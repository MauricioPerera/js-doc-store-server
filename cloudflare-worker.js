/**
 * js-doc-store-server for Cloudflare Workers
 * API REST with js-doc-store + js-vector-store integration
 * Document database + Vector semantic search
 */

import { DocStore, CloudflareKVAdapter as DocStoreKVAdapter, Auth, Table } from 'js-doc-store';
import {
  VectorStore,
  QuantizedStore,
  BinaryQuantizedStore,
  PolarQuantizedStore,
  CloudflareKVAdapter as VectorKVAdapter,
  IVFIndex,
  BM25Index,
  HybridSearch
} from './js-vector-store.js';

// JWT Secret from environment (will be set from env.JWT_SECRET in the handler)

// Vector store configuration
const VECTOR_CONFIG = {
  dimensions: 768,
  storeType: 'binary', // 'float32' | 'int8' | 'binary' | 'polar'
  maxCollections: 50
};

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    // Initialize adapters (same KV, different prefixes)
    const docAdapter = new DocStoreKVAdapter(env.DOC_STORE_KV, 'jsdoc/');
    const vectorAdapter = new VectorKVAdapter(env.DOC_STORE_KV, 'vec/');
    const bm25Adapter = new VectorKVAdapter(env.DOC_STORE_KV, 'bm25/');

    await docAdapter.preloadAll();
    // Vector adapter uses lazy loading, preload on-demand per collection

    // Helper to get file extensions based on store type
    function getVectorExtensions() {
      switch (VECTOR_CONFIG.storeType) {
        case 'float32': return { bin: '.bin', json: '.json' };
        case 'int8':    return { bin: '.q8.bin', json: '.q8.json' };
        case 'binary':  return { bin: '.b1.bin', json: '.b1.json' };
        case 'polar':   return { bin: '.p1.bin', json: '.p1.json' };
        default:        return { bin: '.b1.bin', json: '.b1.json' };
      }
    }

    // Preload vector collection before operations
    async function preloadVectorCollection(collection) {
      const ext = getVectorExtensions();
      await vectorAdapter.preload([collection + ext.bin, collection + ext.json]);
    }

    // Preload BM25 index for a collection
    async function preloadBM25(collection) {
      const state = await env.DOC_STORE_KV.get(`bm25/${collection}.json`, 'json');
      if (state) {
        bm25Store.importState(collection, state);
      }
    }

    // Save BM25 index for a collection
    async function saveBM25(collection) {
      const state = bm25Store.exportState(collection);
      if (state) {
        await env.DOC_STORE_KV.put(`bm25/${collection}.json`, JSON.stringify(state));
      }
    }

    const db = new DocStore(docAdapter);

    // Initialize vector store based on config
    let vectorStore;
    switch (VECTOR_CONFIG.storeType) {
      case 'int8':
        vectorStore = new QuantizedStore(vectorAdapter, VECTOR_CONFIG.dimensions);
        break;
      case 'binary':
        vectorStore = new BinaryQuantizedStore(vectorAdapter, VECTOR_CONFIG.dimensions);
        break;
      case 'polar':
        vectorStore = new PolarQuantizedStore(vectorAdapter, VECTOR_CONFIG.dimensions);
        break;
      default:
        vectorStore = new VectorStore(vectorAdapter, VECTOR_CONFIG.dimensions);
    }

    // Initialize BM25 for hybrid search
    const bm25Store = new BM25Index();

    const auth = new Auth(db, { secret: env.JWT_SECRET || 'default-secret-change-in-production' });
    await auth.init();

    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // Helper to verify JWT and check roles
    async function verifyAuth(request, requiredRole = null) {
      const authHeader = request.headers.get('Authorization');
      if (!authHeader?.startsWith('Bearer ')) {
        return { error: 'No token', status: 401 };
      }
      const token = authHeader.slice(7);
      const payload = await auth.verify(token);
      if (!payload) {
        return { error: 'Invalid token', status: 401 };
      }

      // Check role if required
      if (requiredRole && (!payload.roles || !payload.roles.includes(requiredRole))) {
        return { error: `Required role: ${requiredRole}`, status: 403 };
      }

      return { user: payload };
    }

    // Parse JSON body (only once per request)
    let parsedBody = null;
    const json = async () => {
      if (parsedBody) return parsedBody;
      try {
        parsedBody = await request.json();
        return parsedBody;
      } catch (e) {
        console.error('JSON parse error:', e.message);
        return {};
      }
    };

    // --- PUBLIC ENDPOINTS (no authentication required) ---

    // GET /public/tables - List publicly accessible tables
    if (path === '/public/tables' && request.method === 'GET') {
      // Get list of tables from PUBLIC_TABLES env var
      // If not set, returns empty list (no tables are public by default)
      const PUBLIC_TABLES = (env.PUBLIC_TABLES || '').split(',').filter(Boolean);

      return new Response(JSON.stringify({ success: true, tables: PUBLIC_TABLES }), { headers: corsHeaders });
    }

    // GET /public/query/:table - Query a publicly accessible table
    if (path.startsWith('/public/query/') && request.method === 'GET') {
      const PUBLIC_TABLES = (env.PUBLIC_TABLES || '').split(',').filter(Boolean);
      const tableName = path.split('/').pop();

      // Only allow access to whitelisted public tables
      if (!PUBLIC_TABLES.includes(tableName)) {
        return new Response(JSON.stringify({ success: false, message: 'Table not publicly accessible' }), { status: 403, headers: corsHeaders });
      }

      const table = new Table(db, tableName, { columns: [] });
      const results = table.find({}).toArray();
      return new Response(JSON.stringify({ success: true, data: results }), { headers: corsHeaders });
    }

    // --- AUTH ENDPOINTS ---

    // POST /auth/register - Requires SETUP_TOKEN if configured
    if (path === '/auth/register' && request.method === 'POST') {
      const body = await json();

      // Check if SETUP_TOKEN is configured
      if (env.SETUP_TOKEN) {
        // Require setup_token in request body
        if (body.setup_token !== env.SETUP_TOKEN) {
          return new Response(JSON.stringify({
            success: false,
            message: 'Invalid or missing setup_token. Registration requires a valid setup token.'
          }), { status: 403, headers: corsHeaders });
        }
      }

      try {
        const user = await auth.register(body.email, body.password, { name: body.name });

        // Auto-assign admin role to the first user
        const usersTable = new Table(db, 'users', { columns: [] });
        const userCount = usersTable.find({}).toArray().length;
        if (userCount === 1) {
          await auth.assignRole(user._id, 'admin');
        }

        await db.flush();
        await docAdapter.persist();
        return new Response(JSON.stringify({ success: true, user }), { headers: corsHeaders });
      } catch (e) {
        return new Response(JSON.stringify({ success: false, message: e.message }), { status: 400, headers: corsHeaders });
      }
    }

    // POST /auth/bootstrap - Create first admin user (only works when no users exist)
    if (path === '/auth/bootstrap' && request.method === 'POST') {
      const body = await json();

      try {
        // Check if users already exist
        const usersTable = new Table(db, 'users', { columns: [] });
        const existingUsers = usersTable.find({}).toArray();

        if (existingUsers.length > 0) {
          return new Response(JSON.stringify({
            success: false,
            message: 'Bootstrap can only be used when no users exist. Use /auth/register instead.'
          }), { status: 403, headers: corsHeaders });
        }

        const { email, password, name } = body;
        if (!email || !password) {
          return new Response(JSON.stringify({
            success: false,
            message: 'email and password are required'
          }), { status: 400, headers: corsHeaders });
        }

        // Register the user
        const user = await auth.register(email, password, { name });

        // Assign admin role
        await auth.assignRole(user._id, 'admin');

        // Get updated user with roles
        const updatedUser = usersTable.findById(user._id);

        await db.flush();
        await docAdapter.persist();

        return new Response(JSON.stringify({
          success: true,
          message: 'First admin user created successfully',
          user: { _id: updatedUser._id, email: updatedUser.email, roles: updatedUser.roles }
        }), { headers: corsHeaders });
      } catch (e) {
        return new Response(JSON.stringify({ success: false, message: e.message }), { status: 400, headers: corsHeaders });
      }
    }

    // POST /auth/login
    if (path === '/auth/login' && request.method === 'POST') {
      const body = await json();
      try {
        const result = await auth.login(body.email, body.password);
        await db.flush();
        await docAdapter.persist();
        return new Response(JSON.stringify({ success: true, token: result.token, user: result.user }), { headers: corsHeaders });
      } catch (e) {
        return new Response(JSON.stringify({ success: false, message: e.message }), { status: 401, headers: corsHeaders });
      }
    }

    // --- ADMIN ENDPOINTS (require auth) ---

    // POST /admin/create-table
    if (path === '/admin/create-table' && request.method === 'POST') {
      const authCheck = await verifyAuth(request, 'admin');
      if (authCheck.error) {
        return new Response(JSON.stringify({ success: false, message: authCheck.error }), { status: authCheck.status, headers: corsHeaders });
      }

      const body = await json();
      try {
        const table = new Table(db, body.tableName, { columns: body.columns });
        await db.flush();
        await docAdapter.persist();
        return new Response(JSON.stringify({ success: true, message: `Table ${body.tableName} created` }), { headers: corsHeaders });
      } catch (e) {
        return new Response(JSON.stringify({ success: false, message: e.message }), { status: 400, headers: corsHeaders });
      }
    }

    // POST /admin/insert
    if (path === '/admin/insert' && request.method === 'POST') {
      const authCheck = await verifyAuth(request, 'admin');
      if (authCheck.error) {
        return new Response(JSON.stringify({ success: false, message: authCheck.error }), { status: authCheck.status, headers: corsHeaders });
      }

      const body = await json();
      const table = new Table(db, body.tableName, { columns: [] });
      const doc = table.insert(body.data);
      await db.flush();
      await docAdapter.persist();
      return new Response(JSON.stringify({ success: true, id: doc._id }), { headers: corsHeaders });
    }

    // POST /admin/query
    if (path === '/admin/query' && request.method === 'POST') {
      const authCheck = await verifyAuth(request, 'admin');
      if (authCheck.error) {
        return new Response(JSON.stringify({ success: false, message: authCheck.error }), { status: authCheck.status, headers: corsHeaders });
      }

      const body = await json();
      const table = new Table(db, body.tableName, { columns: [] });
      let query = table.find(body.filter || {});
      if (body.sort) query = query.sort(body.sort);
      if (body.limit) query = query.limit(body.limit);
      const results = query.toArray();
      return new Response(JSON.stringify({ success: true, data: results }), { headers: corsHeaders });
    }

    // POST /admin/update
    if (path === '/admin/update' && request.method === 'POST') {
      const authCheck = await verifyAuth(request, 'admin');
      if (authCheck.error) {
        return new Response(JSON.stringify({ success: false, message: authCheck.error }), { status: authCheck.status, headers: corsHeaders });
      }

      const body = await json();
      const table = new Table(db, body.tableName, { columns: [] });
      const count = table.update(body.filter, body.update);
      await db.flush();
      await docAdapter.persist();
      return new Response(JSON.stringify({ success: true, updated: count }), { headers: corsHeaders });
    }

    // POST /admin/remove
    if (path === '/admin/remove' && request.method === 'POST') {
      const authCheck = await verifyAuth(request, 'admin');
      if (authCheck.error) {
        return new Response(JSON.stringify({ success: false, message: authCheck.error }), { status: authCheck.status, headers: corsHeaders });
      }

      const body = await json();
      const table = new Table(db, body.tableName, { columns: [] });
      const count = table.remove(body.filter);
      await db.flush();
      await docAdapter.persist();
      return new Response(JSON.stringify({ success: true, removed: count }), { headers: corsHeaders });
    }

    // POST /admin/aggregate
    if (path === '/admin/aggregate' && request.method === 'POST') {
      const authCheck = await verifyAuth(request, 'admin');
      if (authCheck.error) {
        return new Response(JSON.stringify({ success: false, message: authCheck.error }), { status: authCheck.status, headers: corsHeaders });
      }

      const body = await json();
      const table = new Table(db, body.tableName, { columns: [] });
      let agg = table.aggregate();
      for (const step of body.pipeline || []) {
        if (step.stage === 'match') agg = agg.match(step.params);
        else if (step.stage === 'lookup') agg = agg.lookup(step.params);
        else if (step.stage === 'group') agg = agg.group(step.params.field, step.params.accumulators);
        else if (step.stage === 'sort') agg = agg.sort(step.params);
        else if (step.stage === 'limit') agg = agg.limit(step.params);
      }
      const results = agg.toArray();
      return new Response(JSON.stringify({ success: true, data: results }), { headers: corsHeaders });
    }

    // --- VECTOR SEARCH ENDPOINTS ---

    // POST /admin/vector/index - Index a document with embedding
    if (path === '/admin/vector/index' && request.method === 'POST') {
      const authCheck = await verifyAuth(request, 'admin');
      if (authCheck.error) {
        return new Response(JSON.stringify({ success: false, message: authCheck.error }), { status: authCheck.status, headers: corsHeaders });
      }

      const body = await json();
      try {
        const { collection = 'default', id, vector, text, metadata = {} } = body;

        if (!id || !vector) {
          return new Response(JSON.stringify({ success: false, message: 'id and vector are required' }), { status: 400, headers: corsHeaders });
        }

        // Preload collection before operation
        await preloadVectorCollection(collection);
        await preloadBM25(collection);

        // Index in vector store
        vectorStore.set(collection, id, vector, metadata);
        vectorStore.flush();

        // Index text in BM25 if provided
        if (text) {
          bm25Store.addDocument(collection, id, text);
          await saveBM25(collection);
        }

        await vectorAdapter.persist();

        return new Response(JSON.stringify({
          success: true,
          message: `Vector indexed in collection ${collection}`,
          id
        }), { headers: corsHeaders });
      } catch (e) {
        return new Response(JSON.stringify({ success: false, message: e.message }), { status: 400, headers: corsHeaders });
      }
    }

    // POST /admin/vector/search - Semantic vector search
    if (path === '/admin/vector/search' && request.method === 'POST') {
      const authCheck = await verifyAuth(request, 'admin');
      if (authCheck.error) {
        return new Response(JSON.stringify({ success: false, message: authCheck.error }), { status: authCheck.status, headers: corsHeaders });
      }

      const body = await json();
      try {
        const {
          collection = 'default',
          vector,
          limit = 10,
          metric = 'cosine',
          dimSlice = 0,
          matryoshka = null
        } = body;

        if (!vector) {
          return new Response(JSON.stringify({ success: false, message: 'vector is required' }), { status: 400, headers: corsHeaders });
        }

        // Preload collection before operation
        await preloadVectorCollection(collection);

        let results;
        if (matryoshka && Array.isArray(matryoshka) && matryoshka.length > 0) {
          // Multi-stage matryoshka search
          results = vectorStore.matryoshkaSearch(collection, vector, limit, matryoshka, metric);
        } else {
          // Standard search
          results = vectorStore.search(collection, vector, limit, dimSlice, metric);
        }

        return new Response(JSON.stringify({ success: true, data: results }), { headers: corsHeaders });
      } catch (e) {
        return new Response(JSON.stringify({ success: false, message: e.message }), { status: 400, headers: corsHeaders });
      }
    }

    // POST /admin/vector/search-hybrid - Hybrid search (vector + BM25)
    if (path === '/admin/vector/search-hybrid' && request.method === 'POST') {
      const authCheck = await verifyAuth(request, 'admin');
      if (authCheck.error) {
        return new Response(JSON.stringify({ success: false, message: authCheck.error }), { status: authCheck.status, headers: corsHeaders });
      }

      const body = await json();
      try {
        const {
          collection = 'default',
          vector,
          text,
          limit = 10,
          metric = 'cosine',
          mode = 'rrf',
          vectorWeight = 0.6,
          textWeight = 0.4,
          rrfK = 60
        } = body;

        if (!vector || !text) {
          return new Response(JSON.stringify({ success: false, message: 'vector and text are required' }), { status: 400, headers: corsHeaders });
        }

        // Preload collection before operation
        await preloadVectorCollection(collection);
        await preloadBM25(collection);

        // Create hybrid search instance
        const hybrid = new HybridSearch(vectorStore, bm25Store, mode);

        // Perform hybrid search
        const results = hybrid.search(collection, vector, text, limit, {
          vectorWeight,
          textWeight,
          rrfK
        });

        return new Response(JSON.stringify({ success: true, data: results }), { headers: corsHeaders });
      } catch (e) {
        return new Response(JSON.stringify({ success: false, message: e.message }), { status: 400, headers: corsHeaders });
      }
    }

    // POST /admin/vector/search-cross - Cross-collection search
    if (path === '/admin/vector/search-cross' && request.method === 'POST') {
      const authCheck = await verifyAuth(request, 'admin');
      if (authCheck.error) {
        return new Response(JSON.stringify({ success: false, message: authCheck.error }), { status: authCheck.status, headers: corsHeaders });
      }

      const body = await json();
      try {
        const { collections, vector, limit = 10, metric = 'cosine' } = body;

        if (!collections || !Array.isArray(collections) || collections.length === 0) {
          return new Response(JSON.stringify({ success: false, message: 'collections array is required' }), { status: 400, headers: corsHeaders });
        }

        if (!vector) {
          return new Response(JSON.stringify({ success: false, message: 'vector is required' }), { status: 400, headers: corsHeaders });
        }

        // Preload all collections
        const ext = getVectorExtensions();
        const files = [];
        for (const col of collections) {
          files.push(col + ext.bin, col + ext.json);
        }
        await vectorAdapter.preload(files);

        const results = vectorStore.searchAcross(collections, vector, limit, metric);

        return new Response(JSON.stringify({ success: true, data: results }), { headers: corsHeaders });
      } catch (e) {
        return new Response(JSON.stringify({ success: false, message: e.message }), { status: 400, headers: corsHeaders });
      }
    }

    // POST /admin/vector/search-cross-hybrid - Cross-collection hybrid search
    if (path === '/admin/vector/search-cross-hybrid' && request.method === 'POST') {
      const authCheck = await verifyAuth(request, 'admin');
      if (authCheck.error) {
        return new Response(JSON.stringify({ success: false, message: authCheck.error }), { status: authCheck.status, headers: corsHeaders });
      }

      const body = await json();
      try {
        const {
          collections,
          vector,
          text,
          limit = 10,
          metric = 'cosine',
          mode = 'rrf',
          vectorWeight = 0.6,
          textWeight = 0.4,
          rrfK = 60
        } = body;

        if (!collections || !Array.isArray(collections) || collections.length === 0) {
          return new Response(JSON.stringify({ success: false, message: 'collections array is required' }), { status: 400, headers: corsHeaders });
        }

        if (!vector || !text) {
          return new Response(JSON.stringify({ success: false, message: 'vector and text are required' }), { status: 400, headers: corsHeaders });
        }

        // Preload all collections and their BM25 indexes
        const ext = getVectorExtensions();
        const files = [];
        for (const col of collections) {
          files.push(col + ext.bin, col + ext.json);
          await preloadBM25(col);
        }
        await vectorAdapter.preload(files);

        // Create hybrid search instance
        const hybrid = new HybridSearch(vectorStore, bm25Store, mode);

        // Perform cross-collection hybrid search
        const results = hybrid.searchAcross(collections, vector, text, limit, {
          vectorWeight,
          textWeight,
          rrfK,
          metric
        });

        return new Response(JSON.stringify({ success: true, data: results }), { headers: corsHeaders });
      } catch (e) {
        return new Response(JSON.stringify({ success: false, message: e.message }), { status: 400, headers: corsHeaders });
      }
    }

    // GET /admin/vector/:collection/:id - Get a specific vector by ID
    if (path.match(/^\/admin\/vector\/[^\/]+\/[^\/]+$/) && request.method === 'GET') {
      const authCheck = await verifyAuth(request, 'admin');
      if (authCheck.error) {
        return new Response(JSON.stringify({ success: false, message: authCheck.error }), { status: authCheck.status, headers: corsHeaders });
      }

      try {
        const parts = path.split('/');
        const collection = parts[3];
        const id = decodeURIComponent(parts[4]);

        // Preload collection before operation
        await preloadVectorCollection(collection);

        const result = vectorStore.get(collection, id);
        if (!result) {
          return new Response(JSON.stringify({ success: false, message: 'Vector not found' }), { status: 404, headers: corsHeaders });
        }

        return new Response(JSON.stringify({ success: true, data: result }), { headers: corsHeaders });
      } catch (e) {
        return new Response(JSON.stringify({ success: false, message: e.message }), { status: 400, headers: corsHeaders });
      }
    }

    // DELETE /admin/vector/:collection/:id - Remove from vector index
    if (path.match(/^\/admin\/vector\/[^\/]+\/[^\/]+$/) && request.method === 'DELETE') {
      const authCheck = await verifyAuth(request, 'admin');
      if (authCheck.error) {
        return new Response(JSON.stringify({ success: false, message: authCheck.error }), { status: authCheck.status, headers: corsHeaders });
      }

      try {
        const parts = path.split('/');
        const collection = parts[3];
        const id = parts[4];

        // Preload collection before operation
        await preloadVectorCollection(collection);
        await preloadBM25(collection);

        const removed = vectorStore.remove(collection, id);
        vectorStore.flush();

        // Also remove from BM25 index
        bm25Store.removeDocument(collection, id);
        await saveBM25(collection);

        await vectorAdapter.persist();

        return new Response(JSON.stringify({ success: true, removed }), { headers: corsHeaders });
      } catch (e) {
        return new Response(JSON.stringify({ success: false, message: e.message }), { status: 400, headers: corsHeaders });
      }
    }

    // GET /admin/vector/stats - Vector store statistics
    if (path === '/admin/vector/stats' && request.method === 'GET') {
      const authCheck = await verifyAuth(request, 'admin');
      if (authCheck.error) {
        return new Response(JSON.stringify({ success: false, message: authCheck.error }), { status: authCheck.status, headers: corsHeaders });
      }

      try {
        // Get collections from KV
        const keys = await vectorAdapter.listKeys();
        const ext = getVectorExtensions().json;
        const collections = [...new Set(keys.filter(k => k.endsWith(ext)).map(k => k.slice(0, -ext.length)))].filter(Boolean);

        const stats = {};
        for (const col of collections) {
          await preloadVectorCollection(col);
          stats[col] = { count: vectorStore.count(col) };
        }

        return new Response(JSON.stringify({
          success: true,
          config: VECTOR_CONFIG,
          collections,
          stats
        }), { headers: corsHeaders });
      } catch (e) {
        return new Response(JSON.stringify({ success: false, message: e.message }), { status: 400, headers: corsHeaders });
      }
    }

    // GET /admin/vector/collections - List vector collections
    if (path === '/admin/vector/collections' && request.method === 'GET') {
      const authCheck = await verifyAuth(request, 'admin');
      if (authCheck.error) {
        return new Response(JSON.stringify({ success: false, message: authCheck.error }), { status: authCheck.status, headers: corsHeaders });
      }

      try {
        // Get collections from KV
        const keys = await vectorAdapter.listKeys();
        const ext = getVectorExtensions().json;
        const collections = [...new Set(keys.filter(k => k.endsWith(ext)).map(k => k.slice(0, -ext.length)))].filter(Boolean);
        const result = [];
        for (const col of collections) {
          await preloadVectorCollection(col);
          result.push({ name: col, count: vectorStore.count(col) });
        }

        return new Response(JSON.stringify({ success: true, collections: result }), { headers: corsHeaders });
      } catch (e) {
        return new Response(JSON.stringify({ success: false, message: e.message }), { status: 400, headers: corsHeaders });
      }
    }

    // POST /admin/vector/drop - Drop a vector collection
    if (path === '/admin/vector/drop' && request.method === 'POST') {
      const authCheck = await verifyAuth(request, 'admin');
      if (authCheck.error) {
        return new Response(JSON.stringify({ success: false, message: authCheck.error }), { status: authCheck.status, headers: corsHeaders });
      }

      const body = await json();
      try {
        const { collection } = body;
        if (!collection) {
          return new Response(JSON.stringify({ success: false, message: 'collection is required' }), { status: 400, headers: corsHeaders });
        }

        // Preload collection before operation
        await preloadVectorCollection(collection);

        vectorStore.drop(collection);
        await vectorAdapter.persist();

        return new Response(JSON.stringify({ success: true, message: `Collection ${collection} dropped` }), { headers: corsHeaders });
      } catch (e) {
        return new Response(JSON.stringify({ success: false, message: e.message }), { status: 400, headers: corsHeaders });
      }
    }

    // POST /admin/vector/batch - Batch index vectors
    if (path === '/admin/vector/batch' && request.method === 'POST') {
      const authCheck = await verifyAuth(request, 'admin');
      if (authCheck.error) {
        return new Response(JSON.stringify({ success: false, message: authCheck.error }), { status: authCheck.status, headers: corsHeaders });
      }

      const body = await json();
      try {
        const { collection = 'default', vectors } = body;

        if (!vectors || !Array.isArray(vectors)) {
          return new Response(JSON.stringify({ success: false, message: 'vectors array is required' }), { status: 400, headers: corsHeaders });
        }

        // Preload collection before operation
        await preloadVectorCollection(collection);

        let indexed = 0;
        for (const item of vectors) {
          if (item.id && item.vector) {
            vectorStore.set(collection, item.id, item.vector, item.metadata || {});
            indexed++;
          }
        }

        vectorStore.flush();
        await vectorAdapter.persist();

        return new Response(JSON.stringify({ success: true, indexed }), { headers: corsHeaders });
      } catch (e) {
        return new Response(JSON.stringify({ success: false, message: e.message }), { status: 400, headers: corsHeaders });
      }
    }

    // --- VAULT ENDPOINTS ---

    // POST /admin/vault/add - Store a secret in vault
    if (path === '/admin/vault/add' && request.method === 'POST') {
      const authCheck = await verifyAuth(request, 'admin');
      if (authCheck.error) {
        return new Response(JSON.stringify({ success: false, message: authCheck.error }), { status: authCheck.status, headers: corsHeaders });
      }

      const body = await json();
      try {
        const { secretId, secretValue, label } = body;
        if (!secretId || !secretValue) {
          return new Response(JSON.stringify({ success: false, message: 'secretId and secretValue are required' }), { status: 400, headers: corsHeaders });
        }

        // Simple encryption using XOR with VAULT_SECRET
        const vaultKey = env.VAULT_SECRET;
        if (!vaultKey) {
          return new Response(JSON.stringify({ success: false, message: 'VAULT_SECRET not configured' }), { status: 500, headers: corsHeaders });
        }

        const encryptedValue = btoa(secretValue.split('').map((char, i) =>
          String.fromCharCode(char.charCodeAt(0) ^ vaultKey.charCodeAt(i % vaultKey.length))
        ).join(''));

        const vault = new Table(db, 'vault', { columns: [] });
        vault.insert({ _id: secretId, label, value: encryptedValue, createdAt: new Date().toISOString() });
        await db.flush();
        await docAdapter.persist();

        return new Response(JSON.stringify({ success: true, message: 'Secret stored securely' }), { headers: corsHeaders });
      } catch (e) {
        return new Response(JSON.stringify({ success: false, message: e.message }), { status: 400, headers: corsHeaders });
      }
    }

    // GET /admin/vault/list - List vault secrets (without values)
    if (path === '/admin/vault/list' && request.method === 'GET') {
      const authCheck = await verifyAuth(request, 'admin');
      if (authCheck.error) {
        return new Response(JSON.stringify({ success: false, message: authCheck.error }), { status: authCheck.status, headers: corsHeaders });
      }

      try {
        const vault = new Table(db, 'vault', { columns: [] });
        const all = vault.find({}).toArray();
        const sanitized = all.map(item => { const { value, ...rest } = item; return rest; });
        return new Response(JSON.stringify({ success: true, secrets: sanitized }), { headers: corsHeaders });
      } catch (e) {
        return new Response(JSON.stringify({ success: false, message: e.message }), { status: 400, headers: corsHeaders });
      }
    }

    // POST /admin/vault/execute - Execute HTTP request using stored secret
    if (path === '/admin/vault/execute' && request.method === 'POST') {
      const authCheck = await verifyAuth(request, 'admin');
      if (authCheck.error) {
        return new Response(JSON.stringify({ success: false, message: authCheck.error }), { status: authCheck.status, headers: corsHeaders });
      }

      const body = await json();
      try {
        const { secretId, url, method = 'GET', body: reqBody = {}, headerType = 'bearer' } = body;

        const vault = new Table(db, 'vault', { columns: [] });
        const secretDoc = vault.findById(secretId);
        if (!secretDoc) {
          return new Response(JSON.stringify({ success: false, message: 'Secret not found' }), { status: 404, headers: corsHeaders });
        }

        // Decrypt
        const vaultKey = env.VAULT_SECRET;
        if (!vaultKey) {
          return new Response(JSON.stringify({ success: false, message: 'VAULT_SECRET not configured' }), { status: 500, headers: corsHeaders });
        }

        const encrypted = atob(secretDoc.value);
        const decryptedValue = encrypted.split('').map((char, i) =>
          String.fromCharCode(char.charCodeAt(0) ^ vaultKey.charCodeAt(i % vaultKey.length))
        ).join('');

        // Build headers based on headerType parameter
        // headerType options: 'bearer', 'api-key', 'basic', 'custom'
        let headers = {};
        switch (headerType) {
          case 'bearer':
            headers = { 'Authorization': `Bearer ${decryptedValue}` };
            break;
          case 'api-key':
            headers = { 'X-API-Key': decryptedValue };
            break;
          case 'x-api-key':
            headers = { 'X-API-KEY': decryptedValue };
            break;
          case 'basic':
            headers = { 'Authorization': `Basic ${btoa(decryptedValue)}` };
            break;
          case 'custom':
            // For custom, expect headerName and headerValueFormat
            // e.g., headerName: 'Api-Key', headerValueFormat: 'prefix-{value}'
            const customHeaderName = body.headerName || 'Authorization';
            const valueFormat = body.headerValueFormat || '{value}';
            headers[customHeaderName] = valueFormat.replace('{value}', decryptedValue);
            break;
          default:
            headers = { 'Authorization': `Bearer ${decryptedValue}` };
        }

        // Add Content-Type for POST/PUT
        if (method === 'POST' || method === 'PUT') {
          headers['Content-Type'] = 'application/json';
        }

        const response = await fetch(url, {
          method,
          headers,
          body: (method === 'POST' || method === 'PUT') ? JSON.stringify(reqBody) : undefined
        });

        const data = await response.text();
        let parsedData;
        try {
          parsedData = JSON.parse(data);
        } catch {
          parsedData = data;
        }

        return new Response(JSON.stringify({
          success: true,
          status: response.status,
          data: parsedData
        }), { headers: corsHeaders });
      } catch (e) {
        return new Response(JSON.stringify({ success: false, message: e.message }), { status: 500, headers: corsHeaders });
      }
    }

    // Default: 404
    return new Response(JSON.stringify({ success: false, message: 'Not found' }), { status: 404, headers: corsHeaders });
  }
};

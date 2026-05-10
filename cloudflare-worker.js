/**
 * js-doc-store-server for Cloudflare Workers
 * API REST with js-doc-store + js-vector-store integration
 * Document database + Vector semantic search
 */

import { DocStore, CloudflareKVAdapter, Auth, Table } from 'js-doc-store';
import {
  VectorStore,
  QuantizedStore,
  BinaryQuantizedStore,
  PolarQuantizedStore,
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
    const docAdapter = new CloudflareKVAdapter(env.DOC_STORE_KV, 'jsdoc/');
    const vectorAdapter = new CloudflareKVAdapter(env.DOC_STORE_KV, 'vec/');

    await docAdapter.preloadAll();
    await vectorAdapter.preloadAll();

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

    // Helper to verify JWT
    async function verifyAuth(request) {
      const authHeader = request.headers.get('Authorization');
      if (!authHeader?.startsWith('Bearer ')) {
        return { error: 'No token', status: 401 };
      }
      const token = authHeader.slice(7);
      const payload = await auth.verify(token);
      if (!payload) {
        return { error: 'Invalid token', status: 401 };
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

    // --- PUBLIC ENDPOINTS (require auth if JWT_SECRET is configured) ---

    // GET /public/tables
    if (path === '/public/tables' && request.method === 'GET') {
      // Require auth if JWT_SECRET is configured
      if (env.JWT_SECRET) {
        const authCheck = await verifyAuth(request);
        if (authCheck.error) {
          return new Response(JSON.stringify({ success: false, message: authCheck.error }), { status: authCheck.status, headers: corsHeaders });
        }
      }

      const keys = await docAdapter.listKeys();
      const tables = [...new Set(keys.filter(k => k.endsWith('.docs.json')).map(k => k.replace('.docs.json', '')))];
      return new Response(JSON.stringify({ success: true, tables }), { headers: corsHeaders });
    }

    // GET /public/query/:table
    if (path.startsWith('/public/query/') && request.method === 'GET') {
      // Require auth if JWT_SECRET is configured
      if (env.JWT_SECRET) {
        const authCheck = await verifyAuth(request);
        if (authCheck.error) {
          return new Response(JSON.stringify({ success: false, message: authCheck.error }), { status: authCheck.status, headers: corsHeaders });
        }
      }

      const tableName = path.split('/').pop();
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
        await db.flush();
        await docAdapter.persist();
        return new Response(JSON.stringify({ success: true, user }), { headers: corsHeaders });
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
      const authCheck = await verifyAuth(request);
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
      const authCheck = await verifyAuth(request);
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
      const authCheck = await verifyAuth(request);
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
      const authCheck = await verifyAuth(request);
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
      const authCheck = await verifyAuth(request);
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
      const authCheck = await verifyAuth(request);
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
      const authCheck = await verifyAuth(request);
      if (authCheck.error) {
        return new Response(JSON.stringify({ success: false, message: authCheck.error }), { status: authCheck.status, headers: corsHeaders });
      }

      const body = await json();
      try {
        const { collection = 'default', id, vector, text, metadata = {} } = body;

        if (!id || !vector) {
          return new Response(JSON.stringify({ success: false, message: 'id and vector are required' }), { status: 400, headers: corsHeaders });
        }

        // Index in vector store
        vectorStore.set(collection, id, vector, metadata);
        vectorStore.flush();

        // Index text in BM25 if provided
        if (text) {
          bm25Store.addDocument(collection, id, text);
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
      const authCheck = await verifyAuth(request);
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
      const authCheck = await verifyAuth(request);
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
      const authCheck = await verifyAuth(request);
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

        const results = vectorStore.searchAcross(collections, vector, limit, metric);

        return new Response(JSON.stringify({ success: true, data: results }), { headers: corsHeaders });
      } catch (e) {
        return new Response(JSON.stringify({ success: false, message: e.message }), { status: 400, headers: corsHeaders });
      }
    }

    // DELETE /admin/vector/:collection/:id - Remove from vector index
    if (path.match(/^\/admin\/vector\/[^\/]+\/[^\/]+$/) && request.method === 'DELETE') {
      const authCheck = await verifyAuth(request);
      if (authCheck.error) {
        return new Response(JSON.stringify({ success: false, message: authCheck.error }), { status: authCheck.status, headers: corsHeaders });
      }

      try {
        const parts = path.split('/');
        const collection = parts[3];
        const id = parts[4];

        const removed = vectorStore.remove(collection, id);
        vectorStore.flush();
        await vectorAdapter.persist();

        return new Response(JSON.stringify({ success: true, removed }), { headers: corsHeaders });
      } catch (e) {
        return new Response(JSON.stringify({ success: false, message: e.message }), { status: 400, headers: corsHeaders });
      }
    }

    // GET /admin/vector/stats - Vector store statistics
    if (path === '/admin/vector/stats' && request.method === 'GET') {
      const authCheck = await verifyAuth(request);
      if (authCheck.error) {
        return new Response(JSON.stringify({ success: false, message: authCheck.error }), { status: authCheck.status, headers: corsHeaders });
      }

      try {
        const stats = vectorStore.stats();
        const collections = vectorStore.collections();

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
      const authCheck = await verifyAuth(request);
      if (authCheck.error) {
        return new Response(JSON.stringify({ success: false, message: authCheck.error }), { status: authCheck.status, headers: corsHeaders });
      }

      try {
        const collections = vectorStore.collections();
        const result = collections.map(col => ({
          name: col,
          count: vectorStore.count(col)
        }));

        return new Response(JSON.stringify({ success: true, collections: result }), { headers: corsHeaders });
      } catch (e) {
        return new Response(JSON.stringify({ success: false, message: e.message }), { status: 400, headers: corsHeaders });
      }
    }

    // POST /admin/vector/drop - Drop a vector collection
    if (path === '/admin/vector/drop' && request.method === 'POST') {
      const authCheck = await verifyAuth(request);
      if (authCheck.error) {
        return new Response(JSON.stringify({ success: false, message: authCheck.error }), { status: authCheck.status, headers: corsHeaders });
      }

      const body = await json();
      try {
        const { collection } = body;
        if (!collection) {
          return new Response(JSON.stringify({ success: false, message: 'collection is required' }), { status: 400, headers: corsHeaders });
        }

        vectorStore.drop(collection);
        await vectorAdapter.persist();

        return new Response(JSON.stringify({ success: true, message: `Collection ${collection} dropped` }), { headers: corsHeaders });
      } catch (e) {
        return new Response(JSON.stringify({ success: false, message: e.message }), { status: 400, headers: corsHeaders });
      }
    }

    // POST /admin/vector/batch - Batch index vectors
    if (path === '/admin/vector/batch' && request.method === 'POST') {
      const authCheck = await verifyAuth(request);
      if (authCheck.error) {
        return new Response(JSON.stringify({ success: false, message: authCheck.error }), { status: authCheck.status, headers: corsHeaders });
      }

      const body = await json();
      try {
        const { collection = 'default', vectors } = body;

        if (!vectors || !Array.isArray(vectors)) {
          return new Response(JSON.stringify({ success: false, message: 'vectors array is required' }), { status: 400, headers: corsHeaders });
        }

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

    // Default: 404
    return new Response(JSON.stringify({ success: false, message: 'Not found' }), { status: 404, headers: corsHeaders });
  }
};

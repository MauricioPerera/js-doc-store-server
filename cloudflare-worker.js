/**
 * js-doc-store-server for Cloudflare Workers
 * API REST with js-doc-store + js-vector-store integration
 * Document database + Vector semantic search
 */

import { DocStore, CloudflareKVAdapter as DocStoreKVAdapter, Auth, Table } from './js-doc-store.js';
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

// Embedding worker configuration
const EMBEDDING_CONFIG = {
  // URL of the Gemma embedding worker
  workerUrl: null, // Will be set from env.EMBEDDING_WORKER_URL
  apiKey: null,    // Will be set from env.EMBEDDING_API_KEY
  // Default dimensions for embeddings
  defaultDimensions: 768,
  // Fields to auto-embed (can be overridden per request)
  autoEmbedFields: ['content', 'text', 'description', 'body']
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

    // Initialize embedding config from environment
    EMBEDDING_CONFIG.workerUrl = env.EMBEDDING_WORKER_URL || null;
    EMBEDDING_CONFIG.apiKey = env.EMBEDDING_API_KEY || null;

    // Metrics tracking
    const METRICS_PREFIX = 'metrics:';
    const CURRENT_HOUR = new Date().toISOString().slice(0, 13); // YYYY-MM-DDTHH

    async function trackMetric(metricType, value = 1) {
      const key = `${METRICS_PREFIX}${metricType}:${CURRENT_HOUR}`;
      const current = await env.DOC_STORE_KV.get(key, 'json') || { count: 0, hour: CURRENT_HOUR };
      current.count += value;
      await env.DOC_STORE_KV.put(key, JSON.stringify(current), { expirationTtl: 86400 * 30 }); // 30 days
    }

    async function getMetrics(hours = 24) {
      const metrics = {};
      const now = new Date();
      for (let i = 0; i < hours; i++) {
        const date = new Date(now.getTime() - i * 3600000);
        const hourKey = date.toISOString().slice(0, 13);
        const requests = await env.DOC_STORE_KV.get(`${METRICS_PREFIX}requests:${hourKey}`, 'json');
        const errors = await env.DOC_STORE_KV.get(`${METRICS_PREFIX}errors:${hourKey}`, 'json');
        const embeddings = await env.DOC_STORE_KV.get(`${METRICS_PREFIX}embeddings:${hourKey}`, 'json');
        if (requests || errors || embeddings) {
          metrics[hourKey] = {
            requests: requests?.count || 0,
            errors: errors?.count || 0,
            embeddings: embeddings?.count || 0
          };
        }
      }
      return metrics;
    }

    /**
     * Generate embedding via Cloudflare AI (direct binding)
     * @param {string} text - Text to embed
     * @param {number} dimensions - Desired dimensions (optional)
     * @returns {Promise<number[]>} - Embedding vector
     */
    async function generateEmbedding(text, dimensions = null) {
      // Use Cloudflare AI binding directly if available
      if (env.AI) {
        const targetDimensions = dimensions || EMBEDDING_CONFIG.defaultDimensions;
        const result = await env.AI.run('@cf/google/embeddinggemma-300m', { text });

        if (!result.data?.[0]) {
          throw new Error('Invalid embedding response from AI');
        }

        const fullEmbedding = result.data[0];

        // Return truncated embedding if Matryoshka dimensions requested
        if (targetDimensions && targetDimensions < fullEmbedding.length) {
          return fullEmbedding.slice(0, targetDimensions);
        }

        return fullEmbedding;
      }

      // Fallback to external embedding worker
      if (!EMBEDDING_CONFIG.workerUrl) {
        throw new Error('AI binding not available and EMBEDDING_WORKER_URL not configured');
      }

      const targetDimensions = dimensions || EMBEDDING_CONFIG.defaultDimensions;
      const endpoint = targetDimensions !== 2048 ? '/embed/matryoshka' : '/embed';

      const response = await fetch(`${EMBEDDING_CONFIG.workerUrl}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${EMBEDDING_CONFIG.apiKey}`
        },
        body: JSON.stringify({
          text,
          dimensions: targetDimensions
        })
      });

      const responseText = await response.text();
      let result;
      try {
        result = JSON.parse(responseText);
      } catch (e) {
        throw new Error(`Embedding worker returned invalid JSON: ${responseText.substring(0, 100)}`);
      }

      if (!result.success) {
        throw new Error(`Embedding worker error: ${result.message || response.status}`);
      }

      if (!result.embeddings?.[0]?.embedding) {
        throw new Error('Invalid embedding response');
      }

      return result.embeddings[0].embedding;
    }

    /**
     * Extract text from document for embedding
     * @param {Object} doc - Document data
     * @param {string[]} fields - Fields to extract
     * @returns {string} - Combined text
     */
    function extractTextForEmbedding(doc, fields = null) {
      const targetFields = fields || EMBEDDING_CONFIG.autoEmbedFields;
      const texts = [];

      for (const field of targetFields) {
        if (doc[field] && typeof doc[field] === 'string') {
          texts.push(doc[field]);
        }
      }

      return texts.join(' ').trim();
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

    // Rate limiting configuration
    const RATE_LIMIT_CONFIG = {
      // Public endpoints: 60 requests per minute per IP
      public: { requests: 60, window: 60 },
      // Authenticated endpoints: 300 requests per minute per user
      authenticated: { requests: 300, window: 60 },
      // Embedding endpoints (higher cost): 30 requests per minute
      embedding: { requests: 30, window: 60 }
    };

    /**
     * Simple rate limiter using KV store
     * Tracks requests per IP/user within time windows
     */
    async function checkRateLimit(identifier, config) {
      const key = `ratelimit:${identifier}:${Math.floor(Date.now() / (config.window * 1000))}`;
      const current = await env.DOC_STORE_KV.get(key, 'json') || { count: 0, reset: Date.now() + config.window * 1000 };

      if (current.count >= config.requests) {
        return {
          allowed: false,
          retryAfter: Math.ceil((current.reset - Date.now()) / 1000)
        };
      }

      // Increment counter
      current.count++;
      await env.DOC_STORE_KV.put(key, JSON.stringify(current), { expirationTtl: config.window + 1 });

      return {
        allowed: true,
        limit: config.requests,
        remaining: config.requests - current.count,
        reset: new Date(current.reset).toISOString()
      };
    }

    /**
     * Get rate limit headers for response
     */
    function getRateLimitHeaders(rateLimitResult) {
      if (!rateLimitResult) return {};
      return {
        'X-RateLimit-Limit': rateLimitResult.limit?.toString(),
        'X-RateLimit-Remaining': rateLimitResult.remaining?.toString(),
        'X-RateLimit-Reset': rateLimitResult.reset
      };
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

    // Apply rate limiting to public endpoints
    const clientIP = request.headers.get('CF-Connecting-IP') || 'unknown';

    // GET /public/tables - List publicly accessible tables
    if (path === '/public/tables' && request.method === 'GET') {
      // Rate limit check
      const rateLimit = await checkRateLimit(`public:${clientIP}`, RATE_LIMIT_CONFIG.public);
      const rateLimitHeaders = getRateLimitHeaders(rateLimit);

      if (!rateLimit.allowed) {
        return new Response(JSON.stringify({
          success: false,
          message: 'Rate limit exceeded. Please try again later.'
        }), {
          status: 429,
          headers: { ...corsHeaders, ...rateLimitHeaders, 'Retry-After': rateLimit.retryAfter.toString() }
        });
      }

      // Get list of tables from PUBLIC_TABLES env var
      // If not set, returns empty list (no tables are public by default)
      const PUBLIC_TABLES = (env.PUBLIC_TABLES || '').split(',').filter(Boolean);

      return new Response(JSON.stringify({ success: true, tables: PUBLIC_TABLES }), {
        headers: { ...corsHeaders, ...rateLimitHeaders }
      });
    }

    // GET /public/query/:table - Query a publicly accessible table
    if (path.startsWith('/public/query/') && request.method === 'GET') {
      // Rate limit check
      const rateLimit = await checkRateLimit(`public:${clientIP}`, RATE_LIMIT_CONFIG.public);
      const rateLimitHeaders = getRateLimitHeaders(rateLimit);

      if (!rateLimit.allowed) {
        return new Response(JSON.stringify({
          success: false,
          message: 'Rate limit exceeded. Please try again later.'
        }), {
          status: 429,
          headers: { ...corsHeaders, ...rateLimitHeaders, 'Retry-After': rateLimit.retryAfter.toString() }
        });
      }

      const PUBLIC_TABLES = (env.PUBLIC_TABLES || '').split(',').filter(Boolean);
      const tableName = path.split('/').pop();

      // Only allow access to whitelisted public tables
      if (!PUBLIC_TABLES.includes(tableName)) {
        return new Response(JSON.stringify({ success: false, message: 'Table not publicly accessible' }), { status: 403, headers: corsHeaders });
      }

      const table = new Table(db, tableName, { columns: [] });
      const results = table.find({}).toArray();
      return new Response(JSON.stringify({ success: true, data: results }), {
        headers: { ...corsHeaders, ...rateLimitHeaders }
      });
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
        await trackMetric('requests', 1);
        return new Response(JSON.stringify({ success: true, token: result.token, user: result.user }), { headers: corsHeaders });
      } catch (e) {
        await trackMetric('errors', 1);
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

    // --- EMBEDDING INTEGRATION ENDPOINTS ---

    // POST /admin/embed - Generate embedding for text
    if (path === '/admin/embed' && request.method === 'POST') {
      const authCheck = await verifyAuth(request, 'admin');
      if (authCheck.error) {
        return new Response(JSON.stringify({ success: false, message: authCheck.error }), { status: authCheck.status, headers: corsHeaders });
      }

      // Rate limit check for embedding endpoints (stricter due to AI cost)
      const userId = authCheck.user?.sub || authCheck.user?._id || 'unknown';
      const rateLimit = await checkRateLimit(`embed:${userId}`, RATE_LIMIT_CONFIG.embedding);
      const rateLimitHeaders = getRateLimitHeaders(rateLimit);

      if (!rateLimit.allowed) {
        return new Response(JSON.stringify({
          success: false,
          message: 'Embedding rate limit exceeded. Please try again later.'
        }), {
          status: 429,
          headers: { ...corsHeaders, ...rateLimitHeaders, 'Retry-After': rateLimit.retryAfter.toString() }
        });
      }

      const body = await json();
      try {
        const { text, dimensions } = body;

        if (!text) {
          return new Response(JSON.stringify({ success: false, message: 'text is required' }), { status: 400, headers: corsHeaders });
        }

        const embedding = await generateEmbedding(text, dimensions);

        await trackMetric('embeddings', 1);
        return new Response(JSON.stringify({
          success: true,
          model: '@cf/google/embeddinggemma-300m',
          dimensions: embedding.length,
          embedding
        }), { headers: { ...corsHeaders, ...rateLimitHeaders } });

      } catch (e) {
        await trackMetric('errors', 1);
        return new Response(JSON.stringify({ success: false, message: e.message }), { status: 500, headers: corsHeaders });
      }
    }

    // POST /admin/vector/index-with-text - Index document with auto-generated embedding
    if (path === '/admin/vector/index-with-text' && request.method === 'POST') {
      const authCheck = await verifyAuth(request, 'admin');
      if (authCheck.error) {
        return new Response(JSON.stringify({ success: false, message: authCheck.error }), { status: authCheck.status, headers: corsHeaders });
      }

      // Rate limit check
      const userId = authCheck.user?.sub || authCheck.user?._id || 'unknown';
      const rateLimit = await checkRateLimit(`embed:${userId}`, RATE_LIMIT_CONFIG.embedding);
      const rateLimitHeaders = getRateLimitHeaders(rateLimit);

      if (!rateLimit.allowed) {
        return new Response(JSON.stringify({
          success: false,
          message: 'Embedding rate limit exceeded. Please try again later.'
        }), {
          status: 429,
          headers: { ...corsHeaders, ...rateLimitHeaders, 'Retry-After': rateLimit.retryAfter.toString() }
        });
      }

      const body = await json();
      try {
        const {
          collection = 'default',
          id,
          text,
          doc, // Document data for auto-extracting text
          metadata = {},
          dimensions
        } = body;

        if (!id) {
          return new Response(JSON.stringify({ success: false, message: 'id is required' }), { status: 400, headers: corsHeaders });
        }

        // Get text to embed
        let textToEmbed = text;
        if (!textToEmbed && doc) {
          textToEmbed = extractTextForEmbedding(doc);
        }

        if (!textToEmbed) {
          return new Response(JSON.stringify({
            success: false,
            message: 'Provide "text" or "doc" with embeddable fields'
          }), { status: 400, headers: corsHeaders });
        }

        // Generate embedding
        const embedding = await generateEmbedding(textToEmbed, dimensions);

        // Preload collection
        await preloadVectorCollection(collection);

        // Index in vector store
        vectorStore.set(collection, id, embedding, { ...metadata, text: textToEmbed.substring(0, 500) });
        vectorStore.flush();
        await vectorAdapter.persist();

        return new Response(JSON.stringify({
          success: true,
          message: `Document indexed in collection ${collection}`,
          id,
          textLength: textToEmbed.length,
          embeddingDimensions: embedding.length
        }), { headers: { ...corsHeaders, ...rateLimitHeaders } });

      } catch (e) {
        return new Response(JSON.stringify({ success: false, message: e.message }), { status: 500, headers: corsHeaders });
      }
    }

    // POST /admin/vector/search-by-text - Search vectors using text query
    if (path === '/admin/vector/search-by-text' && request.method === 'POST') {
      const authCheck = await verifyAuth(request, 'admin');
      if (authCheck.error) {
        return new Response(JSON.stringify({ success: false, message: authCheck.error }), { status: authCheck.status, headers: corsHeaders });
      }

      // Rate limit check
      const userId = authCheck.user?.sub || authCheck.user?._id || 'unknown';
      const rateLimit = await checkRateLimit(`embed:${userId}`, RATE_LIMIT_CONFIG.embedding);
      const rateLimitHeaders = getRateLimitHeaders(rateLimit);

      if (!rateLimit.allowed) {
        return new Response(JSON.stringify({
          success: false,
          message: 'Embedding rate limit exceeded. Please try again later.'
        }), {
          status: 429,
          headers: { ...corsHeaders, ...rateLimitHeaders, 'Retry-After': rateLimit.retryAfter.toString() }
        });
      }

      const body = await json();
      try {
        const {
          collection = 'default',
          query,
          limit = 10,
          metric = 'cosine',
          dimensions
        } = body;

        if (!query) {
          return new Response(JSON.stringify({ success: false, message: 'query text is required' }), { status: 400, headers: corsHeaders });
        }

        // Generate embedding for query
        const queryEmbedding = await generateEmbedding(query, dimensions);

        // Preload collection
        await preloadVectorCollection(collection);

        // Search
        const results = vectorStore.search(collection, queryEmbedding, limit, 0, metric);

        await trackMetric('embeddings', 1);
        await trackMetric('requests', 1);
        return new Response(JSON.stringify({
          success: true,
          query,
          collection,
          count: results.length,
          data: results
        }), { headers: { ...corsHeaders, ...rateLimitHeaders } });

      } catch (e) {
        await trackMetric('errors', 1);
        return new Response(JSON.stringify({ success: false, message: e.message }), { status: 500, headers: corsHeaders });
      }
    }

    // POST /admin/vector/batch-index-with-text - Batch index documents with embeddings
    if (path === '/admin/vector/batch-index-with-text' && request.method === 'POST') {
      const authCheck = await verifyAuth(request, 'admin');
      if (authCheck.error) {
        return new Response(JSON.stringify({ success: false, message: authCheck.error }), { status: authCheck.status, headers: corsHeaders });
      }

      // Rate limit check (stricter for batch - uses 1 limit per document or minimum)
      const userId = authCheck.user?.sub || authCheck.user?._id || 'unknown';
      const body = await json();
      const docCount = body.documents?.length || 1;

      // Batch requests consume rate limit based on document count
      const batchRateLimit = {
        requests: Math.max(1, Math.floor(RATE_LIMIT_CONFIG.embedding.requests / 5)),
        window: RATE_LIMIT_CONFIG.embedding.window
      };

      const rateLimit = await checkRateLimit(`embed-batch:${userId}`, batchRateLimit);
      const rateLimitHeaders = getRateLimitHeaders(rateLimit);

      if (!rateLimit.allowed) {
        return new Response(JSON.stringify({
          success: false,
          message: 'Batch embedding rate limit exceeded. Please try again later.'
        }), {
          status: 429,
          headers: { ...corsHeaders, ...rateLimitHeaders, 'Retry-After': rateLimit.retryAfter.toString() }
        });
      }

      try {
        const {
          collection = 'default',
          documents,
          textField = 'content',
          dimensions
        } = body;

        if (!documents || !Array.isArray(documents)) {
          return new Response(JSON.stringify({ success: false, message: 'documents array is required' }), { status: 400, headers: corsHeaders });
        }

        const indexed = [];
        const failed = [];

        // Preload collection
        await preloadVectorCollection(collection);

        for (const doc of documents) {
          try {
            const id = doc._id || doc.id || crypto.randomUUID();
            const text = doc[textField] || extractTextForEmbedding(doc);

            if (!text) {
              failed.push({ id, reason: 'No text content found' });
              continue;
            }

            const embedding = await generateEmbedding(text, dimensions);
            vectorStore.set(collection, id, embedding, { ...doc, text: text.substring(0, 500) });

            indexed.push({ id, textLength: text.length });
          } catch (e) {
            failed.push({ id: doc._id || doc.id, reason: e.message });
          }
        }

        vectorStore.flush();
        await vectorAdapter.persist();

        return new Response(JSON.stringify({
          success: true,
          collection,
          indexed: indexed.length,
          failed: failed.length,
          indexedIds: indexed.map(i => i.id),
          failedDetails: failed
        }), { headers: { ...corsHeaders, ...rateLimitHeaders } });

      } catch (e) {
        return new Response(JSON.stringify({ success: false, message: e.message }), { status: 500, headers: corsHeaders });
      }
    }

    // --- METRICS ENDPOINT ---

    // GET /admin/metrics - Get usage metrics
    if (path === '/admin/metrics' && request.method === 'GET') {
      const authCheck = await verifyAuth(request, 'admin');
      if (authCheck.error) {
        return new Response(JSON.stringify({ success: false, message: authCheck.error }), { status: authCheck.status, headers: corsHeaders });
      }

      const url = new URL(request.url);
      const hours = parseInt(url.searchParams.get('hours')) || 24;

      const metrics = await getMetrics(hours);
      const totalRequests = Object.values(metrics).reduce((sum, m) => sum + (m.requests || 0), 0);
      const totalErrors = Object.values(metrics).reduce((sum, m) => sum + (m.errors || 0), 0);
      const totalEmbeddings = Object.values(metrics).reduce((sum, m) => sum + (m.embeddings || 0), 0);

      return new Response(JSON.stringify({
        success: true,
        period: `${hours}h`,
        summary: {
          totalRequests,
          totalErrors,
          totalEmbeddings,
          errorRate: totalRequests > 0 ? ((totalErrors / totalRequests) * 100).toFixed(2) + '%' : '0%'
        },
        hourly: metrics
      }), { headers: corsHeaders });
    }

    // POST /admin/errors/report - Report client-side errors
    if (path === '/admin/errors/report' && request.method === 'POST') {
      const body = await json();

      // Store error in KV for analysis
      const errorLog = {
        timestamp: new Date().toISOString(),
        userAgent: request.headers.get('User-Agent'),
        ip: request.headers.get('CF-Connecting-IP'),
        error: body.error,
        context: body.context,
        url: body.url
      };

      const errorKey = `error:${Date.now()}:${Math.random().toString(36).substr(2, 9)}`;
      await env.DOC_STORE_KV.put(errorKey, JSON.stringify(errorLog), { expirationTtl: 86400 * 7 }); // 7 days

      // Track error metric
      await trackMetric('errors', 1);

      return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
    }

    // GET /admin/errors - Get recent errors (admin only)
    if (path === '/admin/errors' && request.method === 'GET') {
      const authCheck = await verifyAuth(request, 'admin');
      if (authCheck.error) {
        return new Response(JSON.stringify({ success: false, message: authCheck.error }), { status: authCheck.status, headers: corsHeaders });
      }

      // List recent errors
      const keys = await env.DOC_STORE_KV.list({ prefix: 'error:' });
      const errors = [];

      for (const key of keys.keys.slice(0, 50)) { // Last 50 errors
        const errorData = await env.DOC_STORE_KV.get(key.name, 'json');
        if (errorData) {
          errors.push(errorData);
        }
      }

      return new Response(JSON.stringify({
        success: true,
        count: errors.length,
        errors: errors.reverse() // Newest first
      }), { headers: corsHeaders });
    }

    // GET /health - Health check endpoint
    if (path === '/health' && request.method === 'GET') {
      // Check KV connectivity
      let kvStatus = 'unknown';
      try {
        await env.DOC_STORE_KV.put('health-check', 'ok', { expirationTtl: 60 });
        kvStatus = 'connected';
      } catch (e) {
        kvStatus = 'error: ' + e.message;
      }

      return new Response(JSON.stringify({
        success: true,
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: '1.2.0',
        features: {
          embeddings: !!env.AI,
          kv: kvStatus,
          rateLimiting: true,
          metrics: true
        }
      }), { headers: corsHeaders });
    }

    // Static Assets (Admin UI) - Serve from ASSETS binding
    if (env.ASSETS) {
      try {
        // Try to serve static assets from the public directory
        const assetResponse = await env.ASSETS.fetch(request);
        if (assetResponse.status !== 404) {
          return assetResponse;
        }
      } catch (e) {
        // Asset not found, continue to API 404
      }
    }

    // Default: 404
    await trackMetric('errors', 1);
    return new Response(JSON.stringify({ success: false, message: 'Not found' }), { status: 404, headers: corsHeaders });
  }
};

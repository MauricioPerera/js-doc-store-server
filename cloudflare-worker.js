/**
 * js-doc-store-server for Cloudflare Workers
 * API REST compatible using Cloudflare KV
 */

import { DocStore, CloudflareKVAdapter, Auth, Table } from 'js-doc-store';

// JWT Secret from environment
const JWT_SECRET = 'pi-sovereign-jwt-secret-2026';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    // Initialize adapter with KV binding
    const adapter = new CloudflareKVAdapter(env.DOC_STORE_KV, 'jsdoc/');
    await adapter.preloadAll();
    const db = new DocStore(adapter);

    const auth = new Auth(db, { secret: JWT_SECRET });
    await auth.init();

    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
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

    // Parse JSON body
    const json = async () => {
      try {
        return await request.json();
      } catch {
        return {};
      }
    };

    // --- PUBLIC ENDPOINTS ---

    // GET /public/tables
    if (path === '/public/tables' && request.method === 'GET') {
      const keys = await adapter.listKeys();
      const tables = [...new Set(keys.filter(k => k.endsWith('.docs.json')).map(k => k.replace('.docs.json', '')))];
      return new Response(JSON.stringify({ success: true, tables }), { headers: corsHeaders });
    }

    // GET /public/query/:table
    if (path.startsWith('/public/query/') && request.method === 'GET') {
      const tableName = path.split('/').pop();
      const table = new Table(db, tableName, { columns: [] });
      const results = table.find({}).toArray();
      return new Response(JSON.stringify({ success: true, data: results }), { headers: corsHeaders });
    }

    // --- AUTH ENDPOINTS ---

    // POST /auth/register
    if (path === '/auth/register' && request.method === 'POST') {
      const body = await json();
      try {
        const user = await auth.register(body.email, body.password, { name: body.name });
        await db.flush();
        await adapter.persist();
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
        await adapter.persist();
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
      await adapter.persist();
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

    // Default: 404
    return new Response(JSON.stringify({ success: false, message: 'Not found' }), { status: 404, headers: corsHeaders });
  }
};

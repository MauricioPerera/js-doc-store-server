const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const fsBoot = require('fs');
const envPath = path.resolve(__dirname, '.env');
if (fsBoot.existsSync(envPath)) {
    const result = dotenv.config({ path: envPath });
    if (result.error) {
        console.error('Dotenv error:', result.error);
        process.exit(1);
    }
}
const { DocStore, FileStorageAdapter, EncryptedAdapter, Table, Auth, FieldCrypto, createFromTemplate } = require('./js-doc-store.js');
const { VectorStore, QuantizedStore, BinaryQuantizedStore, PolarQuantizedStore, BM25Index, HybridSearch } = require('./js-vector-store.js');
const fs = require('fs');
const axios = require('axios');

// Simple file storage adapter for js-vector-store (avoids ESM/CJS interop issues)
class SimpleFileStorageAdapter {
    constructor(dir) {
        this.dir = dir;
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    }
    readBin(filename) {
        const file = path.join(this.dir, filename);
        if (!fs.existsSync(file)) return null;
        const buf = fs.readFileSync(file);
        return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
    }
    writeBin(filename, buffer) {
        const file = path.join(this.dir, filename);
        fs.writeFileSync(file, Buffer.from(buffer));
    }
    readJson(filename) {
        const file = path.join(this.dir, filename);
        if (!fs.existsSync(file)) return null;
        return JSON.parse(fs.readFileSync(file, 'utf-8'));
    }
    writeJson(filename, data) {
        const file = path.join(this.dir, filename);
        fs.writeFileSync(file, JSON.stringify(data));
    }
    delete(filename) {
        const file = path.join(this.dir, filename);
        if (fs.existsSync(file)) fs.unlinkSync(file);
    }
    list() {
        return fs.readdirSync(this.dir);
    }
    persist() {
        return Promise.resolve();
    }
}

// Custom vault encryption using Node crypto (FieldCrypto uses Web Crypto which is broken in Node 24)
const cryptoNative = require('crypto');
class VaultCrypto {
    constructor(secret) {
        this.key = cryptoNative.createHash('sha256').update(secret).digest();
    }
    async encrypt(plaintext) {
        const iv = cryptoNative.randomBytes(16);
        const cipher = cryptoNative.createCipheriv('aes-256-cbc', this.key, iv);
        let encrypted = cipher.update(plaintext, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        return iv.toString('hex') + ':' + encrypted;
    }
    async decrypt(ciphertext) {
        const [ivHex, encrypted] = ciphertext.split(':');
        const iv = Buffer.from(ivHex, 'hex');
        const decipher = cryptoNative.createDecipheriv('aes-256-cbc', this.key, iv);
        let decrypted = decipher.update(encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
    }
}

const app = express();
app.use(cors());
app.use(express.json());

app.use(express.static(path.join(__dirname, 'public')));

const PORT = process.env.PORT || 3000;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const JWT_SECRET = process.env.JWT_SECRET;
const VAULT_SECRET = process.env.VAULT_SECRET;
const DB_ENCRYPTION_KEY = process.env.DB_ENCRYPTION_KEY;

// Embedding configuration (supports Ollama local + external worker)
const EMBEDDING_WORKER_URL = process.env.EMBEDDING_WORKER_URL;
const EMBEDDING_API_KEY = process.env.EMBEDDING_API_KEY;
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const OLLAMA_EMBEDDING_MODEL = process.env.OLLAMA_EMBEDDING_MODEL || 'embeddinggemma';
const EMBEDDING_CONFIG = {
    defaultDimensions: 768,
    autoEmbedFields: ['content', 'text', 'description', 'body']
};

function validateEnvOrExit() {
    if (!JWT_SECRET) {
        console.error('ERROR: JWT_SECRET environment variable is required');
        process.exit(1);
    }
    if (!VAULT_SECRET) {
        console.error('ERROR: VAULT_SECRET environment variable is required');
        process.exit(1);
    }
    if (!DB_ENCRYPTION_KEY) {
        console.error('ERROR: DB_ENCRYPTION_KEY environment variable is required');
        process.exit(1);
    }
    if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
    }
}

// --- DB INITIALIZATION WITH FULL ENCRYPTION ---
async function initDb() {
    try {
        const baseAdapter = new FileStorageAdapter(DATA_DIR);
        const dbAdapter = await EncryptedAdapter.create(baseAdapter, DB_ENCRYPTION_KEY);
        // Preload data for collections that will be accessed during initialization
        // Specifically for Auth collections: _users and _sessions
        await dbAdapter.preload([
            '_users.docs.json',
            '_users.meta.json',
            '_sessions.docs.json',
            '_sessions.meta.json'
        ]);
        const db = new DocStore(dbAdapter);
        return { db, dbAdapter };
    } catch (e) {
        console.error("Database Initialization Error:", e);
        process.exit(1);
    }
}

// Since initDb is async, we wrap the server start
async function startServer(options = {}) {
    const { listen = true } = options;
    validateEnvOrExit();
    const { db, dbAdapter } = await initDb();
    const tableCache = new Map();

    // Force a synchronous flush + encrypted disk persist. Use after writes that
    // create users / store credentials so they survive an immediate restart
    // (the 5s auto-persist below leaves a window where data lives only in RAM).
    async function persistNow() {
        db.flush();
        if (dbAdapter?.persist) {
            try { await dbAdapter.persist(); } catch (err) { /* swallow */ }
        }
    }

    // Auto-persist encrypted data every 5 seconds
    setInterval(persistNow, 5000);

    // --- VECTOR STORE INITIALIZATION ---
    const VECTOR_DIR = process.env.VECTOR_DIR || path.join(DATA_DIR, 'vectors');
    if (!fs.existsSync(VECTOR_DIR)) fs.mkdirSync(VECTOR_DIR, { recursive: true });
    const vectorAdapter = new SimpleFileStorageAdapter(VECTOR_DIR);
    const VECTOR_CONFIG = {
        storeType: process.env.VECTOR_STORE_TYPE || 'float32',
        dimensions: parseInt(process.env.VECTOR_DIMENSIONS || '768', 10)
    };
    let vectorStore;
    switch (VECTOR_CONFIG.storeType) {
        case 'int8': vectorStore = new QuantizedStore(vectorAdapter, VECTOR_CONFIG.dimensions); break;
        case 'binary': vectorStore = new BinaryQuantizedStore(vectorAdapter, VECTOR_CONFIG.dimensions); break;
        case 'polar': vectorStore = new PolarQuantizedStore(vectorAdapter, VECTOR_CONFIG.dimensions); break;
        default: vectorStore = new VectorStore(vectorAdapter, VECTOR_CONFIG.dimensions);
    }
    const bm25Store = new BM25Index();

    const auth = new Auth(db, {
        secret: JWT_SECRET,
        passwordPolicy: { minLength: 6 }
    });
    auth.init().catch(err => console.error("Auth Init Error:", err));

    const vaultCrypto = new VaultCrypto(VAULT_SECRET);

    function getTable(name) {
        if (tableCache.has(name)) return tableCache.get(name);
        const table = new Table(db, name, { columns: [] });
        tableCache.set(name, table);
        return table;
    }

    // --- EMBEDDING HELPERS ---

    /**
     * Generate embedding via Ollama (local) or external embedding worker
     */
    async function generateEmbedding(text, dimensions = null) {
        const targetDimensions = dimensions || EMBEDDING_CONFIG.defaultDimensions;

        // Try Ollama first if no external worker is configured
        if (!EMBEDDING_WORKER_URL) {
            try {
                const response = await axios({
                    method: 'POST',
                    url: `${OLLAMA_URL}/api/embeddings`,
                    headers: { 'Content-Type': 'application/json' },
                    data: {
                        model: OLLAMA_EMBEDDING_MODEL,
                        prompt: text
                    }
                });

                const embedding = response.data?.embedding;
                if (!embedding || !Array.isArray(embedding)) {
                    throw new Error('Invalid embedding response from Ollama');
                }

                // Truncate to requested dimensions if needed
                if (targetDimensions && embedding.length > targetDimensions) {
                    return embedding.slice(0, targetDimensions);
                }
                return embedding;
            } catch (e) {
                if (!EMBEDDING_API_KEY) throw new Error(`Ollama embedding failed: ${e.message}. Set EMBEDDING_WORKER_URL or ensure Ollama is running.`);
            }
        }

        // Fallback to external embedding worker
        if (!EMBEDDING_WORKER_URL || !EMBEDDING_API_KEY) {
            throw new Error('Embedding not configured. Set OLLAMA_URL+OLLAMA_EMBEDDING_MODEL for local, or EMBEDDING_WORKER_URL+EMBEDDING_API_KEY for remote.');
        }

        const endpoint = targetDimensions !== 2048 ? '/embed/matryoshka' : '/embed';

        const response = await axios({
            method: 'POST',
            url: `${EMBEDDING_WORKER_URL}${endpoint}`,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${EMBEDDING_API_KEY}`
            },
            data: {
                text,
                dimensions: targetDimensions
            }
        });

        if (!response.data.success || !response.data.embeddings?.[0]?.embedding) {
            throw new Error('Invalid embedding response');
        }

        return response.data.embeddings[0].embedding;
    }

    /**
     * Extract text from document for embedding
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

    // --- MIDDLEWARES ---
    async function authenticateJWT(req, res, next) {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ success: false, message: "No token provided" });
        }
        const token = authHeader.split(' ')[1];
        const payload = await auth.verify(token);
        if (!payload) {
            return res.status(401).json({ success: false, message: "Invalid or expired token" });
        }
        req.user = payload;
        next();
    }

    function authorize(role) {
        return (req, res, next) => {
            if (!req.user || !req.user.roles || !req.user.roles.includes(role)) {
                return res.status(403).json({ success: false, message: `Required role: ${role}` });
            }
            next();
        };
    }

    // --- PUBLIC ENDPOINTS (no authentication required) ---
    // Whitelist of tables that can be queried publicly
    const PUBLIC_TABLES = (process.env.PUBLIC_TABLES || '').split(',').filter(Boolean);

    app.get('/public/tables', (req, res) => {
        // Return only the list of publicly configured tables
        res.json({ success: true, tables: PUBLIC_TABLES });
    });

    app.get('/public/query/:tableName', (req, res) => {
        const { tableName } = req.params;

        // Only allow access to whitelisted public tables
        if (!PUBLIC_TABLES.includes(tableName)) {
            return res.status(403).json({ success: false, message: 'Table not publicly accessible' });
        }

        const table = getTable(tableName);
        const results = table.find({}).toArray();
        res.json({ success: true, data: results });
    });

    // --- AUTHENTICATION ---

    // Bootstrap endpoint - Create first admin when no users exist
    app.post('/auth/bootstrap', async (req, res) => {
        try {
            // Ensure auth tables are initialized before checking users
            await auth.init();

            // Check if users already exist
            const usersTable = new Table(db, 'users', { columns: [] });
            const existingUsers = usersTable.find({}).toArray();

            if (existingUsers.length > 0) {
                return res.status(403).json({
                    success: false,
                    message: 'Bootstrap can only be used when no users exist. Use /auth/register instead.'
                });
            }

            const { email, password, name } = req.body;
            if (!email || !password) {
                return res.status(400).json({
                    success: false,
                    message: 'email and password are required'
                });
            }

            // Register the user
            const user = await auth.register(email, password, { name });
            if (!user || !user._id) {
                return res.status(500).json({ success: false, message: 'Registration failed unexpectedly' });
            }

            // Assign admin role
            await auth.assignRole(user._id, 'admin');

            // Get updated user with roles
            const updatedUser = usersTable.findById(user._id);

            await persistNow();

            res.json({
                success: true,
                message: 'First admin user created successfully',
                user: { _id: updatedUser._id, email: updatedUser.email, roles: updatedUser.roles }
            });
        } catch (e) {
            res.status(400).json({ success: false, message: e.message });
        }
    });

    app.post('/auth/register', async (req, res) => {
        const { email, password, name } = req.body;
        try {
            let user = await auth.register(email, password, { name });

            // Auto-assign admin role to the first user
            const userCount = auth._users.find({}).toArray().length;
            if (userCount === 1) {
                await auth.assignRole(user._id, 'admin');
                user = auth.getUser(user._id);
            }

            await persistNow();
            res.json({ success: true, user });
        } catch (e) { res.status(400).json({ success: false, message: e.message }); }
    });

    app.post('/auth/login', async (req, res) => {
        const { email, password } = req.body;
        try {
            const { token, user } = await auth.login(email, password);
            res.json({ success: true, token, user });
        } catch (e) { res.status(401).json({ success: false, message: e.message }); }
    });

    // --- VAULT SYSTEM ---
    app.post('/admin/vault/add', authenticateJWT, authorize('admin'), async (req, res) => {
        try {
            const { secretId, secretValue, label } = req.body;
            if (!secretId || secretValue === undefined) {
                return res.status(400).json({ success: false, message: 'secretId and secretValue are required' });
            }
            const vault = getTable('vault');
            const encryptedValue = await vaultCrypto.encrypt(secretValue);
            vault.insert({ _id: secretId, label, value: encryptedValue, createdAt: new Date().toISOString() });
            db.flush();
            res.json({ success: true, message: "Secret stored securely." });
        } catch (e) {
            res.status(500).json({ success: false, message: e.message });
        }
    });

    app.get('/admin/vault/list', authenticateJWT, authorize('admin'), (req, res) => {
        const vault = getTable('vault');
        const all = vault.find({}).toArray();
        const sanitized = all.map(item => { const { value, ...rest } = item; return rest; });
        res.json({ success: true, secrets: sanitized });
    });

    app.post('/admin/vault/get', authenticateJWT, authorize('admin'), async (req, res) => {
        try {
            const { secretId } = req.body;
            const vault = getTable('vault');
            const secretDoc = vault.findById(secretId);
            if (!secretDoc) return res.status(404).json({ success: false, message: "Secret not found" });
            const decryptedValue = await vaultCrypto.decrypt(secretDoc.value);
            res.json({ success: true, secretId, label: secretDoc.label, value: decryptedValue });
        } catch (e) { res.status(500).json({ success: false, message: e.message }); }
    });

    app.post('/admin/vault/execute', authenticateJWT, authorize('admin'), async (req, res) => {
        const { secretId, url, method = 'GET', body: reqBody = {}, headerType = 'bearer' } = req.body;
        const vault = getTable('vault');
        const secretDoc = vault.findById(secretId);
        if (!secretDoc) return res.status(404).json({ success: false, message: "Secret not found" });
        try {
            const decryptedValue = await vaultCrypto.decrypt(secretDoc.value);
            let headers = {};
            switch (headerType) {
                case 'bearer': headers = { 'Authorization': `Bearer ${decryptedValue}` }; break;
                case 'api-key': headers = { 'X-Api-Key': decryptedValue }; break;
                case 'x-api-key': headers = { 'X-API-KEY': decryptedValue }; break;
                case 'basic': headers = { 'Authorization': `Basic ${Buffer.from(decryptedValue).toString('base64')}` }; break;
                case 'custom': {
                    const customHeaderName = req.body.headerName || 'Authorization';
                    const valueFormat = req.body.headerValueFormat || '{value}';
                    headers[customHeaderName] = valueFormat.replace('{value}', decryptedValue); break;
                }
                default: headers = { 'Authorization': `Bearer ${decryptedValue}` };
            }
            const response = await axios({ method, url, data: reqBody, headers });
            res.json({ success: true, data: response.data, status: response.status });
        } catch (e) { res.status(500).json({ success: false, message: e.message }); }
    });

    // --- CONNECTION METADATA SYSTEM ---
    app.post('/admin/connections/register', authenticateJWT, authorize('admin'), (req, res) => {
        try {
            const { name, host, port = 22, username, vaultSecretId, label } = req.body;
            if (!name || !host || !username || !vaultSecretId) {
                return res.status(400).json({ success: false, message: 'name, host, username, and vaultSecretId are required' });
            }
            const connections = getTable('connections');
            const existing = connections.findById(name);
            if (existing) {
                connections.update(name, { host, port, username, vaultSecretId, label, updatedAt: new Date().toISOString() });
            } else {
                connections.insert({ _id: name, name, host, port, username, vaultSecretId, label, createdAt: new Date().toISOString() });
            }
            db.flush();
            res.json({ success: true, message: 'Connection registered' });
        } catch (e) { res.status(500).json({ success: false, message: e.message }); }
    });

    app.post('/admin/connections/list', authenticateJWT, authorize('admin'), (req, res) => {
        try {
            const connections = getTable('connections');
            const all = connections.find({}).toArray();
            const sanitized = all.map(c => {
                const { value, ...rest } = c;
                return rest;
            });
            res.json({ success: true, connections: sanitized });
        } catch (e) { res.status(500).json({ success: false, message: e.message }); }
    });

    // --- EMBEDDING & VECTOR ENDPOINTS ---

    function bm25Path(collection) { return path.join(VECTOR_DIR, `${collection}.bm25.json`); }
    function loadBM25(collection) {
        try { const state = JSON.parse(fs.readFileSync(bm25Path(collection), 'utf-8')); bm25Store.importState(collection, state); } catch {}
    }
    function saveBM25(collection) {
        const state = bm25Store.exportState(collection);
        if (state) fs.writeFileSync(bm25Path(collection), JSON.stringify(state));
    }

    app.post('/admin/embed', authenticateJWT, authorize('admin'), async (req, res) => {
        try {
            const { text, dimensions } = req.body;
            if (!text) return res.status(400).json({ success: false, message: 'text is required' });
            const embedding = await generateEmbedding(text, dimensions);
            res.json({ success: true, model: OLLAMA_EMBEDDING_MODEL, dimensions: embedding.length, embedding });
        } catch (e) { res.status(500).json({ success: false, message: e.message }); }
    });

    app.post('/admin/vector/index', authenticateJWT, authorize('admin'), async (req, res) => {
        try {
            const { collection = 'default', id, vector, metadata = {} } = req.body;
            if (!id) return res.status(400).json({ success: false, message: 'id is required' });
            if (!vector || !Array.isArray(vector)) return res.status(400).json({ success: false, message: 'vector is required (array of floats)' });
            vectorStore.set(collection, id, vector, metadata);
            vectorStore.flush();
            await vectorAdapter.persist();
            res.json({ success: true, message: `Document indexed in collection ${collection}`, id, embeddingDimensions: vector.length });
        } catch (e) { res.status(500).json({ success: false, message: e.message }); }
    });

    app.post('/admin/vector/batch', authenticateJWT, authorize('admin'), async (req, res) => {
        try {
            const { collection = 'default', vectors } = req.body;
            if (!Array.isArray(vectors)) return res.status(400).json({ success: false, message: 'vectors array is required' });
            let count = 0;
            for (const item of vectors) {
                if (item.id && item.vector) {
                    vectorStore.set(collection, item.id, item.vector, item.metadata || {});
                    count++;
                }
            }
            vectorStore.flush();
            await vectorAdapter.persist();
            res.json({ success: true, message: `${count} documents indexed in collection ${collection}`, count });
        } catch (e) { res.status(500).json({ success: false, message: e.message }); }
    });

    app.post('/admin/vector/index-with-text', authenticateJWT, authorize('admin'), async (req, res) => {
        try {
            const { collection = 'default', id, text, doc, metadata = {}, dimensions } = req.body;
            if (!id) return res.status(400).json({ success: false, message: 'id is required' });
            let textToEmbed = text;
            if (!textToEmbed && doc) textToEmbed = extractTextForEmbedding(doc);
            if (!textToEmbed) return res.status(400).json({ success: false, message: 'Provide "text" or "doc" with embeddable fields' });
            const embedding = await generateEmbedding(textToEmbed, dimensions);
            vectorStore.set(collection, id, embedding, { ...metadata, text: textToEmbed.substring(0, 500) });
            vectorStore.flush();
            await vectorAdapter.persist();
            res.json({ success: true, message: `Document indexed in collection ${collection}`, id, textLength: textToEmbed.length, embeddingDimensions: embedding.length });
        } catch (e) { res.status(500).json({ success: false, message: e.message }); }
    });

    app.post('/admin/vector/search', authenticateJWT, authorize('admin'), async (req, res) => {
        try {
            const { collection = 'default', vector, limit = 10, metric = 'cosine', matryoshka, dimSlice } = req.body;
            if (!vector || !Array.isArray(vector)) return res.status(400).json({ success: false, message: 'vector is required (array of floats)' });
            let results;
            if (matryoshka && Array.isArray(matryoshka)) {
                results = vectorStore.matryoshkaSearch(collection, vector, limit, matryoshka, metric);
            } else {
                results = vectorStore.search(collection, vector, limit, dimSlice || 0, metric);
            }
            res.json({ success: true, collection, results });
        } catch (e) { res.status(500).json({ success: false, message: e.message }); }
    });

    app.post('/admin/vector/search-by-text', authenticateJWT, authorize('admin'), async (req, res) => {
        try {
            const { collection = 'default', query, limit = 10, metric = 'cosine', dimensions } = req.body;
            if (!query) return res.status(400).json({ success: false, message: 'query text is required' });
            const queryEmbedding = await generateEmbedding(query, dimensions);
            const results = vectorStore.search(collection, queryEmbedding, limit, 0, metric);
            res.json({ success: true, query, collection, results });
        } catch (e) { res.status(500).json({ success: false, message: e.message }); }
    });

    app.post('/admin/vector/search-hybrid', authenticateJWT, authorize('admin'), async (req, res) => {
        try {
            const { collection = 'default', vector, text, limit = 10, metric = 'cosine', mode = 'rrf', weights = [0.7, 0.3] } = req.body;
            if (!vector || !Array.isArray(vector)) return res.status(400).json({ success: false, message: 'vector is required' });
            if (!text) return res.status(400).json({ success: false, message: 'text is required' });
            loadBM25(collection);
            const hybrid = new HybridSearch(vectorStore, bm25Store, mode);
            const results = hybrid.search(collection, vector, text, limit, weights);
            res.json({ success: true, collection, mode, results });
        } catch (e) { res.status(500).json({ success: false, message: e.message }); }
    });

    app.post('/admin/vector/search-cross', authenticateJWT, authorize('admin'), async (req, res) => {
        try {
            const { collections, vector, limit = 10, metric = 'cosine' } = req.body;
            if (!Array.isArray(collections)) return res.status(400).json({ success: false, message: 'collections array is required' });
            if (!vector || !Array.isArray(vector)) return res.status(400).json({ success: false, message: 'vector is required' });
            const results = vectorStore.searchAcross(collections, vector, limit, metric);
            res.json({ success: true, collections, results });
        } catch (e) { res.status(500).json({ success: false, message: e.message }); }
    });

    app.get('/admin/vector/collections', authenticateJWT, authorize('admin'), (req, res) => {
        try {
            const result = [];
            const files = vectorAdapter.list();
            const seen = new Set();
            for (const f of files) {
                const name = f.replace(/\.(bin|json|q8\.(bin|json)|b1\.(bin|json)|p1\.(bin|json))$/, '');
                if (!name || seen.has(name)) continue;
                seen.add(name);
                result.push({ name, count: vectorStore.count(name) });
            }
            res.json({ success: true, collections: result });
        } catch (e) { res.status(500).json({ success: false, message: e.message }); }
    });

    app.get('/admin/vector/stats', authenticateJWT, authorize('admin'), (req, res) => {
        try {
            const stats = { storeType: VECTOR_CONFIG.storeType, dimensions: VECTOR_CONFIG.dimensions };
            const files = vectorAdapter.list ? vectorAdapter.list() : [];
            const seen = new Set();
            for (const f of files) {
                const name = f.replace(/\.(bin|json|q8\.(bin|json)|b1\.(bin|json)|p1\.(bin|json))$/, '');
                if (!name || seen.has(name)) continue;
                seen.add(name);
                stats[name] = { count: vectorStore.count(name) };
            }
            res.json({ success: true, stats });
        } catch (e) { res.status(500).json({ success: false, message: e.message }); }
    });

    app.delete('/admin/vector/:collection/:id', authenticateJWT, authorize('admin'), (req, res) => {
        try {
            const { collection, id } = req.params;
            const removed = vectorStore.remove(collection, id);
            vectorStore.flush();
            vectorAdapter.persist().catch(() => {});
            res.json({ success: true, removed });
        } catch (e) { res.status(500).json({ success: false, message: e.message }); }
    });

    app.post('/admin/vector/drop', authenticateJWT, authorize('admin'), (req, res) => {
        try {
            const { collection } = req.body;
            if (!collection) return res.status(400).json({ success: false, message: 'collection is required' });
            vectorStore.drop(collection);
            try { fs.unlinkSync(bm25Path(collection)); } catch {}
            res.json({ success: true, message: `Collection ${collection} dropped` });
        } catch (e) { res.status(500).json({ success: false, message: e.message }); }
    });

    app.get('/admin/vector/:collection/:id', authenticateJWT, authorize('admin'), (req, res) => {
        try {
            const { collection, id } = req.params;
            const result = vectorStore.get(collection, id);
            if (!result) return res.status(404).json({ success: false, message: 'Not found' });
            res.json({ success: true, result });
        } catch (e) { res.status(500).json({ success: false, message: e.message }); }
    });

    app.post('/admin/vector/batch-index-with-text', authenticateJWT, authorize('admin'), async (req, res) => {
        try {
            const { collection = 'default', documents } = req.body;
            if (!Array.isArray(documents)) return res.status(400).json({ success: false, message: 'documents array is required' });
            let count = 0;
            for (const doc of documents) {
                const { id, text } = doc;
                if (!id || !text) continue;
                const embedding = await generateEmbedding(text, doc.dimensions);
                vectorStore.set(collection, id, embedding, { ...doc.metadata, text: text.substring(0, 500) });
                count++;
            }
            vectorStore.flush();
            await vectorAdapter.persist();
            res.json({ success: true, message: `${count} documents indexed`, count });
        } catch (e) { res.status(500).json({ success: false, message: e.message }); }
    });

    // --- CORE DATA OPERATIONS ---
    app.post('/admin/create-table', authenticateJWT, authorize('admin'), (req, res) => {
        const { tableName, columns } = req.body;
        const table = new Table(db, tableName, { columns });
        tableCache.set(tableName, table);
        db.flush();
        res.json({ success: true, message: `Table ${tableName} created.` });
    });

    app.post('/admin/deploy-template', authenticateJWT, authorize('admin'), (req, res) => {
        const { tableName, templateName } = req.body;
        try {
            const table = createFromTemplate(db, tableName, templateName);
            tableCache.set(tableName, table);
            db.flush();
            res.json({ success: true, message: `Table ${tableName} deployed from template ${templateName}.` });
        } catch (e) {
            res.status(400).json({ success: false, message: e.message });
        }
    });

    app.post('/admin/insert', authenticateJWT, authorize('admin'), (req, res) => {
        const { tableName, data } = req.body;
        const table = getTable(tableName);
        const doc = table.insert(data);
        db.flush();
        res.json({ success: true, id: doc._id });
    });

    app.post('/admin/query', authenticateJWT, authorize('admin'), (req, res) => {
        const { tableName, filter, sort, limit } = req.body;
        const table = getTable(tableName);
        let query = table.find(filter || {});
        if (sort) query = query.sort(sort);
        if (limit) query = query.limit(limit);
        res.json({ success: true, data: query.toArray() });
    });

    app.post('/admin/create-view', authenticateJWT, authorize('admin'), (req, res) => {
        const { tableName, viewName, filter, sort, limit } = req.body;
        const table = getTable(tableName);
        table.createView(viewName, { filter, sort, limit });
        db.flush();
        res.json({ success: true, message: `View '${viewName}' created for table ${tableName}.` });
    });

    app.post('/admin/execute-view', authenticateJWT, authorize('admin'), (req, res) => {
        const { tableName, viewName } = req.body;
        const table = getTable(tableName);
        const results = table.view(viewName).toArray();
        res.json({ success: true, data: results });
    });

    app.post('/admin/update', authenticateJWT, authorize('admin'), (req, res) => {
        const { tableName, filter, update } = req.body;
        const table = getTable(tableName);
        table.updateMany(filter, update);
        db.flush();
        res.json({ success: true });
    });

    app.post('/admin/remove', authenticateJWT, authorize('admin'), (req, res) => {
        const { tableName, filter } = req.body;
        const table = getTable(tableName);
        const count = table.remove(filter);
        db.flush();
        res.json({ success: true, count });
    });

    app.post('/admin/aggregate', authenticateJWT, authorize('admin'), (req, res) => {
        const { tableName, pipeline } = req.body;
        const table = getTable(tableName);
        let agg = table.aggregate();
        for (const step of pipeline) {
            if (step.stage === 'match') agg = agg.match(step.params);
            else if (step.stage === 'lookup') agg = agg.lookup(step.params);
            else if (step.stage === 'group') agg = agg.group(step.params.field, step.params.accumulators);
            else if (step.stage === 'sort') agg = agg.sort(step.params);
            else if (step.stage === 'limit') agg = agg.limit(step.params);
            else if (step.stage === 'project') agg = agg.project(step.params);
            else if (step.stage === 'unwind') agg = agg.unwind(step.params);
        }
        res.json({ success: true, data: agg.toArray() });
    });

    app.post('/admin/assign-role', authenticateJWT, authorize('admin'), async (req, res) => {
        const { userId, role } = req.body;
        try {
            auth.assignRole(userId, role);
            res.json({ success: true, message: `Role ${role} assigned to ${userId}` });
        } catch (e) { res.status(400).json({ success: false, message: e.message }); }
    });

    let httpServer = null;
    if (listen) {
        httpServer = app.listen(PORT, () => {
            console.log(`🚀 DocStore Server running on http://localhost:${PORT}`);
            console.log(`🔐 Security: JWT + RBAC + Full-Disk Encryption Enabled`);
            console.log(`📁 Data directory: ${DATA_DIR}`);
        });
    }

    return { app, db, dbAdapter, vaultCrypto, auth, getTable, PORT, httpServer };
}

module.exports = { startServer, VaultCrypto };

if (require.main === module) {
    startServer();
}

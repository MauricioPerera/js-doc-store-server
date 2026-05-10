const express = require('express');
const cors = require('cors');
const { DocStore, FileStorageAdapter, EncryptedAdapter, Table, Auth, FieldCrypto, createFromTemplate } = require('js-doc-store');
const path = require('path');
const fs = require('fs');
const axios = require('axios');

const app = express();
app.use(cors());
app.use(express.json());

app.use(express.static(path.join(__dirname, 'public')));

const PORT = process.env.PORT || 3000;
const DATA_DIR = "D:/repos/ollama/pi-shared-data";
const JWT_SECRET = "pi-sovereign-jwt-secret-2026";
const VAULT_SECRET = "pi-vault-master-key-2026";
const DB_ENCRYPTION_KEY = "pi-db-full-encryption-key-2026"; // For EncryptedAdapter

if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

// --- DB INITIALIZATION WITH FULL ENCRYPTION ---
async function initDb() {
    try {
        const baseAdapter = new FileStorageAdapter(DATA_DIR);
        // EncryptedAdapter wraps the base adapter, encrypting everything at rest
        const encryptedAdapter = await EncryptedAdapter.create(baseAdapter, DB_ENCRYPTION_KEY);
        
        const db = new DocStore(encryptedAdapter);
        return db;
    } catch (e) {
        console.error("Database Initialization Error:", e);
        process.exit(1);
    }
}

// Since initDb is async, we wrap the server start
async function startServer() {
    const db = await initDb();
    const tableCache = new Map();

    const auth = new Auth(db, { 
        secret: JWT_SECRET,
        passwordPolicy: { minLength: 6 } 
    });
    auth.init().catch(err => console.error("Auth Init Error:", err));

    const vaultCrypto = new FieldCrypto(VAULT_SECRET);

    function getTable(name) {
        if (tableCache.has(name)) return tableCache.get(name);
        const table = new Table(db, name, { columns: [] });
        tableCache.set(name, table);
        return table;
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

    // --- PUBLIC ENDPOINTS ---
    app.get('/public/tables', (req, res) => {
        const files = fs.readdirSync(DATA_DIR);
        const tables = [...new Set(files.filter(f => f.endsWith('.docs.json')).map(f => f.replace('.docs.json', '')))];
        res.json({ success: true, tables });
    });

    app.get('/public/query/:tableName', (req, res) => {
        const { tableName } = req.params;
        const table = getTable(tableName);
        const results = table.find({}).toArray();
        res.json({ success: true, data: results });
    });

    // --- AUTHENTICATION ---
    app.post('/auth/register', async (req, res) => {
        const { email, password, name } = req.body;
        try {
            const user = await auth.register(email, password, { name });
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
        const { secretId, secretValue, label } = req.body;
        const vault = getTable('vault');
        const encryptedValue = await vaultCrypto.encrypt(secretValue);
        vault.insert({ _id: secretId, label, value: encryptedValue, createdAt: new Date().toISOString() });
        db.flush();
        res.json({ success: true, message: "Secret stored securely." });
    });

    app.get('/admin/vault/list', authenticateJWT, authorize('admin'), (req, res) => {
        const vault = getTable('vault');
        const all = vault.find({}).toArray();
        const sanitized = all.map(item => { const { value, ...rest } = item; return rest; });
        res.json({ success: true, secrets: sanitized });
    });

    app.post('/admin/vault/execute', authenticateJWT, async (req, res) => {
        const { secretId, url, method = 'GET', body = {} } = req.body;
        const vault = getTable('vault');
        const secretDoc = vault.findById(secretId);
        if (!secretDoc) return res.status(404).json({ success: false, message: "Secret not found" });
        try {
            const decryptedValue = await vaultCrypto.decrypt(secretDoc.value);
            const response = await axios({
                method, url, data: body,
                headers: { 'Authorization': `Bearer ${decryptedValue}`, 'X-API-KEY': decryptedValue }
            });
            res.json({ success: true, data: response.data, status: response.status });
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

    app.post('/admin/insert', authenticateJWT, (req, res) => {
        const { tableName, data } = req.body;
        const table = getTable(tableName);
        const doc = table.insert(data);
        db.flush();
        res.json({ success: true, id: doc._id });
    });

    app.post('/admin/query', authenticateJWT, (req, res) => {
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

    app.post('/admin/execute-view', authenticateJWT, (req, res) => {
        const { tableName, viewName } = req.body;
        const table = getTable(tableName);
        const results = table.view(viewName).toArray();
        res.json({ success: true, data: results });
    });

    app.post('/admin/update', authenticateJWT, (req, res) => {
        const { tableName, filter, update } = req.body;
        const table = getTable(tableName);
        table.updateMany(filter, update);
        db.flush();
        res.json({ success: true });
    });

    app.post('/admin/aggregate', authenticateJWT, (req, res) => {
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

    app.listen(PORT, () => {
        console.log(`🚀 DocStore Server running on http://localhost:${PORT}`);
        console.log(`🔐 Security: JWT + RBAC + Full-Disk Encryption Enabled`);
        console.log(`📁 Data directory: ${DATA_DIR}`);
    });
}

startServer();

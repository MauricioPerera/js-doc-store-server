const axios = require('axios');

const BASE_URL = process.env.API_URL || 'https://YOUR_WORKER_SUBDOMAIN.workers.dev';
const EMBEDDING_URL = process.env.EMBEDDING_URL || 'https://gemma-embedding-worker.YOUR_SUBDOMAIN.workers.dev';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@example.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD; // MUST be set via env

async function test() {
    if (!ADMIN_PASSWORD) {
        console.error('❌ ADMIN_PASSWORD environment variable is required');
        console.error('   Example: ADMIN_PASSWORD=your_password node test_direct_integration.js');
        process.exit(1);
    }
    console.log('Testing direct embedding integration...\n');
    
    try {
        // Test 1: Login
        console.log('1. Login...');
        const loginRes = await axios.post(`${BASE_URL}/auth/login`, {
            email: ADMIN_EMAIL,
            password: ADMIN_PASSWORD
        });
        const token = loginRes.data.token;
        console.log('✅ Login successful\n');
        
        // Test 2: Direct call to embedding worker
        console.log('2. Direct call to embedding worker...');
        const directRes = await axios.post(`${EMBEDDING_URL}/embed`, {
            text: 'Hello world',
            dimensions: 768
        }, {
            headers: { Authorization: `Bearer ${process.env.EMBEDDING_API_KEY || 'your-embedding-api-key'}` }
        });
        console.log('✅ Direct call successful');
        console.log('   Dimensions:', directRes.data.dimensions);
        console.log('');
        
        // Test 3: Call through doc-store-server
        console.log('3. Call through doc-store-server...');
        const embedRes = await axios.post(`${BASE_URL}/admin/embed`, {
            text: 'Machine learning is a subset of AI',
            dimensions: 768
        }, {
            headers: { Authorization: `Bearer ${token}` }
        });
        console.log('✅ Embed endpoint successful');
        console.log('   Dimensions:', embedRes.data.dimensions);
        
    } catch (e) {
        console.error('❌ Error:');
        console.error('   Status:', e.response?.status);
        console.error('   Data:', e.response?.data);
        console.error('   Message:', e.message);
    }
}

test();

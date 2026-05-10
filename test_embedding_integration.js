const axios = require('axios');

const BASE_URL = process.env.API_URL || 'https://YOUR_WORKER_SUBDOMAIN.workers.dev';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@example.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Admin123!';

async function test() {
    console.log('══════════════════════════════════════════════════');
    console.log('   Testing Embedding Integration');
    console.log('══════════════════════════════════════════════════');
    console.log(`API URL: ${BASE_URL}\n`);

    try {
        // Step 1: Login
        console.log('Step 1: Login...');
        const loginRes = await axios.post(`${BASE_URL}/auth/login`, {
            email: ADMIN_EMAIL,
            password: ADMIN_PASSWORD
        });
        const token = loginRes.data.token;
        console.log('✅ Login successful\n');

        const headers = { Authorization: `Bearer ${token}` };

        // Step 2: Generate embedding
        console.log('Step 2: POST /admin/embed');
        const embedRes = await axios.post(`${BASE_URL}/admin/embed`, {
            text: 'Machine learning is a subset of artificial intelligence',
            dimensions: 768
        }, { headers });
        console.log('✅ Embedding generated:');
        console.log('   Model:', embedRes.data.model);
        console.log('   Dimensions:', embedRes.data.dimensions);
        console.log('   First 5 values:', embedRes.data.embedding.slice(0, 5));
        console.log('');

        // Step 3: Index document with text
        console.log('Step 3: POST /admin/vector/index-with-text');
        const indexRes = await axios.post(`${BASE_URL}/admin/vector/index-with-text`, {
            collection: 'documents',
            id: 'doc-' + Date.now(),
            text: 'This is a document about machine learning and AI',
            metadata: { category: 'tech', author: 'test' },
            dimensions: 768
        }, { headers });
        console.log('✅ Document indexed:');
        console.log('   ID:', indexRes.data.id);
        console.log('   Text length:', indexRes.data.textLength);
        console.log('   Embedding dimensions:', indexRes.data.embeddingDimensions);
        console.log('');

        // Step 4: Search by text
        console.log('Step 4: POST /admin/vector/search-by-text');
        const searchRes = await axios.post(`${BASE_URL}/admin/vector/search-by-text`, {
            collection: 'documents',
            query: 'artificial intelligence',
            limit: 5,
            dimensions: 768
        }, { headers });
        console.log('✅ Search query embedding generated:');
        console.log('   Query:', searchRes.data.query);
        console.log('   Embedding dimensions:', searchRes.data.embeddingDimensions);
        console.log('');

        console.log('══════════════════════════════════════════════════');
        console.log('   ALL EMBEDDING TESTS PASSED');
        console.log('══════════════════════════════════════════════════');

    } catch (e) {
        console.error('\n❌ Test failed:');
        console.error('   Status:', e.response?.status);
        console.error('   Message:', e.response?.data?.message || e.message);
        process.exit(1);
    }
}

test();

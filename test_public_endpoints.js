const axios = require('axios');

const BASE_URL = process.env.API_URL || 'https://js-doc-store-server.rckflr.workers.dev';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@example.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Admin123!';

async function testPublicEndpoints() {
    console.log('══════════════════════════════════════════════════');
    console.log('   Testing Public Endpoints with Authentication');
    console.log('══════════════════════════════════════════════════');
    console.log(`API URL: ${BASE_URL}\n`);

    let token = null;

    try {
        // Step 1: Login
        console.log('Step 1: Login to get JWT token...');
        const loginRes = await axios.post(`${BASE_URL}/auth/login`, {
            email: ADMIN_EMAIL,
            password: ADMIN_PASSWORD
        });
        token = loginRes.data.token;
        console.log('✅ Login successful!');
        console.log(`   Token: ${token.substring(0, 50)}...\n`);

        const authHeaders = { Authorization: `Bearer ${token}` };

        // Step 2: Test Public Tables
        console.log('Step 2: GET /public/tables (with auth token)...');
        const tablesRes = await axios.get(`${BASE_URL}/public/tables`, {
            headers: authHeaders
        });
        console.log('✅ Response:', JSON.stringify(tablesRes.data, null, 2));
        console.log(`   Found ${tablesRes.data.tables?.length || 0} tables\n`);

        // Step 3: Test Public Query
        console.log('Step 3: GET /public/query/products (with auth token)...');
        try {
            const productsRes = await axios.get(`${BASE_URL}/public/query/products`, {
                headers: authHeaders
            });
            console.log('✅ Response:', JSON.stringify(productsRes.data, null, 2));
            console.log(`   Found ${productsRes.data.data?.length || 0} records\n`);
        } catch (e) {
            console.log('ℹ️ Products table may not exist or not be accessible\n');
        }

        // Step 4: Test Public Query for test_collab
        console.log('Step 4: GET /public/query/test_collab (with auth token)...');
        try {
            const testRes = await axios.get(`${BASE_URL}/public/query/test_collab`, {
                headers: authHeaders
            });
            console.log('✅ Response:', JSON.stringify(testRes.data, null, 2));
            console.log(`   Found ${testRes.data.data?.length || 0} records\n`);
        } catch (e) {
            console.log('ℹ️ Table not accessible (may require PUBLIC_TABLES config)\n');
        }

        // Step 5: Test WITHOUT auth (should fail)
        console.log('Step 5: GET /public/tables WITHOUT auth (should fail)...');
        try {
            await axios.get(`${BASE_URL}/public/tables`);
            console.log('❌ Unexpected: Request succeeded without auth\n');
        } catch (e) {
            console.log('✅ Expected error:', e.response?.data?.message || 'No token');
            console.log('   Status:', e.response?.status, '\n');
        }

        console.log('══════════════════════════════════════════════════');
        console.log('   ALL PUBLIC ENDPOINT TESTS COMPLETED');
        console.log('══════════════════════════════════════════════════');

    } catch (e) {
        console.error('\n❌ Test failed:');
        console.error('   Status:', e.response?.status);
        console.error('   Message:', e.response?.data?.message || e.message);
        process.exit(1);
    }
}

testPublicEndpoints();

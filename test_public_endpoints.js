const axios = require('axios');

const BASE_URL = process.env.API_URL || 'https://YOUR_WORKER_SUBDOMAIN.workers.dev';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@example.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Admin123!';

async function testPublicEndpoints() {
    console.log('══════════════════════════════════════════════════');
    console.log('   Testing Public Endpoints');
    console.log('══════════════════════════════════════════════════');
    console.log(`API URL: ${BASE_URL}\n`);

    let token = null;

    try {
        // Step 1: Test WITHOUT auth (should SUCCEED - public endpoints)
        console.log('Step 1: GET /public/tables WITHOUT auth...');
        const tablesRes = await axios.get(`${BASE_URL}/public/tables`);
        console.log('✅ Response:', JSON.stringify(tablesRes.data, null, 2));
        console.log(`   Found ${tablesRes.data.tables?.length || 0} tables\n`);

        // Step 2: Test Public Query WITHOUT auth
        console.log('Step 2: GET /public/query/products WITHOUT auth...');
        try {
            const productsRes = await axios.get(`${BASE_URL}/public/query/products`);
            console.log('✅ Response:', JSON.stringify(productsRes.data, null, 2));
            console.log(`   Found ${productsRes.data.data?.length || 0} records\n`);
        } catch (e) {
            console.log('ℹ️ Products table may not exist or not be accessible\n');
        }

        // Step 3: Test admin endpoint WITHOUT auth (should FAIL)
        console.log('Step 3: GET /admin/vector/stats WITHOUT auth (should fail)...');
        try {
            await axios.get(`${BASE_URL}/admin/vector/stats`);
            console.log('❌ Unexpected: Admin request succeeded without auth\n');
            process.exit(1);
        } catch (e) {
            console.log('✅ Expected error:', e.response?.data?.message || 'No token');
            console.log('   Status:', e.response?.status, '\n');
        }

        // Step 4: Login to test with auth
        console.log('Step 4: Login to get JWT token...');
        const loginRes = await axios.post(`${BASE_URL}/auth/login`, {
            email: ADMIN_EMAIL,
            password: ADMIN_PASSWORD
        });
        token = loginRes.data.token;
        console.log('✅ Login successful!');
        console.log(`   Token: ${token.substring(0, 50)}...\n`);

        const authHeaders = { Authorization: `Bearer ${token}` };

        // Step 5: Test admin endpoint WITH auth (should SUCCEED)
        console.log('Step 5: GET /admin/vector/stats WITH auth...');
        const statsRes = await axios.get(`${BASE_URL}/admin/vector/stats`, {
            headers: authHeaders
        });
        console.log('✅ Response:', JSON.stringify(statsRes.data, null, 2));
        console.log(`   Found ${statsRes.data.collections?.length || 0} collections\n`);

        // Step 6: Test admin endpoint WITH auth
        console.log('Step 6: GET /admin/vector/collections WITH auth...');
        const collsRes = await axios.get(`${BASE_URL}/admin/vector/collections`, {
            headers: authHeaders
        });
        console.log('✅ Response:', JSON.stringify(collsRes.data, null, 2));
        console.log(`   Found ${collsRes.data.collections?.length || 0} collections\n`);

        console.log('══════════════════════════════════════════════════');
        console.log('   ALL PUBLIC ENDPOINT TESTS PASSED');
        console.log('══════════════════════════════════════════════════');
        console.log('\nSummary:');
        console.log('  ✅ Public endpoints work WITHOUT authentication');
        console.log('  ✅ Admin endpoints REQUIRE authentication');
        console.log('  ✅ Admin endpoints work WITH valid token');

    } catch (e) {
        console.error('\n❌ Test failed:');
        console.error('   Status:', e.response?.status);
        console.error('   Message:', e.response?.data?.message || e.message);
        process.exit(1);
    }
}

testPublicEndpoints();

const axios = require('axios');

// Configuration
const BASE_URL = process.env.API_URL || 'https://js-doc-store-server.091122c40cc6f8d0d421cbc90e2caca8.workers.dev';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@example.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

async function test() {
    console.log('══════════════════════════════════════════════════');
    console.log('   Testing DocStore Server Collaboration');
    console.log('══════════════════════════════════════════════════');
    console.log(`API URL: ${BASE_URL}`);
    console.log('');

    let token = null;
    let user = null;

    try {
        // Step 1: Bootstrap - Create first admin if no users exist
        console.log('Step 1: Attempting bootstrap...');
        try {
            const bootstrapRes = await axios.post(`${BASE_URL}/auth/bootstrap`, {
                email: ADMIN_EMAIL,
                password: ADMIN_PASSWORD,
                name: 'Test Admin'
            });
            console.log('✅ Bootstrap successful:', bootstrapRes.data.message);
            user = bootstrapRes.data.user;
        } catch (e) {
            if (e.response?.status === 403) {
                console.log('ℹ️ Bootstrap skipped - users already exist, proceeding to login');
            } else if (e.response?.data?.message?.includes('already exist')) {
                console.log('ℹ️ Bootstrap skipped - users already exist, proceeding to login');
            } else {
                console.log('ℹ️ Bootstrap error (may already have users):', e.response?.data?.message || e.message);
            }
        }

        // Step 2: Login
        console.log('\nStep 2: Logging in...');
        const loginRes = await axios.post(`${BASE_URL}/auth/login`, {
            email: ADMIN_EMAIL,
            password: ADMIN_PASSWORD
        });
        token = loginRes.data.token;
        user = loginRes.data.user;
        console.log('✅ Login successful');
        console.log('   User:', user.email);
        console.log('   Roles:', user.roles || ['user']);

        const authHeaders = { Authorization: `Bearer ${token}` };

        // Step 3: Create Table
        console.log('\nStep 3: Creating table...');
        const res1 = await axios.post(`${BASE_URL}/admin/create-table`, {
            tableName: 'test_collab',
            columns: [{ name: 'name', type: 'text', required: true }]
        }, { headers: authHeaders });
        console.log('✅ Table Creation:', res1.data.message);

        // Step 4: Insert Data
        console.log('\nStep 4: Inserting data...');
        const res2 = await axios.post(`${BASE_URL}/admin/insert`, {
            tableName: 'test_collab',
            data: { name: 'Agent-X', created: new Date().toISOString() }
        }, { headers: authHeaders });
        console.log('✅ Data Insertion - ID:', res2.data.id);

        // Step 5: Query Data
        console.log('\nStep 5: Querying data...');
        const res3 = await axios.post(`${BASE_URL}/admin/query`, {
            tableName: 'test_collab',
            filter: { _id: res2.data.id }
        }, { headers: authHeaders });
        console.log('✅ Query Result:', JSON.stringify(res3.data.data, null, 2));

        // Step 6: Test Public Tables Endpoint
        console.log('\nStep 6: Testing public tables endpoint...');
        const publicRes = await axios.get(`${BASE_URL}/public/tables`, {
            headers: authHeaders
        });
        console.log('✅ Public Tables:', publicRes.data.tables);

        // Step 7: Test Vector Collections
        console.log('\nStep 7: Testing vector collections...');
        const vecStats = await axios.get(`${BASE_URL}/admin/vector/stats`, {
            headers: authHeaders
        });
        console.log('✅ Vector Collections:', vecStats.data.collections?.length || 0, 'collections found');

        // Final Validation
        console.log('\n══════════════════════════════════════════════════');
        if (res3.data.data.length > 0 && res3.data.data[0]._id === res2.data.id) {
            console.log('🚀 ALL TESTS PASSED');
            console.log('   Server is correctly handling multi-agent requests');
        } else {
            console.error('❌ Test failed: Data not retrieved correctly');
            process.exit(1);
        }
        console.log('══════════════════════════════════════════════════');

    } catch (e) {
        console.error('\n❌ Error during testing:');
        console.error('   Status:', e.response?.status);
        console.error('   Message:', e.response?.data?.message || e.message);
        console.error('\nPossible fixes:');
        console.error('   - Set API_URL environment variable to your deployed URL');
        console.error('   - Set ADMIN_EMAIL and ADMIN_PASSWORD for first bootstrap');
        process.exit(1);
    }
}

test();

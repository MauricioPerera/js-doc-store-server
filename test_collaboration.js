const axios = require('axios');

async function test() {
    const URL = 'http://localhost:3000';
    console.log('Testing DocStore Server...');

    try {
        // 1. Create Table
        const res1 = await axios.post(`${URL}/create-table`, {
            tableName: 'test_collab',
            columns: [{ name: 'name', type: 'text', required: true }]
        });
        console.log('✅ Table Creation:', res1.data.message);

        // 2. Insert Data
        const res2 = await axios.post(`${URL}/insert`, {
            tableName: 'test_collab',
            data: { name: 'Agent-X' }
        });
        console.log('✅ Data Insertion:', res2.data.id);

        // 3. Query Data
        const res3 = await axios.post(`${URL}/query`, {
            tableName: 'test_collab',
            filter: { name: 'Agent-X' }
        });
        console.log('✅ Query Result:', res3.data.data);

        if (res3.data.data.length > 0 && res3.data.data[0].name === 'Agent-X') {
            console.log('🚀 ALL TESTS PASSED: Server is correctly handling multi-agent requests.');
        } else {
            console.error('❌ Test failed: Data not retrieved correctly.');
        }

    } catch (e) {
        console.error('❌ Error during testing:', e.message);
    }
}

test();

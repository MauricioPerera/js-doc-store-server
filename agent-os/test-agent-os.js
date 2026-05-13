import { AgentRuntimeManager } from "./core/agent-runtime.js";
import { VaultBridge } from "./core/vault-bridge.js";
import { ToolsFactory } from "./core/tools-factory.js";
import fs from "fs";
import os from "os";
import path from "path";

// Mock de la estructura del servidor original para la prueba
const mockServer = {
    vault: {
        decrypt: async (text) => "decrypted-api-key-123", // Simula descifrado exitoso
    },
    admin: {
        createTable: async (name, cols) => {
            console.log(`[Test] Creating table ${name} with columns ${cols}...`);
            return { success: true };
        },
        queryTable: async (name, filter) => {
            console.log(`[Test] Querying table ${name} with filter ${JSON.stringify(filter)}...`);
            return [{ id: '1', text: 'Test Data' }];
        }
    },
    PORT: 3000
};

async function runTests() {
    console.log('🧪 Starting Agent OS Integration Tests...\\n');

    try {
        // --- TEST 1: Vault Bridge ---
        console.log('Test 1: Vault Bridge Encryption/Decryption...');
        const vaultBridge = new VaultBridge(mockServer.vault);
        const syncSuccess = await vaultBridge.syncKey('anthropic', 'encrypted-string');
        const retrieved = await vaultBridge.getAuthStorage().getApiKey('anthropic');
        if (syncSuccess && retrieved === 'decrypted-api-key-123') {
            console.log('✅ Vault Bridge: SUCCESS');
        } else {
            throw new Error(`Vault Bridge failed to sync keys (got: ${JSON.stringify(retrieved)})`);
        }

        // --- TEST 2: Runtime Initialization ---
        console.log('\\nTest 2: Runtime & Session Management...');
        const runtime = new AgentRuntimeManager({
            cwd: process.cwd(),
            authStorage: vaultBridge.getAuthStorage(),
        });
        await runtime.initialize();
        if (runtime.getSession() && runtime.getSession().sessionId) {
            console.log('✅ Runtime Initialization: SUCCESS');
        } else {
            throw new Error('Runtime failed to initialize session');
        }

        // --- TEST 3: Tools Factory (DB Operations) ---
        console.log('\\nTest 3: DB Tools Execution...');
        const toolsFactory = new ToolsFactory(mockServer);
        const dbTools = toolsFactory.createDbTools();
        const createTool = dbTools.find(t => t.name === 'db_create_table');
        
        const createResult = await createTool.execute('test-id', { 
            tableName: 'test_table', 
            columns: ['col1', 'col2'] 
        });
        
        if (createResult.content[0].text.includes('Successfully')) {
            console.log('✅ DB Tool Execution: SUCCESS');
        } else {
            throw new Error('DB Tool failed to create table');
        }

        // --- TEST 4: Skill Management ---
        console.log('\\nTest 4: Skill Import & Reload...');
        const tmpAgentDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-os-test-'));
        fs.mkdirSync(path.join(tmpAgentDir, 'skills'), { recursive: true });
        let reloadCalled = false;
        const skillServer = {
            ...mockServer,
            agentRuntime: {
                agentDir: tmpAgentDir,
                getLoader: () => ({ reload: async () => { reloadCalled = true; } }),
            },
        };
        const skillFactory = new ToolsFactory(skillServer);
        const skillTools = skillFactory.createSkillTools();
        const importTool = skillTools.find(t => t.name === 'skill_import');

        const skillContent = '# Test Skill\\nThis is a test skill for validation.';
        const importResult = await importTool.execute('test-id', {
            skillName: 'test_validation_skill',
            content: skillContent
        });

        const writtenPath = path.join(tmpAgentDir, 'skills', 'test_validation_skill.md');
        const fileExists = fs.existsSync(writtenPath);
        fs.rmSync(tmpAgentDir, { recursive: true, force: true });

        if (importResult.content[0].text.includes('successfully') && fileExists && reloadCalled) {
            console.log('✅ Skill Import: SUCCESS');
        } else {
            throw new Error(`Skill import failed: ${importResult.content[0].text} (fileExists=${fileExists}, reloadCalled=${reloadCalled})`);
        }

        console.log('\\n==================================================');
        console.log('🎉 ALL TESTS PASSED SUCCESSFULLY');
        console.log('==================================================');

    } catch (error) {
        console.error('\\n❌ TEST FAILED:');
        console.error(error);
        process.exit(1);
    }
}

runTests();

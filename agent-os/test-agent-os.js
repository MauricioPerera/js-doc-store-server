import { AgentRuntimeManager } from "./core/agent-runtime.js";
import { VaultBridge } from "./core/vault-bridge.js";
import { ToolsFactory } from "./core/tools-factory.js";
import fs from "fs";
import os from "os";
import path from "path";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const { DocStore, MemoryStorageAdapter, Table } = require("../js-doc-store.js");

const mockServer = {
    vault: {
        decrypt: async () => "decrypted-api-key-123",
    },
};

const assert = (cond, msg) => {
    if (!cond) throw new Error(`Assertion failed: ${msg}`);
};

const findTool = (tools, name) => {
    const t = tools.find((x) => x.name === name);
    if (!t) throw new Error(`Tool not registered: ${name}`);
    return t;
};

const ok = (result) => /Error:/.test(result.content[0].text) === false;
const text = (result) => result.content[0].text;

async function runTests() {
    console.log("🧪 Starting Agent OS Integration Tests...\n");
    try {
        // --- TEST 1: Vault Bridge ---
        console.log("Test 1: Vault Bridge sync...");
        const vaultBridge = new VaultBridge(mockServer.vault);
        const syncSuccess = await vaultBridge.syncKey("anthropic", "encrypted-string");
        const retrieved = await vaultBridge.getAuthStorage().getApiKey("anthropic");
        assert(syncSuccess && retrieved === "decrypted-api-key-123", `vault round-trip got: ${JSON.stringify(retrieved)}`);
        console.log("✅ Vault Bridge");

        // --- TEST 2: Runtime init ---
        console.log("\nTest 2: Runtime & Session Management...");
        const runtime = new AgentRuntimeManager({
            cwd: process.cwd(),
            authStorage: vaultBridge.getAuthStorage(),
        });
        await runtime.initialize();
        assert(runtime.getSession()?.sessionId, "runtime session id missing");
        console.log("✅ Runtime init");

        // --- TEST 3: DB tools against a real in-memory DocStore ---
        console.log("\nTest 3: DB tools (real DocStore + MemoryStorageAdapter)...");
        const adapter = new MemoryStorageAdapter();
        const db = new DocStore(adapter);
        const factory = new ToolsFactory({ db, Table, agentRuntime: runtime });
        const tools = factory.createDbTools();

        const listTool = findTool(tools, "db_list_tables");
        const createTool = findTool(tools, "db_create_table");
        const describeTool = findTool(tools, "db_describe_table");
        const addColTool = findTool(tools, "db_add_column");
        const dropTool = findTool(tools, "db_drop_table");
        const insertTool = findTool(tools, "db_insert");
        const findToolFn = findTool(tools, "db_find");
        const findOneTool = findTool(tools, "db_find_one");
        const updateTool = findTool(tools, "db_update");
        const countTool = findTool(tools, "db_count");
        const removeTool = findTool(tools, "db_remove");
        const aggTool = findTool(tools, "db_aggregate");

        // 3.1 list (empty)
        const list0 = await listTool.execute("t", {});
        assert(ok(list0) && text(list0).includes("[]"), "expected empty list");

        // 3.2 create with schema
        const create = await createTool.execute("t", {
            tableName: "contacts",
            columns: [
                { name: "name", type: "text", required: true },
                { name: "email", type: "email", unique: true },
                { name: "active", type: "checkbox" },
            ],
        });
        assert(ok(create), `create failed: ${text(create)}`);

        // 3.3 list after create
        const list1 = await listTool.execute("t", {});
        assert(text(list1).includes("contacts"), "contacts not listed");

        // 3.4 describe
        const desc = await describeTool.execute("t", { tableName: "contacts" });
        assert(text(desc).includes("\"email\""), "describe missing email column");

        // 3.5 system-table block
        const sysBlock = await createTool.execute("t", { tableName: "_secret", columns: [] });
        assert(!ok(sysBlock), "system table creation should be blocked");

        // 3.6 insert (valid)
        const ins1 = await insertTool.execute("t", { tableName: "contacts", doc: { name: "Ada", email: "ada@x.io", active: true } });
        assert(ok(ins1), `insert failed: ${text(ins1)}`);
        const ins2 = await insertTool.execute("t", { tableName: "contacts", doc: { name: "Lin", email: "lin@x.io", active: false } });
        assert(ok(ins2), `insert2 failed: ${text(ins2)}`);

        // 3.7 insert invalid (missing required)
        const insBad = await insertTool.execute("t", { tableName: "contacts", doc: { email: "bad@x.io" } });
        assert(!ok(insBad), "invalid insert should fail");

        // 3.8 find with filter
        const found = await findToolFn.execute("t", { tableName: "contacts", filter: { active: true } });
        assert(text(found).includes("ada@x.io") && !text(found).includes("lin@x.io"), "find filter mismatch");

        // 3.9 find limit cap
        const findMax = await findToolFn.execute("t", { tableName: "contacts", limit: 99999 });
        assert(findMax.details.limit === 1000, `expected cap 1000, got ${findMax.details.limit}`);

        // 3.10 find_one
        const one = await findOneTool.execute("t", { tableName: "contacts", filter: { name: "Ada" } });
        assert(text(one).includes("ada@x.io"), "find_one missed Ada");

        // 3.11 count
        const c = await countTool.execute("t", { tableName: "contacts", filter: {} });
        assert(c.details.count === 2, `expected 2 docs, got ${c.details.count}`);

        // 3.12 update
        const upd = await updateTool.execute("t", { tableName: "contacts", filter: { name: "Lin" }, update: { $set: { active: true } } });
        assert(upd.details.modified === 1, `expected 1 modified, got ${upd.details.modified}`);
        const afterUpd = await countTool.execute("t", { tableName: "contacts", filter: { active: true } });
        assert(afterUpd.details.count === 2, "update did not flip Lin");

        // 3.13 add_column
        const addCol = await addColTool.execute("t", { tableName: "contacts", column: { name: "tag", type: "text" } });
        assert(ok(addCol), `addColumn failed: ${text(addCol)}`);

        // 3.14 remove without confirm
        const removeBad = await removeTool.execute("t", { tableName: "contacts", filter: { active: true } });
        assert(!ok(removeBad), "remove without confirm should be rejected");

        // 3.15 remove with confirm
        const removeOk = await removeTool.execute("t", { tableName: "contacts", filter: { name: "Lin" }, confirm: true });
        assert(removeOk.details.removed === 1, `expected 1 removed, got ${removeOk.details.removed}`);

        // 3.16 aggregate group/sort
        await insertTool.execute("t", { tableName: "contacts", doc: { name: "Bea", email: "bea@x.io", active: true } });
        const agg = await aggTool.execute("t", {
            tableName: "contacts",
            pipeline: [
                { stage: "match", params: { active: true } },
                { stage: "sort", params: { name: 1 } },
            ],
        });
        assert(text(agg).indexOf("Ada") < text(agg).indexOf("Bea"), "aggregate sort wrong");

        // 3.17 drop without confirm
        const dropBad = await dropTool.execute("t", { tableName: "contacts" });
        assert(!ok(dropBad), "drop without confirm should be rejected");

        // 3.18 drop with confirm
        const dropOk = await dropTool.execute("t", { tableName: "contacts", confirm: true });
        assert(ok(dropOk), `drop failed: ${text(dropOk)}`);
        const list2 = await listTool.execute("t", {});
        assert(!text(list2).includes("contacts"), "contacts still listed after drop");

        console.log("✅ DB tools (18 sub-assertions)");

        // --- TEST 4: Skill Import ---
        console.log("\nTest 4: Skill Import & Reload...");
        const tmpAgentDir = fs.mkdtempSync(path.join(os.tmpdir(), "agent-os-test-"));
        fs.mkdirSync(path.join(tmpAgentDir, "skills"), { recursive: true });
        let reloadCalled = false;
        const skillFactory = new ToolsFactory({
            db,
            Table,
            agentRuntime: {
                agentDir: tmpAgentDir,
                getLoader: () => ({ reload: async () => { reloadCalled = true; } }),
            },
        });
        const importTool = findTool(skillFactory.createSkillTools(), "skill_import");
        const result = await importTool.execute("t", { skillName: "test_skill", content: "# Test" });
        const written = path.join(tmpAgentDir, "skills", "test_skill.md");
        const exists = fs.existsSync(written);
        fs.rmSync(tmpAgentDir, { recursive: true, force: true });
        assert(ok(result) && exists && reloadCalled, `skill import failed: text=${text(result)} exists=${exists} reload=${reloadCalled}`);
        console.log("✅ Skill Import");

        console.log("\n==================================================");
        console.log("🎉 ALL TESTS PASSED SUCCESSFULLY");
        console.log("==================================================");
    } catch (error) {
        console.error("\n❌ TEST FAILED:");
        console.error(error);
        process.exit(1);
    }
}

runTests();

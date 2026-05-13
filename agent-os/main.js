import express from "express";
import path from "path";
import http from "http";
import { fileURLToPath } from "url";
import { createRequire } from "module";

import { AgentRuntimeManager } from "./core/agent-runtime.js";
import { VaultBridge } from "./core/vault-bridge.js";
import { ToolsFactory } from "./core/tools-factory.js";
import { SocketHandler } from "./api/socket-handler.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const { startServer } = require("../server.js");
const { Table } = require("../js-doc-store.js");

function buildAdmin(db, getTable) {
    return {
        async createTable(name, columns) {
            const cols = (columns || []).map((c) =>
                typeof c === "string" ? { name: c, type: "string" } : c,
            );
            const table = new Table(db, name, { columns: cols });
            return { name: table.name, columns: table.columns };
        },
        async queryTable(name, filter = {}, limit) {
            let cursor = db.collection(name).find(filter);
            if (typeof limit === "number") cursor = cursor.limit(limit);
            return cursor.toArray();
        },
    };
}

async function bootAgentOS() {
    console.log("🚀 Booting Agent OS Layer...");

    const ctx = await startServer({ listen: false });
    const { app, db, vaultCrypto, getTable, PORT } = ctx;

    const vaultBridge = new VaultBridge(vaultCrypto);

    const runtimeManager = new AgentRuntimeManager({
        cwd: path.join(__dirname, ".."),
        authStorage: vaultBridge.getAuthStorage(),
        ollama: {
            baseUrl: process.env.AGENT_OLLAMA_BASE_URL || "http://localhost:11434/v1",
            model: process.env.AGENT_OLLAMA_MODEL || "gemma4:31b-cloud",
        },
    });
    await runtimeManager.initialize();

    const admin = buildAdmin(db, getTable);
    const toolsFactory = new ToolsFactory({
        admin,
        agentRuntime: runtimeManager,
    });
    const allTools = toolsFactory.createAllTools();

    const session = runtimeManager.getSession();
    session.agent.state.tools = [...session.agent.state.tools, ...allTools];

    const httpServer = http.createServer(app);
    new SocketHandler(httpServer, runtimeManager);

    app.use("/agent-ui", express.static(path.join(__dirname, "public")));

    httpServer.listen(PORT, () => {
        console.log(`\n✨ Agent OS is now LIVE`);
        console.log(`🌐 Web UI: http://localhost:${PORT}/agent-ui`);
        console.log(`🧠 Runtime: Connected to DocStore Database`);
        console.log(`🔐 Vault: Bridge active via VaultCrypto`);
    });
}

bootAgentOS().catch((err) => {
    console.error("[AgentOS] Boot failed:", err);
    process.exit(1);
});

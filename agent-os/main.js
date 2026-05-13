import express from "express";
import path from "path";
import http from "http";
import { fileURLToPath } from "url";
import { createRequire } from "module";

if (process.env.AGENT_DEBUG_HTTP) {
    const origFetch = globalThis.fetch;
    globalThis.fetch = async (url, opts) => {
        const u = typeof url === "string" ? url : url?.url || String(url);
        if (u.includes("/chat/completions") || u.includes("/v1/")) {
            console.error("[HTTP-OUT]", u);
            if (opts?.body) {
                const body = typeof opts.body === "string" ? opts.body : "[non-string body]";
                try {
                    const parsed = JSON.parse(body);
                    console.error("[HTTP-OUT model]", parsed.model);
                    console.error("[HTTP-OUT tools count]", Array.isArray(parsed.tools) ? parsed.tools.length : "(no tools key)");
                    if (Array.isArray(parsed.tools)) {
                        console.error("[HTTP-OUT tool names]", parsed.tools.map((t) => t.function?.name || t.name).join(", "));
                    }
                    console.error("[HTTP-OUT messages count]", parsed.messages?.length);
                } catch {
                    console.error("[HTTP-OUT body]", body.slice(0, 500));
                }
            }
        }
        const res = await origFetch(url, opts);
        return res;
    };
}

import { AgentRuntimeManager } from "./core/agent-runtime.js";
import { VaultBridge } from "./core/vault-bridge.js";
import { ToolsFactory } from "./core/tools-factory.js";
import { SocketHandler } from "./api/socket-handler.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const { startServer } = require("../server.js");
const { Table } = require("../js-doc-store.js");

async function bootAgentOS() {
    console.log("🚀 Booting Agent OS Layer...");

    const ctx = await startServer({ listen: false });
    const { app, db, vaultCrypto, PORT } = ctx;

    const vaultBridge = new VaultBridge(vaultCrypto);

    const runtimeManager = new AgentRuntimeManager({
        cwd: path.join(__dirname, ".."),
        authStorage: vaultBridge.getAuthStorage(),
        ollama: {
            baseUrl: process.env.AGENT_OLLAMA_BASE_URL || "http://localhost:11434/v1",
            model: process.env.AGENT_OLLAMA_MODEL || "gemma4:31b-cloud",
        },
    });

    // ToolsFactory needs `agentRuntime` only for skill_import (lazy). Build it
    // before initialize() so we can pass customTools into the session, then
    // wire the runtime back afterwards.
    const toolsFactory = new ToolsFactory({ db, Table, agentRuntime: null });
    runtimeManager.setCustomTools(toolsFactory.createAllTools());

    await runtimeManager.initialize();
    toolsFactory.agentRuntime = runtimeManager;

    const session = runtimeManager.getSession();
    console.log(`[AgentOS] active tools: ${session.getActiveToolNames().join(", ")}`);

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

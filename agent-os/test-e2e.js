import { io } from "socket.io-client";
import { createRequire } from "module";
import path from "path";
import { fileURLToPath } from "url";

// End-to-end smoke test: assumes `node main.js` is already running on PORT.
// Logs in via POST /auth/login using credentials from the parent .env
// (ADMIN_EMAIL/ADMIN_PASSWORD), opens a socket with the resulting JWT,
// sends one prompt, streams the response, and exits on agent_end or after
// a 90s wall-clock timeout.
//
// Override credentials with E2E_EMAIL/E2E_PASSWORD. Skip auth with
// AGENT_OS_DISABLE_AUTH=1 (must match the server flag).

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const dotenv = require("dotenv");
dotenv.config({ path: path.resolve(__dirname, "..", ".env") });

const PORT = process.env.PORT || 3000;
const URL = `http://localhost:${PORT}`;
const PROMPT = process.argv[2] || "Saluda en una sola frase corta en español.";
const TIMEOUT_MS = 90_000;
const SKIP_AUTH = process.env.AGENT_OS_DISABLE_AUTH === "1";

async function postJson(pathname, body) {
    const res = await fetch(`${URL}${pathname}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data };
}

async function loginForToken() {
    const email = process.env.E2E_EMAIL || process.env.ADMIN_EMAIL;
    const password = process.env.E2E_PASSWORD || process.env.ADMIN_PASSWORD;
    if (!email || !password) {
        throw new Error(
            "E2E auth: set E2E_EMAIL/E2E_PASSWORD or ADMIN_EMAIL/ADMIN_PASSWORD, or run server with AGENT_OS_DISABLE_AUTH=1.",
        );
    }
    let login = await postJson("/auth/login", { email, password });
    if (!login.ok) {
        // Maybe no admin exists yet. Try bootstrap, then retry login regardless
        // of bootstrap's response — bootstrap can return an error after a
        // successful user creation, and a second run on the same data would
        // hit "users already exist" while the user is in fact ready to log in.
        await postJson("/auth/bootstrap", { email, password, name: "Agent OS" });
        login = await postJson("/auth/login", { email, password });
        if (login.ok) console.log("[e2e] bootstrapped admin user");
    }
    if (!login.ok || !login.data.token) {
        throw new Error(`Login failed (HTTP ${login.status}): ${login.data.message || "unknown"}`);
    }
    return login.data.token;
}

async function main() {
    const token = SKIP_AUTH ? null : await loginForToken();
    if (token) console.log("[e2e] obtained admin token");

    const socket = io(URL, {
        transports: ["websocket", "polling"],
        auth: token ? { token } : undefined,
    });

    let collected = "";
    let done = false;
    const finish = (reason, code = 0) => {
        if (done) return;
        done = true;
        console.log(`\n--- finished (${reason}) ---`);
        console.log("response text:");
        console.log(collected || "(empty)");
        socket.close();
        process.exit(code);
    };
    const timer = setTimeout(() => finish("timeout", 1), TIMEOUT_MS);

    socket.on("connect", () => {
        console.log(`[e2e] connected as ${socket.id}, sending prompt...`);
        socket.emit("agent:prompt", { text: PROMPT });
    });
    socket.on("agent:session:updated", ({ sessionId }) => {
        console.log(`[e2e] session=${sessionId}`);
    });
    socket.on("agent:event", (event) => {
        if (process.env.E2E_VERBOSE) {
            const inner = event.assistantMessageEvent?.type
                ? ` / ${event.assistantMessageEvent.type}`
                : "";
            console.log(`[e2e] event: ${event.type}${inner}`);
        }
        if (
            event.type === "message_update" &&
            event.assistantMessageEvent?.type === "text_delta"
        ) {
            process.stdout.write(event.assistantMessageEvent.delta);
            collected += event.assistantMessageEvent.delta;
        } else if (event.type === "tool_execution_start") {
            console.log(`\n[e2e] tool_start: ${event.toolName} args=${JSON.stringify(event.args)}`);
        } else if (event.type === "tool_execution_end") {
            console.log(`[e2e] tool_end: ${event.toolName} error=${event.isError} result=${JSON.stringify(event.result).slice(0, 200)}`);
        } else if (event.type === "agent_end") {
            clearTimeout(timer);
            finish("agent_end");
        }
    });
    socket.on("agent:error", ({ message }) => {
        clearTimeout(timer);
        console.error(`[e2e] agent:error: ${message}`);
        finish("agent:error", 1);
    });
    socket.on("connect_error", (err) => {
        clearTimeout(timer);
        console.error(`[e2e] connect_error: ${err.message}`);
        finish("connect_error", 1);
    });
}

main().catch((err) => {
    console.error(`[e2e] fatal: ${err.message}`);
    process.exit(1);
});

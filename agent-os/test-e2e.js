import { io } from "socket.io-client";

// End-to-end smoke test: assumes `node main.js` is already running on PORT.
// Connects a socket, sends one prompt, streams the response, exits when
// the agent finishes (`agent_end`) or a 90s wall-clock timeout elapses.

const PORT = process.env.PORT || 3000;
const URL = `http://localhost:${PORT}`;
const PROMPT = process.argv[2] || "Saluda en una sola frase corta en español.";
const TIMEOUT_MS = 90_000;

const socket = io(URL, { transports: ["websocket", "polling"] });
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

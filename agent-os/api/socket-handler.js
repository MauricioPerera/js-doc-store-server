import { Server } from "socket.io";

/**
 * SocketHandler bridges the Agent Runtime to connected Web UI clients.
 * One subscription per (socket, in-flight prompt) — released on agent_end
 * or on socket disconnect, so subscribers don't accumulate across prompts.
 */
class SocketHandler {
    constructor(server, agentRuntime) {
        this.io = new Server(server, {
            cors: { origin: "*", methods: ["GET", "POST"] },
        });
        this.agentRuntime = agentRuntime;
        this.setupListeners();
    }

    setupListeners() {
        this.io.on("connection", (socket) => {
            console.log(`[SocketHandler] Client connected: ${socket.id}`);

            const activeUnsubs = new Set();

            const sendInitialState = () => {
                const session = this.agentRuntime.getSession();
                if (session?.sessionId) {
                    socket.emit("agent:session:updated", { sessionId: session.sessionId });
                }
            };
            sendInitialState();

            socket.on("agent:prompt", async (data) => {
                const { text, options } = data || {};
                let unsubscribe = null;
                try {
                    const session = this.agentRuntime.getSession();
                    unsubscribe = session.subscribe((event) => {
                        socket.emit("agent:event", event);
                        if (event.type === "agent_end" && unsubscribe) {
                            unsubscribe();
                            activeUnsubs.delete(unsubscribe);
                            unsubscribe = null;
                        }
                    });
                    activeUnsubs.add(unsubscribe);
                    await this.agentRuntime.prompt(text, options);
                } catch (e) {
                    if (unsubscribe) {
                        unsubscribe();
                        activeUnsubs.delete(unsubscribe);
                    }
                    socket.emit("agent:error", { message: e.message });
                }
            });

            socket.on("agent:session:new", async () => {
                try {
                    const session = await this.agentRuntime.createNewSession();
                    socket.emit("agent:session:updated", { sessionId: session.sessionId });
                } catch (e) {
                    socket.emit("agent:error", { message: e.message });
                }
            });

            socket.on("agent:session:switch", async ({ sessionId }) => {
                try {
                    const session = await this.agentRuntime.switchSession(sessionId);
                    socket.emit("agent:session:updated", { sessionId: session.sessionId });
                } catch (e) {
                    socket.emit("agent:error", { message: e.message });
                }
            });

            socket.on("disconnect", () => {
                for (const unsub of activeUnsubs) {
                    try { unsub(); } catch {}
                }
                activeUnsubs.clear();
                console.log(`[SocketHandler] Client disconnected: ${socket.id}`);
            });
        });
    }

    broadcast(event, data) {
        this.io.emit(event, data);
    }
}

export { SocketHandler };

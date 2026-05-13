import { Server } from "socket.io";

/**
 * SocketHandler bridges the Agent Runtime to connected Web UI clients.
 *
 * Auth: every connection must present a JWT via socket.handshake.auth.token
 * (issued by POST /auth/login on the host server) that resolves to a user
 * with the 'admin' role. Set AGENT_OS_DISABLE_AUTH=1 to bypass (dev only —
 * an unauthenticated agent endpoint is a destructive open admin surface).
 *
 * One subscription per (socket, in-flight prompt) — released on agent_end
 * or on socket disconnect, so subscribers don't accumulate.
 */
class SocketHandler {
    constructor(server, agentRuntime, options = {}) {
        this.io = new Server(server, {
            cors: { origin: "*", methods: ["GET", "POST"] },
        });
        this.agentRuntime = agentRuntime;
        this.auth = options.auth || null;
        this.requireAdmin = options.requireAdmin !== false;
        this.disableAuth = !!options.disableAuth;
        if (this.disableAuth) {
            console.warn("[SocketHandler] ⚠️  AUTH DISABLED — WebSocket open to any client. Dev only.");
        } else if (!this.auth) {
            throw new Error("SocketHandler: { auth } is required when auth is enabled.");
        }
        this.setupAuth();
        this.setupListeners();
    }

    setupAuth() {
        if (this.disableAuth) return;
        this.io.use(async (socket, next) => {
            try {
                const token = socket.handshake.auth?.token;
                if (!token) return next(new Error("Unauthorized: missing token"));
                const payload = await this.auth.verify(token);
                if (!payload) return next(new Error("Unauthorized: invalid or expired token"));
                if (this.requireAdmin && !payload.roles?.includes("admin")) {
                    return next(new Error("Forbidden: admin role required"));
                }
                socket.data.user = payload;
                next();
            } catch (e) {
                next(new Error(`Auth error: ${e.message}`));
            }
        });
    }

    setupListeners() {
        this.io.on("connection", (socket) => {
            const user = socket.data.user;
            const who = user ? `${user.email || user._id}` : "anonymous";
            console.log(`[SocketHandler] Client connected: ${socket.id} (${who})`);

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

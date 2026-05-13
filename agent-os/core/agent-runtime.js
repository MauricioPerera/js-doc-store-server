import {
    createAgentSession,
    createAgentSessionRuntime,
    SessionManager,
    ModelRegistry,
    DefaultResourceLoader,
} from "@earendil-works/pi-coding-agent";
import path from "path";

const DEFAULT_OLLAMA_BASE = "http://localhost:11434/v1";
const DEFAULT_OLLAMA_MODEL = "gemma4:31b-cloud";

class AgentRuntimeManager {
    constructor(options) {
        this.cwd = options.cwd || process.cwd();
        this.agentDir = options.agentDir || path.join(this.cwd, ".pi/agent");
        this.authStorage = options.authStorage;
        this.modelRegistry = ModelRegistry.create(this.authStorage);
        this.ollama = {
            baseUrl: options.ollama?.baseUrl || DEFAULT_OLLAMA_BASE,
            model: options.ollama?.model || DEFAULT_OLLAMA_MODEL,
            displayName: options.ollama?.displayName,
            contextWindow: options.ollama?.contextWindow || 32768,
            maxTokens: options.ollama?.maxTokens || 8192,
        };
        this.customTools = options.customTools || [];
        this.runtime = null;
        this.currentSession = null;
        this.model = null;
    }

    setCustomTools(tools) {
        this.customTools = tools || [];
    }

    registerOllamaProvider() {
        const modelId = this.ollama.model;
        const name = this.ollama.displayName || modelId;
        this.modelRegistry.registerProvider("ollama", {
            baseUrl: this.ollama.baseUrl,
            apiKey: "ollama",
            api: "openai-completions",
            models: [
                {
                    id: modelId,
                    name,
                    api: "openai-completions",
                    provider: "ollama",
                    baseUrl: this.ollama.baseUrl,
                    contextWindow: this.ollama.contextWindow,
                    maxTokens: this.ollama.maxTokens,
                    input: ["text"],
                    reasoning: false,
                    // pi-ai's calculateCost reads model.cost.{input,output,cacheRead,cacheWrite};
                    // Ollama is local/free so zeros are correct, but the keys must exist.
                    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
                },
            ],
        });
        this.model = this.modelRegistry.find("ollama", modelId);
        if (!this.model) {
            throw new Error(
                `[AgentRuntime] Failed to register Ollama model ${modelId} at ${this.ollama.baseUrl}`,
            );
        }
    }

    async initialize() {
        this.registerOllamaProvider();

        this.loader = new DefaultResourceLoader({
            cwd: this.cwd,
            agentDir: this.agentDir,
        });
        await this.loader.reload();

        const createRuntimeFactory = async ({ cwd, sessionManager }) => {
            const { session } = await createAgentSession({
                cwd,
                agentDir: this.agentDir,
                authStorage: this.authStorage,
                modelRegistry: this.modelRegistry,
                sessionManager,
                resourceLoader: this.loader,
                model: this.model,
                customTools: this.customTools,
            });
            return { session };
        };

        this.runtime = await createAgentSessionRuntime(createRuntimeFactory, {
            cwd: this.cwd,
            agentDir: this.agentDir,
            sessionManager: SessionManager.create(this.cwd),
        });

        this.currentSession = this.runtime.session;
        console.log(
            `[AgentRuntime] Initialized. Session=${this.currentSession.sessionId} model=${this.model.provider}/${this.model.id}`,
        );
    }

    async prompt(text, options = {}) {
        if (!this.currentSession) throw new Error("Runtime not initialized");
        return await this.currentSession.prompt(text, options);
    }

    async switchSession(sessionId) {
        if (!this.runtime) throw new Error("Runtime not initialized");
        await this.runtime.switchSession(sessionId);
        this.currentSession = this.runtime.session;
        return this.currentSession;
    }

    async createNewSession() {
        if (!this.runtime) throw new Error("Runtime not initialized");
        await this.runtime.newSession();
        this.currentSession = this.runtime.session;
        return this.currentSession;
    }

    getSession() {
        return this.currentSession;
    }

    getLoader() {
        return this.loader;
    }
}

export { AgentRuntimeManager };

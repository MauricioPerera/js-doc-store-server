# Agent OS — Intelligence Layer for DocStore

Agent OS embeds an LLM-driven agent runtime directly into the `js-doc-store-server` process. The agent shares the host server's database, vault, and HTTP server, so it can manipulate the data plane through tool calls instead of through external HTTP requests.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                       Agent OS (Node)                       │
│                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────┐  │
│  │  Vault       │  │  Runtime     │  │  Tools Factory    │  │
│  │  Bridge      │→ │  Manager     │← │  (db, skills)     │  │
│  │ (decrypt →   │  │ (pi-coding-  │  │                   │  │
│  │  AuthStorage)│  │  agent SDK)  │  │                   │  │
│  └──────┬───────┘  └──────┬───────┘  └─────────┬─────────┘  │
│         │                 │                    │            │
│         │            ┌────▼────┐               │            │
│         │            │ Session │               │            │
│         │            └────┬────┘               │            │
│         │                 │ events             │            │
│         │            ┌────▼────────┐           │            │
│         │            │ SocketHandler│ ────────►│ Web UI     │
│         │            └─────────────┘           │ (public/)  │
│         │                                      │            │
│  ┌──────▼──────────────────────────────────────▼─────────┐  │
│  │              server.js  (DocStore + Express)          │  │
│  │  VaultCrypto · DocStore · Table · Auth · /admin/*     │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                         ▲
                         │ http://localhost:11434/v1
                  ┌──────┴──────┐
                  │   Ollama    │  gemma4:31b-cloud (default)
                  └─────────────┘
```

### Layers

| Layer | Path | Responsibility |
|---|---|---|
| Runtime | `core/agent-runtime.js` | Wraps `@earendil-works/pi-coding-agent`. Registers the Ollama provider, owns the session lifecycle. |
| Bridge | `core/vault-bridge.js` | Pulls encrypted credentials out of `VaultCrypto` and injects them into the SDK's `AuthStorage`. |
| Tools | `core/tools-factory.js` | Defines the "super-tools" the agent calls: `db_create_table`, `db_query`, `skill_list`, `skill_import`. |
| API | `api/socket-handler.js` | Bridges `session.subscribe()` events to socket.io clients. Subscribes per prompt, releases on `agent_end` and on disconnect. |
| UI | `public/` | Static SPA. Streams `text_delta` deltas, surfaces tool calls. |
| Boot | `main.js` | Imports `server.js`, calls `startServer({ listen: false })`, wires everything, then `httpServer.listen(PORT)`. |

## Tools

| Name | Purpose | Backing call |
|---|---|---|
| `db_create_table` | Create a Table with given columns | `new Table(db, name, { columns })` |
| `db_query` | Filter + limit a collection | `db.collection(name).find(filter).limit(n).toArray()` |
| `skill_list` | List loaded skills | `resourceLoader.getSkills()` |
| `skill_import` | Write a `.md` skill and reload | `fs.writeFileSync(...)` + `resourceLoader.reload()` |

Column parameters arrive as `string[]` from the tool schema; `main.js`'s `buildAdmin()` adapter promotes them to `{ name, type: 'string' }` before reaching `Table`. Tighten the schema in `tools-factory.js` if you need full column metadata.

## Setup

### Prerequisites

- Node ≥ 20 (uses ESM in `agent-os/`, top-level `await`).
- Ollama running on `http://localhost:11434` (default) with the target model pulled. Default: `gemma4:31b-cloud`.
- `.env` in the parent directory with `JWT_SECRET`, `VAULT_SECRET`, `DB_ENCRYPTION_KEY` (see `../.env.example`).

### Install & run

```bash
# In the repo root (../):
npm install

# From agent-os/:
cd agent-os
npm install
npm start                    # boots server.js + agent-os layer on :3000
```

Open `http://localhost:3000/agent-ui/` for the chat UI. The original DocStore dashboard remains on `http://localhost:3000/`.

### Configuration (env vars)

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `3000` | HTTP port (read by `server.js`). |
| `AGENT_OLLAMA_BASE_URL` | `http://localhost:11434/v1` | Ollama OpenAI-compatible endpoint. |
| `AGENT_OLLAMA_MODEL` | `gemma4:31b-cloud` | Model id to register and use by default. |
| `JWT_SECRET`, `VAULT_SECRET`, `DB_ENCRYPTION_KEY` | — | Required by `server.js`; see `../.env.example`. |

Any model Ollama can serve via its OpenAI-compatible API works (e.g. `qwen3.6:latest`, `gpt-oss:20b`, `granite4.1:3b`). Swap the env var and restart.

## Tests

```bash
# Unit/integration with mocks (no network, no Ollama):
node test-agent-os.js

# End-to-end (requires main.js running on PORT and Ollama reachable):
node main.js &                # background
node test-e2e.js "Saluda en una frase"
```

`test-agent-os.js` covers the four core wirings (Vault bridge, runtime init, db tool, skill import) using injected mocks. `test-e2e.js` is a socket.io client that sends one prompt and streams the response — it is the gate that proves the model is actually reachable.

## Implementation notes

- `agent-os/` is ESM (`"type": "module"`); `server.js` and `js-doc-store.js` stay CommonJS. `main.js` bridges them via `createRequire(import.meta.url)`.
- `server.js` was refactored to (a) tolerate a missing `.env`, (b) expose `startServer({ listen })` returning `{ app, db, vaultCrypto, getTable, auth, PORT, httpServer }`, and (c) only auto-listen when run as `node server.js` (`require.main === module`).
- The Ollama provider is registered at runtime via `ModelRegistry.registerProvider("ollama", ...)` with `api: "openai-completions"` — there is no built-in `ollama` provider in `@earendil-works/pi-ai`.
- `SocketHandler` tracks the per-socket `unsubscribe` callbacks in a `Set` and releases them on `agent_end` and on `disconnect`. The earlier version leaked one listener per prompt.
- The UI filters `message_update` events to `assistantMessageEvent.type === 'text_delta'`. The other event variants (`text_start`, `thinking_delta`, `text_end`, etc.) are part of the union and must not be rendered as reply text.

## Roadmap

- [x] `VaultBridge` for credential resolution.
- [x] `AgentRuntimeManager` with session + Ollama provider.
- [x] `ToolsFactory` for DB and skill manipulation.
- [x] WebSocket handler with proper subscription lifecycle.
- [x] Agent Web UI (chat + sessions).
- [x] End-to-end smoke test against a live model.
- [ ] Enrich `db_create_table` schema to accept column metadata (`type`, `unique`, `required`).
- [ ] UI: list skills, switch between sessions, surface tool args/results.
- [ ] Persist `AuthStorage` to disk (currently lives in memory per process).
- [ ] Authentication on the WebSocket (JWT from the existing `auth` system).

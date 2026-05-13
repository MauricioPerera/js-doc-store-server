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

The factory exposes full CRUD over both schema and data.

### Schema

| Name | Purpose | Destructive |
|---|---|---|
| `db_list_tables` | List user tables (system tables hidden) | — |
| `db_create_table` | Create a table with typed columns | — |
| `db_describe_table` | Return column schema | — |
| `db_add_column` | Add a column to an existing table | — |
| `db_remove_column` | Drop a column. Requires `confirm:true` | yes |
| `db_drop_table` | Delete a table and all its data. Requires `confirm:true` | yes |

### Data

| Name | Purpose | Destructive |
|---|---|---|
| `db_insert` | Insert one document; schema validation runs if columns are typed | — |
| `db_find` | Filter + sort + skip + limit. Default limit 50, max 1000 | — |
| `db_find_one` | First match or `null` | — |
| `db_update` | Update with Mongo-style operators (`$set`, `$inc`, `$push`, …) | — |
| `db_count` | Count matching documents | — |
| `db_remove` | Delete matching docs. Requires `confirm:true` | yes |
| `db_aggregate` | Pipeline with `match`/`sort`/`limit`/`skip`/`project`/`group`/`unwind`/`lookup` | — |

### Skills

| Name | Purpose |
|---|---|
| `skill_list` | List loaded skills |
| `skill_import` | Write a `.md` skill and reload the resource loader |

### Safety rules baked into the factory

- **System tables blocked.** Any name starting with `_` (e.g. `_users`, `_sessions`, `_schemas`) is rejected. Read and write paths both check.
- **Confirmation required for destructive ops.** `db_drop_table`, `db_remove_column`, `db_remove` refuse to run without `confirm: true`. Without it they return a short impact summary (e.g. "Refusing to remove 42 document(s) from 'todos' without confirm:true").
- **Find limit capped.** `db_find` defaults to 50 results and silently clamps any value above 1000.

### Column types

`text`, `number`, `checkbox`, `date`, `email`, `url`, `phone`, `select` (with `options`), `multiselect`, `relation` (use `collection`), `json`, `attachment`, `autonumber`. Per-column flags: `required`, `unique`, `default`.

The schema persists to `{tableName}.schema.json` automatically when columns change. The factory rebuilds `Table` instances from disk on first access so columns survive restarts (DocStore's `Table` constructor only loads `autoNum`/`views`, not columns).

## Authentication

The WebSocket requires a JWT with the `admin` role. Every connection must include the token in the socket.io handshake:

```js
const socket = io({ auth: { token } });
```

The token is obtained from the host server's `POST /auth/login`, which already exists in `server.js`. On a clean install, call `POST /auth/bootstrap` once with the credentials from `.env` (`ADMIN_EMAIL`/`ADMIN_PASSWORD`) — this creates the first admin user and persists it via `dbAdapter.persist()` (the auto-persist interval used to leave a window where the user only existed in RAM and disappeared on the next restart). The UI handles all of this automatically: it shows a login overlay on first visit, stores the token in `localStorage`, and re-prompts when the server rejects the connection.

To bypass auth for local development, set `AGENT_OS_DISABLE_AUTH=1`. The server logs a loud warning on boot when auth is disabled — never deploy that way.

`AuthStorage` (the SDK's runtime credential store for upstream model providers) is persisted to `agent-os/.pi/agent/auth.json` (plain JSON, mode 600). This directory is gitignored. With Ollama local you can ignore this entirely; it matters when you sync real Anthropic/OpenAI keys via `VaultBridge`.

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
| `AGENT_OS_DISABLE_AUTH` | unset | When `1`, the WebSocket accepts any client. Dev only. |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | — | Used by `test-e2e.js` to bootstrap/login. Production: set these to real values. |
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
- The Ollama provider is registered at runtime via `ModelRegistry.registerProvider("ollama", ...)` with `api: "openai-completions"` — there is no built-in `ollama` provider in `@earendil-works/pi-ai`. The model definition must include `cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }`: `pi-ai`'s `calculateCost(model, usage)` reads those fields unconditionally and throws when they're missing, which silently turns tool calls into `stopReason: "error"` (terminating the turn without executing the tool).
- Custom tools must be passed via `createAgentSession({ customTools: [...] })`. Mutating `session.agent.state.tools` after construction does not work — the session refresh path rebuilds `state.tools` from `_customTools` + `_baseToolDefinitions`.
- `SocketHandler` tracks the per-socket `unsubscribe` callbacks in a `Set` and releases them on `agent_end` and on `disconnect`. The earlier version leaked one listener per prompt.
- The UI filters `message_update` events to `assistantMessageEvent.type === 'text_delta'`. The other event variants (`text_start`, `thinking_delta`, `text_end`, etc.) are part of the union and must not be rendered as reply text.

## Roadmap

- [x] `VaultBridge` for credential resolution.
- [x] `AgentRuntimeManager` with session + Ollama provider.
- [x] `ToolsFactory` for DB and skill manipulation.
- [x] WebSocket handler with proper subscription lifecycle.
- [x] Agent Web UI (chat + sessions).
- [x] End-to-end smoke test against a live model.
- [x] Enrich `db_create_table` schema to accept column metadata (`type`, `unique`, `required`, `default`, `options`).
- [x] Full CRUD over tables and data (`db_insert`/`db_find`/`db_update`/`db_remove`/`db_count`/`db_aggregate` + schema evolution).
- [x] System-table protection + confirm-flag for destructive operations.
- [x] Surface tool args/results in the UI (collapsible cards per tool call).
- [x] Persist `AuthStorage` to disk (`agent-os/.pi/agent/auth.json`).
- [x] Authentication on the WebSocket (JWT from the existing `auth` system, with `AGENT_OS_DISABLE_AUTH=1` dev bypass).
- [ ] UI: list skills, switch between sessions.
- [ ] Surface `db_aggregate` errors with stage context (currently bubbles up the raw exception).
- [ ] `db.flush()` is called after most write endpoints in `server.js`, but only a few now call `dbAdapter.persist()`; sweep the rest so all mutations are crash-safe.

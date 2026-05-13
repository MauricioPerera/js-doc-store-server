import { defineTool } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import fs from "fs";
import path from "path";

const COLUMN_TYPES = [
    "text", "number", "checkbox", "date", "email", "url", "phone",
    "select", "multiselect", "relation", "json", "attachment", "autonumber",
];

const ColumnDef = Type.Object({
    name: Type.String({ description: "Column name." }),
    type: Type.Union(
        COLUMN_TYPES.map((t) => Type.Literal(t)),
        { description: "Column type." },
    ),
    required: Type.Optional(Type.Boolean({ description: "Reject inserts that omit this field." })),
    unique: Type.Optional(Type.Boolean({ description: "Enforce uniqueness via an index." })),
    default: Type.Optional(Type.Any({ description: "Default value when omitted on insert." })),
    options: Type.Optional(Type.Array(Type.String(), { description: "Allowed values for select/multiselect." })),
    collection: Type.Optional(Type.String({ description: "Target table for `relation` type." })),
});

const FIND_DEFAULT_LIMIT = 50;
const FIND_MAX_LIMIT = 1000;

const isSystemTable = (name) => typeof name !== "string" || name.startsWith("_");

const ok = (text, details = {}) => ({
    content: [{ type: "text", text }],
    details,
});
const fail = (text, details = {}) => ({
    content: [{ type: "text", text: `Error: ${text}` }],
    details,
});

/**
 * ToolsFactory builds the agent's DB and skill tools on top of a live DocStore.
 * The factory owns a Table cache so that the rich column schema persisted on
 * disk ({name}.schema.json) is reloaded across processes — DocStore's
 * Table constructor doesn't auto-load columns, only autoNum and views.
 */
class ToolsFactory {
    constructor({ db, Table, agentRuntime }) {
        if (!db) throw new Error("ToolsFactory requires { db }");
        if (!Table) throw new Error("ToolsFactory requires { Table }");
        this.db = db;
        this.Table = Table;
        this.agentRuntime = agentRuntime;
        this._tables = new Map();
    }

    _readPersistedColumns(name) {
        try {
            const meta = this.db._adapter.readJson(`${name}.schema.json`);
            return meta?.columns || [];
        } catch {
            return [];
        }
    }

    _table(name) {
        if (this._tables.has(name)) return this._tables.get(name);
        const columns = this._readPersistedColumns(name);
        const table = new this.Table(this.db, name, { columns });
        this._tables.set(name, table);
        return table;
    }

    _invalidate(name) {
        this._tables.delete(name);
    }

    // ── Schema tools ────────────────────────────────────────────────────────

    _schemaTools() {
        return [
            defineTool({
                name: "db_list_tables",
                label: "List Tables",
                description: "Lists all user-visible tables (system tables prefixed with `_` are hidden).",
                parameters: Type.Object({}),
                execute: async () => {
                    const names = this.db.collections().filter((n) => !isSystemTable(n));
                    return ok(JSON.stringify(names, null, 2), { count: names.length });
                },
            }),

            defineTool({
                name: "db_create_table",
                label: "Create Table",
                description: "Creates a new table with a typed schema. Persists columns to disk.",
                parameters: Type.Object({
                    tableName: Type.String(),
                    columns: Type.Array(ColumnDef, { description: "Schema columns. Empty array for a free-form table." }),
                }),
                execute: async (_id, { tableName, columns }) => {
                    if (isSystemTable(tableName)) return fail(`Cannot create system table '${tableName}' (names starting with '_' are reserved).`);
                    const existing = this.db.collections().includes(tableName);
                    if (existing) return fail(`Table '${tableName}' already exists. Use db_add_column to evolve it.`);
                    const table = new this.Table(this.db, tableName, { columns: columns || [] });
                    table.flush();
                    this._tables.set(tableName, table);
                    return ok(`Table '${tableName}' created with ${table.columns.length} column(s).`, { columns: table.columns });
                },
            }),

            defineTool({
                name: "db_describe_table",
                label: "Describe Table",
                description: "Returns the column schema of a table.",
                parameters: Type.Object({ tableName: Type.String() }),
                execute: async (_id, { tableName }) => {
                    if (isSystemTable(tableName)) return fail(`Cannot describe system table '${tableName}'.`);
                    const table = this._table(tableName);
                    return ok(JSON.stringify({ name: tableName, columns: table.columns }, null, 2));
                },
            }),

            defineTool({
                name: "db_add_column",
                label: "Add Column",
                description: "Adds a column to an existing table. Persists to disk.",
                parameters: Type.Object({
                    tableName: Type.String(),
                    column: ColumnDef,
                }),
                execute: async (_id, { tableName, column }) => {
                    if (isSystemTable(tableName)) return fail(`Cannot modify system table '${tableName}'.`);
                    try {
                        const table = this._table(tableName);
                        table.addColumn(column);
                        return ok(`Column '${column.name}' added to '${tableName}'.`, { columns: table.columns });
                    } catch (e) {
                        return fail(e.message);
                    }
                },
            }),

            defineTool({
                name: "db_remove_column",
                label: "Remove Column",
                description: "Drops a column from a table's schema. Destructive: existing field values remain in documents but the schema no longer validates them. Requires confirm:true.",
                parameters: Type.Object({
                    tableName: Type.String(),
                    columnName: Type.String(),
                    confirm: Type.Optional(Type.Boolean({ description: "Must be true to execute." })),
                }),
                execute: async (_id, { tableName, columnName, confirm }) => {
                    if (isSystemTable(tableName)) return fail(`Cannot modify system table '${tableName}'.`);
                    if (!confirm) return fail(`Refusing to remove column '${columnName}' from '${tableName}' without confirm:true.`);
                    const table = this._table(tableName);
                    table.removeColumn(columnName);
                    return ok(`Column '${columnName}' removed from '${tableName}'.`, { columns: table.columns });
                },
            }),

            defineTool({
                name: "db_drop_table",
                label: "Drop Table",
                description: "Deletes a table and ALL its data and indexes. Irreversible. Requires confirm:true.",
                parameters: Type.Object({
                    tableName: Type.String(),
                    confirm: Type.Optional(Type.Boolean({ description: "Must be true to execute." })),
                }),
                execute: async (_id, { tableName, confirm }) => {
                    if (isSystemTable(tableName)) return fail(`Cannot drop system table '${tableName}'.`);
                    if (!this.db.collections().includes(tableName)) return fail(`Table '${tableName}' does not exist.`);
                    if (!confirm) {
                        const count = this._table(tableName).count();
                        return fail(`Refusing to drop '${tableName}' (${count} document(s)) without confirm:true.`);
                    }
                    this.db.drop(tableName);
                    // Schema file is removed by db.drop via adapter for known files,
                    // but {name}.schema.json is not enumerated — clean it up too.
                    try { this.db._adapter.delete(`${tableName}.schema.json`); } catch {}
                    try { this.db._adapter.delete(`${tableName}.views.json`); } catch {}
                    this._invalidate(tableName);
                    return ok(`Table '${tableName}' dropped.`);
                },
            }),
        ];
    }

    // ── Data tools ──────────────────────────────────────────────────────────

    _dataTools() {
        return [
            defineTool({
                name: "db_insert",
                label: "Insert Document",
                description: "Inserts a single document. Schema validation runs if the table has typed columns.",
                parameters: Type.Object({
                    tableName: Type.String(),
                    doc: Type.Any({ description: "The document to insert." }),
                }),
                execute: async (_id, { tableName, doc }) => {
                    if (isSystemTable(tableName)) return fail(`Cannot write to system table '${tableName}'.`);
                    try {
                        const inserted = this._table(tableName).insert(doc);
                        return ok(`Inserted into '${tableName}'.`, { doc: inserted });
                    } catch (e) {
                        return fail(e.message);
                    }
                },
            }),

            defineTool({
                name: "db_find",
                label: "Find Documents",
                description: `Find documents matching a filter. Default limit ${FIND_DEFAULT_LIMIT}, max ${FIND_MAX_LIMIT}. Supports MongoDB-style filters and operators.`,
                parameters: Type.Object({
                    tableName: Type.String(),
                    filter: Type.Optional(Type.Any({ description: "Mongo-style filter, e.g. { status: 'active', age: { $gt: 18 } }." })),
                    sort: Type.Optional(Type.Any({ description: "Sort spec, e.g. { createdAt: -1 }." })),
                    limit: Type.Optional(Type.Number({ description: `Max results (capped at ${FIND_MAX_LIMIT}).` })),
                    skip: Type.Optional(Type.Number({ description: "Documents to skip (for pagination)." })),
                }),
                execute: async (_id, { tableName, filter = {}, sort, limit, skip }) => {
                    if (isSystemTable(tableName)) return fail(`Cannot read system table '${tableName}'.`);
                    const capped = Math.min(typeof limit === "number" ? limit : FIND_DEFAULT_LIMIT, FIND_MAX_LIMIT);
                    let cursor = this._table(tableName).find(filter);
                    if (sort) cursor = cursor.sort(sort);
                    if (typeof skip === "number") cursor = cursor.skip(skip);
                    cursor = cursor.limit(capped);
                    const docs = cursor.toArray();
                    return ok(JSON.stringify(docs, null, 2), { count: docs.length, limit: capped });
                },
            }),

            defineTool({
                name: "db_find_one",
                label: "Find One Document",
                description: "Returns the first document matching the filter, or null.",
                parameters: Type.Object({
                    tableName: Type.String(),
                    filter: Type.Optional(Type.Any()),
                }),
                execute: async (_id, { tableName, filter = {} }) => {
                    if (isSystemTable(tableName)) return fail(`Cannot read system table '${tableName}'.`);
                    const doc = this._table(tableName).findOne(filter);
                    return ok(doc ? JSON.stringify(doc, null, 2) : "null");
                },
            }),

            defineTool({
                name: "db_update",
                label: "Update Documents",
                description: "Updates documents matching the filter. Update supports $set, $inc, $push, $unset, $rename operators.",
                parameters: Type.Object({
                    tableName: Type.String(),
                    filter: Type.Any({ description: "Filter selecting documents to update." }),
                    update: Type.Any({ description: "Update spec, e.g. { $set: { status: 'done' } }." }),
                }),
                execute: async (_id, { tableName, filter, update }) => {
                    if (isSystemTable(tableName)) return fail(`Cannot write to system table '${tableName}'.`);
                    try {
                        const modified = this._table(tableName).update(filter, update);
                        return ok(`Updated ${modified} document(s) in '${tableName}'.`, { modified });
                    } catch (e) {
                        return fail(e.message);
                    }
                },
            }),

            defineTool({
                name: "db_count",
                label: "Count Documents",
                description: "Counts documents matching the filter.",
                parameters: Type.Object({
                    tableName: Type.String(),
                    filter: Type.Optional(Type.Any()),
                }),
                execute: async (_id, { tableName, filter = {} }) => {
                    if (isSystemTable(tableName)) return fail(`Cannot read system table '${tableName}'.`);
                    const n = this._table(tableName).count(filter);
                    return ok(String(n), { count: n });
                },
            }),

            defineTool({
                name: "db_remove",
                label: "Remove Documents",
                description: "Deletes documents matching the filter. Destructive. Requires confirm:true.",
                parameters: Type.Object({
                    tableName: Type.String(),
                    filter: Type.Any({ description: "Filter selecting documents to delete. Use {} to delete all." }),
                    confirm: Type.Optional(Type.Boolean({ description: "Must be true to execute." })),
                }),
                execute: async (_id, { tableName, filter, confirm }) => {
                    if (isSystemTable(tableName)) return fail(`Cannot write to system table '${tableName}'.`);
                    if (!confirm) {
                        const matching = this._table(tableName).count(filter);
                        return fail(`Refusing to remove ${matching} document(s) from '${tableName}' without confirm:true.`);
                    }
                    const removed = this._table(tableName).remove(filter);
                    return ok(`Removed ${removed} document(s) from '${tableName}'.`, { removed });
                },
            }),

            defineTool({
                name: "db_aggregate",
                label: "Aggregate",
                description: "Runs an aggregation pipeline over a table. Stages: match, sort, limit, skip, project, group, unwind, lookup.",
                parameters: Type.Object({
                    tableName: Type.String(),
                    pipeline: Type.Array(
                        Type.Object({
                            stage: Type.Union([
                                Type.Literal("match"),
                                Type.Literal("sort"),
                                Type.Literal("limit"),
                                Type.Literal("skip"),
                                Type.Literal("project"),
                                Type.Literal("group"),
                                Type.Literal("unwind"),
                                Type.Literal("lookup"),
                            ]),
                            params: Type.Any({ description: "Stage-specific params. For group: { field, accumulators }." }),
                        }),
                        { description: "Ordered list of stages." },
                    ),
                }),
                execute: async (_id, { tableName, pipeline }) => {
                    if (isSystemTable(tableName)) return fail(`Cannot read system table '${tableName}'.`);
                    try {
                        let agg = this._table(tableName)._col.aggregate();
                        for (const { stage, params } of pipeline) {
                            switch (stage) {
                                case "match": agg = agg.match(params); break;
                                case "sort": agg = agg.sort(params); break;
                                case "limit": agg = agg.limit(params); break;
                                case "skip": agg = agg.skip(params); break;
                                case "project": agg = agg.project(params); break;
                                case "group": agg = agg.group(params.field, params.accumulators); break;
                                case "unwind": agg = agg.unwind(params); break;
                                case "lookup": agg = agg.lookup(params); break;
                            }
                        }
                        const result = agg.toArray();
                        return ok(JSON.stringify(result, null, 2), { count: result.length });
                    } catch (e) {
                        return fail(e.message);
                    }
                },
            }),
        ];
    }

    // ── Skill tools (unchanged behavior) ────────────────────────────────────

    _skillTools() {
        return [
            defineTool({
                name: "skill_list",
                label: "List Skills",
                description: "Lists all currently loaded skills.",
                parameters: Type.Object({}),
                execute: async () => {
                    const skills = this.agentRuntime?.getLoader()?.getSkills?.() ?? [];
                    return ok(JSON.stringify(skills, null, 2));
                },
            }),
            defineTool({
                name: "skill_import",
                label: "Import Skill",
                description: "Writes a markdown skill file and reloads the resource loader.",
                parameters: Type.Object({
                    skillName: Type.String(),
                    content: Type.String(),
                }),
                execute: async (_id, { skillName, content }) => {
                    try {
                        if (!this.agentRuntime?.agentDir) throw new Error("agentRuntime.agentDir not configured");
                        const skillsDir = path.join(this.agentRuntime.agentDir, "skills");
                        fs.mkdirSync(skillsDir, { recursive: true });
                        const skillPath = path.join(skillsDir, `${skillName}.md`);
                        fs.writeFileSync(skillPath, content);
                        await this.agentRuntime.getLoader().reload();
                        return ok(`Skill '${skillName}' imported and reloaded successfully.`);
                    } catch (e) {
                        return fail(e.message);
                    }
                },
            }),
        ];
    }

    createDbTools() {
        return [...this._schemaTools(), ...this._dataTools()];
    }

    createSkillTools() {
        return this._skillTools();
    }

    createAllTools() {
        return [...this.createDbTools(), ...this.createSkillTools()];
    }
}

export { ToolsFactory };

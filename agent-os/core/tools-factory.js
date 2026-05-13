import { defineTool } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import fs from "fs";
import path from "path";

/**
 * ToolsFactory defines the "Super-Tools" that grant the agent 
 * programmatic control over the DocStore server.
 */
class ToolsFactory {
    constructor(serverInstance) {
        this.server = serverInstance; // Reference to the running express app / db
    }

    /**
     * Creates tools for managing database architecture.
     */
    createDbTools() {
        return [
            defineTool({
                name: "db_create_table",
                label: "Create DB Table",
                description: "Creates a new table in the DocStore with specific columns. Use this to design data architectures for new integrations.",
                parameters: Type.Object({
                    tableName: Type.String({ description: "Name of the table to create" }),
                    columns: Type.Array(Type.String({ description: "List of column names" })),
                }),
                execute: async (_id, params) => {
                    try {
                        // Call internal server logic to create table
                        const result = await this.server.admin.createTable(params.tableName, params.columns);
                        return {
                            content: [{ type: "text", text: `Successfully created table ${params.tableName}.` }],
                            details: { result },
                        };
                    } catch (e) {
                        return {
                            content: [{ type: "text", text: `Error creating table: ${e.message}` }],
                            details: {},
                        };
                    }
                },
            }),
            defineTool({
                name: "db_query",
                label: "Query Knowledge Base",
                description: "Executes a query against a table to retrieve information. Supports filters and sorting.",
                parameters: Type.Object({
                    tableName: Type.String({ description: "Table to query" }),
                    filter: Type.Any({ description: "Filter object (e.g. { category: 'crm' })" }),
                    limit: Type.Optional(Type.Number({ description: "Max results to return" })),
                }),
                execute: async (_id, params) => {
                    try {
                        const data = await this.server.admin.queryTable(params.tableName, params.filter, params.limit);
                        return {
                            content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
                            details: {},
                        };
                    } catch (e) {
                        return {
                            content: [{ type: "text", text: `Query failed: ${e.message}` }],
                            details: {},
                        };
                    }
                },
            }),
        ];
    }

    /**
     * Creates tools for managing agent capabilities.
     */
    createSkillTools() {
        return [
            defineTool({
                name: "skill_list",
                label: "List Skills",
                description: "Lists all currently loaded skills and their descriptions.",
                parameters: Type.Object({}),
                execute: async () => {
                    const skills = this.server.agentRuntime.getLoader().getSkills();
                    return {
                        content: [{ type: "text", text: JSON.stringify(skills, null, 2) }],
                        details: {},
                    };
                },
            }),
            defineTool({
                name: "skill_import",
                label: "Import Skill",
                description: "Imports a new skill from a provided content string by saving it to the skills directory.",
                parameters: Type.Object({
                    skillName: Type.String({ description: "Name of the skill" }),
                    content: Type.String({ description: "Markdown content of the skill" }),
                }),
                execute: async (_id, params) => {
                    try {
                        const skillPath = path.join(this.server.agentRuntime.agentDir, 'skills', `${params.skillName}.md`);
                        fs.writeFileSync(skillPath, params.content);
                        await this.server.agentRuntime.getLoader().reload();
                        return {
                            content: [{ type: "text", text: `Skill ${params.skillName} imported and reloaded successfully.` }],
                            details: {},
                        };
                    } catch (e) {
                        return {
                            content: [{ type: "text", text: `Failed to import skill: ${e.message}` }],
                            details: {},
                        };
                    }
                },
            }),
        ];
    }

    /**
     * Returns all tools combined.
     */
    createAllTools() {
        return [
            ...this.createDbTools(),
            ...this.createSkillTools(),
        ];
    }
}

export { ToolsFactory };

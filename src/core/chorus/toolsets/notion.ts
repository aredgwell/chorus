import { StdioServerParameters } from "@core/chorus/MCPStdioTauri";
import { MCPServer, Toolset } from "@core/chorus/Toolsets";

export class MCPServerNotion extends MCPServer {
    protected getExecutionParameters(
        config: Record<string, string>,
    ): StdioServerParameters {
        return {
            type: "sidecar",
            sidecarBinary: "binaries/mcp-notion",
            env: {
                NOTION_API_TOKEN: config.apiToken,
            },
        };
    }
}

export class ToolsetNotion extends Toolset {
    constructor() {
        super(
            "notion",
            "Notion",
            {
                apiToken: {
                    id: "apiToken",
                    displayName: "API Token",
                    type: "string",
                },
            },
            "Manage notes, tasks, and databases",
            "https://www.notion.so/settings/integrations",
        );

        const notionServer = new MCPServerNotion();

        this.addServer(notionServer, { mode: "all" });
    }
}

import { MCPServer, Toolset } from "@core/chorus/Toolsets";
import { StdioServerParameters } from "@core/chorus/MCPStdioTauri";

export class MCPServerSlack extends MCPServer {
    protected getExecutionParameters(
        config: Record<string, string>,
    ): StdioServerParameters {
        return {
            type: "sidecar",
            sidecarBinary: "binaries/mcp-slack",
            env: {
                SLACK_BOT_TOKEN: config.apiToken,
                SLACK_TEAM_ID: config.teamId,
            },
        };
    }
}

export class ToolsetSlack extends Toolset {
    constructor() {
        super(
            "slack",
            "Slack",
            {
                apiToken: {
                    id: "apiToken",
                    displayName: "API Token",
                    type: "string",
                    isSecret: true,
                },
                teamId: {
                    id: "teamId",
                    displayName: "Team ID",
                    type: "string",
                },
            },
            "Manage Slack channels, messages, and users",
            "https://app.chorus.sh/auth/slack",
        );

        const slackServer = new MCPServerSlack();

        this.addServer(slackServer, { mode: "all" });
    }
}

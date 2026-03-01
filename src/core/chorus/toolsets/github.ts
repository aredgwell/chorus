import { StdioServerParameters } from "@core/chorus/MCPStdioTauri";
import { MCPServer, Toolset } from "@core/chorus/Toolsets";

export class MCPServerGitHub extends MCPServer {
    protected getExecutionParameters(
        config: Record<string, string>,
    ): StdioServerParameters {
        return {
            type: "sidecar",
            sidecarBinary: "binaries/mcp-github",
            args: ["stdio"],
            env: {
                GITHUB_PERSONAL_ACCESS_TOKEN: config.personalAccessToken,
            },
        };
    }
}

export class ToolsetGithub extends Toolset {
    constructor() {
        super(
            "github",
            "GitHub",
            {
                personalAccessToken: {
                    id: "personalAccessToken",
                    displayName: "Personal Access Token",
                    type: "string",
                    isSecret: true,
                },
            },
            "Manage repos, code, issues, and PRs",
            "https://app.chorus.sh/auth/github_integration",
        );

        const githubServer = new MCPServerGitHub();

        this.addServer(githubServer, { mode: "all" });
    }
}

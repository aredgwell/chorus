import { StdioServerParameters } from "@core/chorus/MCPStdioTauri";
import { MCPServer, Toolset } from "@core/chorus/Toolsets";

export class MCPServerApple extends MCPServer {
    protected getExecutionParameters(
        _config: Record<string, string>,
    ): StdioServerParameters {
        return {
            type: "sidecar",
            sidecarBinary: "binaries/mcp-apple",
        };
    }
}

export class ToolsetApple extends Toolset {
    constructor() {
        super(
            "mac",
            "Mac",
            {}, // No config needed
            "Use macOS tools",
        );

        const appleServer = new MCPServerApple();

        // Add server with automatic tool registration
        this.addServer(appleServer, {
            mode: "all",
        });
    }
}

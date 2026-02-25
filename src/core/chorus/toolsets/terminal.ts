import { MCPServer, Toolset } from "@core/chorus/Toolsets";
import { StdioServerParameters } from "@core/chorus/MCPStdioTauri";

class MCPServerDesktopCommander extends MCPServer {
    protected getExecutionParameters(
        _config: Record<string, string>,
    ): StdioServerParameters {
        return {
            type: "sidecar",
            sidecarBinary: "binaries/mcp-desktopcommander",
        };
    }
}

export class ToolsetTerminal extends Toolset {
    constructor() {
        super(
            "terminal",
            "Terminal",
            {}, // No config needed
            "Run commands in the terminal",
        );

        const desktopCommander = new MCPServerDesktopCommander();

        // Add server with automatic tool registration
        this.addServer(
            desktopCommander,
            {
                mode: "select",
                include: [
                    "execute_command",
                    "read_output",
                    "force_terminate",
                    "list_sessions",
                    "list_processes",
                    "kill_process",
                ],
            },
            {},
            {
                execute_command:
                    "Start a new session to execute a command. (Use ~ to access the user's home directory.)",
            },
        );
    }
}

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

export class ToolsetCoder extends Toolset {
    constructor() {
        super(
            "coder",
            "Coder",
            {}, // No config needed
            "Write and edit code",
        );

        const desktopCommander = new MCPServerDesktopCommander();

        // Add server with automatic tool registration
        this.addServer(
            desktopCommander,
            {
                mode: "select",
                include: [
                    "read_file",
                    "write_file",
                    "search_code",
                    "edit_block",
                ],
            },
            {},
            {
                read_file: "Read a file on the user's filesystem.",
                write_file: "Write to a file on the user's filesystem.",
                search_code: "Search for code in the user's filesystem.",
                edit_block: "Edit a block of code in the user's filesystem.",
            },
        );
    }
}

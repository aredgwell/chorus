import { StdioServerParameters } from "@core/chorus/MCPStdioTauri";
import { MCPServer, Toolset } from "@core/chorus/Toolsets";

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

export class ToolsetFiles extends Toolset {
    constructor() {
        super(
            "files",
            "Files",
            {}, // No config needed
            "Read and edit files on your computer",
        );

        const desktopCommander = new MCPServerDesktopCommander();

        // Add server with automatic tool registration
        this.addServer(
            desktopCommander,
            {
                mode: "select",
                include: [
                    "read_file",
                    "read_multiple_files",
                    "write_file",
                    "create_directory",
                    "list_directory",
                    "move_file",
                    "search_files",
                    "search_code",
                    "get_file_info",
                    "edit_block",
                ],
            },
            {
                read_file: "read",
                read_multiple_files: "read_multiple",
                write_file: "write",
                create_directory: "create_directory",
                list_directory: "list_directory",
                move_file: "move",
                search_files: "search",
                search_code: "search_code",
                get_file_info: "get_info",
                edit_block: "edit",
            },
        );
    }
}

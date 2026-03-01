import { parseArgsStringToArgv } from "string-argv";

import { StdioServerParameters } from "../MCPStdioTauri";
import { ToolsetConfig } from "../Toolsets";
import { Toolset } from "../Toolsets";
import { getEnvFromJSON,MCPServer } from "../Toolsets";

export class MCPServerCustom extends MCPServer {
    protected getExecutionParameters(
        config: Record<string, string>,
    ): StdioServerParameters {
        const env = getEnvFromJSON(config.env);
        return {
            type: "custom",
            command: config.command,
            args: config.args ? parseArgsStringToArgv(config.args) : undefined,
            env: env._type === "error" ? {} : env,
        };
    }
}

export class CustomToolset extends Toolset {
    constructor(public readonly name: string) {
        super(
            name,
            name,
            {
                enabled: {
                    id: "enabled",
                    displayName: "Enabled",
                    type: "boolean",
                },
                command: {
                    id: "command",
                    displayName: "Command",
                    type: "string",
                },
                args: {
                    id: "args",
                    displayName: "Arguments",
                    type: "string",
                },
                env: {
                    id: "env",
                    displayName: "Environment",
                    type: "string",
                },
            },
            "",
            undefined,
            false,
        );

        this.addServer(new MCPServerCustom(), {
            mode: "all",
        });
    }

    areRequiredParamsFilled(_configs: ToolsetConfig | undefined): boolean {
        return true;
    }
}

import { useState, useEffect } from "react";
import { Button } from "@ui/components/ui/button";
import { Input } from "@ui/components/ui/input";
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from "@ui/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@ui/components/ui/tooltip";
import { Loader2, ExternalLinkIcon, Pencil, Trash2, Plus, LinkIcon } from "lucide-react";
import { RiClaudeFill, RiSupabaseFill } from "react-icons/ri";
import { SiStripe, SiElevenlabs } from "react-icons/si";
import { InfoCircledIcon } from "@radix-ui/react-icons";
import { toast } from "sonner";
import { openUrl } from "@tauri-apps/plugin-opener";
import { CustomToolsetConfig, getEnvFromJSON } from "@core/chorus/Toolsets";
import * as ToolsetsAPI from "@core/chorus/api/ToolsetsAPI";
import { ToolsetsManager } from "@core/chorus/ToolsetsManager";
import { getToolsetIcon } from "@core/chorus/Toolsets";
import { CodeBlock } from "@ui/components/renderers/CodeBlock";

type ToolsetFormProps = {
    toolset: CustomToolsetConfig;
    errors: Record<string, string>;
    isReadOnly?: boolean;
    onChange: (field: keyof CustomToolsetConfig, value: string) => void;
    onSave: () => void;
    onCancel: () => void;
    title: string;
    apiKeyUrl?: string;
    docsUrl?: string;
};

function RemoteToolsetForm({
    isOpen,
    onClose,
    onSubmit,
}: {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (name: string, url: string) => void;
}) {
    const [name, setName] = useState("");
    const [url, setUrl] = useState("");
    const [errors, setErrors] = useState<{ name?: string; url?: string }>({});
    const { data: customToolsetConfigs = [] } =
        ToolsetsAPI.useCustomToolsetConfigs();

    const validateName = (value: string) => {
        if (!value.trim()) {
            return "Name is required";
        } else if (!/^[a-z0-9-]+$/.test(value)) {
            return "Name must be one word, lowercase, and contain only letters, numbers, and dashes";
        } else if (customToolsetConfigs.some((t) => t.name === value)) {
            return "Name already exists";
        }
        return undefined;
    };

    const validateUrl = (value: string) => {
        if (!value.trim()) {
            return "URL is required";
        } else if (
            !value.startsWith("http://") &&
            !value.startsWith("https://")
        ) {
            return "URL must start with http:// or https://";
        } else {
            try {
                new URL(value);
            } catch {
                return "Invalid URL format";
            }
        }
        return undefined;
    };

    const validateForm = () => {
        const nameError = validateName(name);
        const urlError = validateUrl(url);

        const newErrors: { name?: string; url?: string } = {};
        if (nameError) newErrors.name = nameError;
        if (urlError) newErrors.url = urlError;

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setName(value);
        const error = validateName(value);
        setErrors((prev) => {
            const newErrors = { ...prev };
            if (error) {
                newErrors.name = error;
            } else {
                delete newErrors.name;
            }
            return newErrors;
        });
    };

    const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setUrl(value);
        const error = validateUrl(value);
        setErrors((prev) => {
            const newErrors = { ...prev };
            if (error) {
                newErrors.url = error;
            } else {
                delete newErrors.url;
            }
            return newErrors;
        });
    };

    const handleSubmit = () => {
        if (validateForm()) {
            onSubmit(name, url);
            setName("");
            setUrl("");
            setErrors({});
        }
    };

    useEffect(() => {
        if (!isOpen) {
            setName("");
            setUrl("");
            setErrors({});
        }
    }, [isOpen]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSubmit();
        }
    };

    return (
        <div className="space-y-4 border rounded-md p-4 max-w-full overflow-hidden">
            <h4 className="font-semibold flex items-center justify-between gap-1">
                Add Remote MCP
            </h4>

            <div className="space-y-2">
                <label htmlFor="remote-mcp-name" className="font-semibold">
                    Name
                </label>
                <Input
                    id="remote-mcp-name"
                    value={name}
                    onChange={handleNameChange}
                    onKeyDown={handleKeyDown}
                    placeholder="zapier"
                    className={errors.name ? "border-destructive" : ""}
                    autoFocus
                    autoCapitalize="off"
                    autoCorrect="off"
                    spellCheck={false}
                />
                {errors.name && (
                    <div className="text-destructive text-sm">
                        {errors.name}
                    </div>
                )}
                <p className="text-xs text-muted-foreground">
                    One word, lowercase, letters, numbers, and dashes only
                </p>
            </div>

            <div className="space-y-2">
                <label htmlFor="remote-mcp-url" className="font-semibold">
                    URL
                </label>
                <Input
                    id="remote-mcp-url"
                    value={url}
                    onChange={handleUrlChange}
                    onKeyDown={handleKeyDown}
                    placeholder="https://mcp.zapier.com/api/mcp/s/.../sse"
                    className={errors.url ? "border-destructive" : ""}
                />
                {errors.url && (
                    <div className="text-destructive text-sm">{errors.url}</div>
                )}
                <p className="text-xs text-muted-foreground">
                    The URL of the remote MCP server.
                </p>
            </div>

            <div className="flex justify-end space-x-2 pt-2">
                <Button variant="outline" size="sm" onClick={onClose}>
                    Cancel
                </Button>
                <Button
                    size="sm"
                    onClick={handleSubmit}
                    disabled={Object.keys(errors).length > 0}
                >
                    Save
                </Button>
            </div>
        </div>
    );
}

function ToolsetForm({
    toolset,
    errors,
    isReadOnly = false,
    onChange,
    onSave,
    onCancel,
    title,
    docsUrl,
    apiKeyUrl,
}: ToolsetFormProps) {
    return (
        <div className="space-y-4 border rounded-md p-4 max-w-full overflow-hidden">
            <h4 className="font-semibold flex items-center justify-between gap-1">
                {title}
                {docsUrl && (
                    <Button
                        variant="link"
                        size="iconSm"
                        onClick={() => void openUrl(docsUrl)}
                    >
                        Docs <ExternalLinkIcon className="w-4 h-4" />
                    </Button>
                )}
            </h4>

            {errors._general && (
                <div className="text-destructive ">{errors._general}</div>
            )}

            {!isReadOnly && (
                <div className="space-y-2">
                    <label className="font-semibold">Name</label>
                    <Input
                        value={toolset.name}
                        onChange={(e) => onChange("name", e.target.value)}
                        className={errors.name ? "border-destructive" : ""}
                        readOnly={isReadOnly}
                        placeholder="myserver"
                        autoCapitalize="off"
                        autoComplete="off"
                        spellCheck={false}
                    />
                    <span className="text-[10px] ">
                        One word, lowercase, letters, numbers, and dashes only
                    </span>
                    {errors.name && (
                        <div className="text-destructive ">{errors.name}</div>
                    )}
                </div>
            )}

            <div className="space-y-2">
                <div className="flex items-center justify-between">
                    <label className="font-semibold">Command</label>
                    {toolset.command.includes("docker") && (
                        <p className="text-[10px]  flex items-center gap-1">
                            <InfoCircledIcon className="w-3 h-3" />
                            Make sure you have Docker running. We recommend{" "}
                            <button
                                className="font-semibold"
                                onClick={() =>
                                    void openUrl("https://orbstack.dev/")
                                }
                            >
                                OrbStack
                            </button>
                        </p>
                    )}
                </div>
                <Input
                    value={toolset.command}
                    spellCheck={false}
                    onChange={(e) => onChange("command", e.target.value)}
                    className={errors.command ? "border-destructive" : ""}
                    placeholder="/path/to/mcp/server/executable"
                />
                <span className="text-[10px] ">
                    Absolute path to a program, or a program available on your
                    PATH. For example: npx or /usr/bin/my-mcp-server
                </span>
                {errors.command && (
                    <div className="text-destructive ">{errors.command}</div>
                )}
            </div>

            <div className="space-y-2">
                <label className="font-semibold">Arguments</label>
                <Input
                    value={toolset.args || ""}
                    spellCheck={false}
                    onChange={(e) => onChange("args", e.target.value)}
                    className={errors.args ? "border-destructive" : ""}
                    placeholder="--port 8080 --host 0.0.0.0"
                />
                <span className="text-[10px] ">
                    Arguments to pass to the program. For example:{" "}
                    <code>--port 8080 --host 0.0.0.0</code>
                </span>
                {errors.args && (
                    <div className="text-destructive ">{errors.args}</div>
                )}
            </div>

            <div className="space-y-2">
                <div className=" items-center flex justify-between">
                    <label className="font-semibold">Environment (JSON)</label>
                    {apiKeyUrl && (
                        <Button
                            variant="default"
                            size="sm"
                            className="font-semibold"
                            onClick={() => void openUrl(apiKeyUrl)}
                        >
                            Get API key <ExternalLinkIcon className="w-4 h-4" />
                        </Button>
                    )}
                </div>
                <Input
                    spellCheck={false}
                    value={toolset.env || "{}"}
                    onChange={(e) => onChange("env", e.target.value)}
                    className={errors.env ? "border-destructive" : ""}
                />
                <span className="text-[10px] ">
                    Environment variables to pass to the program. For example:{" "}
                    <code>
                        {`{
    "GITHUB_API_KEY": "...",
    "OPENAI_API_KEY": "..."
}`}
                    </code>
                </span>

                {errors.env && (
                    <div className="text-destructive ">{errors.env}</div>
                )}
            </div>

            <div className="flex justify-end space-x-2 pt-2">
                <Button variant="outline" size="sm" onClick={onCancel}>
                    Cancel
                </Button>
                <Button
                    size="sm"
                    onClick={onSave}
                    disabled={Object.keys(errors).length > 0}
                >
                    Save
                </Button>
            </div>
        </div>
    );
}

type CustomToolsetRowProps = {
    toolset: CustomToolsetConfig;
    onEdit: (toolset: CustomToolsetConfig) => void;
    onDelete: (name: string) => void;
};

function CustomToolsetRow({
    toolset,
    onEdit,
    onDelete,
}: CustomToolsetRowProps) {
    const recommendedMatch = RECOMMENDED_TOOLSETS.find(
        (t) => t.name === toolset.name,
    );
    const docsUrl = recommendedMatch?.docsUrl;
    const apiKeyUrl = recommendedMatch?.apiKeyUrl;
    const needsUserInput = recommendedMatch?.needsUserInput;

    const envToCommands = () => {
        const parsedEnv = getEnvFromJSON(toolset.env);
        if (parsedEnv._type === "error") return "";
        return Object.entries(parsedEnv)
            .map(([key, value]) => `${key}=${value}`)
            .join(" ");
    };

    const fullCommandText =
        `${envToCommands()} ${toolset.command} ${toolset.args || ""}`.trim();
    const displayCommandText =
        `${toolset.command} ${toolset.args || ""}`.trim();
    const truncatedCommandText =
        displayCommandText.length > 75
            ? displayCommandText.slice(0, 75) + "..."
            : displayCommandText;

    return (
        <div className="flex flex-col justify-between items-start p-4 border rounded-lg shadow-xs bg-card">
            <div className="w-full flex justify-between items-center">
                <div className="font-semibold  text-card-foreground flex items-center gap-2">
                    {recommendedMatch?.logo}
                    {toolset.name}
                </div>
                <div className="flex space-x-1">
                    <Button
                        variant="ghost"
                        size="iconSm"
                        onClick={() => onEdit(toolset)}
                        title="Edit"
                    >
                        <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="iconSm"
                        onClick={() => onDelete(toolset.name)}
                        title="Delete"
                    >
                        <Trash2 className="h-4 w-4" />
                    </Button>
                </div>
            </div>
            <div className="mt-2 w-full border border-border text-sm rounded-md">
                <CodeBlock
                    language="sh"
                    overrideRunCommand={true}
                    contentToCopy={fullCommandText}
                    content={truncatedCommandText}
                />
            </div>
            {(docsUrl || (apiKeyUrl && needsUserInput)) && (
                <div className="text-[10px] flex justify-end items-center gap-2 mt-2 w-full">
                    {docsUrl && (
                        <button
                            type="button"
                            className="hover:text-foreground flex items-center gap-1"
                            onClick={(e) => {
                                e.preventDefault();
                                void openUrl(docsUrl);
                            }}
                        >
                            <InfoCircledIcon className="size-3" /> Docs
                        </button>
                    )}
                    {apiKeyUrl && needsUserInput && (
                        <button
                            type="button"
                            className="hover:text-foreground flex items-center gap-1"
                            onClick={(e) => {
                                e.preventDefault();
                                void openUrl(apiKeyUrl);
                            }}
                        >
                            <ExternalLinkIcon className="size-3" /> Get API Key
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}

const RECOMMENDED_TOOLSETS = [
    {
        name: "context7",
        command: "npx",
        args: "-y @upstash/context7-mcp@latest",
        description: "Gets up-to-date documentation and code examples.",
        logo: <img src="/context7.png" className="size-8 rounded-lg" />,
        docsUrl: "https://github.com/upstash/context7-mcp",
        needsUserInput: false,
    },
    {
        name: "replicate",
        command: "npx",
        args: "-y mcp-remote@latest https://mcp.replicate.com/sse",
        env: `{"REPLICATE_API_TOKEN": "your-replicate-api-token"}`,
        description: "Run and manage machine learning models in the cloud.",
        logo: <img src="/replicate.png" className="size-8" />,
        docsUrl: "https://www.npmjs.com/package/replicate-mcp",
        apiKeyUrl: "https://replicate.com/account/api-tokens",
        needsUserInput: false,
    },
    {
        name: "stripe",
        command: "npx",
        args: "-y @stripe/mcp --tools=all --api-key=YOUR_STRIPE_API_KEY",
        description: "Manage payments, customers, and subscriptions.",
        logo: <SiStripe className="size-8" />,
        docsUrl: "https://docs.stripe.com/building-with-llms",
        apiKeyUrl: "https://dashboard.stripe.com/apikeys",
        needsUserInput: true,
    },
    {
        name: "elevenlabs",
        command: "uvx",
        args: "elevenlabs-mcp",
        env: `{"ELEVENLABS_API_KEY": "your-elevenlabs-api-key"}`,
        description: "Generate high-quality speech from text using AI voices.",
        logo: <SiElevenlabs className="size-8" />,
        docsUrl: "https://github.com/elevenlabs/elevenlabs-mcp",
        apiKeyUrl: "https://elevenlabs.io/app/settings/api-keys",
        needsUserInput: true,
    },
    {
        name: "supabase",
        command: "npx",
        args: "-y @supabase/mcp-server-supabase@latest --access-token <personal-access-token>",
        description:
            "Manage databases, authentication, and real-time subscriptions.",
        logo: <RiSupabaseFill className="size-8" />,
        docsUrl: "https://supabase.com/blog/mcp-server",
        apiKeyUrl: "https://supabase.com/dashboard/project/settings/api",
        needsUserInput: true,
    },
];

const CORE_BUILTIN_TOOLSETS_DATA = ToolsetsManager.instance
    .listToolsets()
    .filter((toolset) => toolset.isBuiltIn)
    .map((toolset) => ({
        name: toolset.name,
        displayName: toolset.displayName,
        icon: () => getToolsetIcon(toolset.name),
        description: toolset.description,
    }));

export default function ConnectionsTab() {
    const { data: customToolsetConfigs = [] } =
        ToolsetsAPI.useCustomToolsetConfigs();
    const updateToolset = ToolsetsAPI.useUpdateCustomToolsetConfig();
    const deleteToolset = ToolsetsAPI.useDeleteCustomToolsetConfig();
    const importFromClaudeDesktop = ToolsetsAPI.useImportFromClaudeDesktop();

    const [formMode, setFormMode] = useState<
        "create" | "edit" | "remote" | null
    >(null);
    const [editingToolset, setEditingToolset] = useState<CustomToolsetConfig>({
        name: "",
        command: "",
        args: "",
        env: "{}",
    });
    const [formErrors, setFormErrors] = useState<Record<string, string>>({});
    const [activeToolsetTab, setActiveToolsetTab] = useState<
        "custom" | "builtin"
    >("custom");

    const validateToolset = (
        toolset: CustomToolsetConfig,
        isEditing: boolean,
    ) => {
        const errors: Record<string, string> = {};
        if (!toolset.name) errors.name = "Name is required";
        if (!toolset.command) errors.command = "Command is required";

        if (toolset.name && !/^[a-z0-9-]+$/.test(toolset.name)) {
            errors.name =
                "Name must be one word, lowercase, and contain only letters, numbers, and dashes";
        }

        if (
            toolset.name &&
            !isEditing &&
            customToolsetConfigs.some((t) => t.name === toolset.name)
        ) {
            errors.name = "Name already exists";
        }

        if (toolset.env) {
            try {
                const envParsed = getEnvFromJSON(toolset.env);
                if (envParsed._type === "error") {
                    errors.env = envParsed.error;
                }
            } catch {
                errors.env = "Invalid JSON format";
            }
        }

        return errors;
    };

    const handleEditToolset = (toolset: CustomToolsetConfig) => {
        setFormMode("edit");
        setEditingToolset({ ...toolset });
        setFormErrors({});
    };

    const handleCreateToolset = () => {
        setFormMode("create");
        setEditingToolset({ name: "", command: "", args: "", env: "{}" });
        setFormErrors({});
    };

    const handleCreateRemoteToolsetForm = () => {
        setFormMode("remote");
        setFormErrors({});
    };

    const handleCancelForm = () => {
        setFormMode(null);
        setEditingToolset({ name: "", command: "", args: "", env: "{}" });
        setFormErrors({});
    };

    const handleFieldChange = (
        field: keyof CustomToolsetConfig,
        value: string,
    ) => {
        const updatedToolset = { ...editingToolset, [field]: value };
        setEditingToolset(updatedToolset);
        setFormErrors(validateToolset(updatedToolset, formMode === "edit"));
    };

    const handleSaveToolset = async () => {
        const validationErrors = validateToolset(
            editingToolset,
            formMode === "edit",
        );
        if (Object.keys(validationErrors).length > 0) {
            setFormErrors(validationErrors);
            return;
        }

        try {
            await updateToolset.mutateAsync({
                toolset: editingToolset,
            });
            toast.success("Success", {
                description: `Connection ${formMode === "create" ? "created" : "updated"} successfully`,
            });
            setFormMode(null);
            setEditingToolset({ name: "", command: "", args: "", env: "{}" });
            setFormErrors({});
        } catch {
            setFormErrors({
                _general: `Failed to ${formMode} connection`,
            });
        }
    };

    const handleCreateRemoteToolset = async (name: string, url: string) => {
        await updateToolset.mutateAsync({
            toolset: {
                name: name,
                command: "npx",
                args: `-y mcp-remote ${url}`,
                env: "{}",
            },
        });
        toast.success("Success", {
            description: `Remote connection created successfully`,
        });
        setFormMode(null);
    };

    const handleDeleteToolset = async (name: string) => {
        try {
            await deleteToolset.mutateAsync(name);
            toast.success("Success", {
                description: "Connection deleted successfully",
            });
        } catch {
            toast.error("Error", {
                description: "Failed to delete connection",
            });
        }
    };

    const handleSuggestedMCP = (
        name: string,
        command: string,
        args: string,
        env: string,
        needsUserInput: boolean,
    ) => {
        if (needsUserInput) {
            setFormMode("create");
            setEditingToolset({
                name: name,
                command: command,
                args: args,
                env: env,
            });
        } else {
            updateToolset
                .mutateAsync({
                    toolset: {
                        name: name,
                        command: command,
                        args: args,
                        env: env,
                    },
                })
                .then(() => {
                    toast.success("Success", {
                        description: `${name} connection added successfully`,
                    });
                })
                .catch((err) => {
                    toast.error("Error", {
                        description: `Failed to add ${name} connection ${err}`,
                    });
                });
        }
    };

    const onClaudeDesktopImportClick = async () => {
        try {
            const result = await importFromClaudeDesktop.mutateAsync();
            toast.success("Import Successful", {
                description: `Imported ${result.imported} tools from Claude Desktop`,
            });
        } catch (error) {
            toast.error("Import Failed", {
                description:
                    error instanceof Error
                        ? error.message
                        : "Failed to import tools from Claude Desktop",
            });
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h3 className="text-2xl font-semibold">MCP Connections</h3>
            </div>

            {formMode === "remote" ? (
                <RemoteToolsetForm
                    isOpen={true}
                    onClose={handleCancelForm}
                    onSubmit={(name, url) => {
                        void handleCreateRemoteToolset(name, url);
                    }}
                />
            ) : formMode ? (
                <ToolsetForm
                    toolset={editingToolset}
                    errors={formErrors}
                    isReadOnly={formMode === "edit"}
                    onChange={handleFieldChange}
                    onSave={() => void handleSaveToolset()}
                    onCancel={handleCancelForm}
                    apiKeyUrl={
                        RECOMMENDED_TOOLSETS.find(
                            (t) => t.name === editingToolset.name,
                        )?.apiKeyUrl
                    }
                    docsUrl={
                        RECOMMENDED_TOOLSETS.find(
                            (t) => t.name === editingToolset.name,
                        )?.docsUrl
                    }
                    title={
                        formMode === "create"
                            ? "New MCP"
                            : `Edit ${editingToolset.name}`
                    }
                />
            ) : (
                <div className="gap-2">
                    <h5 className="text-sm font-geist-mono uppercase tracking-wider font-[350]">
                        Quick start
                    </h5>
                    <div className="grid grid-cols-3 gap-2 mt-2">
                        <div className="col-span-1">
                            <button
                                onClick={handleCreateToolset}
                                className={`flex flex-col font-semibold items-center gap-2 border border-border hover:bg-muted rounded-md w-full py-4 disabled:opacity-50 disabled:hover:bg-transparent disabled:cursor-not-allowed`}
                            >
                                <Plus className="size-9" />
                                New Local MCP
                            </button>
                        </div>
                        <div className="col-span-1">
                            <button
                                onClick={handleCreateRemoteToolsetForm}
                                className={`flex flex-col font-medium items-center gap-2 border border-border hover:bg-muted rounded-md w-full py-4 disabled:opacity-50 disabled:hover:bg-transparent disabled:cursor-not-allowed`}
                            >
                                <Plus className="size-9" />
                                New Remote MCP
                            </button>
                        </div>
                        <div className="col-span-1">
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <button
                                        onClick={() =>
                                            void onClaudeDesktopImportClick()
                                        }
                                        className={`flex flex-col font-semibold items-center gap-2  border border-border hover:bg-muted rounded-md w-full py-4 disabled:opacity-50 disabled:hover:bg-transparent disabled:cursor-not-allowed`}
                                    >
                                        {importFromClaudeDesktop.isPending ? (
                                            <>
                                                <Loader2 className="size-9 animate-spin" />
                                                Importing...
                                            </>
                                        ) : (
                                            <>
                                                <RiClaudeFill className="size-9" />
                                                Import from Claude Desktop
                                            </>
                                        )}
                                    </button>
                                </TooltipTrigger>
                                <TooltipContent
                                    side="bottom"
                                    className="max-w-[300px]"
                                >
                                    Import MCPs from Claude Desktop. If you've
                                    made changes to your MCPs in Claude Desktop,
                                    you can click this button again to refresh
                                    your Chorus MCPs.
                                </TooltipContent>
                            </Tooltip>
                        </div>

                        {RECOMMENDED_TOOLSETS.map((toolset) => (
                            <div key={toolset.name} className="relative">
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <button
                                            type="button"
                                            disabled={customToolsetConfigs.some(
                                                (t) => t.name === toolset.name,
                                            )}
                                            className={`flex flex-col items-center gap-2  font-semibold border border-border hover:bg-muted rounded-md w-full py-4 disabled:opacity-50 disabled:hover:bg-transparent disabled:cursor-not-allowed`}
                                            onClick={() => {
                                                handleSuggestedMCP(
                                                    toolset.name,
                                                    toolset.command,
                                                    toolset.args,
                                                    toolset.env || "{}",
                                                    toolset.needsUserInput,
                                                );
                                            }}
                                        >
                                            {toolset.logo}
                                            <span className="flex items-center gap-1">
                                                {toolset.name}{" "}
                                            </span>
                                        </button>
                                    </TooltipTrigger>
                                    {toolset.description && (
                                        <TooltipContent
                                            side="bottom"
                                            className="max-w-[300px]"
                                        >
                                            {toolset.description}
                                        </TooltipContent>
                                    )}
                                </Tooltip>

                                <div className="text-[10px] flex justify-end absolute top-1 right-1.5">
                                    <button
                                        type="button"
                                        className="hover:text-foreground flex items-center gap-1"
                                        onClick={(e) => {
                                            e.preventDefault();
                                            if (toolset.docsUrl) {
                                                void openUrl(toolset.docsUrl);
                                            }
                                        }}
                                    >
                                        <InfoCircledIcon className="size-3" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {!formMode && (
                <Tabs
                    value={activeToolsetTab}
                    onValueChange={(value) =>
                        setActiveToolsetTab(value as "custom" | "builtin")
                    }
                    className="mt-6"
                >
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="custom">Custom</TabsTrigger>
                        <TabsTrigger value="builtin">Built-in</TabsTrigger>
                    </TabsList>
                    <TabsContent value="custom" className="mt-4">
                        {customToolsetConfigs.length > 0 ? (
                            <div className="space-y-4 overflow-hidden">
                                {customToolsetConfigs.map((toolset) => (
                                    <CustomToolsetRow
                                        key={toolset.name}
                                        toolset={toolset}
                                        onEdit={handleEditToolset}
                                        onDelete={(name) =>
                                            void handleDeleteToolset(name)
                                        }
                                    />
                                ))}
                            </div>
                        ) : (
                            <button
                                type="button"
                                className="relative block w-full hover:bg-muted rounded-lg border-2 border-dashed border-border p-12 text-center focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                                onClick={handleCreateToolset}
                            >
                                <span className="mt-2 block">
                                    <Plus className="size-12 mx-auto text-muted-foreground" />
                                    <span className="mt-2 block  font-semibold">
                                        New MCP
                                    </span>
                                </span>
                            </button>
                        )}
                    </TabsContent>
                    <TabsContent value="builtin" className="mt-4">
                        <div className="space-y-4 overflow-hidden">
                            {CORE_BUILTIN_TOOLSETS_DATA.map((toolset) => (
                                <div
                                    key={toolset.name}
                                    className="flex items-start gap-4 p-4 border rounded-lg shadow-xs bg-card"
                                >
                                    <div className="text-primary shrink-0 mt-1">
                                        {toolset.icon()}
                                    </div>
                                    <div className="flex-1">
                                        <div className="font-semibold  text-card-foreground">
                                            {toolset.displayName}
                                        </div>
                                        {toolset.description && (
                                            <p className="text-sm mt-1">
                                                {toolset.description}
                                            </p>
                                        )}
                                    </div>
                                    {toolset.name === "github" && (
                                        <Button
                                            onClick={() => {
                                                void openUrl(
                                                    "https://github.com/settings/connections/applications/Ov23liViInr7fzLZk61V",
                                                );
                                            }}
                                            variant="outline"
                                            size="iconSm"
                                        >
                                            <LinkIcon className="size-4" />
                                            Manage Connection
                                        </Button>
                                    )}
                                </div>
                            ))}
                        </div>
                    </TabsContent>
                </Tabs>
            )}

        </div>
    );
}

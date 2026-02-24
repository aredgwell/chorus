import { useState, useEffect } from "react";
import { Button } from "@ui/components/ui/button";
import { Input } from "@ui/components/ui/input";
import { Separator } from "@ui/components/ui/separator";
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "@ui/components/ui/tooltip";
import {
    Loader2,
    ExternalLinkIcon,
    Pencil,
    Trash2,
    Plus,
    LinkIcon,
    Flame,
    Search,
    CheckIcon,
    ChevronDown,
} from "lucide-react";
import { RiClaudeFill, RiSupabaseFill } from "react-icons/ri";
import {
    SiStripe,
    SiElevenlabs,
    SiSentry,
    SiVercel,
    SiPostgresql,
    SiSlack,
    SiBrave,
    SiAmazonwebservices,
    SiCloudflare,
    SiGithub,
} from "react-icons/si";
import { toast } from "sonner";
import { openUrl } from "@tauri-apps/plugin-opener";
import { CustomToolsetConfig, getEnvFromJSON } from "@core/chorus/Toolsets";
import * as ToolsetsAPI from "@core/chorus/api/ToolsetsAPI";
import { ToolsetsManager } from "@core/chorus/ToolsetsManager";
import { getToolsetIcon } from "@core/chorus/Toolsets";
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@ui/components/ui/collapsible";

// ---------------------------------------------------------------------------
// Recommended integrations registry (alphabetical)
// ---------------------------------------------------------------------------

const RECOMMENDED_TOOLSETS = [
    {
        name: "aws",
        command: "npx",
        args: "-y @aws/amazon-q-developer-mcp-server",
        env: `{"AWS_ACCESS_KEY_ID": "your-access-key", "AWS_SECRET_ACCESS_KEY": "your-secret-key", "AWS_REGION": "us-east-1"}`,
        description: "Manage AWS resources and services.",
        logo: <SiAmazonwebservices className="size-5" />,
        docsUrl: "https://github.com/aws/amazon-q-developer-mcp-server",
        apiKeyUrl:
            "https://console.aws.amazon.com/iam/home#/security_credentials",
        needsUserInput: true,
    },
    {
        name: "brave-search",
        command: "npx",
        args: "-y @modelcontextprotocol/server-brave-search",
        env: `{"BRAVE_API_KEY": "your-brave-api-key"}`,
        description: "Search the web using Brave Search API.",
        logo: <SiBrave className="size-5" />,
        docsUrl:
            "https://github.com/modelcontextprotocol/servers/tree/main/src/brave-search",
        apiKeyUrl: "https://brave.com/search/api/",
        needsUserInput: true,
    },
    {
        name: "cloudflare",
        command: "npx",
        args: "-y @cloudflare/mcp-server-cloudflare",
        env: `{"CLOUDFLARE_API_TOKEN": "your-cloudflare-api-token"}`,
        description: "Manage Cloudflare Workers, D1 databases, and R2 storage.",
        logo: <SiCloudflare className="size-5" />,
        docsUrl: "https://github.com/cloudflare/mcp-server-cloudflare",
        apiKeyUrl: "https://dash.cloudflare.com/profile/api-tokens",
        needsUserInput: true,
    },
    {
        name: "context7",
        command: "npx",
        args: "-y @upstash/context7-mcp@latest",
        description: "Gets up-to-date documentation and code examples.",
        logo: (
            <img src="/context7.png" className="size-5 rounded" />
        ),
        docsUrl: "https://github.com/upstash/context7-mcp",
        needsUserInput: false,
    },
    {
        name: "elevenlabs",
        command: "uvx",
        args: "elevenlabs-mcp",
        env: `{"ELEVENLABS_API_KEY": "your-elevenlabs-api-key"}`,
        description: "Generate high-quality speech from text using AI voices.",
        logo: <SiElevenlabs className="size-5" />,
        docsUrl: "https://github.com/elevenlabs/elevenlabs-mcp",
        apiKeyUrl: "https://elevenlabs.io/app/settings/api-keys",
        needsUserInput: true,
    },
    {
        name: "exa",
        command: "npx",
        args: "-y exa-mcp-server",
        env: `{"EXA_API_KEY": "your-exa-api-key"}`,
        description: "Semantic search across the web with AI-powered results.",
        logo: <Search className="size-5" />,
        docsUrl: "https://github.com/exa-labs/exa-mcp-server",
        apiKeyUrl: "https://dashboard.exa.ai/api-keys",
        needsUserInput: true,
    },
    {
        name: "firecrawl",
        command: "npx",
        args: "-y firecrawl-mcp",
        env: `{"FIRECRAWL_API_KEY": "your-firecrawl-api-key"}`,
        description: "Scrape and crawl websites, extract structured data.",
        logo: <Flame className="size-5" />,
        docsUrl: "https://github.com/firecrawl/firecrawl-mcp-server",
        apiKeyUrl: "https://www.firecrawl.dev/app/api-keys",
        needsUserInput: true,
    },
    {
        name: "postgres",
        command: "npx",
        args: "-y @modelcontextprotocol/server-postgres postgres://user:password@localhost:5432/dbname",
        description: "Query and manage PostgreSQL databases.",
        logo: <SiPostgresql className="size-5" />,
        docsUrl:
            "https://github.com/modelcontextprotocol/servers/tree/main/src/postgres",
        needsUserInput: true,
    },
    {
        name: "replicate",
        command: "npx",
        args: "-y mcp-remote@latest https://mcp.replicate.com/sse",
        env: `{"REPLICATE_API_TOKEN": "your-replicate-api-token"}`,
        description: "Run and manage machine learning models in the cloud.",
        logo: <img src="/replicate.png" className="size-5" />,
        docsUrl: "https://www.npmjs.com/package/replicate-mcp",
        apiKeyUrl: "https://replicate.com/account/api-tokens",
        needsUserInput: false,
    },
    {
        name: "sentry",
        command: "npx",
        args: "-y @sentry/mcp-server@latest",
        env: `{"SENTRY_AUTH_TOKEN": "your-sentry-auth-token"}`,
        description: "Monitor errors, performance, and application health.",
        logo: <SiSentry className="size-5" />,
        docsUrl: "https://github.com/getsentry/sentry-mcp",
        apiKeyUrl: "https://sentry.io/settings/account/api/auth-tokens/",
        needsUserInput: true,
    },
    {
        name: "slack",
        command: "npx",
        args: "-y @modelcontextprotocol/server-slack",
        env: `{"SLACK_BOT_TOKEN": "xoxb-your-slack-bot-token"}`,
        description: "Read and send messages in Slack workspaces.",
        logo: <SiSlack className="size-5" />,
        docsUrl:
            "https://github.com/modelcontextprotocol/servers/tree/main/src/slack",
        apiKeyUrl: "https://api.slack.com/apps",
        needsUserInput: true,
    },
    {
        name: "stripe",
        command: "npx",
        args: "-y @stripe/mcp --tools=all --api-key=YOUR_STRIPE_API_KEY",
        description: "Manage payments, customers, and subscriptions.",
        logo: <SiStripe className="size-5" />,
        docsUrl: "https://docs.stripe.com/building-with-llms",
        apiKeyUrl: "https://dashboard.stripe.com/apikeys",
        needsUserInput: true,
    },
    {
        name: "supabase",
        command: "npx",
        args: "-y @supabase/mcp-server-supabase@latest --access-token <personal-access-token>",
        description:
            "Manage databases, authentication, and real-time subscriptions.",
        logo: <RiSupabaseFill className="size-5" />,
        docsUrl: "https://supabase.com/blog/mcp-server",
        apiKeyUrl: "https://supabase.com/dashboard/project/settings/api",
        needsUserInput: true,
    },
    {
        name: "vercel",
        command: "npx",
        args: "-y @vercel/mcp@latest",
        env: `{"VERCEL_API_TOKEN": "your-vercel-api-token"}`,
        description: "Deploy, manage, and monitor Vercel projects.",
        logo: <SiVercel className="size-5" />,
        docsUrl: "https://vercel.com/docs/mcp",
        apiKeyUrl: "https://vercel.com/account/tokens",
        needsUserInput: true,
    },
];

// ---------------------------------------------------------------------------
// Built-in toolsets
// ---------------------------------------------------------------------------

const CORE_BUILTIN_TOOLSETS_DATA = ToolsetsManager.instance
    .listToolsets()
    .filter((toolset) => toolset.isBuiltIn)
    .map((toolset) => ({
        name: toolset.name,
        displayName: toolset.displayName,
        icon: () => getToolsetIcon(toolset.name),
        description: toolset.description,
    }));

// ---------------------------------------------------------------------------
// Recommended integration row — inline editable
// ---------------------------------------------------------------------------

function RecommendedIntegrationRow({
    rec,
    installed,
    onAdd,
    onRemove,
}: {
    rec: (typeof RECOMMENDED_TOOLSETS)[number];
    installed: CustomToolsetConfig | undefined;
    onAdd: (toolset: CustomToolsetConfig) => void;
    onRemove: (name: string) => void;
}) {
    const isInstalled = !!installed;
    // Local state for editable fields — initialized from installed config or defaults
    const [args, setArgs] = useState(installed?.args ?? rec.args);
    const [env, setEnv] = useState(installed?.env ?? rec.env ?? "{}");

    // Sync local state when installed config changes (e.g. after save)
    useEffect(() => {
        if (installed) {
            setArgs(installed.args ?? rec.args);
            setEnv(installed.env ?? rec.env ?? "{}");
        }
    }, [installed, rec.args, rec.env]);

    const handleAdd = () => {
        onAdd({
            name: rec.name,
            command: rec.command,
            args,
            env,
        });
    };

    return (
        <div className="space-y-2">
            {/* Header row: logo + name + description + status + actions */}
            <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2.5 flex-1 min-w-0">
                    <div className="mt-0.5 shrink-0">{rec.logo}</div>
                    <div className="min-w-0">
                        <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">
                                {rec.name}
                            </span>
                            {isInstalled && (
                                <CheckIcon className="size-3.5 text-green-500" />
                            )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                            {rec.description}
                        </p>
                    </div>
                </div>
                {/* Fixed-width icon area: two slots so icons stay aligned */}
                <div className="flex items-center shrink-0 w-[52px] justify-end gap-0">
                    {rec.docsUrl ? (
                        <Button
                            variant="ghost"
                            size="iconSm"
                            onClick={() => void openUrl(rec.docsUrl)}
                            title="Documentation"
                        >
                            {rec.docsUrl.includes("github.com") ? (
                                <SiGithub className="size-3.5" />
                            ) : (
                                <ExternalLinkIcon className="size-3.5" />
                            )}
                        </Button>
                    ) : (
                        <div className="w-6" />
                    )}
                    {rec.apiKeyUrl ? (
                        <Button
                            variant="ghost"
                            size="iconSm"
                            onClick={() => void openUrl(rec.apiKeyUrl!)}
                            title="Get API key"
                        >
                            <ExternalLinkIcon className="size-3.5" />
                        </Button>
                    ) : (
                        <div className="w-6" />
                    )}
                </div>
            </div>

            {/* Inline fields */}
            <Collapsible>
                <CollapsibleTrigger className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
                    <ChevronDown className="size-3" />
                    {isInstalled ? "Edit configuration" : "Configure & add"}
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-2 pt-2">
                    {/* Command (read-only for recommended) */}
                    <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">
                            Command
                        </label>
                        <Input
                            value={rec.command}
                            readOnly
                            className="text-xs font-mono bg-muted/50 h-8"
                            spellCheck={false}
                        />
                    </div>

                    {/* Arguments */}
                    <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">
                            Arguments
                        </label>
                        <Input
                            value={args}
                            onChange={(e) => setArgs(e.target.value)}
                            className="text-xs font-mono h-8"
                            spellCheck={false}
                        />
                    </div>

                    {/* Environment (only if there are env vars) */}
                    {rec.env && (
                        <div className="space-y-1">
                            <div className="flex items-center justify-between">
                                <label className="text-xs text-muted-foreground">
                                    Environment (JSON)
                                </label>
                                {rec.apiKeyUrl && (
                                    <button
                                        type="button"
                                        className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
                                        onClick={() =>
                                            void openUrl(rec.apiKeyUrl!)
                                        }
                                    >
                                        Get API key
                                        <ExternalLinkIcon className="size-3" />
                                    </button>
                                )}
                            </div>
                            <Input
                                value={env}
                                onChange={(e) => setEnv(e.target.value)}
                                className="text-xs font-mono h-8"
                                spellCheck={false}
                            />
                        </div>
                    )}

                    {/* Action buttons */}
                    <div className="flex justify-end gap-2 pt-1">
                        {isInstalled ? (
                            <>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => onRemove(rec.name)}
                                >
                                    <Trash2 className="size-3 mr-1" />
                                    Remove
                                </Button>
                                <Button size="sm" onClick={handleAdd}>
                                    Save
                                </Button>
                            </>
                        ) : (
                            <Button size="sm" onClick={handleAdd}>
                                <Plus className="size-3 mr-1" />
                                Add
                            </Button>
                        )}
                    </div>
                </CollapsibleContent>
            </Collapsible>
        </div>
    );
}

// ---------------------------------------------------------------------------
// Custom (non-recommended) integration row
// ---------------------------------------------------------------------------

function CustomIntegrationRow({
    toolset,
    onEdit,
    onDelete,
}: {
    toolset: CustomToolsetConfig;
    onEdit: (toolset: CustomToolsetConfig) => void;
    onDelete: (name: string) => void;
}) {
    return (
        <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
                <div className="text-sm font-medium">{toolset.name}</div>
                <p className="text-xs text-muted-foreground font-mono truncate">
                    {toolset.command} {toolset.args}
                </p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
                <Button
                    variant="ghost"
                    size="iconSm"
                    onClick={() => onEdit(toolset)}
                    title="Edit"
                >
                    <Pencil className="size-3.5" />
                </Button>
                <Button
                    variant="ghost"
                    size="iconSm"
                    onClick={() => onDelete(toolset.name)}
                    title="Delete"
                >
                    <Trash2 className="size-3.5" />
                </Button>
            </div>
        </div>
    );
}

// ---------------------------------------------------------------------------
// Inline edit form (for custom/local/remote integrations)
// ---------------------------------------------------------------------------

function InlineEditForm({
    toolset,
    errors,
    isNew,
    onChange,
    onSave,
    onCancel,
}: {
    toolset: CustomToolsetConfig;
    errors: Record<string, string>;
    isNew: boolean;
    onChange: (field: keyof CustomToolsetConfig, value: string) => void;
    onSave: () => void;
    onCancel: () => void;
}) {
    return (
        <div className="space-y-3 border rounded-md p-4">
            <h4 className="text-sm font-semibold">
                {isNew ? "New Integration" : `Edit ${toolset.name}`}
            </h4>

            {errors._general && (
                <div className="text-destructive text-sm">
                    {errors._general}
                </div>
            )}

            {isNew && (
                <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">
                        Name
                    </label>
                    <Input
                        value={toolset.name}
                        onChange={(e) => onChange("name", e.target.value)}
                        className={`text-xs font-mono h-8 ${errors.name ? "border-destructive" : ""}`}
                        placeholder="my-integration"
                        autoCapitalize="off"
                        autoComplete="off"
                        spellCheck={false}
                    />
                    {errors.name && (
                        <div className="text-destructive text-xs">
                            {errors.name}
                        </div>
                    )}
                </div>
            )}

            <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Command</label>
                <Input
                    value={toolset.command}
                    onChange={(e) => onChange("command", e.target.value)}
                    className={`text-xs font-mono h-8 ${errors.command ? "border-destructive" : ""}`}
                    placeholder="npx"
                    spellCheck={false}
                />
                {errors.command && (
                    <div className="text-destructive text-xs">
                        {errors.command}
                    </div>
                )}
            </div>

            <div className="space-y-1">
                <label className="text-xs text-muted-foreground">
                    Arguments
                </label>
                <Input
                    value={toolset.args || ""}
                    onChange={(e) => onChange("args", e.target.value)}
                    className={`text-xs font-mono h-8 ${errors.args ? "border-destructive" : ""}`}
                    placeholder="--port 8080"
                    spellCheck={false}
                />
            </div>

            <div className="space-y-1">
                <label className="text-xs text-muted-foreground">
                    Environment (JSON)
                </label>
                <Input
                    value={toolset.env || "{}"}
                    onChange={(e) => onChange("env", e.target.value)}
                    className={`text-xs font-mono h-8 ${errors.env ? "border-destructive" : ""}`}
                    spellCheck={false}
                />
                {errors.env && (
                    <div className="text-destructive text-xs">
                        {errors.env}
                    </div>
                )}
            </div>

            <div className="flex justify-end gap-2 pt-1">
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

// ---------------------------------------------------------------------------
// Remote integration form
// ---------------------------------------------------------------------------

function RemoteIntegrationForm({
    onClose,
    onSubmit,
}: {
    onClose: () => void;
    onSubmit: (name: string, url: string) => void;
}) {
    const [name, setName] = useState("");
    const [url, setUrl] = useState("");
    const [errors, setErrors] = useState<{ name?: string; url?: string }>({});
    const { data: customToolsetConfigs = [] } =
        ToolsetsAPI.useCustomToolsetConfigs();

    const validate = () => {
        const newErrors: { name?: string; url?: string } = {};
        if (!name.trim()) newErrors.name = "Name is required";
        else if (!/^[a-z0-9-]+$/.test(name))
            newErrors.name = "Lowercase letters, numbers, and dashes only";
        else if (customToolsetConfigs.some((t) => t.name === name))
            newErrors.name = "Name already exists";

        if (!url.trim()) newErrors.url = "URL is required";
        else if (!url.startsWith("http://") && !url.startsWith("https://"))
            newErrors.url = "Must start with http:// or https://";
        else {
            try {
                new URL(url);
            } catch {
                newErrors.url = "Invalid URL";
            }
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = () => {
        if (validate()) {
            onSubmit(name, url);
        }
    };

    return (
        <div className="space-y-3 border rounded-md p-4">
            <h4 className="text-sm font-semibold">Add Remote Integration</h4>

            <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Name</label>
                <Input
                    value={name}
                    onChange={(e) => {
                        setName(e.target.value);
                        setErrors((prev) => ({ ...prev, name: undefined }));
                    }}
                    onKeyDown={(e) => {
                        if (e.key === "Enter") handleSubmit();
                    }}
                    className={`text-xs font-mono h-8 ${errors.name ? "border-destructive" : ""}`}
                    placeholder="zapier"
                    autoFocus
                    autoCapitalize="off"
                    spellCheck={false}
                />
                {errors.name && (
                    <div className="text-destructive text-xs">
                        {errors.name}
                    </div>
                )}
            </div>

            <div className="space-y-1">
                <label className="text-xs text-muted-foreground">URL</label>
                <Input
                    value={url}
                    onChange={(e) => {
                        setUrl(e.target.value);
                        setErrors((prev) => ({ ...prev, url: undefined }));
                    }}
                    onKeyDown={(e) => {
                        if (e.key === "Enter") handleSubmit();
                    }}
                    className={`text-xs font-mono h-8 ${errors.url ? "border-destructive" : ""}`}
                    placeholder="https://mcp.zapier.com/api/mcp/s/.../sse"
                />
                {errors.url && (
                    <div className="text-destructive text-xs">
                        {errors.url}
                    </div>
                )}
            </div>

            <div className="flex justify-end gap-2 pt-1">
                <Button variant="outline" size="sm" onClick={onClose}>
                    Cancel
                </Button>
                <Button size="sm" onClick={handleSubmit}>
                    Save
                </Button>
            </div>
        </div>
    );
}

// ---------------------------------------------------------------------------
// Main ConnectionsTab
// ---------------------------------------------------------------------------

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

    const validateToolset = (
        toolset: CustomToolsetConfig,
        isEditing: boolean,
    ) => {
        const errors: Record<string, string> = {};
        if (!toolset.name) errors.name = "Name is required";
        if (!toolset.command) errors.command = "Command is required";
        if (toolset.name && !/^[a-z0-9-]+$/.test(toolset.name))
            errors.name = "Lowercase letters, numbers, and dashes only";
        if (
            toolset.name &&
            !isEditing &&
            customToolsetConfigs.some((t) => t.name === toolset.name)
        )
            errors.name = "Name already exists";
        if (toolset.env) {
            try {
                const envParsed = getEnvFromJSON(toolset.env);
                if (envParsed._type === "error") errors.env = envParsed.error;
            } catch {
                errors.env = "Invalid JSON";
            }
        }
        return errors;
    };

    const handleSaveToolset = async () => {
        const errors = validateToolset(editingToolset, formMode === "edit");
        if (Object.keys(errors).length > 0) {
            setFormErrors(errors);
            return;
        }
        try {
            await updateToolset.mutateAsync({ toolset: editingToolset });
            toast.success("Success", {
                description: `Integration ${formMode === "create" ? "created" : "updated"} successfully`,
            });
            setFormMode(null);
            setEditingToolset({ name: "", command: "", args: "", env: "{}" });
            setFormErrors({});
        } catch {
            setFormErrors({ _general: `Failed to ${formMode} integration` });
        }
    };

    const handleAddRecommended = async (toolset: CustomToolsetConfig) => {
        try {
            await updateToolset.mutateAsync({ toolset });
            toast.success("Success", {
                description: `${toolset.name} integration added successfully`,
            });
        } catch (err) {
            toast.error("Error", {
                description: `Failed to add ${toolset.name} integration ${err}`,
            });
        }
    };

    const handleRemoveIntegration = async (name: string) => {
        try {
            await deleteToolset.mutateAsync(name);
            toast.success("Success", {
                description: "Integration removed successfully",
            });
        } catch {
            toast.error("Error", {
                description: "Failed to remove integration",
            });
        }
    };

    const handleCreateRemoteToolset = async (name: string, url: string) => {
        await updateToolset.mutateAsync({
            toolset: {
                name,
                command: "npx",
                args: `-y mcp-remote ${url}`,
                env: "{}",
            },
        });
        toast.success("Success", {
            description: "Remote integration created successfully",
        });
        setFormMode(null);
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

    // Separate custom toolsets that are NOT in the recommended list
    const recommendedNames = new Set(RECOMMENDED_TOOLSETS.map((t) => t.name));
    const pureCustomToolsets = customToolsetConfigs.filter(
        (t) => !recommendedNames.has(t.name),
    );

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-semibold mb-2">Integrations</h2>
                <p className="text-sm text-muted-foreground">
                    Add integrations to give AI models access to external tools
                    and services.
                </p>
            </div>

            {/* Recommended integrations — flat list */}
            <div className="space-y-5">
                {RECOMMENDED_TOOLSETS.map((rec) => (
                    <RecommendedIntegrationRow
                        key={rec.name}
                        rec={rec}
                        installed={customToolsetConfigs.find(
                            (t) => t.name === rec.name,
                        )}
                        onAdd={(toolset) => void handleAddRecommended(toolset)}
                        onRemove={(name) =>
                            void handleRemoveIntegration(name)
                        }
                    />
                ))}
            </div>

            {/* Custom (non-recommended) integrations */}
            {pureCustomToolsets.length > 0 && (
                <>
                    <Separator />
                    <div className="space-y-3">
                        <h3 className="text-sm font-semibold">
                            Custom Integrations
                        </h3>
                        {pureCustomToolsets.map((toolset) => (
                            <CustomIntegrationRow
                                key={toolset.name}
                                toolset={toolset}
                                onEdit={(t) => {
                                    setFormMode("edit");
                                    setEditingToolset({ ...t });
                                    setFormErrors({});
                                }}
                                onDelete={(name) =>
                                    void handleRemoveIntegration(name)
                                }
                            />
                        ))}
                    </div>
                </>
            )}

            {/* Inline edit form (shown when creating/editing custom) */}
            {formMode === "remote" && (
                <>
                    <Separator />
                    <RemoteIntegrationForm
                        onClose={() => setFormMode(null)}
                        onSubmit={(name, url) => {
                            void handleCreateRemoteToolset(name, url);
                        }}
                    />
                </>
            )}
            {(formMode === "create" || formMode === "edit") && (
                <>
                    <Separator />
                    <InlineEditForm
                        toolset={editingToolset}
                        errors={formErrors}
                        isNew={formMode === "create"}
                        onChange={(field, value) => {
                            const updated = {
                                ...editingToolset,
                                [field]: value,
                            };
                            setEditingToolset(updated);
                            setFormErrors(
                                validateToolset(updated, formMode === "edit"),
                            );
                        }}
                        onSave={() => void handleSaveToolset()}
                        onCancel={() => {
                            setFormMode(null);
                            setEditingToolset({
                                name: "",
                                command: "",
                                args: "",
                                env: "{}",
                            });
                            setFormErrors({});
                        }}
                    />
                </>
            )}

            {/* Add custom / Import section */}
            <Separator />
            <div className="space-y-3">
                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                            setFormMode("create");
                            setEditingToolset({
                                name: "",
                                command: "",
                                args: "",
                                env: "{}",
                            });
                            setFormErrors({});
                        }}
                    >
                        <Plus className="size-3 mr-1" />
                        Add Local Integration
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                            setFormMode("remote");
                            setFormErrors({});
                        }}
                    >
                        <Plus className="size-3 mr-1" />
                        Add Remote Integration
                    </Button>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                    void onClaudeDesktopImportClick()
                                }
                                disabled={importFromClaudeDesktop.isPending}
                            >
                                {importFromClaudeDesktop.isPending ? (
                                    <Loader2 className="size-3 mr-1 animate-spin" />
                                ) : (
                                    <RiClaudeFill className="size-3 mr-1" />
                                )}
                                Import from Claude Desktop
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent
                            side="bottom"
                            className="max-w-[300px]"
                        >
                            Import integrations from Claude Desktop. Click again
                            to refresh.
                        </TooltipContent>
                    </Tooltip>
                </div>
            </div>

            {/* Built-in integrations (informational) */}
            <Separator />
            <div className="space-y-3">
                <h3 className="text-sm font-semibold">Built-in</h3>
                <div className="space-y-2">
                    {CORE_BUILTIN_TOOLSETS_DATA.map((toolset) => (
                        <div
                            key={toolset.name}
                            className="flex items-center gap-2.5"
                        >
                            <div className="text-muted-foreground shrink-0">
                                {toolset.icon()}
                            </div>
                            <div className="flex-1 min-w-0">
                                <span className="text-sm font-medium">
                                    {toolset.displayName}
                                </span>
                                {toolset.description && (
                                    <span className="text-xs text-muted-foreground ml-2">
                                        — {toolset.description}
                                    </span>
                                )}
                            </div>
                            {toolset.name === "github" && (
                                <Button
                                    onClick={() => {
                                        void openUrl(
                                            "https://github.com/settings/connections/applications/Ov23liViInr7fzLZk61V",
                                        );
                                    }}
                                    variant="ghost"
                                    size="iconSm"
                                    title="Manage GitHub integration"
                                >
                                    <LinkIcon className="size-3.5" />
                                </Button>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

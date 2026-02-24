import { useEffect, useState } from "react";
import {
    SettingsManager,
} from "@core/utilities/Settings";
import { useTheme } from "@ui/hooks/useTheme";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@ui/components/ui/dialog";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";
import {
    ExternalLink,
    Fullscreen,
    ShieldCheckIcon,
    User2,
    Key,
    PlugIcon,
    FileText,
    Import,
    BookOpen,
    Globe,
    BarChart3,
} from "lucide-react";
import { toast } from "sonner";
import { config } from "@core/config";
import { useSearchParams } from "react-router-dom";
import { openUrl } from "@tauri-apps/plugin-opener";
import Database from "@tauri-apps/plugin-sql";
import { useDatabase } from "@ui/hooks/useDatabase";
import { UNIVERSAL_SYSTEM_PROMPT_DEFAULT } from "@core/chorus/prompts/prompts";
import { useQueryClient } from "@tanstack/react-query";
import { useReactQueryAutoSync } from "use-react-query-auto-sync";
import { SiOpenai } from "react-icons/si";
import { RiClaudeFill } from "react-icons/ri";
import ImportChatDialog from "./ImportChatDialog";
import { dialogActions } from "@core/infra/DialogStore";
import * as AppMetadataAPI from "@core/chorus/api/AppMetadataAPI";
import { PermissionsTab } from "./PermissionsTab";
import { CostDashboard } from "./CostDashboard";
import { cn } from "@ui/lib/utils";
import GeneralTab from "./settings/GeneralTab";
import ApiKeysTab from "./settings/ApiKeysTab";
import QuickChatTab from "./settings/QuickChatTab";
import ConnectionsTab from "./settings/ConnectionsTab";
import BaseUrlTab from "./settings/BaseUrlTab";
import type { SettingsTabId, TabConfig } from "./settings/types";
export type { SettingsTabId } from "./settings/types";

export const SETTINGS_DIALOG_ID = "settings";

interface SettingsProps {
    tab?: SettingsTabId;
}

const TABS: Record<SettingsTabId, TabConfig> = {
    general: { label: "General", icon: User2 },
    import: { label: "Import", icon: Import },
    "system-prompt": { label: "System Prompt", icon: FileText },
    "api-keys": { label: "API Keys", icon: Key },
    "quick-chat": { label: "Ambient Chat", icon: Fullscreen },
    connections: { label: "Connections", icon: PlugIcon },
    permissions: { label: "Tool Permissions", icon: ShieldCheckIcon },
    "base-url": { label: "Base URL", icon: Globe },
    usage: { label: "Usage", icon: BarChart3 },
    docs: { label: "Documentation", icon: BookOpen },
} as const;

interface QuickChatSettings {
    enabled: boolean;
    modelConfigId?: string;
    shortcut?: string;
}

interface Settings {
    apiKeys: Record<string, string>;
    sansFont?: string;
    monoFont?: string;
    autoConvertLongText: boolean;
    showCost: boolean;
    quickChat: QuickChatSettings;
    lmStudioBaseUrl?: string;
    autoScrapeUrls: boolean;
    cautiousEnter?: boolean;
}

export default function Settings({ tab = "general" }: SettingsProps) {
    const settingsManager = SettingsManager.getInstance();
    const { mode, setMode, setSansFont, setMonoFont, sansFont } = useTheme();
    const [apiKeys, setApiKeys] = useState<Record<string, string>>({});
    const [autoConvertLongText, setAutoConvertLongText] = useState(true);
    const [autoScrapeUrls, setAutoScrapeUrls] = useState(true);
    const [cautiousEnter, setCautiousEnter] = useState(false);
    const [showCost, setShowCost] = useState(false);
    const { db } = useDatabase();
    const [searchParams] = useSearchParams();
    const defaultTab =
        tab || (searchParams.get("tab") as SettingsTabId) || "general";
    const [quickChatEnabled, setQuickChatEnabled] = useState(true);
    const [quickChatShortcut, setQuickChatShortcut] = useState("Alt+Space");
    const [lmStudioBaseUrl, setLmStudioBaseUrl] = useState(
        "http://localhost:1234/v1",
    );
    const queryClient = useQueryClient();

    // Use React Query hooks for custom base URL
    const customBaseUrl = AppMetadataAPI.useCustomBaseUrl() || "";
    const setCustomBaseUrlMutation = AppMetadataAPI.useSetCustomBaseUrl();

    // Universal system prompt autosync
    const { draft: universalSystemPrompt, setDraft: setUniversalSystemPrompt } =
        useReactQueryAutoSync({
            queryOptions: {
                queryKey: ["universalSystemPrompt"],
                queryFn: async () => {
                    const appMetadata = await AppMetadataAPI.fetchAppMetadata();
                    return (
                        appMetadata["universal_system_prompt"] ??
                        UNIVERSAL_SYSTEM_PROMPT_DEFAULT
                    );
                },
            },
            mutationOptions: {
                mutationFn: async (value: string) => {
                    await db.execute(
                        `INSERT OR REPLACE INTO app_metadata (key, value) VALUES ('universal_system_prompt', ?)`,
                        [value],
                    );
                    await queryClient.invalidateQueries({
                        queryKey: ["appMetadata"],
                    });
                    return value;
                },
            },
            autoSaveOptions: {
                wait: 1000,
            },
        });

    const handleThemeChange = (value: string) => {
        const [_, mode] = value.split("-");
        setMode(mode as "light" | "dark" | "system");
    };

    const handleSansFontChange = async (value: string) => {
        setSansFont(value);
        const currentSettings = await settingsManager.get();
        void settingsManager.set({ ...currentSettings, sansFont: value });
    };

    const handleApiKeyChange = async (provider: string, value: string) => {
        const currentSettings = await settingsManager.get();
        const newApiKeys = {
            ...currentSettings.apiKeys,
            [provider]: value,
        };
        setApiKeys(newApiKeys);
        void settingsManager.set({
            ...currentSettings,
            apiKeys: newApiKeys,
        });

        void queryClient.invalidateQueries({ queryKey: ["apiKeys"] });
    };

    useEffect(() => {
        const loadSettings = async () => {
            const settings = (await settingsManager.get()) as Settings;
            setSansFont(settings.sansFont ?? "Geist");
            setMonoFont(settings.monoFont ?? "Fira Code");
            setApiKeys(settings.apiKeys ?? {});
            setQuickChatEnabled(settings.quickChat?.enabled ?? true);
            setQuickChatShortcut(settings.quickChat?.shortcut ?? "Alt+Space");
            setAutoConvertLongText(settings.autoConvertLongText ?? true);
            setAutoScrapeUrls(settings.autoScrapeUrls ?? true);
            setCautiousEnter(settings.cautiousEnter ?? false);
            setShowCost(settings.showCost ?? false);
            setLmStudioBaseUrl(
                settings.lmStudioBaseUrl ?? "http://localhost:1234/v1",
            );
        };

        void loadSettings();
    }, [db, setMonoFont, setSansFont, settingsManager]);

    const handleQuickChatShortcutChange = async (value: string) => {
        setQuickChatShortcut(value);
        const currentSettings = await settingsManager.get();
        void settingsManager.set({
            ...currentSettings,
            quickChat: {
                ...currentSettings.quickChat,
                shortcut: value,
            },
        });
    };

    const handleQuickChatEnabledChange = async (enabled: boolean) => {
        setQuickChatEnabled(enabled);
        const currentSettings = await settingsManager.get();
        void settingsManager.set({
            ...currentSettings,
            quickChat: {
                ...currentSettings.quickChat,
                enabled,
            },
        });
    };

    const handleAutoConvertLongTextChange = async (enabled: boolean) => {
        setAutoConvertLongText(enabled);
        const currentSettings = await settingsManager.get();
        void settingsManager.set({
            ...currentSettings,
            autoConvertLongText: enabled,
        });
    };

    const handleAutoScrapeUrlsChange = async (enabled: boolean) => {
        setAutoScrapeUrls(enabled);
        const currentSettings = await settingsManager.get();
        void settingsManager.set({
            ...currentSettings,
            autoScrapeUrls: enabled,
        });
    };

    const handleCautiousEnterChange = async (enabled: boolean) => {
        setCautiousEnter(enabled);
        const currentSettings = await settingsManager.get();
        void settingsManager.set({
            ...currentSettings,
            cautiousEnter: enabled,
        });

        await db.execute(
            `INSERT OR REPLACE INTO app_metadata (key, value) VALUES ('cautious_enter', ?)`,
            [enabled ? "true" : "false"],
        );

        await queryClient.invalidateQueries({
            queryKey: ["appMetadata"],
        });
    };

    const handleShowCostChange = async (enabled: boolean) => {
        setShowCost(enabled);
        const currentSettings = await settingsManager.get();
        void settingsManager.set({
            ...currentSettings,
            showCost: enabled,
        });
    };

    const onDefaultQcShortcutClick = async () => {
        setQuickChatShortcut("Alt+Space");
        setQuickChatEnabled(true);
        const currentSettings = await settingsManager.get();
        void settingsManager.set({
            ...currentSettings,
            quickChat: {
                ...currentSettings.quickChat,
                shortcut: "Alt+Space",
                enabled: true,
            },
        });
    };

    const onLmStudioBaseUrlChange = async (
        e: React.ChangeEvent<HTMLInputElement>,
    ) => {
        const newUrl = e.target.value || "http://localhost:1234/v1";
        setLmStudioBaseUrl(newUrl);
        const currentSettings = await settingsManager.get();
        void settingsManager.set({
            ...currentSettings,
            lmStudioBaseUrl: newUrl,
        });
    };

    const onCustomBaseUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newUrl = e.target.value;
        void setCustomBaseUrlMutation.mutate(newUrl);
    };

    const showOnboarding = async () => {
        const db = await Database.load(config.dbUrl);
        await db.execute(
            "UPDATE app_metadata SET value = 'false' WHERE key = 'has_dismissed_onboarding'; UPDATE app_metadata SET value = '0' WHERE key = 'onboarding_step';",
        );

        await queryClient.invalidateQueries({ queryKey: ["appMetadata"] });
        await queryClient.invalidateQueries({
            queryKey: ["hasDismissedOnboarding"],
        });

        toast("Onboarding Reset", {
            description: "Onboarding will appear now.",
        });
    };

    const handleImportHistory = (platform: "openai" | "anthropic") => {
        dialogActions.openDialog(`import-${platform}`);
    };

    const [activeTab, setActiveTab] = useState<SettingsTabId>(defaultTab);

    useEffect(() => {
        setActiveTab(defaultTab);
    }, [defaultTab]);

    const content = (
        <div className="flex flex-col h-full">
            <DialogHeader className="sr-only">
                <DialogTitle>Settings</DialogTitle>
                <DialogDescription>
                    Manage your Chorus settings
                </DialogDescription>
            </DialogHeader>

            <div className="h-full flex">
                {/* Settings Sidebar */}
                <div className="w-52 bg-sidebar p-4 overflow-y-auto border-r">
                    <div className="flex flex-col gap-1">
                        {Object.entries(TABS).map(
                            ([id, { label, icon: Icon }]) => (
                                <button
                                    key={id}
                                    onClick={() => {
                                        if (id === "docs") {
                                            void openUrl(
                                                "https://docs.chorus.sh",
                                            );
                                        } else {
                                            setActiveTab(id as SettingsTabId);
                                        }
                                    }}
                                    className={cn(
                                        "w-full flex items-center gap-3 px-3 py-2 text-sm text-left rounded-md transition-all",
                                        "hover:bg-sidebar-accent",
                                        "focus:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                                        activeTab === id && id !== "docs"
                                            ? "bg-sidebar-accent font-medium"
                                            : "text-muted-foreground",
                                    )}
                                >
                                    <Icon className="w-4 h-4 shrink-0" />
                                    <span className="flex items-center gap-2">
                                        {label}
                                        {id === "docs" && (
                                            <ExternalLink className="w-3 h-3 opacity-50" />
                                        )}
                                    </span>
                                </button>
                            ),
                        )}
                    </div>
                </div>

                {/* Content Area */}
                <div className="flex-1 overflow-y-auto p-6">
                    {activeTab === "general" && (
                        <GeneralTab
                            mode={mode}
                            sansFont={sansFont}
                            autoConvertLongText={autoConvertLongText}
                            autoScrapeUrls={autoScrapeUrls}
                            cautiousEnter={cautiousEnter}
                            showCost={showCost}
                            onThemeChange={handleThemeChange}
                            onSansFontChange={(v) =>
                                void handleSansFontChange(v)
                            }
                            onAutoConvertLongTextChange={(v) =>
                                void handleAutoConvertLongTextChange(v)
                            }
                            onAutoScrapeUrlsChange={(v) =>
                                void handleAutoScrapeUrlsChange(v)
                            }
                            onCautiousEnterChange={(v) =>
                                void handleCautiousEnterChange(v)
                            }
                            onShowCostChange={(v) =>
                                void handleShowCostChange(v)
                            }
                            onShowOnboarding={() => void showOnboarding()}
                            setActiveTab={setActiveTab}
                        />
                    )}

                    {activeTab === "import" && (
                        <div className="space-y-6 max-w-2xl">
                            <div>
                                <h2 className="text-2xl font-semibold mb-2">
                                    Import Chat History
                                </h2>
                                <p className="text-muted-foreground text-sm">
                                    Import your conversation history from other
                                    AI chat platforms.
                                </p>
                            </div>
                            <div className="space-y-4">
                                <div className="flex gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() =>
                                            handleImportHistory("openai")
                                        }
                                        className="flex items-center gap-2"
                                    >
                                        <SiOpenai className="h-4 w-4" />
                                        Import from OpenAI
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() =>
                                            handleImportHistory("anthropic")
                                        }
                                        className="flex items-center gap-2"
                                    >
                                        <RiClaudeFill className="h-4 w-4" />
                                        Import from Anthropic
                                    </Button>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === "system-prompt" && (
                        <div className="space-y-6 max-w-2xl">
                            <div>
                                <h2 className="text-2xl font-semibold mb-2">
                                    System Prompt
                                </h2>
                                <p className="text-muted-foreground text-sm">
                                    All AIs will see this prompt. Use it to
                                    control their tone, role, or conversation
                                    style.
                                </p>
                            </div>
                            <div className="space-y-4">
                                <Textarea
                                    value={universalSystemPrompt || ""}
                                    onChange={(e) =>
                                        setUniversalSystemPrompt(e.target.value)
                                    }
                                    placeholder="Enter your custom system prompt..."
                                    rows={30}
                                    className="w-full font-mono text-sm resize-y min-h-[200px]"
                                />
                                <div className="flex justify-end pt-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={async () => {
                                            await db.execute(
                                                `DELETE FROM app_metadata WHERE key = 'universal_system_prompt'`,
                                            );
                                            setUniversalSystemPrompt(
                                                UNIVERSAL_SYSTEM_PROMPT_DEFAULT,
                                            );
                                            await queryClient.invalidateQueries(
                                                {
                                                    queryKey: ["appMetadata"],
                                                },
                                            );
                                        }}
                                    >
                                        Reset to default
                                    </Button>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === "api-keys" && (
                        <ApiKeysTab
                            apiKeys={apiKeys}
                            lmStudioBaseUrl={lmStudioBaseUrl}
                            onApiKeyChange={(provider, value) =>
                                void handleApiKeyChange(provider, value)
                            }
                            onLmStudioBaseUrlChange={(e) =>
                                void onLmStudioBaseUrlChange(e)
                            }
                        />
                    )}

                    {activeTab === "quick-chat" && (
                        <QuickChatTab
                            quickChatEnabled={quickChatEnabled}
                            quickChatShortcut={quickChatShortcut}
                            onQuickChatEnabledChange={(v) =>
                                void handleQuickChatEnabledChange(v)
                            }
                            onQuickChatShortcutChange={(v) =>
                                void handleQuickChatShortcutChange(v)
                            }
                            onDefaultShortcutClick={() =>
                                void onDefaultQcShortcutClick()
                            }
                        />
                    )}

                    {activeTab === "connections" && (
                        <div className="space-y-6 max-w-2xl">
                            <ConnectionsTab />
                        </div>
                    )}

                    {activeTab === "permissions" && (
                        <div className="max-w-2xl">
                            <PermissionsTab />
                        </div>
                    )}

                    {activeTab === "base-url" && (
                        <BaseUrlTab
                            customBaseUrl={customBaseUrl}
                            onCustomBaseUrlChange={(e) =>
                                void onCustomBaseUrlChange(e)
                            }
                            onClearCustomBaseUrl={() =>
                                void setCustomBaseUrlMutation.mutate("")
                            }
                        />
                    )}

                    {activeTab === "usage" && (
                        <div className="space-y-4 max-w-2xl">
                            <div>
                                <h2 className="text-2xl font-semibold mb-2">
                                    Usage
                                </h2>
                                <p className="text-muted-foreground text-sm">
                                    Track your API usage and costs across models
                                    and projects.
                                </p>
                            </div>
                            <CostDashboard />
                        </div>
                    )}
                </div>
            </div>

            {/* Font preloader - hidden component to ensure fonts are loaded */}
            <div aria-hidden="true" className="hidden">
                <span className="font-monaspace-xenon">Font preload</span>
                <span className="font-geist">Font preload</span>
                <span className="font-monaspace-neon">Font preload</span>
                <span className="font-sf-pro">Font preload</span>
                <span className="font-inter">Font preload</span>
                <span className="font-jetbrains-mono">Font preload</span>
                <span className="font-fira-code">Font preload</span>
                <span className="font-monaspace-argon">Font preload</span>
                <span className="font-monaspace-krypton">Font preload</span>
                <span className="font-monaspace-radon">Font preload</span>
                <span className="font-geist-mono">Font preload</span>
            </div>
        </div>
    );

    return (
        <>
            <Dialog id={SETTINGS_DIALOG_ID}>
                <DialogContent
                    className="max-w-4xl p-0 h-[85vh] overflow-hidden flex flex-col"
                    aria-describedby={undefined}
                >
                    {content}
                </DialogContent>
            </Dialog>
            <ImportChatDialog provider="openai" />
            <ImportChatDialog provider="anthropic" />
        </>
    );
}

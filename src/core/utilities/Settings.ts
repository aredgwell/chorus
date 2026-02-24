import { getStore } from "@core/infra/Store";
import { emit } from "@tauri-apps/api/event";
import {
    getCredential,
    setCredential,
    deleteCredential,
} from "@core/chorus/CredentialService";

export interface Settings {
    defaultEditor: string;
    sansFont: string;
    monoFont: string;
    autoConvertLongText: boolean;
    autoScrapeUrls: boolean;
    showCost: boolean;
    apiKeys?: {
        anthropic?: string;
        openai?: string;
        google?: string;
        perplexity?: string;
        openrouter?: string;
        firecrawl?: string;
    };
    quickChat?: {
        enabled?: boolean;
        modelConfigId?: string;
        shortcut?: string;
    };
    lmStudioBaseUrl?: string;
    cautiousEnter?: boolean;
}

const API_KEY_PROVIDERS = [
    "anthropic",
    "openai",
    "google",
    "perplexity",
    "openrouter",
    "firecrawl",
    "grok",
] as const;

export class SettingsManager {
    private static instance: SettingsManager;
    private storeName = "settings";
    private migrationDone = false;

    private constructor() {}

    public static getInstance(): SettingsManager {
        if (!SettingsManager.instance) {
            SettingsManager.instance = new SettingsManager();
        }
        return SettingsManager.instance;
    }

    /**
     * Migrate API keys from the Tauri Store (plaintext JSON file) to the OS keychain.
     * Runs once per app session. Idempotent — safe to call multiple times.
     */
    public async migrateApiKeysToKeychain(): Promise<void> {
        if (this.migrationDone) return;
        this.migrationDone = true;

        try {
            const store = await getStore(this.storeName);
            const settings = (await store.get("settings")) as
                | Settings
                | undefined;
            const storeApiKeys = settings?.apiKeys;

            if (!storeApiKeys || Object.keys(storeApiKeys).length === 0) {
                return;
            }

            // Move each key to the keychain
            for (const [provider, key] of Object.entries(storeApiKeys)) {
                if (key) {
                    await setCredential(`apikey:${provider}`, key);
                }
            }

            // Remove apiKeys from the store to avoid keeping plaintext secrets on disk
            const { apiKeys: _, ...settingsWithoutKeys } = settings;
            await store.set("settings", settingsWithoutKeys);
            await store.save();

            console.log(
                "Migrated API keys from store to keychain",
            );

            // Also migrate the auth token if present
            try {
                const authStore = await getStore("auth.dat");
                const token = await authStore.get("api_token");
                if (token && typeof token === "string") {
                    await setCredential("chorus_token", token);
                    await authStore.delete("api_token");
                    await authStore.save();
                    console.log("Migrated auth token to keychain");
                }
            } catch (error) {
                console.error("Failed to migrate auth token:", error);
            }
        } catch (error) {
            console.error("Failed to migrate API keys to keychain:", error);
        }
    }

    /**
     * Get all API keys from the OS keychain.
     */
    public async getApiKeys(): Promise<Record<string, string>> {
        const keys: Record<string, string> = {};
        for (const provider of API_KEY_PROVIDERS) {
            const value = await getCredential(`apikey:${provider}`);
            if (value) {
                keys[provider] = value;
            }
        }
        return keys;
    }

    /**
     * Set a single API key in the OS keychain.
     */
    public async setApiKey(
        provider: string,
        value: string,
    ): Promise<void> {
        if (value) {
            await setCredential(`apikey:${provider}`, value);
        } else {
            await deleteCredential(`apikey:${provider}`);
        }
    }

    public async get(): Promise<Settings> {
        try {
            const store = await getStore(this.storeName);
            const settings = await store.get("settings");
            const defaultSettings = {
                defaultEditor: "default",
                sansFont: "Geist",
                monoFont: "Geist Mono",
                autoConvertLongText: true,
                autoScrapeUrls: true,
                showCost: false,
                apiKeys: {},
                quickChat: {
                    enabled: true,
                    modelConfigId: "anthropic::claude-sonnet-4-5-20250929",
                    shortcut: "Alt+Space",
                },
            };

            // If no settings exist yet, save the defaults
            if (!settings) {
                await this.set(defaultSettings);
                return defaultSettings;
            }

            return (settings as Settings) || defaultSettings;
        } catch (error) {
            console.error("Failed to get settings:", error);
            return {
                defaultEditor: "default",
                sansFont: "Geist",
                monoFont: "Fira Code",
                autoConvertLongText: true,
                autoScrapeUrls: true,
                showCost: false,
                apiKeys: {},
                quickChat: {
                    enabled: true,
                    modelConfigId: "anthropic::claude-3-5-sonnet-latest",
                    shortcut: "Alt+Space",
                },
            };
        }
    }

    public async set(settings: Settings): Promise<void> {
        try {
            const store = await getStore(this.storeName);
            // Strip apiKeys before persisting to store — keys live in keychain now
            const { apiKeys: _, ...settingsWithoutKeys } = settings;
            await store.set("settings", settingsWithoutKeys);
            await store.save();
            await emit("settings-changed", settings);
        } catch (error) {
            console.error("Failed to save settings:", error);
        }
    }

    public async getChorusToken(): Promise<string | null> {
        // Try keychain first
        try {
            const token = await getCredential("chorus_token");
            if (token) return token;
        } catch {
            // Fall through to legacy store
        }

        // Fallback to legacy store for pre-migration installs
        try {
            const store = await getStore("auth.dat");
            const token = await store.get("api_token");
            return (token as string) || null;
        } catch (error) {
            console.error("Failed to get Chorus token:", error);
            return null;
        }
    }
}

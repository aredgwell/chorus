import { ProviderName } from "@core/chorus/Models";
import { openUrl } from "@tauri-apps/plugin-opener";
import { ExternalLinkIcon, FlameIcon, GlobeIcon } from "lucide-react";

import { Input } from "./ui/input";
import { ProviderLogo } from "./ui/provider-logo";

interface ApiKeysFormProps {
    apiKeys: Record<string, string>;
    onApiKeyChange: (provider: string, value: string) => void;
}

const providers = [
    {
        id: "anthropic",
        name: "Anthropic",
        placeholder: "sk-ant-...",
        url: "https://console.anthropic.com/settings/keys",
    },
    {
        id: "firecrawl",
        name: "Firecrawl",
        placeholder: "fc-...",
        url: "https://www.firecrawl.dev/app/api-keys",
    },
    {
        id: "google",
        name: "Google AI (Gemini)",
        placeholder: "AI...",
        url: "https://aistudio.google.com/apikey",
    },
    {
        id: "jinaai",
        name: "Jina AI (web fetch)",
        placeholder: "jina_...",
        url: "https://jina.ai/reader/#apiform",
    },
    {
        id: "openai",
        name: "OpenAI",
        placeholder: "sk-...",
        url: "https://platform.openai.com/api-keys",
    },
    {
        id: "openrouter",
        name: "OpenRouter",
        placeholder: "sk-or-...",
        url: "https://openrouter.ai/keys",
    },
    {
        id: "perplexity",
        name: "Perplexity",
        placeholder: "pplx-...",
        url: "https://www.perplexity.ai/account/api/keys",
    },
    {
        id: "grok",
        name: "xAI",
        placeholder: "xai-...",
        url: "https://console.x.ai/settings/keys",
    },
];

export default function ApiKeysForm({
    apiKeys,
    onApiKeyChange,
}: ApiKeysFormProps) {
    return (
        <div className="space-y-4">
            {providers.map((provider) => (
                <div key={provider.id} className="space-y-1.5">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            {provider.id === "firecrawl" ? (
                                <FlameIcon className="w-4 h-4" />
                            ) : provider.id === "jinaai" ? (
                                <GlobeIcon className="w-4 h-4" />
                            ) : (
                                <ProviderLogo
                                    provider={provider.id as ProviderName}
                                    size="sm"
                                />
                            )}
                            <label
                                htmlFor={`apikey-${provider.id}`}
                                className="text-sm font-medium"
                            >
                                {provider.name}
                            </label>
                        </div>
                        <button
                            type="button"
                            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
                            onClick={() => void openUrl(provider.url)}
                        >
                            Get API key
                            <ExternalLinkIcon className="w-3 h-3" />
                        </button>
                    </div>
                    <Input
                        id={`apikey-${provider.id}`}
                        type="password"
                        placeholder={provider.placeholder}
                        value={apiKeys[provider.id] || ""}
                        onChange={(e) =>
                            onApiKeyChange(provider.id, e.target.value)
                        }
                    />
                </div>
            ))}
        </div>
    );
}

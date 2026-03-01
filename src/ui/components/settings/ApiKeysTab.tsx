import ApiKeysForm from "@ui/components/ApiKeysForm";

interface ApiKeysTabProps {
    apiKeys: Record<string, string>;
    onApiKeyChange: (provider: string, value: string) => void;
}

export default function ApiKeysTab({
    apiKeys,
    onApiKeyChange,
}: ApiKeysTabProps) {
    return (
        <div className="space-y-6 max-w-2xl">
            <div>
                <h2 className="text-2xl font-semibold mb-2">API Keys</h2>
                <p className="text-sm text-muted-foreground">
                    Enter your API keys for the providers you want to use.
                    Models for each provider will become available once you add
                    a valid key.
                </p>
            </div>
            <div className="space-y-4">
                <ApiKeysForm
                    apiKeys={apiKeys}
                    onApiKeyChange={(provider, value) =>
                        void onApiKeyChange(provider, value)
                    }
                />
            </div>
        </div>
    );
}

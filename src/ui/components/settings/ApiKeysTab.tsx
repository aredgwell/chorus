import { Input } from "@ui/components/ui/input";
import { Separator } from "@ui/components/ui/separator";
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@ui/components/ui/collapsible";
import { ChevronDown } from "lucide-react";
import ApiKeysForm from "@ui/components/ApiKeysForm";

interface ApiKeysTabProps {
    apiKeys: Record<string, string>;
    lmStudioBaseUrl: string;
    onApiKeyChange: (provider: string, value: string) => void;
    onLmStudioBaseUrlChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export default function ApiKeysTab({
    apiKeys,
    lmStudioBaseUrl,
    onApiKeyChange,
    onLmStudioBaseUrlChange,
}: ApiKeysTabProps) {
    return (
        <div className="space-y-6 max-w-2xl">
            <div>
                <h2 className="text-2xl font-semibold mb-2">API Keys</h2>
                <p className="text-sm text-muted-foreground">
                    Enter your API keys for the providers you want to use.
                    Models for each provider will become available once you add a
                    valid key.
                </p>
            </div>
            <div className="space-y-4">
                <ApiKeysForm
                    apiKeys={apiKeys}
                    onApiKeyChange={(provider, value) =>
                        void onApiKeyChange(provider, value)
                    }
                />
                <Separator className="my-4" />
                <Collapsible className="space-y-2">
                    <div className="flex items-center justify-between">
                        <CollapsibleTrigger className="flex items-center w-full gap-2 hover:opacity-80">
                            <label className="font-semibold">
                                LM Studio Settings
                            </label>
                            <ChevronDown className="h-4 w-4" />
                        </CollapsibleTrigger>
                    </div>
                    <CollapsibleContent className="space-y-2">
                        <p className="">
                            The base URL for your LM Studio server.
                        </p>
                        <Input
                            value={lmStudioBaseUrl}
                            onChange={(e) => void onLmStudioBaseUrlChange(e)}
                            placeholder="http://localhost:1234/v1"
                        />
                    </CollapsibleContent>
                </Collapsible>
            </div>
        </div>
    );
}

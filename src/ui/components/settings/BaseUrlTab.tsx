import { Button } from "@ui/components/ui/button";
import { Input } from "@ui/components/ui/input";
import { toast } from "sonner";

interface BaseUrlTabProps {
    customBaseUrl: string;
    onCustomBaseUrlChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onClearCustomBaseUrl: () => void;
}

export default function BaseUrlTab({
    customBaseUrl,
    onCustomBaseUrlChange,
    onClearCustomBaseUrl,
}: BaseUrlTabProps) {
    return (
        <div className="space-y-6 max-w-2xl">
            <div>
                <h2 className="text-2xl font-semibold mb-2">
                    Base URL Configuration
                </h2>
                <p className="text-muted-foreground text-sm">
                    Configure a custom base URL for all model requests. This
                    allows you to route requests through your own proxy or
                    server.
                </p>
            </div>
            <div className="space-y-4">
                <div className="space-y-2">
                    <label
                        htmlFor="custom-base-url"
                        className="font-semibold"
                    >
                        Custom Base URL
                    </label>
                    <Input
                        id="custom-base-url"
                        value={customBaseUrl}
                        onChange={(e) => void onCustomBaseUrlChange(e)}
                        placeholder="https://your-proxy.com"
                        className="font-mono"
                    />
                    <p className="text-xs text-muted-foreground">
                        Leave empty to use the default Chorus proxy. When set,
                        all model requests will be sent directly to this URL
                        without any path modifications.
                    </p>
                </div>

                {customBaseUrl && (
                    <div className="border rounded-md p-4 bg-muted/50">
                        <h4 className="font-semibold text-sm mb-2">
                            Configuration Details
                        </h4>
                        <div className="space-y-2 text-sm">
                            <p>
                                When using a custom base URL, requests will be
                                sent directly to your proxy without any path
                                prefixes.
                            </p>
                            <p className="text-muted-foreground">
                                Your proxy should:
                            </p>
                            <ul className="list-disc list-inside space-y-1 text-muted-foreground ml-2">
                                <li>
                                    Handle routing to the appropriate model
                                    providers
                                </li>
                                <li>
                                    Manage authentication with each provider
                                </li>
                                <li>
                                    Forward request/response data appropriately
                                </li>
                            </ul>
                            <p className="text-xs mt-2 text-muted-foreground">
                                The proxy will receive the raw OpenAI-compatible
                                API requests for all providers.
                            </p>
                        </div>
                    </div>
                )}

                <div className="flex justify-end gap-2 pt-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                            onClearCustomBaseUrl();
                            toast.success("Custom base URL cleared");
                        }}
                        disabled={!customBaseUrl}
                    >
                        Clear
                    </Button>
                </div>
            </div>
        </div>
    );
}

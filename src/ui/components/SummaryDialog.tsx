import * as React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { MessageMarkdown } from "./renderers/MessageMarkdown";
import { Button } from "./ui/button";
import { Copy, Check, RefreshCcw, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface SummaryDialogProps {
    summary: string;
    title?: string;
    date?: string;
    onRefresh?: () => Promise<void>;
}

export const SUMMARY_DIALOG_ID = "summary-dialog";

export function SummaryDialog({
    summary,
    title,
    date,
    onRefresh,
}: SummaryDialogProps) {
    const [copied, setCopied] = React.useState(false);
    const [isRefreshing, setIsRefreshing] = React.useState(false);

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(summary);
            setCopied(true);
            toast.success("Copied to clipboard", {
                description: "The summary has been copied to your clipboard.",
            });
            // Reset copied state after 2 seconds
            const timeoutId = setTimeout(() => setCopied(false), 2000);
            // No need to return cleanup function in an event handler
            return () => clearTimeout(timeoutId);
        } catch {
            toast.error("Failed to copy", {
                description: "Could not copy the summary to clipboard.",
            });
        }
    };

    const handleRefresh = async () => {
        if (!onRefresh) return;

        setIsRefreshing(true);
        try {
            await onRefresh();
            toast.success("Summary refreshed", {
                description: "The chat summary has been regenerated.",
            });
        } catch {
            toast.error("Failed to refresh", {
                description: "Could not regenerate the summary.",
            });
        } finally {
            setIsRefreshing(false);
        }
    };

    return (
        <Dialog id={SUMMARY_DIALOG_ID}>
            <DialogHeader className="hidden">
                <DialogTitle>Summary</DialogTitle>
            </DialogHeader>
            <DialogContent className="max-w-5xl max-h-[80vh] overflow-y-auto p-8">
                <div className="mb-1 flex items-center gap-2">
                    <div className="flex items-center gap-2">
                        <span className="text-sm uppercase tracking-wider font-geist-mono text-gray-500">
                            {title ? `${title}` : "Summary"}
                        </span>
                        {date && (
                            <>
                                <div className="h-px flex-1 bg-gray-300" />
                                <span className="text-sm uppercase tracking-wider font-geist-mono text-gray-500">
                                    {date}
                                </span>
                            </>
                        )}
                    </div>
                    <div className="h-px flex-1 bg-gray-300" />
                    <div className="flex items-center gap-2">
                        {onRefresh && (
                            <Button
                                className="text-sm text-gray-500 uppercase tracking-wider font-geist-mono border-none"
                                variant="outline"
                                size="sm"
                                onClick={() => void handleRefresh()}
                                disabled={isRefreshing}
                            >
                                {isRefreshing ? (
                                    <>
                                        Refreshing
                                        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                    </>
                                ) : (
                                    <>
                                        Refresh
                                        <RefreshCcw className="h-3 w-3 mr-1" />
                                    </>
                                )}
                            </Button>
                        )}
                        <Button
                            className="text-sm text-gray-500 uppercase tracking-wider font-geist-mono border-none"
                            variant="outline"
                            size="sm"
                            onClick={() => void handleCopy()}
                        >
                            {copied ? (
                                <>
                                    Copied
                                    <Check className="h-3 w-3 ml-1 text-gray-900" />
                                </>
                            ) : (
                                <>
                                    Copy
                                    <Copy className="h-3 w-3 ml-1" />
                                </>
                            )}
                        </Button>
                    </div>
                </div>
                <div>
                    <MessageMarkdown text={summary} />
                </div>
            </DialogContent>
        </Dialog>
    );
}

import { openPath, openUrl } from "@tauri-apps/plugin-opener";
import { Button } from "@ui/components/ui/button";
import {
    HoverCard,
    HoverCardContent,
    HoverCardTrigger,
} from "@ui/components/ui/hover-card";
import { ExternalLinkIcon, EyeIcon, FileIcon } from "lucide-react";
import { useState } from "react";

interface WebPreviewProps {
    url: string;
    children: React.ReactNode;
}

export function WebPreview({ url, children }: WebPreviewProps) {
    const [isLoading, setIsLoading] = useState(true);
    const [loadError, setLoadError] = useState(false);

    const isWikiSite =
        url.includes("wikipedia.org") || url.includes("wiktionary.org");
    const isFileUrl = url.startsWith("file://");

    const handleOpen = async () => {
        if (isFileUrl) {
            const removedFilePrefix = url.replace("file://", "");
            const decodedUrl = decodeURIComponent(removedFilePrefix);
            await openPath(decodedUrl);
        } else {
            await openUrl(url);
        }
    };

    // For file URLs or non-wiki sites, show a simple link that opens directly
    if (isFileUrl || !isWikiSite) {
        return (
            <a
                className="cursor-pointer inline-flex items-center gap-1 hover:underline"
                onClick={(e) => {
                    e.preventDefault();
                    void handleOpen();
                }}
            >
                {children}
                {isFileUrl ? (
                    <FileIcon className="w-3 h-3" />
                ) : (
                    <ExternalLinkIcon className="w-3 h-3" />
                )}
            </a>
        );
    }

    return (
        <HoverCard openDelay={300}>
            <HoverCardTrigger asChild>
                <a className="cursor-pointer inline-flex items-center gap-1 group">
                    {children}
                    <EyeIcon className="w-3 h-3 opacity-50 group-hover:opacity-100" />
                </a>
            </HoverCardTrigger>
            <HoverCardContent className="w-[480px] p-0">
                <div className="flex flex-col">
                    <div className="flex justify-between items-center p-3 border-b">
                        <div className="text-sm text-muted-foreground truncate flex-1 mr-4">
                            {url}
                        </div>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => void handleOpen()}
                            className="flex items-center gap-1.5 h-7 text-sm"
                        >
                            <ExternalLinkIcon className="w-3 h-3" />
                            Open
                        </Button>
                    </div>
                    <div className="relative h-[320px]">
                        {isLoading && (
                            <div className="absolute inset-0 flex items-center justify-center bg-background">
                                <div className="animate-pulse text-sm text-muted-foreground">
                                    Loading preview...
                                </div>
                            </div>
                        )}
                        {loadError ? (
                            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-background p-4 text-center">
                                <div className="text-sm text-muted-foreground">
                                    Preview not available
                                </div>
                                <Button
                                    variant="secondary"
                                    size="sm"
                                    onClick={() => void handleOpen()}
                                    className="flex items-center gap-1.5"
                                >
                                    <ExternalLinkIcon className="w-3 h-3" />
                                    Open in Browser
                                </Button>
                            </div>
                        ) : (
                            <iframe
                                src={url}
                                className="w-full h-full border-0"
                                onLoad={() => setIsLoading(false)}
                                onError={() => {
                                    setLoadError(true);
                                    setIsLoading(false);
                                }}
                                sandbox="allow-scripts allow-same-origin allow-popups"
                            />
                        )}
                    </div>
                </div>
            </HoverCardContent>
        </HoverCard>
    );
}

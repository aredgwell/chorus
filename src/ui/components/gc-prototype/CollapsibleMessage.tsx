import { ChevronDown, ChevronUp } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "../ui/button";

// Component for collapsible message content
export function CollapsibleMessage({ text }: { text: string }) {
    const [isExpanded, setIsExpanded] = useState(false);
    const [needsExpansion, setNeedsExpansion] = useState(false);
    const contentRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (contentRef.current) {
            // Check if content height exceeds 100px
            setNeedsExpansion(contentRef.current.scrollHeight > 100);
        }
    }, [text]);

    return (
        <div className="relative">
            <div
                ref={contentRef}
                className={`text-sm whitespace-pre-wrap select-text overflow-hidden transition-all duration-200 ${
                    isExpanded ? "" : "max-h-[100px]"
                }`}
                style={{ position: "relative" }}
            >
                {text}
                {/* Gradient overlay when collapsed and needs expansion */}
                {!isExpanded && needsExpansion && (
                    <div className="absolute bottom-0 left-0 right-0 h-12 bg-linear-to-t from-background to-transparent pointer-events-none" />
                )}
            </div>
            {/* Show expand/collapse button if content overflows */}
            {needsExpansion && (
                <Button
                    variant="ghost"
                    size="sm"
                    className="mt-1 h-6 px-2 text-xs"
                    onClick={() => setIsExpanded(!isExpanded)}
                >
                    {isExpanded ? (
                        <>
                            <ChevronUp className="h-3 w-3 mr-1" />
                            Show less
                        </>
                    ) : (
                        <>
                            <ChevronDown className="h-3 w-3 mr-1" />
                            Show more
                        </>
                    )}
                </Button>
            )}
        </div>
    );
}

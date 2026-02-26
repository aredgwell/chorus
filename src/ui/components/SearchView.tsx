import { useState, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { SearchIcon, ArrowLeftIcon, MessageCircleIcon } from "lucide-react";
import debounce from "lodash/debounce";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { SidebarTrigger } from "./ui/sidebar";
import { convertDate, displayDate } from "@ui/lib/utils";
import { ProviderLogo } from "@ui/components/ui/provider-logo";
import * as SearchAPI from "@core/chorus/api/SearchAPI";
import * as ModelsAPI from "@core/chorus/api/ModelsAPI";
import type { SearchResult } from "@core/chorus/api/SearchAPI";

const CONTEXT_LENGTH = 200;

function escapeStringRegexp(str: string): string {
    return str.replace(/[|\\{}()[\]^$+*?.]/g, "\\$&");
}

function HighlightedText({
    text,
    query,
}: {
    text: string;
    query: string;
}) {
    if (!query.trim()) return <>{text}</>;

    try {
        const regex = new RegExp(escapeStringRegexp(query), "gi");
        const parts = text.split(regex);
        const matches = text.match(regex) || [];

        return (
            <>
                {parts.map((part, i) => (
                    <span key={i}>
                        {part}
                        {i < matches.length && (
                            <mark className="bg-yellow-500/30 text-foreground rounded-sm px-0.5">
                                {matches[i]}
                            </mark>
                        )}
                    </span>
                ))}
            </>
        );
    } catch {
        return <>{text}</>;
    }
}

function SearchResultItem({
    result,
    query,
    getDisplayName,
}: {
    result: SearchResult;
    query: string;
    getDisplayName: (modelId: string) => string;
}) {
    const navigate = useNavigate();

    const contextText = (() => {
        if (!query || !result.text) return result.text.slice(0, CONTEXT_LENGTH);

        const lowerText = result.text.toLowerCase();
        const lowerQuery = query.toLowerCase();
        const index = lowerText.indexOf(lowerQuery);
        if (index === -1) return result.text.slice(0, CONTEXT_LENGTH);

        const start = Math.max(0, index - CONTEXT_LENGTH / 2);
        const end = Math.min(
            result.text.length,
            index + query.length + CONTEXT_LENGTH / 2,
        );

        return (
            (start > 0 ? "..." : "") +
            result.text.slice(start, end) +
            (end < result.text.length ? "..." : "")
        );
    })();

    const handleClick = () => {
        if (result.parent_chat_id && result.reply_to_id) {
            navigate(
                `/chat/${encodeURIComponent(result.parent_chat_id)}?replyId=${result.chat_id}`,
            );
        } else {
            navigate(`/chat/${encodeURIComponent(result.chat_id)}`);
        }
    };

    const displayName = getDisplayName(result.model);

    return (
        <button
            onClick={handleClick}
            className="w-full text-left p-3 rounded-lg border border-border/50 hover:border-border hover:bg-muted/50 transition-colors cursor-pointer"
        >
            <div className="flex items-center gap-2 mb-1">
                {result.title && (
                    <span className="font-medium text-sm truncate flex-1">
                        <HighlightedText
                            text={result.title}
                            query={query}
                        />
                    </span>
                )}
                <span className="text-xs text-muted-foreground shrink-0">
                    {displayDate(convertDate(result.created_at))}
                </span>
            </div>
            <div className="flex items-start gap-2">
                <div className="flex items-center gap-1.5 shrink-0 mt-0.5">
                    {result.model !== "user" && (
                        <ProviderLogo
                            modelId={result.model}
                            className="h-3.5 w-3.5"
                        />
                    )}
                    <span className="text-xs font-medium text-muted-foreground">
                        {displayName}
                    </span>
                </div>
                <p className="text-sm text-muted-foreground line-clamp-2 flex-1">
                    <HighlightedText text={contextText} query={query} />
                </p>
            </div>
        </button>
    );
}

export default function SearchView() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const initialQuery = searchParams.get("q") || "";
    const [inputValue, setInputValue] = useState(initialQuery);
    const [debouncedQuery, setDebouncedQuery] = useState(initialQuery);

    const { data: modelConfigs } = ModelsAPI.useModelConfigs();
    const { data: searchResults = [], isLoading } =
        SearchAPI.useFullSearchMessages(debouncedQuery);

    const debouncedSearch = useMemo(
        () =>
            debounce((value: string) => {
                setDebouncedQuery(value);
            }, 300),
        [],
    );

    const handleInput = (value: string) => {
        setInputValue(value);
        void debouncedSearch(value);
    };

    const getDisplayName = (modelId: string): string => {
        if (modelId === "user") return "You";
        const config = modelConfigs?.find((c) => c.modelId === modelId);
        return config?.displayName || modelId;
    };

    // Group results by chat
    const groupedResults = (() => {
        const groups = new Map<
            string,
            { title: string; results: SearchResult[] }
        >();

        for (const result of searchResults) {
            const chatId = result.chat_id;
            const existing = groups.get(chatId);
            if (existing) {
                existing.results.push(result);
            } else {
                groups.set(chatId, {
                    title: result.title || "Untitled Chat",
                    results: [result],
                });
            }
        }

        return Array.from(groups.entries());
    })();

    return (
        <div className="flex flex-col h-full w-full">
            {/* Header */}
            <div className="flex items-center gap-2 p-3 border-b border-border">
                <SidebarTrigger />
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => navigate(-1)}
                >
                    <ArrowLeftIcon className="h-4 w-4" />
                </Button>
                <div className="flex items-center flex-1 gap-2">
                    <SearchIcon className="h-4 w-4 text-muted-foreground" />
                    <Input
                        value={inputValue}
                        onChange={(e) => handleInput(e.target.value)}
                        placeholder="Search all conversations..."
                        className="border-0 focus-visible:ring-0 text-base h-9"
                        autoFocus
                    />
                </div>
            </div>

            {/* Results */}
            <div className="flex-1 overflow-y-auto p-4">
                {!debouncedQuery && (
                    <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                        <SearchIcon className="h-12 w-12 mb-4 opacity-20" />
                        <p className="text-sm">
                            Search across all your conversations
                        </p>
                    </div>
                )}

                {debouncedQuery && isLoading && (
                    <div className="flex items-center justify-center py-8">
                        <p className="text-sm text-muted-foreground">
                            Searching...
                        </p>
                    </div>
                )}

                {debouncedQuery && !isLoading && searchResults.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                        <MessageCircleIcon className="h-8 w-8 mb-3 opacity-20" />
                        <p className="text-sm">
                            No results found for &ldquo;{debouncedQuery}&rdquo;
                        </p>
                    </div>
                )}

                {debouncedQuery &&
                    !isLoading &&
                    searchResults.length > 0 && (
                        <div className="space-y-6 max-w-2xl mx-auto">
                            <p className="text-xs text-muted-foreground">
                                {searchResults.length} result
                                {searchResults.length === 1 ? "" : "s"} in{" "}
                                {groupedResults.length} conversation
                                {groupedResults.length === 1 ? "" : "s"}
                            </p>
                            {groupedResults.map(
                                ([chatId, { title, results }]) => (
                                    <div key={chatId} className="space-y-2">
                                        {groupedResults.length > 1 && (
                                            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                                {title} ({results.length})
                                            </h3>
                                        )}
                                        {results.map((result) => (
                                            <SearchResultItem
                                                key={result.id}
                                                result={result}
                                                query={debouncedQuery}
                                                getDisplayName={getDisplayName}
                                            />
                                        ))}
                                    </div>
                                ),
                            )}
                        </div>
                    )}
            </div>
        </div>
    );
}

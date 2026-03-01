import { Project } from "@core/chorus/api/ProjectAPI";
import type { SimilarChat } from "@core/chorus/api/SearchAPI";
import { catchAsyncErrors } from "@core/chorus/utilities";
import { convertDate, displayDate } from "@ui/lib/utils";
import {
    DownloadIcon,
    FileTextIcon,
    Loader2,
    SearchIcon,
    ShareIcon,
    SparklesIcon,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

import { MoveToProjectDropdown } from "./MoveToProjectDropdown";
import { Button } from "./ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";

export function ChatHeaderActions({
    hasMessages,
    isSummarizing,
    isGeneratingShareLink,
    chatId,
    currentProjectId,
    projects,
    relatedChats,
    onSearch,
    onSummarize,
    onShare,
    onExport,
    onMoveToProject,
    onNewProject,
}: {
    hasMessages: boolean;
    isSummarizing: boolean;
    isGeneratingShareLink: boolean;
    chatId: string;
    currentProjectId: string | undefined;
    projects: Project[];
    relatedChats?: SimilarChat[];
    onSearch: () => void;
    onSummarize: () => void;
    onShare: () => void;
    onExport: (format: "markdown" | "json") => Promise<void>;
    onMoveToProject: (chatId: string, projectId: string) => void;
    onNewProject: () => void;
}) {
    const navigate = useNavigate();
    return (
        <div className="flex items-center gap-1">
            {hasMessages && (
                <>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                variant="ghost"
                                size="iconSm"
                                className="px-2 text-accent-foreground hover:text-foreground"
                                tabIndex={-1}
                                onClick={onSearch}
                            >
                                <SearchIcon
                                    strokeWidth={1.5}
                                    className="size-3.5!"
                                />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>Find (⌘F)</TooltipContent>
                    </Tooltip>

                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                variant="ghost"
                                size="iconSm"
                                className="px-2 text-accent-foreground hover:text-foreground"
                                tabIndex={-1}
                                onClick={onSummarize}
                                disabled={isSummarizing}
                            >
                                {isSummarizing ? (
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                ) : (
                                    <FileTextIcon
                                        strokeWidth={1.5}
                                        className="size-3.5!"
                                    />
                                )}
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>Summarize</TooltipContent>
                    </Tooltip>

                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                variant="ghost"
                                size="iconSm"
                                className="px-2 text-accent-foreground hover:text-foreground"
                                tabIndex={-1}
                                onClick={onShare}
                                disabled={isGeneratingShareLink}
                            >
                                {isGeneratingShareLink ? (
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                ) : (
                                    <ShareIcon
                                        strokeWidth={1.5}
                                        className="size-3.5!"
                                    />
                                )}
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>Share (⌘⇧S)</TooltipContent>
                    </Tooltip>

                    <DropdownMenu>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <DropdownMenuTrigger asChild>
                                    <Button
                                        variant="ghost"
                                        size="iconSm"
                                        className="px-2 text-accent-foreground hover:text-foreground"
                                        tabIndex={-1}
                                    >
                                        <DownloadIcon
                                            strokeWidth={1.5}
                                            className="size-3.5!"
                                        />
                                    </Button>
                                </DropdownMenuTrigger>
                            </TooltipTrigger>
                            <TooltipContent>Export</TooltipContent>
                        </Tooltip>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem
                                onClick={catchAsyncErrors(() =>
                                    onExport("markdown"),
                                )}
                            >
                                Export as Markdown
                            </DropdownMenuItem>
                            <DropdownMenuItem
                                onClick={catchAsyncErrors(() =>
                                    onExport("json"),
                                )}
                            >
                                Export as JSON
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>

                    {relatedChats && relatedChats.length > 0 && (
                        <Popover>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant="ghost"
                                            size="iconSm"
                                            className="px-2 text-accent-foreground hover:text-foreground"
                                            tabIndex={-1}
                                        >
                                            <SparklesIcon
                                                strokeWidth={1.5}
                                                className="size-3.5!"
                                            />
                                        </Button>
                                    </PopoverTrigger>
                                </TooltipTrigger>
                                <TooltipContent>Related chats</TooltipContent>
                            </Tooltip>
                            <PopoverContent align="end" className="w-64 p-2">
                                <p className="text-xs font-medium text-muted-foreground px-2 pb-1">
                                    Similar conversations
                                </p>
                                <ul className="space-y-0.5">
                                    {relatedChats.map((r) => (
                                        <li key={r.chatId}>
                                            <button
                                                className="w-full text-left px-2 py-1.5 rounded-md hover:bg-accent transition-colors"
                                                onClick={() =>
                                                    navigate(
                                                        `/chat/${r.chatId}`,
                                                    )
                                                }
                                            >
                                                <div className="text-sm truncate">
                                                    {r.title ?? "Untitled Chat"}
                                                </div>
                                                {r.updatedAt && (
                                                    <div className="text-xs text-muted-foreground">
                                                        {displayDate(
                                                            convertDate(
                                                                r.updatedAt,
                                                            ),
                                                        )}
                                                    </div>
                                                )}
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            </PopoverContent>
                        </Popover>
                    )}
                </>
            )}

            {/* Move to button - always show in non-quick chat */}
            {projects && (
                <MoveToProjectDropdown
                    chatId={chatId}
                    currentProjectId={currentProjectId}
                    projects={projects}
                    onMoveToProject={onMoveToProject}
                    onNewProject={onNewProject}
                />
            )}
        </div>
    );
}

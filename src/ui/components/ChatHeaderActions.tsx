import { Button } from "./ui/button";
import {
    FileTextIcon,
    ShareIcon,
    SearchIcon,
    DownloadIcon,
    Loader2,
} from "lucide-react";
import { TooltipContent, Tooltip, TooltipTrigger } from "./ui/tooltip";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { catchAsyncErrors } from "@core/chorus/utilities";
import { MoveToProjectDropdown } from "./MoveToProjectDropdown";
import { Project } from "@core/chorus/api/ProjectAPI";

export function ChatHeaderActions({
    hasMessages,
    isSummarizing,
    isGeneratingShareLink,
    chatId,
    currentProjectId,
    projects,
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
    onSearch: () => void;
    onSummarize: () => void;
    onShare: () => void;
    onExport: (format: "markdown" | "json") => Promise<void>;
    onMoveToProject: (chatId: string, projectId: string) => void;
    onNewProject: () => void;
}) {
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
                        <TooltipContent>
                            Find (⌘F)
                        </TooltipContent>
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
                        <TooltipContent>
                            Summarize
                        </TooltipContent>
                    </Tooltip>

                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                variant="ghost"
                                size="iconSm"
                                className="px-2 text-accent-foreground hover:text-foreground"
                                tabIndex={-1}
                                onClick={onShare}
                                disabled={
                                    isGeneratingShareLink
                                }
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
                        <TooltipContent>
                            Share (⌘⇧S)
                        </TooltipContent>
                    </Tooltip>

                    <DropdownMenu>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <DropdownMenuTrigger
                                    asChild
                                >
                                    <Button
                                        variant="ghost"
                                        size="iconSm"
                                        className="px-2 text-accent-foreground hover:text-foreground"
                                        tabIndex={-1}
                                    >
                                        <DownloadIcon
                                            strokeWidth={
                                                1.5
                                            }
                                            className="size-3.5!"
                                        />
                                    </Button>
                                </DropdownMenuTrigger>
                            </TooltipTrigger>
                            <TooltipContent>
                                Export
                            </TooltipContent>
                        </Tooltip>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem
                                onClick={catchAsyncErrors(
                                    () =>
                                        onExport(
                                            "markdown",
                                        ),
                                )}
                            >
                                Export as Markdown
                            </DropdownMenuItem>
                            <DropdownMenuItem
                                onClick={catchAsyncErrors(
                                    () =>
                                        onExport(
                                            "json",
                                        ),
                                )}
                            >
                                Export as JSON
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
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

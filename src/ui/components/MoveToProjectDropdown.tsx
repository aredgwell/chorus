import { Project } from "@core/chorus/api/ProjectAPI";
import { cn, projectDisplayName } from "@ui/lib/utils";
import { CornerUpRight, FolderInputIcon, PlusIcon } from "lucide-react";

import { Button } from "./ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";

interface MoveToProjectDropdownProps {
    chatId: string;
    currentProjectId?: string;
    projects: Project[];
    onMoveToProject: (chatId: string, projectId: string) => void;
    onNewProject: () => void;
    className?: string;
}

export function MoveToProjectDropdown({
    chatId,
    currentProjectId,
    projects,
    onMoveToProject,
    onNewProject,
    className,
}: MoveToProjectDropdownProps) {
    return (
        <DropdownMenu>
            <Tooltip>
                <TooltipTrigger asChild>
                    <DropdownMenuTrigger asChild>
                        <Button
                            variant="ghost"
                            size="iconSm"
                            className={cn(
                                "px-2 text-accent-foreground hover:text-foreground",
                                className,
                            )}
                            tabIndex={-1}
                        >
                            <FolderInputIcon
                                strokeWidth={1.5}
                                className="size-3.5!"
                            />
                        </Button>
                    </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent>Move to collection</TooltipContent>
            </Tooltip>
            <DropdownMenuContent className="mr-3">
                <DropdownMenuLabel className="flex items-center text-muted-foreground font-geist-mono text-[10px] uppercase tracking-wider">
                    <CornerUpRight className="w-3 h-3 mr-2" />
                    Move to...
                </DropdownMenuLabel>
                {projects
                    ?.filter(
                        (p) =>
                            p.id !== "quick-chat" && p.id !== currentProjectId,
                    )
                    .map((project) => (
                        <DropdownMenuItem
                            key={project.id}
                            onSelect={() => onMoveToProject(chatId, project.id)}
                            className={cn("cursor-pointer hover:bg-muted")}
                        >
                            {project.id === "default" ? (
                                <span className="text-muted-foreground/70">
                                    No collection
                                </span>
                            ) : (
                                projectDisplayName(project.name)
                            )}
                        </DropdownMenuItem>
                    ))}
                <DropdownMenuItem
                    key="ch_new_project"
                    className="cursor-pointer hover:bg-muted"
                    onSelect={() => void onNewProject()}
                >
                    <PlusIcon className="w-3 h-3 mr-2" />
                    New collection
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

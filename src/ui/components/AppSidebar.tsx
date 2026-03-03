import {
    useSelectedCollectionId,
    useSelectedTagIds,
    useSetSelectedCollectionId,
    useSetSelectedTagIds,
} from "@core/chorus/api/AppMetadataAPI";
import { chatQueries } from "@core/chorus/api/ChatAPI";
import { formatCost } from "@core/chorus/api/CostAPI";
import { noteQueries } from "@core/chorus/api/NoteAPI";
import {
    projectQueries,
    useCreateProject,
    useDeleteProject,
    useRenameProject,
} from "@core/chorus/api/ProjectAPI";
import {
    TAG_COLOR_PALETTE,
    useDeleteTag,
    useTags,
    useUpdateTag,
} from "@core/chorus/api/TagAPI";
import { useQuery } from "@tanstack/react-query";
import { invoke } from "@tauri-apps/api/core";
import { emit } from "@tauri-apps/api/event";
import {
    Sidebar,
    SidebarContent,
    SidebarGroup,
    SidebarGroupContent,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
} from "@ui/components/ui/sidebar";
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "@ui/components/ui/tooltip";
import { projectDisplayName } from "@ui/lib/utils";
import {
    FolderIcon,
    FolderOpenIcon,
    FolderPlusIcon,
    LayersIcon,
    PencilIcon,
    SparklesIcon,
    TagIcon,
    TrashIcon,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import Droppable from "./Droppable";
import { useSettings } from "./hooks/useSettings";
import {
    ContextMenu,
    ContextMenuContent,
    ContextMenuItem,
    ContextMenuTrigger,
} from "./ui/context-menu";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import RetroSpinner from "./ui/retro-spinner";

function DevModeIndicator() {
    const [instanceName, setInstanceName] = useState<string>("");

    useEffect(() => {
        if (import.meta.env.DEV) {
            void invoke<string>("get_instance_name").then((name) => {
                setInstanceName(name);
            });
        }
    }, []);

    if (!import.meta.env.DEV) return null;

    return (
        <div className="px-2 py-1 text-[10px] font-medium bg-yellow-500/10 text-yellow-500">
            {instanceName ? `Instance ${instanceName}` : "DEV MODE"}
        </div>
    );
}

function SidebarTagsSection() {
    const tagsQuery = useTags();
    const deleteTag = useDeleteTag();
    const updateTag = useUpdateTag();
    const selectedTagIds = useSelectedTagIds();
    const setSelectedTagIds = useSetSelectedTagIds();
    const setSelectedCollectionId = useSetSelectedCollectionId();
    const tags = tagsQuery.data ?? [];

    const handleToggleTag = (tagId: string) => {
        const current = [...selectedTagIds];
        const index = current.indexOf(tagId);
        if (index >= 0) {
            current.splice(index, 1);
        } else {
            current.push(tagId);
        }
        // When selecting tags, clear collection selection
        if (current.length > 0) {
            setSelectedCollectionId.mutate(undefined);
        }
        setSelectedTagIds.mutate(current);
    };

    return (
        <>
            <div className="pt-4 flex items-center justify-between px-3">
                <div className="sidebar-label flex items-center gap-2 text-muted-foreground">
                    Tags
                </div>
                {tags.length > 0 && (
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <button
                                onClick={() =>
                                    void emit("open_settings", {
                                        tab: "general",
                                    })
                                }
                                className="text-muted-foreground/50 hover:text-foreground transition-colors"
                            >
                                <PencilIcon
                                    className="size-3"
                                    strokeWidth={1.5}
                                />
                            </button>
                        </TooltipTrigger>
                        <TooltipContent side="right">Edit tags</TooltipContent>
                    </Tooltip>
                )}
            </div>
            {tags.length === 0 ? (
                <div className="px-3 py-2 text-sm text-muted-foreground/60 flex items-center gap-2">
                    <TagIcon className="size-3.5" strokeWidth={1.5} />
                    Add tags to notes to organize them
                </div>
            ) : (
                <div className="px-1 py-1 space-y-0.5">
                    {tags.map((tag) => {
                        const isSelected = selectedTagIds.includes(tag.id);
                        return (
                            <div
                                key={tag.id}
                                className={`group/tag flex items-center gap-2 px-2 py-1 rounded-md text-sm cursor-pointer transition-colors ${
                                    isSelected
                                        ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                                        : "hover:bg-sidebar-accent/50"
                                }`}
                                onClick={() => handleToggleTag(tag.id)}
                            >
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <button
                                            type="button"
                                            className="shrink-0 rounded-full hover:ring-2 hover:ring-muted-foreground/30 transition-all"
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            <span
                                                className="block w-2.5 h-2.5 rounded-full"
                                                style={{
                                                    backgroundColor:
                                                        tag.color ??
                                                        "hsl(var(--muted-foreground))",
                                                }}
                                            />
                                        </button>
                                    </PopoverTrigger>
                                    <PopoverContent
                                        className="w-auto p-2"
                                        align="start"
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        <div className="flex gap-1 flex-wrap max-w-[130px]">
                                            {TAG_COLOR_PALETTE.map((color) => (
                                                <button
                                                    key={color}
                                                    type="button"
                                                    className={`w-5 h-5 rounded-full border-2 transition-all ${
                                                        tag.color === color
                                                            ? "border-foreground scale-110"
                                                            : "border-transparent hover:border-muted-foreground/50"
                                                    }`}
                                                    style={{
                                                        backgroundColor: color,
                                                    }}
                                                    onClick={() => {
                                                        void updateTag.mutateAsync(
                                                            {
                                                                tagId: tag.id,
                                                                color:
                                                                    tag.color ===
                                                                    color
                                                                        ? null
                                                                        : color,
                                                            },
                                                        );
                                                    }}
                                                />
                                            ))}
                                        </div>
                                    </PopoverContent>
                                </Popover>
                                <span className="truncate flex-1">
                                    {tag.name}
                                </span>
                                <button
                                    type="button"
                                    className="opacity-0 group-hover/tag:opacity-100 p-0.5 rounded hover:bg-destructive/10 hover:text-destructive transition-all"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        void deleteTag.mutateAsync({
                                            tagId: tag.id,
                                        });
                                    }}
                                >
                                    <TrashIcon
                                        className="size-3"
                                        strokeWidth={1.5}
                                    />
                                </button>
                            </div>
                        );
                    })}
                </div>
            )}
        </>
    );
}

export function AppSidebar() {
    return (
        <Sidebar
            collapsible="offcanvas"
            variant="sidebar"
            className="no-scrollbar group/sidebar"
        >
            <DevModeIndicator />
            <CollectionsNavigator />
        </Sidebar>
    );
}

function CollectionsNavigator() {
    const projectsQuery = useQuery(projectQueries.list());
    const chatsQuery = useQuery(chatQueries.list());
    const notesQuery = useQuery(noteQueries.list());
    const createProject = useCreateProject();
    const selectedCollectionId = useSelectedCollectionId();
    const setSelectedCollectionId = useSetSelectedCollectionId();
    const selectedTagIds = useSelectedTagIds();
    const setSelectedTagIds = useSetSelectedTagIds();
    const settings = useSettings();
    const showCost = settings?.showCost ?? false;

    if (
        projectsQuery.isPending ||
        chatsQuery.isPending ||
        notesQuery.isPending
    ) {
        return <RetroSpinner />;
    }

    if (projectsQuery.isError || chatsQuery.isError) {
        return (
            <div className="p-3 text-sm text-destructive">
                Error loading data
            </div>
        );
    }

    const projects = (projectsQuery.data ?? [])
        .filter((project) => !["default", "quick-chat"].includes(project.id))
        .sort((a, b) => a.name.localeCompare(b.name));

    // Count items per collection for badges
    const allChats = chatsQuery.data ?? [];
    const allNotes = notesQuery.data ?? [];

    const countForProject = (projectId: string) => {
        const chatCount = allChats.filter(
            (c) => c.projectId === projectId && !c.isNewChat,
        ).length;
        const noteCount = allNotes.filter(
            (n) => n.projectId === projectId,
        ).length;
        return chatCount + noteCount;
    };

    const totalItemCount =
        allChats.filter((c) => c.projectId !== "quick-chat" && !c.isNewChat)
            .length + allNotes.length;

    const selectCollection = (collectionId: string) => {
        setSelectedCollectionId.mutate(collectionId);
        if (selectedTagIds.length > 0) {
            setSelectedTagIds.mutate([]);
        }
    };

    return (
        <SidebarContent className="relative h-full flex flex-col">
            <div className="overflow-y-auto flex-1 no-scrollbar">
                <SidebarGroup className="min-h-0">
                    <SidebarGroupContent>
                        <SidebarMenu className="truncate">
                            {/* All items */}
                            <Droppable id="default">
                                <SidebarMenuItem>
                                    <SidebarMenuButton
                                        isActive={
                                            selectedCollectionId ===
                                                "__all__" &&
                                            selectedTagIds.length === 0
                                        }
                                        onClick={() =>
                                            selectCollection("__all__")
                                        }
                                        className="flex items-center justify-between"
                                    >
                                        <span className="flex items-center gap-2">
                                            <LayersIcon
                                                className="size-4 text-muted-foreground"
                                                strokeWidth={1.5}
                                            />
                                            <span className="text-base">
                                                All items
                                            </span>
                                        </span>
                                        {totalItemCount > 0 && (
                                            <span className="text-xs text-muted-foreground">
                                                {totalItemCount}
                                            </span>
                                        )}
                                    </SidebarMenuButton>
                                </SidebarMenuItem>
                            </Droppable>

                            {/* Collections section */}
                            <div className="pt-2 flex items-center justify-between px-3">
                                <div className="sidebar-label flex items-center gap-2 text-muted-foreground">
                                    Collections
                                </div>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <button
                                            onClick={() =>
                                                createProject.mutate()
                                            }
                                            className="text-muted-foreground/50 hover:text-foreground transition-colors"
                                        >
                                            <FolderPlusIcon
                                                className="size-3"
                                                strokeWidth={1.5}
                                            />
                                        </button>
                                    </TooltipTrigger>
                                    <TooltipContent side="right">
                                        New Collection
                                    </TooltipContent>
                                </Tooltip>
                            </div>
                            <div className="flex flex-col">
                                {projects.length ? (
                                    projects.map((project) => (
                                        <Droppable
                                            id={project.id}
                                            key={project.id}
                                        >
                                            <CollectionItem
                                                projectId={project.id}
                                                name={project.name}
                                                itemCount={countForProject(
                                                    project.id,
                                                )}
                                                isSelected={
                                                    selectedCollectionId ===
                                                    project.id
                                                }
                                                onSelect={() =>
                                                    selectCollection(project.id)
                                                }
                                                cost={
                                                    showCost
                                                        ? project.totalCostUsd
                                                        : undefined
                                                }
                                                isSmart={
                                                    project.collectionType ===
                                                    "smart"
                                                }
                                            />
                                        </Droppable>
                                    ))
                                ) : (
                                    <div className="px-3 py-2 text-sm text-muted-foreground">
                                        No collections yet
                                    </div>
                                )}
                            </div>

                            {/* Tags section */}
                            <SidebarTagsSection />
                        </SidebarMenu>
                    </SidebarGroupContent>
                </SidebarGroup>
            </div>
        </SidebarContent>
    );
}

function CollectionItem({
    projectId,
    name,
    itemCount,
    isSelected,
    onSelect,
    cost,
    isSmart,
}: {
    projectId: string;
    name: string;
    itemCount: number;
    isSelected: boolean;
    onSelect: () => void;
    cost?: number;
    isSmart?: boolean;
}) {
    const [isRenaming, setIsRenaming] = useState(false);
    const [renameValue, setRenameValue] = useState(name);
    const [deletePopoverOpen, setDeletePopoverOpen] = useState(false);
    const renameProject = useRenameProject();
    const deleteProject = useDeleteProject();

    const handleStartRename = useCallback(
        (e?: React.MouseEvent) => {
            e?.preventDefault();
            e?.stopPropagation();
            setRenameValue(name);
            setIsRenaming(true);
        },
        [name],
    );

    const handleFinishRename = useCallback(() => {
        const trimmed = renameValue.trim();
        if (trimmed && trimmed !== name) {
            renameProject.mutate({
                projectId,
                newName: trimmed,
            });
        }
        setIsRenaming(false);
    }, [renameValue, name, projectId, renameProject]);

    const handleConfirmDelete = useCallback(async () => {
        const displayName = projectDisplayName(name);
        await deleteProject.mutateAsync({ projectId });
        setDeletePopoverOpen(false);
        toast(`'${displayName}' deleted`);
    }, [projectId, name, deleteProject]);

    if (isRenaming) {
        return (
            <SidebarMenuItem>
                <div className="flex items-center gap-2 px-2 py-1.5 mb-0.5">
                    {isSelected ? (
                        <FolderOpenIcon
                            strokeWidth={1.5}
                            className="size-4 text-muted-foreground shrink-0"
                        />
                    ) : (
                        <FolderIcon
                            strokeWidth={1.5}
                            className="size-4 text-muted-foreground shrink-0"
                        />
                    )}
                    <input
                        autoFocus
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onBlur={handleFinishRename}
                        onKeyDown={(e) => {
                            if (e.key === "Enter") {
                                handleFinishRename();
                            } else if (e.key === "Escape") {
                                setIsRenaming(false);
                            }
                        }}
                        className="flex-1 min-w-0 text-base bg-transparent border-0 outline-hidden ring-0 p-0"
                    />
                </div>
            </SidebarMenuItem>
        );
    }

    return (
        <ContextMenu>
            <ContextMenuTrigger asChild>
                <SidebarMenuItem>
                    <SidebarMenuButton
                        isActive={isSelected}
                        onClick={onSelect}
                        className="flex items-center justify-between mb-0.5 group/collection"
                    >
                        <span className="flex items-center gap-2 flex-1 min-w-0">
                            {isSmart ? (
                                <SparklesIcon
                                    strokeWidth={1.5}
                                    className="size-4 text-muted-foreground shrink-0"
                                />
                            ) : isSelected ? (
                                <FolderOpenIcon
                                    strokeWidth={1.5}
                                    className="size-4 text-muted-foreground shrink-0"
                                />
                            ) : (
                                <FolderIcon
                                    strokeWidth={1.5}
                                    className="size-4 text-muted-foreground shrink-0"
                                />
                            )}
                            <span className="truncate text-base">
                                {projectDisplayName(name)}
                            </span>
                            {cost !== undefined && cost > 0 && (
                                <span className="ml-auto text-xs text-muted-foreground shrink-0">
                                    {formatCost(cost)}
                                </span>
                            )}
                        </span>
                        <span className="flex items-center gap-1 shrink-0">
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <span
                                        onClick={handleStartRename}
                                        className="opacity-0 group-hover/collection:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
                                    >
                                        <PencilIcon
                                            className="size-3"
                                            strokeWidth={1.5}
                                        />
                                    </span>
                                </TooltipTrigger>
                                <TooltipContent>Rename</TooltipContent>
                            </Tooltip>
                            <Popover
                                open={deletePopoverOpen}
                                onOpenChange={setDeletePopoverOpen}
                            >
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <PopoverTrigger asChild>
                                            <span
                                                onClick={(e) => {
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                }}
                                                className="opacity-0 group-hover/collection:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
                                            >
                                                <TrashIcon
                                                    className="size-3"
                                                    strokeWidth={1.5}
                                                />
                                            </span>
                                        </PopoverTrigger>
                                    </TooltipTrigger>
                                    <TooltipContent>Delete</TooltipContent>
                                </Tooltip>
                                <PopoverContent
                                    align="start"
                                    className="w-52 p-2"
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    <p className="text-xs text-muted-foreground px-2 py-1">
                                        Delete &ldquo;{projectDisplayName(name)}
                                        &rdquo; and all its contents?
                                    </p>
                                    <div className="flex gap-1 mt-1">
                                        <button
                                            type="button"
                                            className="tag-suggestion-item flex-1 justify-center"
                                            onClick={() =>
                                                setDeletePopoverOpen(false)
                                            }
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="button"
                                            className="tag-suggestion-item flex-1 justify-center text-destructive"
                                            onClick={() =>
                                                void handleConfirmDelete()
                                            }
                                        >
                                            Delete
                                        </button>
                                    </div>
                                </PopoverContent>
                            </Popover>
                            {itemCount > 0 && (
                                <span className="text-xs text-muted-foreground ml-1">
                                    {itemCount}
                                </span>
                            )}
                        </span>
                    </SidebarMenuButton>
                </SidebarMenuItem>
            </ContextMenuTrigger>
            <ContextMenuContent>
                <ContextMenuItem onClick={() => handleStartRename()}>
                    <PencilIcon className="size-3.5 mr-2" /> Rename
                </ContextMenuItem>
                <ContextMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={() => setDeletePopoverOpen(true)}
                >
                    <TrashIcon className="size-3.5 mr-2" /> Delete
                </ContextMenuItem>
            </ContextMenuContent>
        </ContextMenu>
    );
}

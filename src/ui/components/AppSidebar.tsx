import {
    useSelectedCollectionId,
    useSelectedTagIds,
    useSetSelectedCollectionId,
    useSetSelectedTagIds,
} from "@core/chorus/api/AppMetadataAPI";
import { chatQueries, useGetOrCreateNewChat } from "@core/chorus/api/ChatAPI";
import { formatCost } from "@core/chorus/api/CostAPI";
import { noteQueries, useCreateNote } from "@core/chorus/api/NoteAPI";
import {
    projectQueries,
    useCreateProject,
    useDeleteProject,
    useRenameProject,
} from "@core/chorus/api/ProjectAPI";
import { useDeleteTag, useTags } from "@core/chorus/api/TagAPI";
import { dialogActions, useDialogStore } from "@core/infra/DialogStore";
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
    FilePlusIcon,
    FolderIcon,
    FolderOpenIcon,
    FolderPlusIcon,
    LayersIcon,
    PencilIcon,
    Settings,
    SparklesIcon,
    SquarePlusIcon,
    TagIcon,
    TrashIcon,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import Droppable from "./Droppable";
import { useSettings } from "./hooks/useSettings";
import { Button } from "./ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "./ui/dialog";
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
            <div className="pt-4 flex items-center justify-between">
                <div className="sidebar-label flex w-full items-center gap-2 px-3 text-muted-foreground">
                    Tags
                </div>
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
                                        ? "bg-accent text-accent-foreground font-medium"
                                        : "hover:bg-accent"
                                }`}
                                onClick={() => handleToggleTag(tag.id)}
                            >
                                <span
                                    className="w-2 h-2 rounded-full shrink-0"
                                    style={{
                                        backgroundColor:
                                            tag.color ??
                                            "hsl(var(--muted-foreground))",
                                    }}
                                />
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
    const createNote = useCreateNote();
    const getOrCreateNewChat = useGetOrCreateNewChat();
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
        allChats.filter(
            (c) =>
                c.projectId !== "quick-chat" && !c.isNewChat,
        ).length + allNotes.length;

    const selectCollection = (collectionId: string) => {
        setSelectedCollectionId.mutate(collectionId);
        if (selectedTagIds.length > 0) {
            setSelectedTagIds.mutate([]);
        }
    };

    // Determine which collection to create new items in
    const createInProjectId =
        selectedCollectionId &&
        selectedCollectionId !== "__all__"
            ? selectedCollectionId
            : "default";

    return (
        <SidebarContent className="relative h-full flex flex-col">
            {/* Toolbar */}
            <div className="relative bg-sidebar z-10">
                <div className="flex items-center justify-center gap-1 py-2 px-2 border-b">
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <button
                                onClick={() =>
                                    createNote.mutate({
                                        projectId: createInProjectId,
                                    })
                                }
                                className="p-2 rounded-md text-muted-foreground/75 hover:text-foreground hover:bg-muted/50 transition-colors"
                            >
                                <FilePlusIcon
                                    className="w-4 h-4"
                                    strokeWidth={1.5}
                                />
                            </button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom">
                            New Note
                        </TooltipContent>
                    </Tooltip>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <button
                                onClick={() =>
                                    getOrCreateNewChat.mutate({
                                        projectId: createInProjectId,
                                    })
                                }
                                className="p-2 rounded-md text-muted-foreground/75 hover:text-foreground hover:bg-muted/50 transition-colors"
                            >
                                <SquarePlusIcon
                                    className="w-4 h-4"
                                    strokeWidth={1.5}
                                />
                            </button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom">
                            New Chat
                        </TooltipContent>
                    </Tooltip>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <button
                                onClick={() => createProject.mutate()}
                                className="p-2 rounded-md text-muted-foreground/75 hover:text-foreground hover:bg-muted/50 transition-colors"
                            >
                                <FolderPlusIcon
                                    className="w-4 h-4"
                                    strokeWidth={1.5}
                                />
                            </button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom">
                            New Collection
                        </TooltipContent>
                    </Tooltip>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <button
                                onClick={(e) => {
                                    e.preventDefault();
                                    void emit("open_settings", {
                                        tab: "general",
                                    });
                                }}
                                className="p-2 rounded-md text-muted-foreground/75 hover:text-foreground hover:bg-muted/50 transition-colors"
                            >
                                <Settings
                                    className="w-4 h-4"
                                    strokeWidth={1.5}
                                />
                            </button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom">
                            Settings <kbd>⌘,</kbd>
                        </TooltipContent>
                    </Tooltip>
                </div>
            </div>

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
                            <div className="pt-2 flex items-center">
                                <div className="sidebar-label flex w-full items-center gap-2 px-3 text-muted-foreground">
                                    Collections
                                </div>
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
                                                    selectCollection(
                                                        project.id,
                                                    )
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

const deleteCollectionDialogId = (projectId: string) =>
    `delete-collection-dialog-${projectId}`;

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
    const renameProject = useRenameProject();
    const deleteProject = useDeleteProject();
    const isDeleteDialogOpen = useDialogStore(
        (state) => state.activeDialogId === deleteCollectionDialogId(projectId),
    );
    const deleteConfirmButtonRef = useRef<HTMLButtonElement>(null);

    const handleStartRename = useCallback(
        (e: React.MouseEvent) => {
            e.preventDefault();
            e.stopPropagation();
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

    const handleOpenDeleteDialog = useCallback(
        (e: React.MouseEvent) => {
            e.preventDefault();
            e.stopPropagation();
            dialogActions.openDialog(deleteCollectionDialogId(projectId));
        },
        [projectId],
    );

    const handleConfirmDelete = useCallback(async () => {
        const displayName = projectDisplayName(name);
        await deleteProject.mutateAsync({ projectId });
        dialogActions.closeDialog();
        toast(`'${displayName}' deleted`);
    }, [projectId, name, deleteProject]);

    useEffect(() => {
        if (isDeleteDialogOpen && deleteConfirmButtonRef.current) {
            deleteConfirmButtonRef.current.focus();
        }
    }, [isDeleteDialogOpen]);

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
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <span
                                onClick={handleOpenDeleteDialog}
                                className="opacity-0 group-hover/collection:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
                            >
                                <TrashIcon
                                    className="size-3"
                                    strokeWidth={1.5}
                                />
                            </span>
                        </TooltipTrigger>
                        <TooltipContent>Delete</TooltipContent>
                    </Tooltip>
                    {itemCount > 0 && (
                        <span className="text-xs text-muted-foreground ml-1">
                            {itemCount}
                        </span>
                    )}
                </span>
            </SidebarMenuButton>

            {/* Delete confirmation dialog */}
            <Dialog
                id={deleteCollectionDialogId(projectId)}
                open={isDeleteDialogOpen}
            >
                <DialogContent className="sm:max-w-md p-5">
                    <DialogHeader>
                        <DialogTitle>
                            Delete &ldquo;{projectDisplayName(name)}&rdquo;
                        </DialogTitle>
                        <DialogDescription>
                            This will delete the collection and all its chats
                            and notes. This action cannot be undone.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => dialogActions.closeDialog()}
                            tabIndex={-1}
                        >
                            Cancel{" "}
                            <span className="ml-1 text-sm text-muted-foreground/70">
                                Esc
                            </span>
                        </Button>
                        <Button
                            type="button"
                            variant="default"
                            size="sm"
                            onClick={() => void handleConfirmDelete()}
                            ref={deleteConfirmButtonRef}
                            tabIndex={1}
                        >
                            Delete <span className="ml-1 text-sm">↵</span>
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </SidebarMenuItem>
    );
}

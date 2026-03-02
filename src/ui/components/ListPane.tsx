import {
    type SidebarSortMode,
    useSelectedCollectionId,
    useSelectedTagIds,
    useSidebarSortMode,
    useSetSidebarSortMode,
} from "@core/chorus/api/AppMetadataAPI";
import { type Chat } from "@core/chorus/api/ChatAPI";
import * as ChatAPI from "@core/chorus/api/ChatAPI";
import { chatQueries, useGetOrCreateNewChat } from "@core/chorus/api/ChatAPI";
import { formatCost } from "@core/chorus/api/CostAPI";
import { type Note } from "@core/chorus/api/NoteAPI";
import * as NoteAPI from "@core/chorus/api/NoteAPI";
import { noteQueries, useCreateNote } from "@core/chorus/api/NoteAPI";
import * as ProjectAPI from "@core/chorus/api/ProjectAPI";
import {
    fetchSmartCollectionItems,
    type SmartCollectionItem,
} from "@core/chorus/api/ProjectAPI";
import { dialogActions, useDialogStore } from "@core/infra/DialogStore";
import {
    type NavigableItem,
    setVisibleItems,
} from "@core/infra/NavigationStore";
import { useQuery } from "@tanstack/react-query";
import { SidebarMenuButton } from "@ui/components/ui/sidebar";
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "@ui/components/ui/tooltip";
import { compactDate, convertDate, projectDisplayName } from "@ui/lib/utils";
import {
    ArrowUpDownIcon,
    CheckIcon,
    FileTextIcon,
    FilePlusIcon,
    MessageSquareIcon,
    PinIcon,
    PinOffIcon,
    SquarePlusIcon,
} from "lucide-react";
import React, { forwardRef, useCallback, useEffect, useState } from "react";
import { useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";

import Draggable from "./Draggable";
import { EditableTitle } from "./EditableTitle";
import { useSettings } from "./hooks/useSettings";
import { type SidebarItem, sortItems } from "./sidebar/ItemListHelpers";
import { Button } from "./ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "./ui/dialog";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import RetroSpinner from "./ui/retro-spinner";

function ContextToolbar({ createInProjectId }: { createInProjectId: string }) {
    const sortMode = useSidebarSortMode();
    const setSortMode = useSetSidebarSortMode();
    const createNote = useCreateNote();
    const getOrCreateNewChat = useGetOrCreateNewChat();

    return (
        <div className="flex items-center justify-end px-2 py-1.5 border-b shrink-0">
            <DropdownMenu>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <DropdownMenuTrigger asChild>
                            <button className="p-1.5 rounded-md text-muted-foreground/75 hover:text-foreground hover:bg-sidebar-accent/50 transition-colors shrink-0">
                                <ArrowUpDownIcon
                                    className="size-3.5"
                                    strokeWidth={1.5}
                                />
                            </button>
                        </DropdownMenuTrigger>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">Sort</TooltipContent>
                </Tooltip>
                <DropdownMenuContent align="end">
                    {(
                        [
                            { value: "date", label: "Date" },
                            { value: "name", label: "Name" },
                            { value: "type", label: "Type" },
                        ] as const
                    ).map((option) => (
                        <DropdownMenuItem
                            key={option.value}
                            onSelect={() =>
                                setSortMode.mutate(
                                    option.value as SidebarSortMode,
                                )
                            }
                            className="flex items-center justify-between"
                        >
                            {option.label}
                            {sortMode === option.value && (
                                <CheckIcon className="size-3.5 ml-2" />
                            )}
                        </DropdownMenuItem>
                    ))}
                </DropdownMenuContent>
            </DropdownMenu>

            <div className="editor-toolbar-separator" />

            <Tooltip>
                <TooltipTrigger asChild>
                    <button
                        onClick={() =>
                            createNote.mutate({
                                projectId: createInProjectId,
                            })
                        }
                        className="p-1.5 rounded-md text-muted-foreground/75 hover:text-foreground hover:bg-sidebar-accent/50 transition-colors"
                    >
                        <FilePlusIcon
                            className="size-3.5"
                            strokeWidth={1.5}
                        />
                    </button>
                </TooltipTrigger>
                <TooltipContent side="bottom">New Note</TooltipContent>
            </Tooltip>
            <Tooltip>
                <TooltipTrigger asChild>
                    <button
                        onClick={() =>
                            getOrCreateNewChat.mutate({
                                projectId: createInProjectId,
                            })
                        }
                        className="p-1.5 rounded-md text-muted-foreground/75 hover:text-foreground hover:bg-sidebar-accent/50 transition-colors"
                    >
                        <SquarePlusIcon
                            className="size-3.5"
                            strokeWidth={1.5}
                        />
                    </button>
                </TooltipTrigger>
                <TooltipContent side="bottom">New Chat</TooltipContent>
            </Tooltip>
        </div>
    );
}

export function ListPane() {
    const selectedCollectionId = useSelectedCollectionId();
    const selectedTagIds = useSelectedTagIds();

    if (selectedTagIds.length > 0) {
        return <TagFilterView tagIds={selectedTagIds} />;
    }

    if (!selectedCollectionId) {
        return (
            <div className="flex items-center justify-center h-full text-muted-foreground text-sm p-6 text-center">
                Select or create a collection
            </div>
        );
    }

    return <CollectionView collectionId={selectedCollectionId} />;
}

function CollectionView({ collectionId }: { collectionId: string }) {
    const chatsQuery = useQuery(chatQueries.list());
    const notesQuery = useQuery(noteQueries.list());
    const projectsQuery = useQuery(ProjectAPI.projectQueries.list());
    const location = useLocation();
    const currentChatId = location.pathname.startsWith("/chat/")
        ? location.pathname.split("/").pop()!
        : undefined;
    const currentNoteId = location.pathname.startsWith("/note/")
        ? location.pathname.split("/").pop()!
        : undefined;
    const sortMode = useSidebarSortMode();

    // Detect smart collection
    const project = (projectsQuery.data ?? []).find(
        (p) => p.id === collectionId,
    );
    const isSmart = project?.collectionType === "smart";
    const smartRules = project?.smartCollectionRules;

    // Fetch smart collection items when applicable
    const smartItemsQuery = useQuery({
        queryKey: ["smartCollectionItems", collectionId, smartRules] as const,
        queryFn: () => fetchSmartCollectionItems(smartRules!),
        enabled: isSmart && !!smartRules,
    });

    if (chatsQuery.isPending || notesQuery.isPending) {
        return (
            <div className="flex items-center justify-center h-full">
                <RetroSpinner />
            </div>
        );
    }

    if (chatsQuery.isError || notesQuery.isError) {
        return (
            <div className="p-3 text-sm text-destructive">
                Error loading items
            </div>
        );
    }

    const allChats = chatsQuery.data ?? [];
    const allNotes = notesQuery.data ?? [];

    // For smart collections, filter by matching item IDs; for manual, by projectId
    let collectionChats: Chat[];
    let collectionNotes: Note[];

    if (isSmart && smartItemsQuery.data) {
        const smartItems = smartItemsQuery.data;
        const smartChatIds = new Set(
            smartItems
                .filter((i: SmartCollectionItem) => i.itemType === "chat")
                .map((i: SmartCollectionItem) => i.itemId),
        );
        const smartNoteIds = new Set(
            smartItems
                .filter((i: SmartCollectionItem) => i.itemType === "note")
                .map((i: SmartCollectionItem) => i.itemId),
        );
        collectionChats = allChats.filter((c) => smartChatIds.has(c.id));
        collectionNotes = allNotes.filter((n) => smartNoteIds.has(n.id));
    } else if (isSmart) {
        // Smart but still loading
        collectionChats = [];
        collectionNotes = [];
    } else if (collectionId === "__all__") {
        collectionChats = allChats.filter(
            (c) => c.projectId !== "quick-chat" && !c.isNewChat,
        );
        collectionNotes = allNotes;
    } else {
        collectionChats = allChats.filter((c) => c.projectId === collectionId);
        collectionNotes = allNotes.filter((n) => n.projectId === collectionId);
    }

    // Build sidebar items
    const noteItems: SidebarItem[] = collectionNotes.map((note) => ({
        type: "note" as const,
        data: note,
    }));
    const chatItems: SidebarItem[] = collectionChats.map((chat) => ({
        type: "chat" as const,
        data: chat,
    }));

    const allItems: SidebarItem[] = [...noteItems, ...chatItems];
    const sortedItems = sortItems(allItems, sortMode);

    const isAll = collectionId === "__all__";

    // Determine which collection to create new items in
    const createInProjectId =
        collectionId !== "__all__" ? collectionId : "default";

    // Build project name lookup for collection labels in "All items" view
    const projectNameById = new Map<string, string>();
    for (const p of projectsQuery.data ?? []) {
        projectNameById.set(p.id, projectDisplayName(p.name));
    }
    const getCollectionLabel = (projectId: string): string | undefined => {
        if (!isAll) return undefined;
        if (projectId === "default") return "Ungrouped";
        return projectNameById.get(projectId);
    };

    return (
        <div className="flex flex-col h-full bg-sidebar">
            <ContextToolbar createInProjectId={createInProjectId} />

            {/* Scrollable items */}
            <div className="flex-1 overflow-y-auto no-scrollbar pt-1">
                {sortedItems.length > 0 ? (
                    <ItemList
                        items={sortedItems}
                        showTypeHeaders={sortMode === "type"}
                        currentNoteId={currentNoteId}
                        currentChatId={currentChatId}
                        getCollectionLabel={getCollectionLabel}
                        keySuffix="-ctx"
                    />
                ) : (
                    <div className="px-3 py-2 text-sm text-muted-foreground">
                        No items yet
                    </div>
                )}
            </div>
        </div>
    );
}

function TagFilterView({ tagIds }: { tagIds: string[] }) {
    const chatsQuery = useQuery(chatQueries.list());
    const notesQuery = useQuery(noteQueries.list());
    const projectsQuery = useQuery(ProjectAPI.projectQueries.list());
    const location = useLocation();
    const currentChatId = location.pathname.startsWith("/chat/")
        ? location.pathname.split("/").pop()!
        : undefined;
    const currentNoteId = location.pathname.startsWith("/note/")
        ? location.pathname.split("/").pop()!
        : undefined;

    const sortMode = useSidebarSortMode();

    // Fetch items matching ALL selected tags
    const smartItemsQuery = useQuery({
        queryKey: ["tagFilterItems", tagIds] as const,
        queryFn: () =>
            fetchSmartCollectionItems({ match: "all", tagIds }),
        enabled: tagIds.length > 0,
    });

    if (chatsQuery.isPending || notesQuery.isPending) {
        return (
            <div className="flex items-center justify-center h-full">
                <RetroSpinner />
            </div>
        );
    }

    const allChats = chatsQuery.data ?? [];
    const allNotes = notesQuery.data ?? [];

    // Filter by matching smart collection item IDs
    let filteredChats: Chat[] = [];
    let filteredNotes: Note[] = [];

    if (smartItemsQuery.data) {
        const matchedChatIds = new Set(
            smartItemsQuery.data
                .filter((i: SmartCollectionItem) => i.itemType === "chat")
                .map((i: SmartCollectionItem) => i.itemId),
        );
        const matchedNoteIds = new Set(
            smartItemsQuery.data
                .filter((i: SmartCollectionItem) => i.itemType === "note")
                .map((i: SmartCollectionItem) => i.itemId),
        );
        filteredChats = allChats.filter((c) => matchedChatIds.has(c.id));
        filteredNotes = allNotes.filter((n) => matchedNoteIds.has(n.id));
    }

    // Build sidebar items
    const noteItems: SidebarItem[] = filteredNotes.map((note) => ({
        type: "note" as const,
        data: note,
    }));
    const chatItems: SidebarItem[] = filteredChats.map((chat) => ({
        type: "chat" as const,
        data: chat,
    }));

    const allItems: SidebarItem[] = [...noteItems, ...chatItems];
    const sortedItems = sortItems(allItems, sortMode);

    // Build project name lookup for collection labels
    const projectNameById = new Map<string, string>();
    for (const p of projectsQuery.data ?? []) {
        projectNameById.set(p.id, projectDisplayName(p.name));
    }
    const getCollectionLabel = (projectId: string): string | undefined => {
        if (projectId === "default") return "Ungrouped";
        return projectNameById.get(projectId);
    };

    return (
        <div className="flex flex-col h-full bg-sidebar">
            <ContextToolbar createInProjectId="default" />

            {/* Scrollable items */}
            <div className="flex-1 overflow-y-auto no-scrollbar pt-1">
                {sortedItems.length > 0 ? (
                    <ItemList
                        items={sortedItems}
                        showTypeHeaders={sortMode === "type"}
                        currentNoteId={currentNoteId}
                        currentChatId={currentChatId}
                        getCollectionLabel={getCollectionLabel}
                        keySuffix="-tag"
                    />
                ) : (
                    <div className="px-3 py-2 text-sm text-muted-foreground">
                        No items yet
                    </div>
                )}
            </div>
        </div>
    );
}

// ─── ItemList (shared between CollectionView and TagFilterView) ──────────────

function ItemList({
    items,
    showTypeHeaders,
    currentNoteId,
    currentChatId,
    getCollectionLabel,
    keySuffix,
}: {
    items: SidebarItem[];
    showTypeHeaders: boolean;
    currentNoteId: string | undefined;
    currentChatId: string | undefined;
    getCollectionLabel: (projectId: string) => string | undefined;
    keySuffix: string;
}) {
    // Sync visible items to navigation store for CMD-[/] cycling
    useEffect(() => {
        const navigableItems: NavigableItem[] = items.map((item) => ({
            type: item.type,
            id: item.data.id,
        }));
        setVisibleItems(navigableItems);
    }, [items]);

    let lastType: "note" | "chat" | undefined;

    return (
        <>
            {items.map((item) => {
                const header =
                    showTypeHeaders && item.type !== lastType ? (
                        <div
                            key={`header-${item.type}`}
                            className="pt-3 pb-1 flex items-center"
                        >
                            <div className="sidebar-label flex w-full items-center gap-2 px-3 text-muted-foreground">
                                {item.type === "note" ? "Notes" : "Chats"}
                            </div>
                        </div>
                    ) : null;
                lastType = item.type;

                return (
                    <React.Fragment key={item.data.id + keySuffix}>
                        {header}
                        {item.type === "note" ? (
                            <NoteListItem
                                note={item.data as Note}
                                isActive={currentNoteId === item.data.id}
                                collectionLabel={getCollectionLabel(
                                    (item.data as Note).projectId,
                                )}
                            />
                        ) : (
                            <ChatListItem
                                chat={item.data as Chat}
                                isActive={currentChatId === item.data.id}
                                collectionLabel={getCollectionLabel(
                                    (item.data as Chat).projectId,
                                )}
                            />
                        )}
                    </React.Fragment>
                );
            })}
        </>
    );
}


const SplitOptimized = forwardRef<
    SVGSVGElement,
    React.SVGProps<SVGSVGElement> & { size?: number }
>(({ size = 16, ...props }, ref) => (
    <div>
        <svg ref={ref} width={size} height={size} {...props}>
            <use href="#icon-split" />
        </svg>
    </div>
));

// ─── NoteListItem ───────────────────────────────────────────────────────────

const deleteNoteDialogId = (noteId: string) => `delete-note-dialog-${noteId}`;

function NoteListItem({
    note,
    isActive,
    collectionLabel,
}: {
    note: Note;
    isActive: boolean;
    collectionLabel?: string;
}) {
    const navigate = useNavigate();
    const [isEditingTitle, setIsEditingTitle] = useState(false);
    const renameNote = NoteAPI.useRenameNote();
    const deleteNote = NoteAPI.useDeleteNote();
    const isDeleteDialogOpen = useDialogStore(
        (state) => state.activeDialogId === deleteNoteDialogId(note.id),
    );
    const deleteConfirmButtonRef = useRef<HTMLButtonElement>(null);

    const handleConfirmDelete = useCallback(async () => {
        const noteTitle = note.title || "Untitled note";
        await deleteNote.mutateAsync({ noteId: note.id });
        dialogActions.closeDialog();
        toast(`'${noteTitle}' deleted`);
    }, [note.id, note.title, deleteNote]);

    useEffect(() => {
        if (isDeleteDialogOpen && deleteConfirmButtonRef.current) {
            deleteConfirmButtonRef.current.focus();
        }
    }, [isDeleteDialogOpen]);

    return (
        <div className={deleteNote.isPending ? "opacity-50" : ""}>
            <Draggable id={`note:${note.id}`}>
                <SidebarMenuButton
                    asChild={false}
                    data-active={isActive}
                    onClick={() => navigate(`/note/${note.id}`)}
                    className="data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-accent-foreground text-sidebar-foreground truncate group/chat-button flex justify-between mb-0.5 font-[350] relative py-2.5 h-auto!"
                >
                    <div className="truncate flex flex-col w-full">
                        <div className="flex items-center text-base w-full">
                            <FileTextIcon
                                className="size-3.5 mr-2 text-muted-foreground shrink-0"
                                strokeWidth={1.5}
                            />
                            <EditableTitle
                                title={note.title || ""}
                                onUpdate={async (newTitle) => {
                                    await renameNote.mutateAsync({
                                        noteId: note.id,
                                        newTitle,
                                    });
                                }}
                                className="flex-1 truncate"
                                editClassName={`h-auto text-base px-0 py-0 ${isActive ? "bg-sidebar-accent" : ""} group-hover/chat-button:bg-sidebar-accent border-0 focus:ring-0 focus:outline-hidden shadow-none`}
                                placeholder="Untitled note"
                                showEditIcon={false}
                                clickToEdit={false}
                                isEditing={isEditingTitle}
                                onStartEdit={() => setIsEditingTitle(true)}
                                onStopEdit={() => setIsEditingTitle(false)}
                            />
                        </div>
                        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground/50 pl-[calc(0.875rem+0.5rem)]">
                            <span>
                                {compactDate(convertDate(note.updatedAt))}
                            </span>
                            {collectionLabel && (
                                <>
                                    <span>·</span>
                                    <span className="truncate">
                                        {collectionLabel}
                                    </span>
                                </>
                            )}
                        </div>
                    </div>

                </SidebarMenuButton>
            </Draggable>

            {/* Delete confirmation dialog */}
            <Dialog id={deleteNoteDialogId(note.id)} open={isDeleteDialogOpen}>
                <DialogContent className="sm:max-w-md p-5">
                    <DialogHeader>
                        <DialogTitle>
                            Delete &ldquo;
                            {note.title || "Untitled note"}
                            &rdquo;
                        </DialogTitle>
                        <DialogDescription>
                            Are you sure you want to delete this note? This
                            action cannot be undone.
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
        </div>
    );
}

// ─── ChatListItem ───────────────────────────────────────────────────────────

const deleteChatDialogId = (chatId: string) => `delete-chat-dialog-${chatId}`;

function ChatListItem({
    chat,
    isActive,
    collectionLabel,
}: {
    chat: Chat;
    isActive: boolean;
    collectionLabel?: string;
}) {
    const isDeleteChatDialogOpen = useDialogStore(
        (state) => state.activeDialogId === deleteChatDialogId(chat.id),
    );
    const deleteConfirmButtonRef = useRef<HTMLButtonElement>(null);
    const [isEditingTitle, setIsEditingTitle] = useState(false);
    const settings = useSettings();
    const navigateRef = useRef(useNavigate());

    const { mutateAsync: renameChatMutateAsync } = ChatAPI.useRenameChat();
    const { mutate: togglePinChat } = ChatAPI.useTogglePinChat();
    const {
        mutateAsync: deleteChatMutateAsync,
        isPending: deleteChatIsPending,
    } = ChatAPI.useDeleteChat();
    const { data: parentChat } = useQuery(
        ChatAPI.chatQueries.detail(chat.parentChatId ?? undefined),
    );
    const branchCount = ChatAPI.useBranchCount(chat.id);

    const handleConfirmDelete = useCallback(async () => {
        const chatTitle = chat.title || "Untitled Chat";
        await deleteChatMutateAsync({ chatId: chat.id });
        dialogActions.closeDialog();
        toast(`'${chatTitle}' deleted`);
    }, [chat.id, chat.title, deleteChatMutateAsync]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!isDeleteChatDialogOpen) return;
            if (e.key === "Escape") {
                dialogActions.closeDialog();
                e.preventDefault();
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [isDeleteChatDialogOpen, chat.id]);

    useEffect(() => {
        if (isDeleteChatDialogOpen && deleteConfirmButtonRef.current) {
            deleteConfirmButtonRef.current?.focus();
        }
    }, [isDeleteChatDialogOpen]);

    const showCost = settings?.showCost ?? false;

    return (
        <div className={deleteChatIsPending ? "opacity-50" : ""}>
            <Draggable id={`chat:${chat.id}`}>
                <SidebarMenuButton
                    asChild={false}
                    data-active={isActive}
                    onClick={() => navigateRef.current(`/chat/${chat.id}`)}
                    className="data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-accent-foreground text-sidebar-foreground truncate group/chat-button flex justify-between mb-0.5 font-[350] relative py-2.5 h-auto!"
                >
                    <div
                        className={`truncate flex flex-col w-full ${chat.isNewChat ? "text-muted-foreground" : ""}`}
                    >
                        <div className="flex items-center text-base w-full">
                            <MessageSquareIcon
                                className="size-3.5 mr-2 text-muted-foreground shrink-0"
                                strokeWidth={1.5}
                            />
                            {parentChat?.id && (
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <div
                                            className="hover:text-foreground group/parent-chat-button mr-2 shrink-0"
                                            onClick={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                navigateRef.current(
                                                    `/chat/${parentChat.id}`,
                                                );
                                            }}
                                        >
                                            <SplitOptimized className="w-3 h-3 mr-2 text-muted-foreground group-hover/parent-chat-button:text-accent-500" />
                                        </div>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        Branched from:{" "}
                                        {parentChat.title || "Untitled Chat"}
                                    </TooltipContent>
                                </Tooltip>
                            )}
                            {chat.pinned && (
                                <PinIcon className="w-2.5 h-2.5 mr-1.5 shrink-0 text-muted-foreground" />
                            )}
                            <EditableTitle
                                title={chat.title || ""}
                                onUpdate={async (newTitle) => {
                                    await renameChatMutateAsync({
                                        chatId: chat.id,
                                        newTitle,
                                    });
                                    setIsEditingTitle(false);
                                }}
                                className="flex-1 truncate"
                                editClassName={`h-auto text-base px-0 py-0 ${isActive ? "bg-sidebar-accent" : ""} group-hover/chat-button:bg-sidebar-accent border-0 focus:ring-0 focus:outline-hidden shadow-none`}
                                placeholder="Untitled Chat"
                                showEditIcon={false}
                                clickToEdit={false}
                                isEditing={isEditingTitle}
                                onStartEdit={() => setIsEditingTitle(true)}
                                onStopEdit={() => setIsEditingTitle(false)}
                            />
                            <ChatLoadingIndicator chatId={chat.id} />
                            {showCost &&
                                chat.totalCostUsd !== undefined &&
                                chat.totalCostUsd > 0 && (
                                    <span className="ml-auto pl-2 text-xs text-muted-foreground shrink-0">
                                        {formatCost(chat.totalCostUsd)}
                                    </span>
                                )}
                            {branchCount > 0 && (
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <span className="ml-auto pl-2 text-xs text-muted-foreground shrink-0 flex items-center gap-0.5">
                                            <SplitOptimized className="w-2.5 h-2.5" />
                                            {branchCount}
                                        </span>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        {branchCount} branch
                                        {branchCount !== 1 ? "es" : ""}
                                    </TooltipContent>
                                </Tooltip>
                            )}
                        </div>
                        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground/50 pl-[calc(0.875rem+0.5rem)]">
                            <span>
                                {compactDate(convertDate(chat.updatedAt))}
                            </span>
                            {collectionLabel && (
                                <>
                                    <span>·</span>
                                    <span className="truncate">
                                        {collectionLabel}
                                    </span>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Gradient overlay on hover */}
                    <div className="absolute right-0 w-20 h-full opacity-0 group-hover/chat-button:opacity-100 transition-opacity bg-linear-to-l from-sidebar-accent via-sidebar-accent to-transparent pointer-events-none" />

                    {/* Chat actions */}
                    <div className="flex items-center gap-2 absolute right-3 z-10">
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <div
                                    onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        togglePinChat({
                                            chatId: chat.id,
                                            pinned: !chat.pinned,
                                        });
                                    }}
                                >
                                    {chat.pinned ? (
                                        <PinOffIcon className="h-[13px] w-[13px] opacity-0 group-hover/chat-button:opacity-100 transition-opacity text-muted-foreground hover:text-foreground" />
                                    ) : (
                                        <PinIcon className="h-[13px] w-[13px] opacity-0 group-hover/chat-button:opacity-100 transition-opacity text-muted-foreground hover:text-foreground" />
                                    )}
                                </div>
                            </TooltipTrigger>
                            <TooltipContent side="bottom">
                                {chat.pinned ? "Unpin chat" : "Pin chat"}
                            </TooltipContent>
                        </Tooltip>
                    </div>
                </SidebarMenuButton>
            </Draggable>

            {/* Delete confirmation dialog */}
            <Dialog id={deleteChatDialogId(chat.id)}>
                <DialogContent className="sm:max-w-md p-5">
                    <DialogHeader>
                        <DialogTitle>
                            Delete &ldquo;
                            {chat.title || "Untitled Chat"}&rdquo;
                        </DialogTitle>
                        <DialogDescription>
                            Are you sure you want to delete this chat? This
                            action cannot be undone.
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
                            tabIndex={1}
                            ref={deleteConfirmButtonRef}
                        >
                            Delete <span className="ml-1 text-xs">⌘↵</span>
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

const ChatLoadingIndicator = React.memo(({ chatId }: { chatId: string }) => {
    const chatIsLoading =
        useQuery(ChatAPI.chatIsLoadingQueries.detail(chatId)).data ?? false;
    return chatIsLoading ? <RetroSpinner className="ml-2" /> : null;
});

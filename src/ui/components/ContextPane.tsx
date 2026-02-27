import {
    FileTextIcon,
    FilePlusIcon,
    SquarePlusIcon,
    PinIcon,
    PinOffIcon,
    ArrowUpDownIcon,
    CheckIcon,
} from "lucide-react";
import { SidebarMenuButton } from "@ui/components/ui/sidebar";

import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "@ui/components/ui/tooltip";
import { useNavigate, useLocation } from "react-router-dom";

import React, {
    useState,
    useCallback,
    useEffect,
    forwardRef,
} from "react";
import { useRef } from "react";
import { Button } from "./ui/button";
import { EditableTitle } from "./EditableTitle";
import { type Chat } from "@core/chorus/api/ChatAPI";
import { useSettings } from "./hooks/useSettings";
import { toast } from "sonner";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "./ui/dialog";
import * as ChatAPI from "@core/chorus/api/ChatAPI";
import * as NoteAPI from "@core/chorus/api/NoteAPI";
import { type Note } from "@core/chorus/api/NoteAPI";
import * as ProjectAPI from "@core/chorus/api/ProjectAPI";
import { formatCost } from "@core/chorus/api/CostAPI";
import RetroSpinner from "./ui/retro-spinner";
import { projectDisplayName } from "@ui/lib/utils";
import { useQuery } from "@tanstack/react-query";
import Draggable from "./Draggable";
import { dialogActions, useDialogStore } from "@core/infra/DialogStore";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { chatQueries } from "@core/chorus/api/ChatAPI";
import { noteQueries } from "@core/chorus/api/NoteAPI";
import {
    useSelectedCollectionId,
    useSidebarSortMode,
    useSetSidebarSortMode,
    type SidebarSortMode,
} from "@core/chorus/api/AppMetadataAPI";
import {
    type SidebarItem,
    sortItems,
} from "./sidebar/ItemListHelpers";

export function ContextPane() {
    const selectedCollectionId = useSelectedCollectionId();

    if (!selectedCollectionId) {
        return (
            <div className="flex items-center justify-center h-full text-muted-foreground text-sm p-6 text-center">
                Select or create a collection
            </div>
        );
    }

    return <CollectionView collectionId={selectedCollectionId} />;
}

type ContextTab = "all" | "notes" | "chats";

function CollectionView({ collectionId }: { collectionId: string }) {
    const chatsQuery = useQuery(chatQueries.list());
    const notesQuery = useQuery(noteQueries.list());
    const location = useLocation();
    const currentChatId = location.pathname.startsWith("/chat/")
        ? location.pathname.split("/").pop()!
        : undefined;
    const currentNoteId = location.pathname.startsWith("/note/")
        ? location.pathname.split("/").pop()!
        : undefined;
    const createNote = NoteAPI.useCreateNote();
    const getOrCreateNewChat = ChatAPI.useGetOrCreateNewChat();

    const [activeTab, setActiveTab] = useState<ContextTab>("all");
    const sortMode = useSidebarSortMode();
    const setSortMode = useSetSidebarSortMode();

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

    // Filter items for this collection (show all chats including new/empty ones)
    const collectionChats = allChats.filter(
        (c) => c.projectId === collectionId,
    );
    const collectionNotes = allNotes.filter(
        (n) => n.projectId === collectionId,
    );

    // Build sidebar items
    const noteItems: SidebarItem[] = collectionNotes.map((note) => ({
        type: "note" as const,
        data: note,
    }));
    const chatItems: SidebarItem[] = collectionChats.map((chat) => ({
        type: "chat" as const,
        data: chat,
    }));

    // Sort notes and chats
    const sortedNotes = sortItems(noteItems, sortMode);
    const sortedChats = sortItems(chatItems, sortMode);

    const isDefault = collectionId === "default";
    const headerTitle = isDefault ? "Ungrouped" : undefined;

    return (
        <div className="flex flex-col h-full bg-sidebar">
            {/* Header */}
            <CollectionHeader
                collectionId={collectionId}
                title={headerTitle}
            />

            {/* Tabs + sort */}
            <div className="flex items-center justify-between px-2 pt-1.5 pb-1 border-b">
                <div className="flex items-center gap-0.5">
                    {(
                        [
                            { value: "all", label: "All" },
                            { value: "notes", label: "Notes" },
                            { value: "chats", label: "Chats" },
                        ] as const
                    ).map(({ value, label }) => (
                        <button
                            key={value}
                            onClick={() => setActiveTab(value)}
                            className={`px-2.5 py-1 text-xs rounded-md transition-colors ${
                                activeTab === value
                                    ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                                    : "text-muted-foreground hover:text-foreground"
                            }`}
                        >
                            {label}
                        </button>
                    ))}
                </div>
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
            </div>

            {/* Scrollable items */}
            <div className="flex-1 overflow-y-auto no-scrollbar">
                {/* Notes section */}
                {(activeTab === "all" || activeTab === "notes") && (
                    <>
                        <div className="pt-3 flex items-center justify-between">
                            <div className="sidebar-label flex w-full items-center gap-2 px-3 text-muted-foreground">
                                Notes
                            </div>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <button
                                        className="text-muted-foreground hover:text-foreground p-1 pr-3 rounded"
                                        onClick={() =>
                                            createNote.mutate({
                                                projectId: collectionId,
                                            })
                                        }
                                    >
                                        <FilePlusIcon
                                            className="size-3.5"
                                            strokeWidth={1.5}
                                        />
                                    </button>
                                </TooltipTrigger>
                                <TooltipContent>New Note</TooltipContent>
                            </Tooltip>
                        </div>
                        {sortedNotes.length > 0 ? (
                            sortedNotes.map((item) => (
                                <NoteListItem
                                    key={item.data.id + "-ctx"}
                                    note={item.data as Note}
                                    isActive={
                                        currentNoteId === item.data.id
                                    }
                                />
                            ))
                        ) : (
                            <div className="px-3 py-2 text-sm text-muted-foreground">
                                No notes yet
                            </div>
                        )}
                    </>
                )}

                {/* Chats section */}
                {(activeTab === "all" || activeTab === "chats") && (
                    <>
                        <div className="pt-3 flex items-center justify-between">
                            <div className="sidebar-label flex w-full items-center gap-2 px-3 text-muted-foreground">
                                Chats
                            </div>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <button
                                        className="text-muted-foreground hover:text-foreground p-1 pr-3 rounded"
                                        onClick={() =>
                                            getOrCreateNewChat.mutate({
                                                projectId: collectionId,
                                            })
                                        }
                                    >
                                        <SquarePlusIcon
                                            className="size-3.5"
                                            strokeWidth={1.5}
                                        />
                                    </button>
                                </TooltipTrigger>
                                <TooltipContent>New Chat</TooltipContent>
                            </Tooltip>
                        </div>
                        {sortedChats.length > 0 ? (
                            sortedChats.map((item) => (
                                <ChatListItem
                                    key={item.data.id + "-ctx"}
                                    chat={item.data as Chat}
                                    isActive={
                                        currentChatId === item.data.id
                                    }
                                />
                            ))
                        ) : (
                            <div className="px-3 py-2 text-sm text-muted-foreground">
                                No chats yet
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}

function CollectionHeader({
    collectionId,
    title,
}: {
    collectionId: string;
    title?: string;
}) {
    const projectsQuery = useQuery(ProjectAPI.projectQueries.list());

    const project = (projectsQuery.data ?? []).find(
        (p) => p.id === collectionId,
    );
    const displayTitle =
        title ?? projectDisplayName(project?.name ?? "Collection");

    return (
        <div
            data-tauri-drag-region
            className="h-[44px] flex items-center justify-end px-3 border-b shrink-0"
        >
            <span className="text-sm font-medium truncate">
                {displayTitle}
            </span>
        </div>
    );
}

// ─── Optimized SVG icons (from index.html sprite) ───────────────────────────

const PencilOptimized = forwardRef<
    SVGSVGElement,
    React.SVGProps<SVGSVGElement> & { size?: number }
>(({ size = 16, ...props }, ref) => (
    <div>
        <svg ref={ref} width={size} height={size} {...props}>
            <use href="#icon-pencil" />
        </svg>
    </div>
));

const Trash2Optimized = forwardRef<
    SVGSVGElement,
    React.SVGProps<SVGSVGElement> & { size?: number }
>(({ size = 16, ...props }, ref) => (
    <div>
        <svg ref={ref} width={size} height={size} {...props}>
            <use href="#icon-trash-2" />
        </svg>
    </div>
));

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

const deleteNoteDialogId = (noteId: string) =>
    `delete-note-dialog-${noteId}`;

function NoteListItem({
    note,
    isActive,
}: {
    note: Note;
    isActive: boolean;
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
                    className="data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-accent-foreground text-sidebar-foreground truncate group/chat-button flex justify-between mb-0.5 font-[350] relative"
                >
                    <div className="truncate flex items-center text-base w-full">
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

                    {/* Gradient overlay on hover */}
                    <div className="absolute right-0 w-20 h-full opacity-0 group-hover/chat-button:opacity-100 transition-opacity bg-linear-to-l from-sidebar-accent via-sidebar-accent to-transparent pointer-events-none" />

                    {/* Note actions */}
                    <div className="flex items-center gap-2 absolute right-3 z-10">
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <PencilOptimized
                                    className="h-[13px] w-[13px] opacity-0 group-hover/chat-button:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
                                    onClick={(e: React.MouseEvent) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        setIsEditingTitle(true);
                                    }}
                                />
                            </TooltipTrigger>
                            <TooltipContent side="bottom">
                                Rename note
                            </TooltipContent>
                        </Tooltip>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <div
                                    onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        dialogActions.openDialog(
                                            deleteNoteDialogId(note.id),
                                        );
                                    }}
                                >
                                    <Trash2Optimized className="h-[13px] w-[13px] opacity-0 group-hover/chat-button:opacity-100 transition-opacity text-muted-foreground hover:text-foreground" />
                                </div>
                            </TooltipTrigger>
                            <TooltipContent side="bottom">
                                Delete note
                            </TooltipContent>
                        </Tooltip>
                    </div>
                </SidebarMenuButton>
            </Draggable>

            {/* Delete confirmation dialog */}
            <Dialog
                id={deleteNoteDialogId(note.id)}
                open={isDeleteDialogOpen}
            >
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

function ChatListItem({ chat, isActive }: { chat: Chat; isActive: boolean }) {
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

    const handleOpenDeleteDialog = useCallback(() => {
        dialogActions.openDialog(deleteChatDialogId(chat.id));
    }, [chat.id]);

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
                    className="data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-accent-foreground text-sidebar-foreground truncate group/chat-button flex justify-between mb-0.5 font-[350] relative"
                >
                    <div
                        className={`truncate flex items-center text-base w-full ${chat.isNewChat ? "text-muted-foreground" : ""}`}
                    >
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
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <PencilOptimized
                                    className="h-[13px] w-[13px] opacity-0 group-hover/chat-button:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
                                    onClick={(e: React.MouseEvent) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        setIsEditingTitle(true);
                                    }}
                                />
                            </TooltipTrigger>
                            <TooltipContent side="bottom">
                                Rename chat
                            </TooltipContent>
                        </Tooltip>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <div onClick={handleOpenDeleteDialog}>
                                    <Trash2Optimized className="h-[13px] w-[13px] opacity-0 group-hover/chat-button:opacity-100 transition-opacity text-muted-foreground hover:text-foreground" />
                                </div>
                            </TooltipTrigger>
                            <TooltipContent side="bottom">
                                Delete chat
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
                            Delete{" "}
                            <span className="ml-1 text-xs">⌘↵</span>
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

const ChatLoadingIndicator = React.memo(
    ({ chatId }: { chatId: string }) => {
        const chatIsLoading =
            useQuery(ChatAPI.chatIsLoadingQueries.detail(chatId)).data ??
            false;
        return chatIsLoading ? <RetroSpinner className="ml-2" /> : null;
    },
);

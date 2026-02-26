import {
    ArchiveIcon,
    ChevronDownIcon,
    Settings,
    PlusIcon,
    FolderIcon,
    FolderOpenIcon,
    FolderPlusIcon,
    SquarePlusIcon,
    ArrowBigUpIcon,
    EllipsisIcon,
    SearchIcon,
    SparklesIcon,
    NetworkIcon,
    FileTextIcon,
    ArrowUpDownIcon,
    CheckIcon,
} from "lucide-react";
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
import { NavigateFunction, useLocation, useNavigate } from "react-router-dom";

import React, {
    useRef,
    useEffect,
    useState,
    useCallback,
    MutableRefObject,
    forwardRef,
} from "react";
import { invoke } from "@tauri-apps/api/core";
import { Button } from "./ui/button";
import { EditableTitle } from "./EditableTitle";
import { type Chat } from "@core/chorus/api/ChatAPI";
import { useSettings } from "./hooks/useSettings";
import { toast } from "sonner";
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "./ui/collapsible";
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

import { emit } from "@tauri-apps/api/event";
import { projectDisplayName } from "@ui/lib/utils";
import { useQuery } from "@tanstack/react-query";
import {
    DndContext,
    DragEndEvent,
    PointerSensor,
    useSensor,
    useSensors,
    useDroppable,
} from "@dnd-kit/core";
import Droppable from "./Droppable";
import Draggable from "./Draggable";
import { dialogActions, useDialogStore } from "@core/infra/DialogStore";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { projectQueries, useCreateProject } from "@core/chorus/api/ProjectAPI";
import { chatQueries } from "@core/chorus/api/ChatAPI";
import { noteQueries } from "@core/chorus/api/NoteAPI";
import {
    useSidebarSortMode,
    useSetSidebarSortMode,
    type SidebarSortMode,
} from "@core/chorus/api/AppMetadataAPI";
import { useToggleProjectIsCollapsed } from "@core/chorus/api/ProjectAPI";
import { SIMILAR_CHATS_DIALOG_ID } from "./SimilarChatsDialog";

function isToday(date: Date) {
    const today = new Date();
    return date.toDateString() === today.toDateString();
}

function isYesterday(date: Date) {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    return date.toDateString() === yesterday.toDateString();
}

function isLastWeek(date: Date) {
    const today = new Date();
    const lastWeek = new Date();
    lastWeek.setDate(today.getDate() - 7);
    return date >= lastWeek && date < today;
}

type SidebarItem =
    | { type: "chat"; data: Chat }
    | { type: "note"; data: Note };

function sidebarItemUpdatedAt(item: SidebarItem): string {
    return item.data.updatedAt || item.data.createdAt;
}

function sidebarItemTitle(item: SidebarItem): string {
    return item.data.title || "";
}


function groupItemsByDate(items: SidebarItem[]) {
    const groups: { label: string; items: SidebarItem[] }[] = [];

    const today: SidebarItem[] = [];
    const yesterday: SidebarItem[] = [];
    const lastWeek: SidebarItem[] = [];
    const older: SidebarItem[] = [];
    items.forEach((item) => {
        const utcDate = new Date(sidebarItemUpdatedAt(item) || 0);
        // Convert to local time
        const date = new Date(
            utcDate.getTime() - utcDate.getTimezoneOffset() * 60000,
        );

        if (isToday(date)) {
            today.push(item);
        } else if (isYesterday(date)) {
            yesterday.push(item);
        } else if (isLastWeek(date)) {
            lastWeek.push(item);
        } else {
            older.push(item);
        }
    });

    if (today.length) groups.push({ label: "Today", items: today });
    if (yesterday.length) groups.push({ label: "Yesterday", items: yesterday });
    if (lastWeek.length) groups.push({ label: "Last Week", items: lastWeek });
    if (older.length) groups.push({ label: "Older", items: older });

    return groups;
}

function EmptyProjectState() {
    const createProject = useCreateProject();
    const { isOver, setNodeRef, active } = useDroppable({
        id: "empty-project-state",
    });

    return (
        <div
            ref={setNodeRef}
            className={`px-3 text-base text-muted-foreground border rounded-md p-2 mt-1 transition-all ${
                isOver && active
                    ? "border-sidebar-accent bg-sidebar-accent scale-[1.02]"
                    : "border-muted-foreground/10"
            }`}
        >
            <p className="mb-2 text-sm whitespace-normal wrap-break-word">
                Collections allow you to share context between chats.
            </p>

            <button
                className="flex items-center justify-between w-full text-sidebar-muted-foreground hover:text-sidebar-accent-foreground group/create-project"
                onClick={() => {
                    createProject.mutate();
                }}
            >
                <div className="flex items-center">
                    <FolderPlusIcon
                        strokeWidth={1.5}
                        className="w-4 h-4 mr-2 text-muted-foreground group-hover/create-project:text-sidebar-accent-foreground"
                    />
                    <span className="font-[350]">
                        {active
                            ? "Drop to create a collection"
                            : "Create a collection"}
                    </span>
                </div>
                <span>
                    <kbd className="invisible group-hover/create-project:visible">
                        <span>⌘</span>
                        <ArrowBigUpIcon className="size-3.5" />N
                    </kbd>
                </span>
            </button>
        </div>
    );
}

function EmptyChatState() {
    return (
        <div className="px-3">
            <div className="text-base text-muted-foreground">
                <p className="flex items-center">⌘N to start your first chat</p>
            </div>
        </div>
    );
}

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

export function AppSidebar() {
    return (
        <>
            <Sidebar
                collapsible="offcanvas"
                variant="sidebar"
                className="no-scrollbar group/sidebar"
            >
                <DevModeIndicator />
                <AppSidebarInner />
            </Sidebar>
        </>
    );
}

// This icon references an svg symbol defined in index.html
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

// This icon references an svg symbol defined in index.html
const Trash2Optimized = forwardRef<
    SVGSVGElement,
    React.SVGProps<SVGSVGElement> & { size?: number }
>(({ size = 16, ...props }, ref) => (
    <div>
        <svg ref={ref} width={size} height={size} {...props}>
            <use href={`#icon-trash-2`} />
        </svg>
    </div>
));

// This icon references an svg symbol defined in index.html
const SplitOptimized = forwardRef<
    SVGSVGElement,
    React.SVGProps<SVGSVGElement> & { size?: number }
>(({ size = 16, ...props }, ref) => (
    <div>
        <svg ref={ref} width={size} height={size} {...props}>
            <use href={`#icon-split`} />
        </svg>
    </div>
));

function Project({ projectId }: { projectId: string }) {
    const navigate = useNavigate();
    const getOrCreateNewChat = ChatAPI.useGetOrCreateNewChat();
    const toggleProjectIsCollapsed = useToggleProjectIsCollapsed();
    const projectsQuery = useQuery(projectQueries.list());
    const chatsQuery = useQuery(chatQueries.list());
    const settings = useSettings();
    const location = useLocation();
    const currentChatId = location.pathname.split("/").pop()!; // well this is super hacky
    const projectIsActive = location.pathname.includes(projectId);
    const [showAllChats, setShowAllChats] = useState(false);

    const allProjectChats =
        chatsQuery.data?.filter((chat) => chat.projectId === projectId) ?? [];
    const chats = filterChatsForDisplay(allProjectChats, currentChatId);

    const chatToDisplay = showAllChats
        ? chats
        : chats.slice(0, NUM_PROJECT_CHATS_TO_SHOW_BY_DEFAULT);

    if (projectsQuery.isPending) return <RetroSpinner />;
    if (projectsQuery.isError) return null;
    if (chatsQuery.isPending) return <RetroSpinner />;
    if (chatsQuery.isError) return null;

    const projects = projectsQuery.data;
    const project = projects.find((p) => p.id === projectId)!;
    const isCollapsed = project?.isCollapsed || false;
    const showCost = settings?.showCost ?? false;

    const handleToggleCollapse = (e: React.MouseEvent) => {
        e.preventDefault();
        void toggleProjectIsCollapsed.mutateAsync({ projectId });
    };

    const handleProjectClick = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        if (isCollapsed) {
            // If collapsed: expand AND navigate
            void toggleProjectIsCollapsed.mutateAsync({ projectId });
        }
        // Always navigate (both collapsed and expanded cases)
        navigate(`/projects/${projectId}`);
    };

    return (
        <SidebarMenuItem>
            <Collapsible open={!isCollapsed} defaultOpen={chats.length > 0}>
                <SidebarMenuButton
                    onClick={handleProjectClick}
                    isActive={location.pathname === `/projects/${projectId}`}
                    className="group/project-toggle flex items-center justify-between mb-0.5 relative"
                >
                    <span className="flex items-center gap-2 flex-1 min-w-0">
                        <CollapsibleTrigger asChild>
                            <div
                                className="text-muted-foreground flex items-center justify-center -ml-1 p-1 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground rounded shrink-0"
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    void handleToggleCollapse(e);
                                }}
                            >
                                <ChevronDownIcon
                                    className={`size-4  transition-transform ${isCollapsed ? "-rotate-90" : ""}
                                    hidden
                                    group-hover/project-toggle:block
                                    `}
                                />
                                {isCollapsed ? (
                                    <FolderIcon
                                        strokeWidth={1.5}
                                        className="size-4 group-hover/project-toggle:hidden"
                                    />
                                ) : (
                                    <FolderOpenIcon
                                        strokeWidth={1.5}
                                        className="size-4 group-hover/project-toggle:hidden"
                                    />
                                )}
                            </div>
                        </CollapsibleTrigger>
                        <h2
                            className="truncate text-base"
                            onClick={handleProjectClick}
                        >
                            {projectDisplayName(project?.name)}
                        </h2>
                        {showCost &&
                            project?.totalCostUsd !== undefined &&
                            project.totalCostUsd > 0 && (
                                <span className="ml-auto pr-8 text-xs text-muted-foreground font-normal shrink-0">
                                    {formatCost(project.totalCostUsd)}
                                </span>
                            )}
                    </span>

                    {/* Gradient overlay that appears when hovering */}
                    <div className="absolute right-0 w-20 h-full opacity-0 group-hover/project-toggle:opacity-100 transition-opacity bg-linear-to-l from-sidebar-accent via-sidebar-accent to-transparent pointer-events-none" />

                    {/* Add new chat in project */}
                    <div
                        className={`group-hover/project-toggle:block ${projectIsActive ? "block" : "hidden"} text-muted-foreground hover:text-sidebar-accent-foreground rounded absolute right-3 z-10`}
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            void getOrCreateNewChat.mutateAsync({
                                projectId,
                            });
                        }}
                    >
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <PlusIcon className="size-3.5" />
                            </TooltipTrigger>
                            <TooltipContent>
                                New chat in {projectDisplayName(project.name)}
                            </TooltipContent>
                        </Tooltip>
                    </div>
                </SidebarMenuButton>
                <CollapsibleContent>
                    {chats.length > 0 && (
                        <div className="relative">
                            {/* Vertical line connecting folder to chats */}
                            <div className="absolute left-[18px] top-0 bottom-1 w-px bg-border" />
                            <div className="pl-[28px]">
                                {chatToDisplay.map((chat) => (
                                    <ChatListItem
                                        key={chat.id + "-sidebar"}
                                        chat={chat}
                                        isActive={currentChatId === chat.id}
                                    />
                                ))}
                                {chats.length >
                                    NUM_PROJECT_CHATS_TO_SHOW_BY_DEFAULT &&
                                    !showAllChats && (
                                        <SidebarMenuItem>
                                            <SidebarMenuButton
                                                onClick={() =>
                                                    setShowAllChats(true)
                                                }
                                                className="text-muted-foreground hover:text-foreground"
                                            >
                                                <EllipsisIcon className="size-4" />
                                                <span className="text-base">
                                                    Show More
                                                </span>
                                            </SidebarMenuButton>
                                        </SidebarMenuItem>
                                    )}
                            </div>
                        </div>
                    )}
                </CollapsibleContent>
            </Collapsible>
        </SidebarMenuItem>
    );
}

// Include new chats that are currently active
function filterChatsForDisplay(chats: Chat[], currentChatId: string) {
    return chats.filter((chat) => !chat.isNewChat || chat.id === currentChatId);
}

const NUM_DEFAULT_CHATS_TO_SHOW_BY_DEFAULT = 25;
const NUM_PROJECT_CHATS_TO_SHOW_BY_DEFAULT = 10;

export function AppSidebarInner() {
    const projectsQuery = useQuery(ProjectAPI.projectQueries.list());
    const chatsQuery = useQuery(ChatAPI.chatQueries.list());
    const notesQuery = useQuery(noteQueries.list());
    const createProject = ProjectAPI.useCreateProject();
    const createNote = NoteAPI.useCreateNote();
    const location = useLocation();
    const navigate = useNavigate();
    const currentChatId = location.pathname.split("/").pop()!; // well this is super hacky
    const currentNoteId = location.pathname.startsWith("/note/")
        ? location.pathname.split("/").pop()!
        : undefined;
    const updateChatProject = ProjectAPI.useSetChatProject();
    const setNoteProject = NoteAPI.useSetNoteProject();
    const getOrCreateNewChat = ChatAPI.useGetOrCreateNewChat();

    const [showAllItems, setShowAllItems] = useState(false);
    const [sidebarFilter, setSidebarFilter] = useState("");
    const sortMode = useSidebarSortMode();
    const setSortMode = useSetSidebarSortMode();

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8,
            },
        }),
    );
    const chatsByProject = (chatsQuery.data ?? []).reduce(
        (acc: Record<string, Chat[]>, chat) => {
            const prev = acc[chat.projectId] ?? [];
            acc[chat.projectId] = [...prev, chat];
            return acc;
        },
        {} as Record<string, Chat[]>,
    );

    // Build merged sidebar items for the default section
    const defaultItems: SidebarItem[] = (() => {
        const chatItems: SidebarItem[] = filterChatsForDisplay(
            chatsByProject["default"] || [],
            currentChatId,
        ).map((chat) => ({ type: "chat" as const, data: chat }));

        const noteItems: SidebarItem[] = (notesQuery.data ?? [])
            .filter((note) => note.projectId === "default")
            .map((note) => ({ type: "note" as const, data: note }));

        let items = [...chatItems, ...noteItems];

        // Apply sort based on mode
        if (sortMode === "name") {
            items.sort((a, b) =>
                sidebarItemTitle(a).localeCompare(sidebarItemTitle(b)),
            );
        } else if (sortMode === "type") {
            items.sort((a, b) => {
                if (a.type !== b.type) {
                    return a.type === "note" ? -1 : 1;
                }
                return (
                    new Date(sidebarItemUpdatedAt(b)).getTime() -
                    new Date(sidebarItemUpdatedAt(a)).getTime()
                );
            });
        } else {
            items.sort(
                (a, b) =>
                    new Date(sidebarItemUpdatedAt(b)).getTime() -
                    new Date(sidebarItemUpdatedAt(a)).getTime(),
            );
        }

        if (sidebarFilter) {
            const lower = sidebarFilter.toLowerCase();
            items = items.filter(
                (item) =>
                    sidebarItemTitle(item).toLowerCase().includes(lower) ||
                    (item.type === "chat" && item.data.id === currentChatId),
            );
        }
        return items;
    })();

    const itemsToDisplay = showAllItems
        ? defaultItems
        : defaultItems.slice(0, NUM_DEFAULT_CHATS_TO_SHOW_BY_DEFAULT);

    // When sorting by date, group into Today/Yesterday/etc.
    // For other sort modes, use a single flat group.
    const groupedItems =
        sortMode === "date"
            ? groupItemsByDate(itemsToDisplay)
            : [{ label: "", items: itemsToDisplay }];
    const quickChats = filterChatsForDisplay(
        chatsByProject["quick-chat"] || [],
        currentChatId,
    );
    const projectsToDisplay = (projectsQuery.data ?? [])
        .filter(
            (project) => !["default", "quick-chat"].includes(project.id),
        )
        .sort((a, b) => a.name.localeCompare(b.name));

    if (
        projectsQuery.isPending ||
        chatsQuery.isPending ||
        notesQuery.isPending
    ) {
        return <RetroSpinner />;
    }

    if (projectsQuery.isError) {
        return (
            <div>
                Error loading projects: {JSON.stringify(projectsQuery.error)}
            </div>
        );
    }
    if (chatsQuery.isError) {
        return (
            <div>Error loading chats: {JSON.stringify(chatsQuery.error)}</div>
        );
    }

    const handleDragEnd = async (event: DragEndEvent) => {
        const itemId = event.active.id.toString();
        const dropTargetId = event.over?.id.toString();

        if (!itemId || !dropTargetId) return;

        // Determine if the dragged item is a note or a chat
        const isNote = (notesQuery.data ?? []).some(
            (note) => note.id === itemId,
        );

        if (dropTargetId === "empty-project-state") {
            const projectId = await createProject.mutateAsync();
            if (isNote) {
                setNoteProject.mutate({ noteId: itemId, projectId });
            } else {
                updateChatProject.mutate({ chatId: itemId, projectId });
            }
        } else {
            if (isNote) {
                setNoteProject.mutate({
                    noteId: itemId,
                    projectId: dropTargetId,
                });
            } else {
                updateChatProject.mutate({
                    chatId: itemId,
                    projectId: dropTargetId,
                });
            }
        }
    };

    function onNewChatClick() {
        void getOrCreateNewChat.mutateAsync({ projectId: "default" });
    }

    function onNewNoteClick() {
        void createNote.mutateAsync({ projectId: "default" });
    }

    const hasNonQuickChats =
        chatsQuery.data?.filter((chat) => chat.projectId !== "quick-chat")
            .length > 0;
    const hasDefaultNotes =
        (notesQuery.data ?? []).filter((n) => n.projectId === "default")
            .length > 0;
    const hasNonQuickItems = hasNonQuickChats || hasDefaultNotes;

    return (
        <SidebarContent className="relative h-full pt-5">
            <DndContext onDragEnd={handleDragEnd} sensors={sensors}>
                <div className="overflow-y-auto h-full no-scrollbar">
                    <SidebarGroup className="min-h-0">
                        <SidebarGroupContent>
                            <SidebarMenu className="truncate">
                                {/* New Chat + New Note buttons */}
                                <div className="flex items-center gap-1 mb-2">
                                    <button
                                        className="group/new-chat text-base pl-3 pr-3 py-2 flex items-center justify-between hover:bg-sidebar-accent rounded-md flex-1 text-sidebar-muted-foreground hover:text-foreground"
                                        onClick={onNewChatClick}
                                    >
                                        <span className="flex items-center gap-2 ">
                                            <SquarePlusIcon
                                                className="size-4 text-muted-foreground group-hover/new-chat:text-foreground"
                                                strokeWidth={1.5}
                                            />
                                            Start New Chat
                                        </span>
                                        <span className="text-xs hidden group-hover/new-chat:block text-muted-foreground">
                                            ⌘N
                                        </span>
                                    </button>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <button
                                                className="p-2 rounded-md text-muted-foreground/75 hover:text-foreground hover:bg-sidebar-accent transition-colors shrink-0"
                                                onClick={onNewNoteClick}
                                            >
                                                <FileTextIcon
                                                    className="size-4"
                                                    strokeWidth={1.5}
                                                />
                                            </button>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                            New Note
                                        </TooltipContent>
                                    </Tooltip>
                                </div>

                                {/* Search input + sort */}
                                <div className="px-2 mb-2 flex items-center gap-1">
                                    <div className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-sidebar-accent/50 border border-border/50 flex-1">
                                        <SearchIcon className="size-3.5 text-muted-foreground shrink-0" />
                                        <input
                                            type="text"
                                            value={sidebarFilter}
                                            onChange={(e) =>
                                                setSidebarFilter(
                                                    e.target.value,
                                                )
                                            }
                                            onKeyDown={(e) => {
                                                if (
                                                    e.key === "Enter" &&
                                                    sidebarFilter.trim()
                                                ) {
                                                    navigate(
                                                        `/search?q=${encodeURIComponent(sidebarFilter)}`,
                                                    );
                                                }
                                            }}
                                            placeholder="Filter..."
                                            className="bg-transparent border-0 text-sm text-foreground placeholder:text-muted-foreground focus:outline-hidden w-full"
                                        />
                                        {sidebarFilter && (
                                            <button
                                                className="text-muted-foreground hover:text-foreground"
                                                onClick={() =>
                                                    setSidebarFilter("")
                                                }
                                            >
                                                <span className="text-xs">
                                                    ✕
                                                </span>
                                            </button>
                                        )}
                                    </div>
                                    <DropdownMenu>
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <DropdownMenuTrigger asChild>
                                                    <button className="p-1.5 rounded-md text-muted-foreground/75 hover:text-foreground hover:bg-sidebar-accent/50 transition-colors shrink-0">
                                                        <ArrowUpDownIcon
                                                            className="size-3.5"
                                                            strokeWidth={
                                                                1.5
                                                            }
                                                        />
                                                    </button>
                                                </DropdownMenuTrigger>
                                            </TooltipTrigger>
                                            <TooltipContent side="bottom">
                                                Sort
                                            </TooltipContent>
                                        </Tooltip>
                                        <DropdownMenuContent align="end">
                                            {(
                                                [
                                                    {
                                                        value: "date",
                                                        label: "Date",
                                                    },
                                                    {
                                                        value: "name",
                                                        label: "Name",
                                                    },
                                                    {
                                                        value: "type",
                                                        label: "Type",
                                                    },
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
                                                    {sortMode ===
                                                        option.value && (
                                                        <CheckIcon className="size-3.5 ml-2" />
                                                    )}
                                                </DropdownMenuItem>
                                            ))}
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>

                                {/* Collections section */}
                                {hasNonQuickItems && (
                                    <>
                                        <div className="pt-2 flex items-center justify-between group/projects">
                                            <div className="sidebar-label flex w-full items-center gap-2 px-3 text-muted-foreground">
                                                Collections
                                            </div>
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    {projectsToDisplay.length && (
                                                        <button
                                                            className="text-muted-foreground hover:text-foreground p-1 pr-3 rounded"
                                                            onClick={() =>
                                                                createProject.mutate()
                                                            }
                                                        >
                                                            <FolderPlusIcon
                                                                className="size-3.5"
                                                                strokeWidth={
                                                                    1.5
                                                                }
                                                            />
                                                        </button>
                                                    )}
                                                </TooltipTrigger>
                                                <TooltipContent>
                                                    New Collection
                                                </TooltipContent>
                                            </Tooltip>
                                        </div>
                                        <div className="flex flex-col">
                                            {projectsToDisplay.length ? (
                                                projectsToDisplay.map(
                                                    (project) => (
                                                        <Droppable
                                                            id={project.id}
                                                            key={project.id}
                                                        >
                                                            <Project
                                                                projectId={
                                                                    project.id
                                                                }
                                                            />
                                                        </Droppable>
                                                    ),
                                                )
                                            ) : (
                                                <EmptyProjectState />
                                            )}
                                        </div>
                                    </>
                                )}
                                {/* Spacer */}
                                <div className="h-3" />

                                <Droppable id="default">
                                    {/* Grouped items (chats + notes) */}
                                    {groupedItems.some(
                                        (g) => g.items.length > 0,
                                    ) ? (
                                        groupedItems.map(
                                            ({
                                                label,
                                                items: groupItems,
                                            }) => (
                                                <div
                                                    key={label || "all"}
                                                    className="pb-3"
                                                >
                                                    {label && (
                                                        <div className="px-3 mb-1 sidebar-label flex items-center gap-2 text-muted-foreground">
                                                            {label}
                                                        </div>
                                                    )}
                                                    {groupItems.map((item) =>
                                                        item.type ===
                                                        "chat" ? (
                                                            <ChatListItem
                                                                key={
                                                                    item.data
                                                                        .id +
                                                                    "-sidebar"
                                                                }
                                                                chat={
                                                                    item.data
                                                                }
                                                                isActive={
                                                                    currentChatId ===
                                                                    item.data.id
                                                                }
                                                            />
                                                        ) : (
                                                            <NoteListItem
                                                                key={
                                                                    item.data
                                                                        .id +
                                                                    "-sidebar"
                                                                }
                                                                note={
                                                                    item.data
                                                                }
                                                                isActive={
                                                                    currentNoteId ===
                                                                    item.data.id
                                                                }
                                                            />
                                                        ),
                                                    )}
                                                </div>
                                            ),
                                        )
                                    ) : (
                                        <EmptyChatState />
                                    )}
                                    {defaultItems.length >
                                        NUM_DEFAULT_CHATS_TO_SHOW_BY_DEFAULT &&
                                        !showAllItems && (
                                            <SidebarMenuItem className="w-full">
                                                <SidebarMenuButton
                                                    onClick={() =>
                                                        setShowAllItems(true)
                                                    }
                                                >
                                                    <EllipsisIcon className="size-4 text-muted-foreground" />
                                                    <span className="text-base text-muted-foreground">
                                                        Show More
                                                    </span>
                                                </SidebarMenuButton>
                                            </SidebarMenuItem>
                                        )}
                                </Droppable>
                            </SidebarMenu>
                        </SidebarGroupContent>
                    </SidebarGroup>
                    {/* gradient overlay */}
                    <div className="absolute bottom-0 left-0 w-full h-24 bg-linear-to-t from-sidebar via-sidebar to-transparent pointer-events-none" />
                </div>
            </DndContext>

            {/* Ambient chats positioned fixed relative to the sidebar */}
            <QuickChats chats={quickChats} />
        </SidebarContent>
    );
}

function QuickChats({ chats }: { chats: Chat[] }) {
    const navigate = useNavigate();
    const settings = useSettings();
    const [isAmbientOpen, setIsAmbientOpen] = useState(false);
    const convertQuickChatToRegularChat =
        ChatAPI.useConvertQuickChatToRegularChat();

    const handleQuickChatConversion = async (
        e: React.MouseEvent,
        chat: Chat,
    ) => {
        e.preventDefault();
        await convertQuickChatToRegularChat.mutateAsync({
            chatId: chat.id,
        });
        navigate(`/chat/${chat.id}`);
    };

    return (
        <div className="relative bg-sidebar z-10">
            {/* Ambient chats collapsible panel */}
            <Collapsible
                open={isAmbientOpen}
                onOpenChange={setIsAmbientOpen}
            >
                <CollapsibleContent className="max-h-[400px] overflow-y-auto no-scrollbar border-t">
                    <div className="px-3 py-2 flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">
                            Ambient Chats
                        </span>
                        <CollapsibleTrigger asChild>
                            <button className="text-muted-foreground/75 hover:text-foreground p-1 rounded-full">
                                <ChevronDownIcon
                                    className="w-4 h-4"
                                    strokeWidth={1.5}
                                />
                            </button>
                        </CollapsibleTrigger>
                    </div>
                    <SidebarGroup className="min-h-0 pt-0">
                        <SidebarGroupContent>
                            {chats.map((chat) => (
                                <SidebarMenuItem key={chat.id}>
                                    <SidebarMenuButton
                                        onClick={(e) =>
                                            void handleQuickChatConversion(
                                                e,
                                                chat,
                                            )
                                        }
                                        className="text-sidebar-accent-foreground truncate group/chat-button flex justify-between"
                                    >
                                        <span className="truncate pr-3 text-sm">
                                            {chat.title || "Untitled Chat"}
                                        </span>
                                    </SidebarMenuButton>
                                </SidebarMenuItem>
                            ))}
                        </SidebarGroupContent>
                    </SidebarGroup>
                    {!chats.length && (
                        <div className="px-3 py-2 text-sm text-muted-foreground">
                            Start an Ambient Chat with{" "}
                            <span className="text-sm">
                                {settings?.quickChat?.shortcut || "⌥Space"}
                            </span>
                        </div>
                    )}
                </CollapsibleContent>
            </Collapsible>

            {/* Footer icon row */}
            <div className="flex items-center justify-center gap-1 py-2 px-2 border-t">
                <Tooltip>
                    <TooltipTrigger asChild>
                        <button
                            onClick={() => setIsAmbientOpen((prev) => !prev)}
                            className={`p-2 rounded-md transition-colors ${
                                isAmbientOpen
                                    ? "text-foreground bg-muted"
                                    : "text-muted-foreground/75 hover:text-foreground hover:bg-muted/50"
                            }`}
                        >
                            <ArchiveIcon
                                className="w-4 h-4"
                                strokeWidth={1.5}
                            />
                        </button>
                    </TooltipTrigger>
                    <TooltipContent side="top">
                        Ambient Chats
                    </TooltipContent>
                </Tooltip>

                <Tooltip>
                    <TooltipTrigger asChild>
                        <button
                            onClick={() => {
                                toast("Graph — coming soon");
                            }}
                            className="p-2 rounded-md text-muted-foreground/75 hover:text-foreground hover:bg-muted/50 transition-colors"
                        >
                            <NetworkIcon
                                className="w-4 h-4"
                                strokeWidth={1.5}
                            />
                        </button>
                    </TooltipTrigger>
                    <TooltipContent side="top">Graph</TooltipContent>
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
                    <TooltipContent side="top">
                        Settings <kbd>⌘,</kbd>
                    </TooltipContent>
                </Tooltip>
            </div>
        </div>
    );
}

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
        <div
            key={note.id + "-sidebar"}
            className={deleteNote.isPending ? "opacity-50" : ""}
        >
            <Draggable id={note.id}>
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
                    <DialogFooter className="">
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

const deleteChatDialogId = (chatId: string) => `delete-chat-dialog-${chatId}`;

function ChatListItem({ chat, isActive }: { chat: Chat; isActive: boolean }) {
    const isDeleteChatDialogOpen = useDialogStore(
        (state) => state.activeDialogId === deleteChatDialogId(chat.id),
    );
    const deleteConfirmButtonRef = useRef<HTMLButtonElement>(null);
    const [isEditingTitle, setIsEditingTitle] = useState(false);
    const settings = useSettings();

    // no good very bad, but unfortunately necessary -- see https://github.com/remix-run/react-router/issues/7634#issuecomment-2184999343
    const navigate = useRef(useNavigate());

    const { mutateAsync: renameChatMutateAsync } = ChatAPI.useRenameChat();
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
        await deleteChatMutateAsync({
            chatId: chat.id,
        });
        dialogActions.closeDialog();

        toast(`'${chatTitle}' deleted`);
    }, [chat.id, chat.title, deleteChatMutateAsync]);

    // Handle keyboard navigation in delete dialog
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

    // Focus the confirm button when dialog opens
    useEffect(() => {
        if (isDeleteChatDialogOpen && deleteConfirmButtonRef.current) {
            setTimeout(() => {
                deleteConfirmButtonRef.current?.focus();
            }, 50);
        }
    }, [isDeleteChatDialogOpen, chat.id]);

    const handleStartEdit = useCallback(() => {
        setIsEditingTitle(true);
    }, [setIsEditingTitle]);

    const handleStopEdit = useCallback(() => {
        setIsEditingTitle(false);
    }, [setIsEditingTitle]);

    const handleSubmitEdit = useCallback(
        async (newTitle: string) => {
            await renameChatMutateAsync({
                chatId: chat.id,
                newTitle,
            });
            setIsEditingTitle(false);
        },
        [chat.id, renameChatMutateAsync],
    );
    const showCost = settings?.showCost ?? false;

    const handleFindSimilar = useCallback(() => {
        window.dispatchEvent(
            new CustomEvent("find-similar-chats", {
                detail: { chatId: chat.id },
            }),
        );
        dialogActions.openDialog(SIMILAR_CHATS_DIALOG_ID);
    }, [chat.id]);

    return (
        <ChatListItemView
            chatId={chat.id}
            chatTitle={chat.title || ""}
            isNewChat={chat.isNewChat}
            parentChatId={parentChat?.id ?? null}
            parentChatTitle={parentChat?.title || null}
            branchCount={branchCount}
            isActive={isActive}
            isEditingTitle={isEditingTitle}
            onStartEdit={handleStartEdit}
            onStopEdit={handleStopEdit}
            onSubmitEdit={handleSubmitEdit}
            onDelete={handleOpenDeleteDialog}
            onFindSimilar={handleFindSimilar}
            onConfirmDelete={handleConfirmDelete}
            deleteIsPending={deleteChatIsPending}
            navigate={navigate}
            deleteConfirmButtonRef={deleteConfirmButtonRef}
            chatCost={chat.totalCostUsd}
            showCost={showCost}
        />
    );
}

type ChatListItemViewProps = {
    chatId: string;
    chatTitle: string;
    isNewChat: boolean;
    parentChatId: string | null;
    parentChatTitle: string | null;
    branchCount: number;
    isActive: boolean;
    isEditingTitle: boolean;
    onStartEdit: () => void;
    onStopEdit: () => void;
    onSubmitEdit: (newTitle: string) => Promise<void>;
    onDelete: () => void;
    onFindSimilar: () => void;
    onConfirmDelete: () => void;
    deleteIsPending: boolean;
    navigate: MutableRefObject<NavigateFunction>;
    deleteConfirmButtonRef: MutableRefObject<HTMLButtonElement | null>;
    chatCost?: number;
    showCost: boolean;
};

const ChatListItemView = React.memo(
    ({
        chatId,
        chatTitle,
        isNewChat,
        parentChatId,
        parentChatTitle,
        branchCount,
        isActive,
        isEditingTitle,
        onStartEdit,
        onStopEdit,
        onSubmitEdit,
        onDelete,
        onFindSimilar,
        onConfirmDelete,
        deleteIsPending,
        navigate,
        deleteConfirmButtonRef,
        chatCost,
        showCost,
    }: ChatListItemViewProps) => {
        return (
            <div
                key={chatId + "-sidebar"}
                className={[
                    deleteIsPending ? "opacity-50" : "",
                    // chat.projectContextSummaryIsStale
                    //     ? "border border-red-500!"
                    //     : "", // for debugging
                ].join(" ")}
            >
                <Draggable id={chatId}>
                    <SidebarMenuButton
                        asChild={false}
                        data-active={isActive}
                        onClick={() => {
                            navigate.current(`/chat/${chatId}`);
                        }}
                        className="data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-accent-foreground text-sidebar-foreground truncate group/chat-button flex justify-between mb-0.5 font-[350] relative"
                    >
                        <div
                            className={`truncate flex items-center text-base w-full ${isNewChat ? "text-muted-foreground" : ""}`}
                        >
                            {parentChatId && (
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <div
                                            className="hover:text-foreground group/parent-chat-button mr-2 shrink-0"
                                            onClick={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                navigate.current(
                                                    `/chat/${parentChatId}`,
                                                );
                                            }}
                                        >
                                            <span className="shrink-0">
                                                <SplitOptimized className="w-3 h-3 mr-2 text-muted-foreground group-hover/parent-chat-button:text-accent-500" />
                                            </span>
                                        </div>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        Branched from:{" "}
                                        {parentChatTitle || "Untitled Chat"}
                                    </TooltipContent>
                                </Tooltip>
                            )}
                            <EditableTitle
                                title={chatTitle || ""}
                                onUpdate={async (newTitle) => {
                                    await onSubmitEdit(newTitle);
                                }}
                                className="flex-1 truncate"
                                editClassName={`h-auto text-base px-0 py-0 ${isActive ? "bg-sidebar-accent" : ""} group-hover/chat-button:bg-sidebar-accent border-0 focus:ring-0 focus:outline-hidden shadow-none`}
                                placeholder="Untitled Chat"
                                showEditIcon={false}
                                clickToEdit={false}
                                isEditing={isEditingTitle}
                                onStartEdit={onStartEdit}
                                onStopEdit={onStopEdit}
                            />
                            <ChatLoadingIndicator chatId={chatId} />
                            {showCost &&
                                chatCost !== undefined &&
                                chatCost > 0 && (
                                    <span className="ml-auto pl-2 text-xs text-muted-foreground shrink-0">
                                        {formatCost(chatCost)}
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

                        {/* Gradient overlay that appears when hovering */}
                        <div className="absolute right-0 w-20 h-full opacity-0 group-hover/chat-button:opacity-100 transition-opacity bg-linear-to-l from-sidebar-accent via-sidebar-accent to-transparent pointer-events-none" />

                        {/* chat actions */}
                        <div className="flex items-center gap-2 absolute right-3 z-10">
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <PencilOptimized
                                        className="h-[13px] w-[13px] opacity-0 group-hover/chat-button:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
                                        onClick={(e: React.MouseEvent) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            onStartEdit();
                                        }}
                                    />
                                </TooltipTrigger>
                                <TooltipContent side="bottom">
                                    Rename chat
                                </TooltipContent>
                            </Tooltip>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <div
                                        onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            onFindSimilar();
                                        }}
                                    >
                                        <SparklesIcon className="h-[13px] w-[13px] opacity-0 group-hover/chat-button:opacity-100 transition-opacity text-muted-foreground hover:text-foreground" />
                                    </div>
                                </TooltipTrigger>
                                <TooltipContent side="bottom">
                                    Find similar
                                </TooltipContent>
                            </Tooltip>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <div onClick={onDelete}>
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
                <Dialog id={deleteChatDialogId(chatId)}>
                    <DialogContent className="sm:max-w-md p-5">
                        <DialogHeader>
                            <DialogTitle>
                                Delete &ldquo;
                                {chatTitle || "Untitled Chat"}&rdquo;
                            </DialogTitle>
                            <DialogDescription>
                                Are you sure you want to delete this chat? This
                                action cannot be undone.
                            </DialogDescription>
                        </DialogHeader>
                        <DialogFooter className="">
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => dialogActions.closeDialog()}
                                // for some reason tabIndex=2 or =0 isn't working
                                // so I'm using -1 to ensure the Delete button gets focus
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
                                onClick={onConfirmDelete}
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
    },
);

const ChatLoadingIndicator = React.memo(({ chatId }: { chatId: string }) => {
    const chatIsLoading =
        useQuery(ChatAPI.chatIsLoadingQueries.detail(chatId)).data ?? false;
    return chatIsLoading ? <RetroSpinner className="ml-2" /> : null;
});

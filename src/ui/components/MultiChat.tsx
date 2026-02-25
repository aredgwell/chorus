import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import React from "react";
import {
    useParams,
    useNavigate,
    useLocation,
    useSearchParams,
} from "react-router-dom";
import { toast } from "sonner";
import { Button } from "./ui/button";
import {
    FileTextIcon,
    ExternalLinkIcon,
    PictureInPicture2Icon,
    ShareIcon,
    CircleAlertIcon,
    SplitIcon,
    SquarePen,
    Loader2,
    SearchIcon,
    DownloadIcon,
    Trash2Icon,
} from "lucide-react";
import { useAppContext } from "@ui/hooks/useAppContext";
import { CopyIcon, CheckIcon, XIcon } from "lucide-react";
import { TooltipContent } from "./ui/tooltip";
import { Tooltip } from "./ui/tooltip";
import { TooltipTrigger } from "./ui/tooltip";
import { VirtualizedMessageSet } from "./VirtualizedMessageSet";
import { invoke } from "@tauri-apps/api/core";
import { QuickChatModelSelector } from "./QuickChatModelSelector";
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
import { catchAsyncErrors } from "@core/chorus/utilities";
import {
    exportChatAsMarkdown,
    exportChatAsJSON,
} from "@core/chorus/ExportService";
import GroupChat from "./GroupChat";
import { MouseTrackingEye, MouseTrackingEyeRef } from "./MouseTrackingEye";
import { MessageSetDetail } from "@core/chorus/ChatState";
import { useShareChat } from "@ui/hooks/useShareChat";
import { Skeleton } from "./ui/skeleton";
import { ChatInput } from "./ChatInput";
import { useWaitForAppMetadata } from "@ui/hooks/useWaitForAppMetadata";
import { SUMMARY_DIALOG_ID, SummaryDialog } from "./SummaryDialog";
import { FindInPage } from "./FindInPage";
import { HeaderBar } from "./HeaderBar";
import { useShortcut } from "@ui/hooks/useShortcut";
import { useQuery } from "@tanstack/react-query";
import RepliesDrawer from "./RepliesDrawer";
import { checkScreenRecordingPermission } from "tauri-plugin-macos-permissions-api";
import { dialogActions } from "@core/infra/DialogStore";
import { MoveToProjectDropdown } from "./MoveToProjectDropdown";
import {
    ResizablePanelGroup,
    ResizablePanel,
    ResizableHandle,
} from "@ui/components/ui/resizable";
import { writeTextFile } from "@tauri-apps/plugin-fs";
import { save } from "@tauri-apps/plugin-dialog";
import * as MessageAPI from "@core/chorus/api/MessageAPI";
import * as ChatAPI from "@core/chorus/api/ChatAPI";
import * as ProjectAPI from "@core/chorus/api/ProjectAPI";
import * as ModelsAPI from "@core/chorus/api/ModelsAPI";
import * as AppMetadataAPI from "@core/chorus/api/AppMetadataAPI";
import { ProjectSwitcher, MessageSetView } from "./ChatMessageViews";

// Re-export sub-components that other files (e.g. ReplyChat.tsx) import from MultiChat
export { UserMessageView, ToolsMessageView } from "./ChatMessageViews";

// ----------------------------------
// Main Component
// ----------------------------------

function ModelSelectorWrapper() {
    const modelConfigsQuery = ModelsAPI.useModelConfigs();
    const updateSelectedModelConfigQuickChat =
        MessageAPI.useUpdateSelectedModelConfigQuickChat();

    const handleModelSelect = useCallback(
        (modelId: string) => {
            console.log("ModelSelector: selecting model", modelId);
            const modelConfig = modelConfigsQuery.data?.find(
                (m) => m.id === modelId,
            );
            if (modelConfig) {
                updateSelectedModelConfigQuickChat.mutate({
                    modelConfig,
                });
            }
        },
        [modelConfigsQuery, updateSelectedModelConfigQuickChat],
    );

    return <QuickChatModelSelector onModelSelect={handleModelSelect} />;
}

// Module-level scroll position cache: saves scroll position per chat
// so it can be restored when switching back to a previously viewed chat.
const scrollPositionCache = new Map<string, number>();
let previousChatId: string | undefined;

export const SHARE_CHAT_DIALOG_ID = "share-chat-dialog";

export default function MultiChat() {
    const { chatId } = useParams();
    const chatQuery = ChatAPI.useChat(chatId!);
    const navigate = useNavigate();
    const location = useLocation();
    const appMetadata = useWaitForAppMetadata();
    const messageSetsQuery = MessageAPI.useMessageSets(chatId!);
    const [searchParams] = useSearchParams();

    // Extract replyId from query parameters
    const replyChatId = searchParams.get("replyId");

    // Check if forward navigation is available using React Router's internal state
    const canGoForward = useMemo(() => {
        const { state } = window.history as { state: { idx: number } };
        return state && state.idx < window.history.length - 1;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [location]); // Re-evaluate when location changes

    const { isQuickChatWindow } = useAppContext();

    const createQuickChat = ChatAPI.useGetOrCreateNewQuickChat();
    const projectsQuery = useQuery(ProjectAPI.projectQueries.list());
    const setChatProject = ProjectAPI.useSetChatProject();
    const createProject = ProjectAPI.useCreateProject();

    const regenerateProjectContextSummaries =
        ProjectAPI.useRegenerateProjectContextSummaries();

    // UI stuff

    const inputRef = useRef<HTMLTextAreaElement>(null);
    const chatContainerRef = useRef<HTMLDivElement>(null);

    // Scroll-to-bottom handling
    const [showScrollButton, setShowScrollButton] = useState(false);

    const handleScrollToBottom = useCallback(
        (smooth = true) => {
            const container = chatContainerRef.current;
            if (container) {
                container.scrollTo({
                    top: container.scrollHeight,
                    behavior: smooth ? "smooth" : "instant",
                });
            }
        },
        [chatContainerRef],
    );
    const lastMessageSetRef = useRef<HTMLDivElement>(null);

    // Replies drawer state - controlled by replyId query parameter
    const repliesDrawerOpen = !!replyChatId;
    const setRepliesDrawerOpen = useCallback(
        (open: boolean) => {
            if (!open) {
                // Remove replyId from URL when closing
                const newSearchParams = new URLSearchParams(location.search);
                newSearchParams.delete("replyId");
                const newSearch = newSearchParams.toString();
                navigate(`/chat/${chatId}${newSearch ? `?${newSearch}` : ""}`, {
                    replace: true,
                });
            }
        },
        [navigate, chatId, location.search],
    );

    const currentMessageSet =
        messageSetsQuery.data && messageSetsQuery.data.length > 0
            ? messageSetsQuery.data[messageSetsQuery.data.length - 1]
            : undefined;
    const currentCompareBlock =
        currentMessageSet?.selectedBlockType === "compare"
            ? currentMessageSet.compareBlock
            : undefined;

    // ----------------------
    // Effects
    // ----------------------

    const prevChatId = useRef<string | undefined>(undefined);
    useEffect(() => {
        if (prevChatId.current !== chatId) {
            prevChatId.current = chatId;
            void regenerateProjectContextSummaries.mutateAsync({
                chatId: chatId!,
            });
        }
    }, [chatId, regenerateProjectContextSummaries]);

    useEffect(() => {
        if (!chatId) {
            console.error("no chatId, navigating home");
            navigate("/");
        } else if (chatQuery.isError) {
            console.warn(
                "error fetching chat. this is expected if the chat was deleted. navigating home.",
                chatQuery.error,
            );
            navigate("/");
        } else if (
            isQuickChatWindow &&
            chatQuery.data &&
            !chatQuery.data.quickChat
        ) {
            console.warn(
                `tried to open non-quick chat ${chatQuery.data?.id} in quick chat window. may be because chat got converted.`,
            );
            navigate("/");
        } else if (
            !isQuickChatWindow &&
            chatQuery.data &&
            chatQuery.data.quickChat
        ) {
            console.error(
                `tried to open quick chat ${chatQuery.data?.id} in non-quick chat window`,
            );
            navigate("/");
        }
    }, [chatQuery, isQuickChatWindow, navigate, chatId]);

    const [windowIsFocused, setWindowIsFocused] = useState(true);
    useEffect(() => {
        const handleFocus = () => {
            setWindowIsFocused(true);
        };
        const handleBlur = () => {
            setWindowIsFocused(false);
        };

        window.addEventListener("focus", handleFocus);
        window.addEventListener("blur", handleBlur);

        return () => {
            window.removeEventListener("focus", handleFocus);
            window.removeEventListener("blur-sm", handleBlur);
        };
    }, []);

    const closeQuickChat = () => {
        void invoke("hide");
    };

    const handleOpenQuickChatInMainWindow = useCallback(async () => {
        void invoke("open_in_main_window", { chatId });
        // hide this window
        void invoke("hide");
        // create a new quick chat to show instead
        await createQuickChat.mutateAsync();
    }, [chatId, createQuickChat]);

    const setVisionModeEnabled = AppMetadataAPI.useSetVisionModeEnabled();

    const eyeRef = useRef<MouseTrackingEyeRef>(null);

    const {
        isGeneratingShareLink,
        shareUrl,
        copiedUrl,
        doShareChat,
        handleCopyShareUrl,
        handleOpenShareUrl,
        handleDeleteShare,
        setShareUrl,
    } = useShareChat(chatId!);

    // Share dialog shortcuts
    useShortcut(
        ["enter"],
        () => {
            if (shareUrl) {
                void handleCopyShareUrl();
            }
        },
        {
            enableOnDialogIds: [SHARE_CHAT_DIALOG_ID],
            enableOnChatFocus: false,
        },
    );

    useShortcut(
        ["meta", "enter"],
        () => {
            if (shareUrl) {
                void handleOpenShareUrl();
            }
        },
        {
            enableOnDialogIds: [SHARE_CHAT_DIALOG_ID],
        },
    );

    useShortcut(
        ["escape"],
        () => {
            setShareUrl(null);
        },
        {
            enableOnDialogIds: [SHARE_CHAT_DIALOG_ID],
        },
    );

    const summarizeChat = MessageAPI.useSummarizeChat();
    const [summary, setSummary] = useState<string | null>(null);
    const [isSummarizing, setIsSummarizing] = useState(false);

    useEffect(() => {
        if (!shareUrl) {
            dialogActions.closeDialog();
        } else {
            dialogActions.openDialog(SHARE_CHAT_DIALOG_ID);
        }
    }, [shareUrl]);

    const handleSummarizeChat = useCallback(async () => {
        setIsSummarizing(true);
        const result = await summarizeChat.mutateAsync({
            chatId: chatId!,
            forceRefresh: false,
            source: "user",
        });
        if (result.summary) {
            setSummary(result.summary);
            dialogActions.openDialog(SUMMARY_DIALOG_ID);
        }
        setIsSummarizing(false);
    }, [chatId, summarizeChat]);

    const handleRefreshSummary = useCallback(async () => {
        const result = await summarizeChat.mutateAsync({
            chatId: chatId!,
            forceRefresh: true,
            source: "user",
        });
        if (result.summary) {
            setSummary(result.summary);
        }
    }, [chatId, summarizeChat]);

    const handleShareChat = useCallback(async () => {
        // Get the main chat container's HTML
        const chatContainer = document.querySelector(".max-w-10xl");
        if (!chatContainer) {
            console.error("Chat container not found");
            return;
        }

        await doShareChat(chatContainer.outerHTML);
    }, [doShareChat]);

    const handleExportChat = useCallback(
        async (format: "markdown" | "json") => {
            if (!chatId) return;
            try {
                const extension = format === "markdown" ? "md" : "json";
                const title = chatQuery.data?.title || "chat";
                const safeName = title
                    .replace(/[^a-zA-Z0-9 _-]/g, "")
                    .slice(0, 50);
                const defaultName = `${safeName}.${extension}`;

                const filePath = await save({
                    defaultPath: defaultName,
                    filters: [
                        {
                            name:
                                format === "markdown"
                                    ? "Markdown"
                                    : "JSON",
                            extensions: [extension],
                        },
                    ],
                });

                if (!filePath) return; // user cancelled

                const content =
                    format === "markdown"
                        ? await exportChatAsMarkdown(chatId)
                        : await exportChatAsJSON(chatId);

                await writeTextFile(filePath, content);
                toast.success(`Exported as ${extension.toUpperCase()}`);
            } catch (error) {
                console.error("Export failed:", error);
                toast.error("Export failed", {
                    description:
                        error instanceof Error ? error.message : "Unknown error",
                });
            }
        },
        [chatId, chatQuery.data?.title],
    );

    const selectMessage = MessageAPI.useSelectMessage();
    const selectSynthesis = MessageAPI.useSelectSynthesis();
    const setReviewsEnabled = MessageAPI.useSetReviewsEnabled();
    // const nextTools = API.useNextTools();

    // function handleTabKey(isShiftPressed: boolean) {
    //     if (currentMessageSet?.selectedBlockType === "tools") {
    //         nextTools.mutate({
    //             chatId: chatId!,
    //             messageSetId: currentMessageSet.id,
    //             toolsBlock: currentMessageSet.toolsBlock,
    //             direction: isShiftPressed ? "prev" : "next",
    //         });
    //     }
    // }

    // useShortcut(["tab"], () => handleTabKey(false));
    // useShortcut(["shift", "tab"], () => handleTabKey(true));

    const handleToggleVisionMode = useCallback(async () => {
        const hasPermissions = await checkScreenRecordingPermission();
        const visionModeEnabled = appMetadata["vision_mode_enabled"] === "true";

        if (!visionModeEnabled && !hasPermissions) {
            toast("Screen Recording Permission Required", {
                description:
                    "Chorus needs screen recording permission to enable vision mode.",
                action: {
                    label: "Open Settings",
                    onClick: () => {
                        void invoke("open_screen_recording_settings");
                        void invoke("hide");
                    },
                },
            });
        } else {
            setVisionModeEnabled.mutate(!visionModeEnabled);
        }
    }, [appMetadata, setVisionModeEnabled]);

    // Add keyboard shortcut handler
    useEffect(() => {
        const handleKeyDown = catchAsyncErrors(async (e: KeyboardEvent) => {
            if (e.metaKey && /^[1-8]$/.test(e.key)) {
                // cmd + 1-8: select message at index
                e.preventDefault();
                if (currentMessageSet?.selectedBlockType !== "compare") {
                    console.warn(
                        "skipping cmd+1-8 because we're not in compare mode",
                    );
                    return;
                }
                // Get message at index (1-based)
                const index = parseInt(e.key) - 1;
                if (
                    !currentCompareBlock ||
                    currentCompareBlock.messages.length <= index
                ) {
                    console.warn(
                        `couldn't select message at ${index} from cmd+${index + 1}`,
                    );
                    return;
                }
                const message = currentCompareBlock.messages[index];

                selectMessage.mutate({
                    chatId: chatId!,
                    messageSetId: currentMessageSet.id,
                    messageId: message.id,
                    blockType: "compare",
                });
            } else if (e.metaKey && e.key === "s" && !e.shiftKey) {
                e.preventDefault();
                if (!currentMessageSet) return;
                selectSynthesis.mutate({
                    chatId: chatId!,
                    messageSetId: currentMessageSet.id,
                });
            } else if (e.metaKey && e.shiftKey && e.key.toLowerCase() === "s") {
                e.preventDefault();
                try {
                    await handleShareChat();
                } catch (error) {
                    console.error(
                        "Error generating/copying share link:",
                        error,
                    );
                    toast.error("Error", {
                        description: "Failed to generate or copy share link",
                    });
                }
            } else if (e.metaKey && e.shiftKey && e.key === "r") {
                e.preventDefault();
                setReviewsEnabled.mutate({
                    enabled: appMetadata["reviews_enabled"] !== "true",
                });
            }

            // quick chat shortcuts -- note that rest of shortcuts are handled in AppContext.tsx
            if (isQuickChatWindow && e.metaKey && e.key === "o") {
                e.preventDefault();
                void handleOpenQuickChatInMainWindow();
            }
            if (isQuickChatWindow && e.metaKey && e.key === "i") {
                e.preventDefault();
                await handleToggleVisionMode();
            }
            if (isQuickChatWindow && e.key === "Escape") {
                e.preventDefault();
                void invoke("hide");
            }
        });

        document.addEventListener("keydown", handleKeyDown);
        return () => document.removeEventListener("keydown", handleKeyDown);
    }, [
        chatId,
        currentMessageSet,
        currentCompareBlock,
        isQuickChatWindow,
        handleShareChat,
        handleOpenQuickChatInMainWindow,
        appMetadata,
        selectMessage,
        selectSynthesis,
        setReviewsEnabled,
        setVisionModeEnabled,
        // nextTools,
        handleToggleVisionMode,
    ]);

    const scrollToLatestMessageSet = useCallback(() => {
        // autoscroll on new message
        const container = chatContainerRef.current;
        const lastMessageSet = lastMessageSetRef.current;
        if (container && lastMessageSet) {
            container.scrollTo({
                top: lastMessageSet.offsetTop - 50,
                behavior: "smooth",
            });
        }
    }, [chatContainerRef, lastMessageSetRef]);

    const onNewProject = () => {
        createProject
            .mutateAsync()
            .then((projectId) => {
                setChatProject.mutate({
                    chatId: chatId!,
                    projectId,
                });
            })
            .catch((error) => {
                console.error("Error creating project:", error);
            });
    };

    // Check if this is a group chat
    if (chatQuery.data && chatQuery.data.gcPrototype) {
        return <GroupChat />;
    }

    return (
        <div
            className={`flex flex-col h-screen w-full min-w-0 mx-auto @container group relative
        ${isQuickChatWindow && (windowIsFocused ? "rounded-xl" : "bg-foreground/5 rounded-xl")}`}
        >
            {/* header bar */}
            {isQuickChatWindow ? (
                <div
                    className={`h-10 flex items-center justify-between px-2 rounded-t-xl`}
                    data-tauri-drag-region
                >
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <button
                                className={`p-1 rounded-full`}
                                onClick={closeQuickChat}
                                tabIndex={-1}
                            >
                                <XIcon className="w-3 h-3" />
                            </button>
                        </TooltipTrigger>
                        <TooltipContent>Close (ESC)</TooltipContent>
                    </Tooltip>
                    {isQuickChatWindow && (
                        <div className="text-sm inline-flex ml-2 items-center gap-1">
                            <ModelSelectorWrapper />
                        </div>
                    )}

                    <div className="flex items-center gap-2 ml-auto text-sm font-[350]">
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    className={`bg-transparent text-foreground px-3 rounded-full ${
                                        appMetadata["vision_mode_enabled"] ===
                                        "true"
                                            ? "bg-accent-600 text-primary-foreground"
                                            : "hover:bg-muted-foreground/10"
                                    }
                                        transition-all duration-200`}
                                    size="iconSm"
                                    onClick={() =>
                                        void handleToggleVisionMode()
                                    }
                                    tabIndex={-1}
                                >
                                    <span
                                        className={`hover:text-foreground/75 ${
                                            appMetadata[
                                                "vision_mode_enabled"
                                            ] === "true"
                                                ? "text-foreground/80"
                                                : "text-foreground/75"
                                        }`}
                                    >
                                        <span className="text-sm font-mono">
                                            ⌘I
                                        </span>{" "}
                                        {appMetadata["vision_mode_enabled"] ===
                                            "true" && (
                                            <span className="ml-1">
                                                Vision Mode Enabled
                                            </span>
                                        )}
                                    </span>
                                    <MouseTrackingEye
                                        ref={eyeRef}
                                        canBlink={true}
                                        isOpen={
                                            appMetadata[
                                                "vision_mode_enabled"
                                            ] === "true"
                                        }
                                    />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                                {appMetadata["vision_mode_enabled"] ===
                                "true" ? (
                                    <>Chorus can see your screen</>
                                ) : (
                                    <>
                                        Enable vision mode to show Chorus your
                                        screen
                                    </>
                                )}
                            </TooltipContent>
                        </Tooltip>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    className="bg-transparent text-foreground hover:bg-muted-foreground/10"
                                    size="iconSm"
                                    onClick={() =>
                                        void handleOpenQuickChatInMainWindow()
                                    }
                                    tabIndex={-1}
                                >
                                    <span className="text-[10px] text-foreground/75">
                                        ⌘O
                                    </span>
                                    <PictureInPicture2Icon className="w-3.5! h-3.5!" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>Open in main window</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    size="iconSm"
                                    className="bg-transparent text-foreground hover:bg-muted-foreground/10"
                                    onClick={() => createQuickChat.mutate()}
                                    tabIndex={-1}
                                >
                                    <span className="text-[10px] text-foreground/75">
                                        ⌘N
                                    </span>
                                    <SquarePen className="w-3.5! h-3.5!" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>New ambient chat</TooltipContent>
                        </Tooltip>
                    </div>
                </div>
            ) : (
                <HeaderBar
                    positioning="absolute"
                    canGoForward={canGoForward}
                    actions={
                        <div className="flex items-center gap-1">
                            {!isQuickChatWindow &&
                                messageSetsQuery.data &&
                                messageSetsQuery.data.length > 1 && (
                                    <>
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <Button
                                                    variant="ghost"
                                                    size="iconSm"
                                                    className="px-2 text-accent-foreground hover:text-foreground"
                                                    tabIndex={-1}
                                                    onClick={() => {
                                                        document.dispatchEvent(
                                                            new KeyboardEvent(
                                                                "keydown",
                                                                {
                                                                    key: "f",
                                                                    metaKey: true,
                                                                    bubbles: true,
                                                                },
                                                            ),
                                                        );
                                                    }}
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
                                                    onClick={() =>
                                                        void handleSummarizeChat()
                                                    }
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
                                                    onClick={handleShareChat}
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
                                                            handleExportChat(
                                                                "markdown",
                                                            ),
                                                    )}
                                                >
                                                    Export as Markdown
                                                </DropdownMenuItem>
                                                <DropdownMenuItem
                                                    onClick={catchAsyncErrors(
                                                        () =>
                                                            handleExportChat(
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
                            {!isQuickChatWindow && projectsQuery.data && (
                                <MoveToProjectDropdown
                                    chatId={chatId!}
                                    currentProjectId={
                                        chatQuery.data?.projectId
                                    }
                                    projects={projectsQuery.data}
                                    onMoveToProject={(chatId, projectId) =>
                                        setChatProject.mutate({
                                            chatId,
                                            projectId,
                                        })
                                    }
                                    onNewProject={onNewProject}
                                />
                            )}
                        </div>
                    }
                >
                    <ProjectSwitcher />
                </HeaderBar>
            )}

            {/* Main container that handles both layouts */}
            <div className="flex-1 min-h-0 relative">
                {/* Desktop layout - always render but conditionally show panels */}
                <div
                    className={`h-full ${repliesDrawerOpen ? "hidden @2xl:block" : "block"}`}
                >
                    <ResizablePanelGroup
                        autoSaveId="main-chat-layout-45er4"
                        direction="horizontal"
                        className="h-full"
                    >
                        <ResizablePanel
                            defaultSize={repliesDrawerOpen ? 70 : 100}
                        >
                            <div className="relative flex-1 min-h-0 overflow-hidden h-full">
                                <MainScrollableContentView
                                    chatContainerRef={chatContainerRef}
                                    lastMessageSetRef={lastMessageSetRef}
                                    inputRef={inputRef}
                                    setShowScrollButton={setShowScrollButton}
                                    handleScrollToBottom={handleScrollToBottom}
                                />
                                <ChatInput
                                    isNewChat={chatQuery.data?.isNewChat}
                                    chatId={chatId!}
                                    inputRef={inputRef}
                                    eyeRef={eyeRef}
                                    currentMessageSet={currentMessageSet}
                                    scrollToLatestMessageSet={
                                        scrollToLatestMessageSet
                                    }
                                    showScrollButton={showScrollButton}
                                    handleScrollToBottom={handleScrollToBottom}
                                />
                            </div>
                        </ResizablePanel>
                        {repliesDrawerOpen && (
                            <>
                                <ResizableHandle className="shadow-lg" />
                                <ResizablePanel
                                    defaultSize={30}
                                    minSize={25}
                                    maxSize={50}
                                    className="shadow-lg mr-1"
                                >
                                    <RepliesDrawer
                                        onOpenChange={setRepliesDrawerOpen}
                                        replyChatId={replyChatId}
                                    />
                                </ResizablePanel>
                            </>
                        )}
                    </ResizablePanelGroup>
                </div>

                {/* Mobile overlay - only render when drawer is open */}
                {repliesDrawerOpen && (
                    <div className="@2xl:hidden h-full">
                        <div className="absolute inset-0 z-50 bg-background">
                            <RepliesDrawer
                                onOpenChange={setRepliesDrawerOpen}
                                replyChatId={replyChatId}
                            />
                        </div>
                    </div>
                )}
            </div>

            <Dialog
                id={SHARE_CHAT_DIALOG_ID}
                onOpenChange={(open) => !open && setShareUrl(null)}
            >
                <DialogContent className="p-5">
                    <DialogHeader>
                        <DialogTitle>Share Chat</DialogTitle>
                        <DialogDescription className="space-y-4">
                            <div className="flex items-center gap-2 mt-2">
                                <CircleAlertIcon className="h-4 w-4 shrink-0" />
                                <p className="text-sm">
                                    Anyone with this link can view your chat.
                                </p>
                            </div>
                            <button
                                onClick={() => void handleCopyShareUrl()}
                                className="text-left focus:outline-hidden border text-sm hover:bg-muted/50 rounded-md p-2 w-full"
                                autoFocus
                            >
                                <code>{shareUrl}</code>
                            </button>
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="flex-col gap-2 sm:flex-row">
                        <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => void handleDeleteShare()}
                            className="sm:mr-auto"
                        >
                            <Trash2Icon className="w-4 h-4" />
                            Delete Link
                        </Button>
                        <div className="flex gap-2 w-full sm:w-auto">
                            <Button
                                size="sm"
                                onClick={() => void handleCopyShareUrl()}
                                className="flex-1 sm:flex-initial"
                            >
                                {copiedUrl ? (
                                    <CheckIcon className="w-4 h-4 text-green-500" />
                                ) : (
                                    <CopyIcon className="w-4 h-4" />
                                )}
                                <span className="ml-1">
                                    {copiedUrl ? "Copied" : "Copy"}
                                </span>
                                <span className="ml-1 text-sm">↵</span>
                            </Button>
                            <Button
                                size="sm"
                                onClick={() => void handleOpenShareUrl()}
                                className="flex-1 sm:flex-initial"
                            >
                                <ExternalLinkIcon className="w-4 h-4" />
                                <span className="ml-1">Open</span>
                                <span className="ml-1 text-sm">⌘↵</span>
                            </Button>
                        </div>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <SummaryDialog
                summary={summary || ""}
                title={chatQuery.data?.title || ""}
                date={chatQuery.data?.createdAt || ""}
                onRefresh={handleRefreshSummary}
            />

            {/* Find in page UI */}
            <FindInPage dependencies={[messageSetsQuery.data]} />
        </div>
    );
}

function ChatMessageSkeleton() {
    const { isQuickChatWindow } = useAppContext();
    if (isQuickChatWindow) {
        return null;
    }
    return (
        <div className="space-y-5 max-w-10xl mx-auto mt-10">
            {/* Skeleton for user message */}
            <div className="ml-12 max-w-prose">
                <div className="bg-message-background inline-block px-5 py-3 rounded">
                    <div className="space-y-2">
                        <Skeleton className="h-4 w-[80%]" />
                    </div>
                </div>
            </div>

            {/* Skeleton for AI message */}
            <div className="ml-12 flex w-full">
                <div className="mr-2 pt-2 w-full max-w-prose">
                    <div className="relative rounded-md border-[0.090rem] p-4">
                        <div className="absolute -top-4 left-0 right-0 flex items-center justify-between">
                            <div className="ml-2 px-2.5 mt-1 bg-background">
                                <Skeleton className="h-3 w-24" />
                            </div>
                        </div>
                        <div className="space-y-3">
                            <Skeleton className="h-4 w-full" />
                            <Skeleton className="h-4 w-[90%]" />
                            <Skeleton className="h-4 w-[85%]" />
                            <Skeleton className="h-4 w-[80%]" />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function MainScrollableContentView({
    chatContainerRef,
    lastMessageSetRef,
    inputRef, // used for spacing
    setShowScrollButton,
    handleScrollToBottom,
}: {
    chatContainerRef: React.RefObject<HTMLDivElement | null>;
    lastMessageSetRef: React.RefObject<HTMLDivElement | null>;
    inputRef: React.RefObject<HTMLTextAreaElement | null>;
    setShowScrollButton: (show: boolean) => void;
    handleScrollToBottom: (smooth?: boolean) => void;
}) {
    const appMetadata = useWaitForAppMetadata();
    const { chatId } = useParams();
    const { isQuickChatWindow } = useAppContext();
    const navigate = useNavigate();

    const chatQuery = ChatAPI.useChat(chatId!);
    const parentChatId = chatQuery.data?.parentChatId;
    const parentChatQuery = useQuery({
        ...ChatAPI.chatQueries.detail(parentChatId ?? ""),
        enabled: !!parentChatId,
    });

    const messageSetsQuery = MessageAPI.useMessageSets(chatId!);

    const manageScrollBottomButton = useCallback(() => {
        const container = chatContainerRef.current;
        if (!container) return;

        const { scrollTop, scrollHeight, clientHeight } = container;
        // Show button if we're more than 400px from the bottom
        setShowScrollButton(scrollHeight - scrollTop - clientHeight > 400);
    }, [chatContainerRef, setShowScrollButton]);

    useEffect(() => {
        const container = chatContainerRef.current;
        if (!container) return;

        // Check initial position
        manageScrollBottomButton();

        // Add scroll listener
        container.addEventListener("scroll", manageScrollBottomButton);
        return () =>
            container.removeEventListener("scroll", manageScrollBottomButton);
    }, [
        manageScrollBottomButton,
        chatContainerRef,
        messageSetsQuery.isSuccess, // when messageSetsQuery.isSucess becomes true, chatContainerRef.current will be set
    ]);

    // Check scroll position when messages change
    useEffect(() => {
        manageScrollBottomButton();
    }, [messageSetsQuery.data, manageScrollBottomButton]);

    // Save scroll position when leaving a chat, restore when entering
    useEffect(() => {
        // Save previous chat's scroll position
        if (previousChatId && previousChatId !== chatId) {
            const container = chatContainerRef.current;
            if (container) {
                scrollPositionCache.set(previousChatId, container.scrollTop);
            }
        }
        previousChatId = chatId;

        // Restore saved position or scroll to bottom for the new chat
        // using hacky timeout because requestAnimationFrame isn't working for unknown reasons
        setTimeout(() => {
            const container = chatContainerRef.current;
            if (!container) return;

            const savedPosition = chatId
                ? scrollPositionCache.get(chatId)
                : undefined;
            if (savedPosition !== undefined) {
                container.scrollTo({ top: savedPosition, behavior: "instant" });
            } else {
                handleScrollToBottom(false);
            }
        }, 50);
    }, [chatId, messageSetsQuery.isSuccess, handleScrollToBottom, chatContainerRef]);

    // --------------------------------------------------------------------------
    // Spacers
    // --------------------------------------------------------------------------
    // - spacer height is proportional to the input height
    //   so that when you add a lot of text to the input,
    //   you can still scroll down far enough to read last message
    // - we use requestAnimationFrame to make sure input height has updated

    const updateSpacerHeight = useCallback(() => {
        requestAnimationFrame(() => {
            if (isQuickChatWindow) {
                // set margin bottom on chat container, which acts as the qc spacer
                if (chatContainerRef.current) {
                    chatContainerRef.current.style.marginBottom =
                        (inputRef.current?.clientHeight ?? 0) + 10 + "px";
                }
            } else {
                // non-qc spacer
                if (nonQcSpacerRef.current) {
                    nonQcSpacerRef.current.style.height =
                        (inputRef.current?.clientHeight ?? 0) + 50 + "px";
                }
            }
        });
    }, [inputRef, isQuickChatWindow, chatContainerRef]);

    const nonQcSpacerRef = useRef<HTMLDivElement>(null);

    // set height of the chat spacer on input change
    useEffect(() => {
        const input = inputRef.current;
        if (input) {
            input.addEventListener("input", updateSpacerHeight);
            return () => {
                input.removeEventListener("input", updateSpacerHeight);
            };
        }
        return undefined;
    }, [inputRef, nonQcSpacerRef, updateSpacerHeight]);

    // also set height spacer whenever input gets changed programmatically
    useEffect(() => {
        updateSpacerHeight();
    }, [
        inputRef,
        updateSpacerHeight,
        chatId, // update when chat changes
        messageSetsQuery.data?.length, // update on submit
    ]);

    const [showScrollbar, setShowScrollbar] = useState(false);

    const handleMouseEnter = () => {
        setShowScrollbar(true);
    };

    const handleMouseLeave = () => {
        setShowScrollbar(false);
    };

    // early stopping
    if (messageSetsQuery.isPending) {
        return <ChatMessageSkeleton />;
    }
    if (messageSetsQuery.error) {
        return <div>Error: {messageSetsQuery.error.message}</div>;
    }

    const messageSets = messageSetsQuery.data;

    function renderMessageSet(
        ms: MessageSetDetail,
        messageSetRef: React.RefObject<HTMLDivElement | null> | undefined = undefined,
    ) {
        const isLastRow = ms.level === messageSets.length - 1;
        return (
            <MessageSetView
                key={ms.id}
                messageSetId={ms.id}
                messageSetRef={messageSetRef}
                userMessageRef={undefined}
                isLastRow={isLastRow}
                isQuickChatWindow={isQuickChatWindow}
            />
        );
    }

    let lastUserSet;
    let lastAISet;
    let otherMessageSets;
    if (messageSets.length === 0) {
        lastUserSet = null;
        lastAISet = null;
        otherMessageSets = messageSets;
    } else if (messageSets[messageSets.length - 1].type === "user") {
        lastUserSet = messageSets[messageSets.length - 1];
        lastAISet = null;
        otherMessageSets = messageSets.slice(0, -1);
    } else {
        lastUserSet = messageSets[messageSets.length - 2];
        lastAISet = messageSets[messageSets.length - 1];
        otherMessageSets = messageSets.slice(0, -2);
    }

    return (
        <div
            ref={chatContainerRef}
            className={`absolute inset-0 overflow-y-scroll overflow-x-hidden ${showScrollbar ? "" : "invisible-scrollbar"} ${
                isQuickChatWindow ? "pl-4 pt-4 mb-16" : "top-10 pt-10"
            }`}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            data-tauri-drag-region={isQuickChatWindow ? "true" : undefined}
        >
            <div
                className="space-y-5 max-w-10xl mx-auto select-text"
                data-tauri-drag-region={isQuickChatWindow ? "true" : undefined}
            >
                {appMetadata["has_dismissed_onboarding"] === "false" &&
                    isQuickChatWindow && (
                        <p className="text-sm text-muted-foreground">
                            Welcome! Press <code>⌘I</code> to enable vision mode
                            to let your Ambient Chat see your screen.
                        </p>
                    )}

                {parentChatId && !isQuickChatWindow && (
                    <button
                        className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors px-4 py-2"
                        onClick={() => navigate(`/chat/${parentChatId}`)}
                    >
                        <SplitIcon className="w-3 h-3" />
                        <span>
                            Branched from{" "}
                            <span className="font-medium">
                                {parentChatQuery.data?.title ||
                                    "Untitled Chat"}
                            </span>
                        </span>
                    </button>
                )}

                {messageSets.length > 0 && (
                    <>
                        {otherMessageSets.map((ms) => (
                            <VirtualizedMessageSet key={ms.id}>
                                {renderMessageSet(ms)}
                            </VirtualizedMessageSet>
                        ))}
                        <div
                            // we should subtract enough space that there's no scroll bar on first message
                            // on either qc or normal chat, but not so much that on subsequent messages
                            // you can see old messages peaking in at the top.
                            className={`space-y-5 ${
                                isQuickChatWindow
                                    ? "h-[calc(100vh-120px)]"
                                    : "h-[calc(100vh-80px)]"
                            }`}
                            data-tauri-drag-region={
                                isQuickChatWindow ? "true" : undefined
                            }
                        >
                            {lastUserSet &&
                                renderMessageSet(
                                    lastUserSet,
                                    lastMessageSetRef,
                                )}
                            {lastAISet && renderMessageSet(lastAISet)}
                            <div ref={nonQcSpacerRef} />
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

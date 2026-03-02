import * as AppMetadataAPI from "@core/chorus/api/AppMetadataAPI";
import * as ChatAPI from "@core/chorus/api/ChatAPI";
import * as MessageAPI from "@core/chorus/api/MessageAPI";
import { useSummarizeChatToNote } from "@core/chorus/api/NoteChatLinkAPI";
import * as ProjectAPI from "@core/chorus/api/ProjectAPI";
import { MessageSetDetail } from "@core/chorus/ChatState";
import { catchAsyncErrors } from "@core/chorus/utilities";
import { dialogActions } from "@core/infra/DialogStore";
import { useQuery } from "@tanstack/react-query";
import { invoke } from "@tauri-apps/api/core";
import {
    ResizableHandle,
    ResizablePanel,
    ResizablePanelGroup,
} from "@ui/components/ui/resizable";
import { useAppContext } from "@ui/hooks/useAppContext";
import { useShareChat } from "@ui/hooks/useShareChat";
import { useShortcut } from "@ui/hooks/useShortcut";
import { useWaitForAppMetadata } from "@ui/hooks/useWaitForAppMetadata";
import { FileTextIcon, Loader2, SplitIcon, TrashIcon } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import React from "react";
import {
    useLocation,
    useNavigate,
    useParams,
    useSearchParams,
} from "react-router-dom";
import { toast } from "sonner";
import { checkScreenRecordingPermission } from "tauri-plugin-macos-permissions-api";

import { ChatInput } from "./ChatInput";
import { MessageSetView } from "./ChatMessageViews";
import { FindInPage } from "./FindInPage";
import GroupChat from "./GroupChat";
import { HeaderBar } from "./HeaderBar";
import { LinkedItems } from "./LinkedItems";
import { MouseTrackingEyeRef } from "./MouseTrackingEye";
import { QuickChatHeaderBar } from "./QuickChatHeaderBar";
import RepliesDrawer from "./RepliesDrawer";
import { SHARE_CHAT_DIALOG_ID, ShareChatDialog } from "./ShareChatDialog";
import { TagInput } from "./TagInput";
import { Button } from "./ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { Skeleton } from "./ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";
import { VirtualizedMessageSet } from "./VirtualizedMessageSet";

// Re-export sub-components that other files (e.g. ReplyChat.tsx) import from MultiChat
export { ToolsMessageView, UserMessageView } from "./ChatMessageViews";
export { SHARE_CHAT_DIALOG_ID } from "./ShareChatDialog";

// Module-level scroll position cache: saves scroll position per chat
// so it can be restored when switching back to a previously viewed chat.
const scrollPositionCache = new Map<string, number>();
let previousChatId: string | undefined;

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

    const { isQuickChatWindow } = useAppContext();

    const createQuickChat = ChatAPI.useGetOrCreateNewQuickChat();

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

    useEffect(() => {
        if (!shareUrl) {
            dialogActions.closeDialog();
        } else {
            dialogActions.openDialog(SHARE_CHAT_DIALOG_ID);
        }
    }, [shareUrl]);

    const handleShareChat = useCallback(async () => {
        // Get the main chat container's HTML
        const chatContainer = document.querySelector(".max-w-10xl");
        if (!chatContainer) {
            console.error("Chat container not found");
            return;
        }

        await doShareChat(chatContainer.outerHTML);
    }, [doShareChat]);

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

    // Check if this is a group chat
    if (chatQuery.data && chatQuery.data.gcPrototype) {
        return <GroupChat />;
    }

    return (
        <div
            className={`flex flex-col ${isQuickChatWindow ? "h-screen" : "h-full"} w-full min-w-0 mx-auto @container group relative
        ${isQuickChatWindow && (windowIsFocused ? "rounded-xl" : "bg-foreground/5 rounded-xl")}`}
        >
            {/* header bar — only for quick chat windows */}
            {isQuickChatWindow && (
                <QuickChatHeaderBar
                    visionModeEnabled={
                        appMetadata["vision_mode_enabled"] === "true"
                    }
                    eyeRef={eyeRef}
                    onClose={closeQuickChat}
                    onToggleVisionMode={() => void handleToggleVisionMode()}
                    onOpenInMainWindow={() =>
                        void handleOpenQuickChatInMainWindow()
                    }
                    onNewAmbientChat={() => createQuickChat.mutate()}
                />
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
                            <div className="flex flex-col min-h-0 h-full">
                                {!isQuickChatWindow && (
                                    <ChatTopBar
                                        chatId={chatId!}
                                        hasMessages={
                                            !!messageSetsQuery.data?.length
                                        }
                                    />
                                )}
                                <div className="relative flex-1 min-h-0 overflow-hidden">
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

            <ShareChatDialog
                shareUrl={shareUrl}
                copiedUrl={copiedUrl}
                onCopyShareUrl={() => void handleCopyShareUrl()}
                onOpenShareUrl={() => void handleOpenShareUrl()}
                onDeleteShare={() => void handleDeleteShare()}
                onClose={() => setShareUrl(null)}
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

/** Header bar for non-quick-chat views — uses HeaderBar for consistent height */
function ChatTopBar({
    chatId,
    hasMessages,
}: {
    chatId: string;
    hasMessages: boolean;
}) {
    const navigate = useNavigate();
    const summarize = useSummarizeChatToNote();
    const deleteChat = ChatAPI.useDeleteChat();
    const chatQuery = ChatAPI.useChat(chatId);
    const [deletePopoverOpen, setDeletePopoverOpen] = useState(false);

    const handleSummarize = useCallback(() => {
        summarize.mutate(
            { chatId },
            {
                onSuccess: (data) => {
                    toast.success("Note created from chat summary");
                    navigate(`/note/${data.noteId}`);
                },
                onError: (err) => {
                    toast.error("Failed to summarize", {
                        description:
                            err instanceof Error
                                ? err.message
                                : "Unknown error",
                    });
                },
            },
        );
    }, [chatId, summarize, navigate]);

    const handleConfirmDelete = useCallback(async () => {
        const chatTitle = chatQuery.data?.title || "Untitled Chat";
        await deleteChat.mutateAsync({ chatId });
        setDeletePopoverOpen(false);
        toast(`'${chatTitle}' deleted`);
        navigate("/");
    }, [chatId, chatQuery.data?.title, deleteChat, navigate]);

    return (
        <HeaderBar
            leftActions={
                <div className="flex items-center gap-1 min-w-0">
                    <TagInput itemType="chat" itemId={chatId} />
                    <LinkedItems chatId={chatId} />
                </div>
            }
            actions={
                <div className="flex items-center gap-1 shrink-0">
                    {hasMessages && (
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="iconSm"
                                    tabIndex={-1}
                                    onClick={handleSummarize}
                                    disabled={summarize.isPending}
                                >
                                    {summarize.isPending ? (
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
                                Summarize to note
                            </TooltipContent>
                        </Tooltip>
                    )}
                    <Popover
                        open={deletePopoverOpen}
                        onOpenChange={setDeletePopoverOpen}
                    >
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant="ghost"
                                        size="iconSm"
                                    >
                                        <TrashIcon
                                            strokeWidth={1.5}
                                            className="size-3.5!"
                                        />
                                    </Button>
                                </PopoverTrigger>
                            </TooltipTrigger>
                            <TooltipContent>Delete chat</TooltipContent>
                        </Tooltip>
                        <PopoverContent
                            align="end"
                            className="w-56 p-3"
                        >
                            <p className="text-sm mb-3">
                                Delete &ldquo;
                                {chatQuery.data?.title || "Untitled Chat"}
                                &rdquo;? This cannot be undone.
                            </p>
                            <div className="flex justify-end gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() =>
                                        setDeletePopoverOpen(false)
                                    }
                                >
                                    Cancel
                                </Button>
                                <Button
                                    variant="destructive"
                                    size="sm"
                                    onClick={() =>
                                        void handleConfirmDelete()
                                    }
                                >
                                    Delete
                                </Button>
                            </div>
                        </PopoverContent>
                    </Popover>
                </div>
            }
        />
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
    }, [
        chatId,
        messageSetsQuery.isSuccess,
        handleScrollToBottom,
        chatContainerRef,
    ]);

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
        messageSetRef:
            | React.RefObject<HTMLDivElement | null>
            | undefined = undefined,
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
                                {parentChatQuery.data?.title || "Untitled Chat"}
                            </span>
                        </span>
                    </button>
                )}

                {messageSets.length > 0 && (
                    <>
                        {otherMessageSets.map((ms) => (
                            <VirtualizedMessageSet
                                key={ms.id}
                                messageSetId={ms.id}
                            >
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

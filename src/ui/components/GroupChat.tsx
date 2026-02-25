import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useParams } from "react-router-dom";
import {
    Loader2,
    X,
    Undo2,
    Users,
    RefreshCcwIcon,
    Maximize2Icon,
    RemoveFormattingIcon,
    ChevronDownIcon,
    WrenchIcon,
    MessageSquareIcon,
} from "lucide-react";
import { HeaderBar } from "@ui/components/HeaderBar";
import { MessageMarkdown } from "@ui/components/renderers/MessageMarkdown";
import { ProviderLogo } from "@ui/components/ui/provider-logo";
import SimpleCopyButton from "@ui/components/unused/CopyButton";
import {
    Dialog,
    DialogContent,
    DialogTitle,
    DialogTrigger,
} from "@ui/components/ui/dialog";
import { Toggle } from "@ui/components/ui/toggle";
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "@ui/components/ui/tooltip";
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@ui/components/ui/collapsible";
import Composer from "@ui/components/Composer";
import GroupChatThread from "@ui/components/GroupChatThread";
import { dialogActions } from "@core/infra/DialogStore";
import {
    useGCMainMessages,
    useGCThreadCounts,
    useSendGCMessage,
    useGenerateAIResponses,
    useDeleteGCMessage,
    useRestoreGCMessage,
    useRegenerateGCMessage,
    useGenerateGCChatTitle,
    type GCMessage,
} from "@core/chorus/api/GroupChatAPI";
import { useChat } from "@core/chorus/api/ChatAPI";
import { type UserToolCall } from "@core/chorus/Toolsets";
import { modelThinkingTracker } from "@core/chorus/gc-prototype/ModelThinkingTracker";
import { getModelDisplayName } from "@core/chorus/gc-prototype/UtilsGC";

// NOTE: useRef is used here for auto-scroll (standard DOM pattern).
// useState is used for thinking state tracking (event-driven from ModelThinkingTracker).

// ---------------------------------------------------------------------------
// Thinking indicator helpers
// ---------------------------------------------------------------------------

type ModelInstance = {
    modelId: string;
    displayName: string;
    instanceNumber: number;
    totalInstances: number;
};

function formatThinkingModels(instances: ModelInstance[]): string {
    if (instances.length === 0) return "";
    if (instances.length === 1) {
        const instance = instances[0];
        return instance.totalInstances > 1
            ? `${instance.displayName} ${instance.instanceNumber}`
            : instance.displayName;
    }

    const groupedByModel = new Map<string, ModelInstance[]>();
    instances.forEach((instance) => {
        const key = instance.modelId;
        if (!groupedByModel.has(key)) {
            groupedByModel.set(key, []);
        }
        groupedByModel.get(key)!.push(instance);
    });

    const formattedGroups: string[] = [];
    groupedByModel.forEach((modelInstances) => {
        if (
            modelInstances.length === 1 &&
            modelInstances[0].totalInstances === 1
        ) {
            formattedGroups.push(modelInstances[0].displayName);
        } else {
            const modelName = modelInstances[0].displayName;
            const instanceNumbers = modelInstances
                .map((i) => i.instanceNumber)
                .join(", ");
            formattedGroups.push(`${modelName} ${instanceNumbers}`);
        }
    });

    if (formattedGroups.length === 1) {
        return formattedGroups[0];
    } else if (formattedGroups.length === 2) {
        return formattedGroups.join(" and ");
    } else {
        const lastGroup = formattedGroups.pop();
        return formattedGroups.join(", ") + ", and " + lastGroup;
    }
}

// ---------------------------------------------------------------------------
// Error message rendering with clickable Settings link
// ---------------------------------------------------------------------------

const API_KEY_ERROR_PATTERN =
    /^Sorry, I encountered an error: Please add your (\w+) API key in Settings to use this model\.$/;

function ErrorMessageWithSettingsLink({ text }: { text: string }) {
    const match = text.match(API_KEY_ERROR_PATTERN);
    if (!match) return null;

    const providerName = match[1];
    return (
        <p className="text-destructive">
            Please add your {providerName} API key in{" "}
            <button
                className="underline hover:text-destructive/80 transition-colors"
                onClick={() => dialogActions.openSettings("api-keys")}
            >
                Settings
            </button>{" "}
            to use this model.
        </p>
    );
}

// ---------------------------------------------------------------------------
// GCMessageView
// ---------------------------------------------------------------------------

function UserMessageView({
    message,
    onDelete,
    onRestore,
}: {
    message: GCMessage;
    onDelete: (messageId: string) => void;
    onRestore: (messageId: string) => void;
}) {
    return (
        <div className="group/message-set-view relative mb-6 flex justify-end px-4">
            {/* Hover actions — floating above the bubble */}
            <div className="flex items-center justify-end absolute -top-2.5 left-0 right-1 invisible group-hover/message-set-view:visible text-muted-foreground z-10">
                <div className="bg-background rounded-lg flex items-center justify-center px-2 py-1 gap-2">
                    {message.isDeleted ? (
                        <button
                            className="hover:text-foreground transition-colors"
                            onClick={() => onRestore(message.id)}
                            title="Restore message"
                        >
                            <Undo2 className="h-3.5 w-3.5" />
                        </button>
                    ) : (
                        <button
                            className="hover:text-foreground transition-colors"
                            onClick={() => onDelete(message.id)}
                            title="Delete message"
                        >
                            <X className="h-3.5 w-3.5" />
                        </button>
                    )}
                </div>
            </div>

            {/* User bubble */}
            <div className="relative bg-highlight text-highlight-foreground inline-block max-w-full rounded">
                <div className="px-5 py-3 text-base whitespace-pre-wrap">
                    {message.isDeleted ? (
                        <span className="italic text-muted-foreground">
                            Message deleted
                        </span>
                    ) : (
                        message.text
                    )}
                </div>
            </div>
        </div>
    );
}

function FullScreenMessageDialog({
    message,
    displayName,
    children,
}: {
    message: GCMessage;
    displayName: string;
    children: React.ReactNode;
}) {
    const [raw, setRaw] = useState(false);

    return (
        <Dialog id={`gc-fullscreen-${message.id}`}>
            <DialogTrigger asChild>{children}</DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[95vh] w-full overflow-auto">
                <DialogTitle className="pt-2 px-3">
                    <div className="flex items-center justify-between">
                        <h1 className="text-lg font-medium">{displayName}</h1>
                        <div className="flex items-center gap-2.5">
                            <Tooltip>
                                <TooltipTrigger asChild tabIndex={-1}>
                                    <Toggle
                                        pressed={raw}
                                        onPressedChange={() => setRaw(!raw)}
                                    >
                                        <RemoveFormattingIcon className="w-3 h-3" />
                                    </Toggle>
                                </TooltipTrigger>
                                <TooltipContent
                                    className="font-normal"
                                    side="bottom"
                                >
                                    Toggle raw text
                                </TooltipContent>
                            </Tooltip>
                            <Tooltip>
                                <TooltipTrigger asChild tabIndex={-1}>
                                    <SimpleCopyButton text={message.text} />
                                </TooltipTrigger>
                                <TooltipContent
                                    className="font-normal"
                                    side="bottom"
                                >
                                    Copy
                                </TooltipContent>
                            </Tooltip>
                        </div>
                    </div>
                </DialogTitle>
                <div className="px-3 pb-4">
                    {raw ? (
                        <pre className="whitespace-pre-wrap text-sm">
                            {message.text}
                        </pre>
                    ) : (
                        <MessageMarkdown text={message.text} />
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}

// ---------------------------------------------------------------------------
// GCToolCallView — compact collapsible tool call display
// ---------------------------------------------------------------------------

function GCToolCallView({ toolCall }: { toolCall: UserToolCall }) {
    const label = toolCall.namespacedToolName ?? "tool";

    const formattedArgs = useMemo(() => {
        const args = toolCall.args as Record<string, unknown> | undefined;
        if (!args) return [];
        return Object.entries(args).map(([key, value]) => ({
            key,
            value:
                typeof value === "string"
                    ? value
                    : JSON.stringify(value, null, 2),
        }));
    }, [toolCall.args]);

    return (
        <Collapsible className="my-2 rounded-md text-muted-foreground text-sm py-1.5 px-1.5 border w-fit max-w-full">
            <CollapsibleTrigger className="group font-mono text-xs text-left flex items-center justify-left hover:text-foreground">
                <WrenchIcon className="w-3 h-3 mr-2 flex-shrink-0" />
                {label}
                <ChevronDownIcon className="w-3 h-3 ml-2 transition-transform group-data-[state=open]:rotate-180" />
            </CollapsibleTrigger>
            <CollapsibleContent>
                {formattedArgs.length > 0 && (
                    <ul className="mt-2 space-y-1 text-xs font-mono">
                        {formattedArgs.map((arg) => (
                            <li key={arg.key}>
                                <span className="text-muted-foreground">
                                    {arg.key}
                                </span>
                                ={" "}
                                <span className="break-all">
                                    {arg.value}
                                </span>
                            </li>
                        ))}
                    </ul>
                )}
            </CollapsibleContent>
        </Collapsible>
    );
}

function AIMessageView({
    message,
    isStreaming,
    threadReplyCount,
    onDelete,
    onRestore,
    onRegenerate,
    onOpenThread,
}: {
    message: GCMessage;
    isStreaming?: boolean;
    threadReplyCount?: number;
    onDelete: (messageId: string) => void;
    onRestore: (messageId: string) => void;
    onRegenerate: (messageId: string, modelConfigId: string) => void;
    onOpenThread?: (messageId: string) => void;
}) {
    const displayName = getModelDisplayName(message.modelConfigId);

    return (
        <div className="group/message-set-view relative mb-6 px-4">
            {/* Card with thin border */}
            <div className="relative rounded-md border-[0.090rem] bg-background">
                {/* Header bar: model name + actions, floating above the card */}
                <div className="absolute left-0 right-0 -top-3 h-6 flex items-center justify-between z-5">
                    {/* Model name */}
                    <div className="flex items-center h-6 gap-2">
                        <div className="ml-2 px-2 bg-background text-muted-foreground">
                            <div className="flex items-center gap-2 h-6">
                                <ProviderLogo
                                    size="sm"
                                    modelId={message.modelConfigId}
                                    className="-mt-px"
                                />
                                <div className="text-sm">{displayName}</div>
                            </div>
                        </div>
                    </div>

                    {/* Hover action buttons (hidden while streaming) */}
                    <div className="mr-3 flex items-center h-6 gap-2">
                        <div className={`gap-2 text-muted-foreground px-2 bg-background ${isStreaming ? "hidden" : "hidden group-hover/message-set-view:flex"}`}>
                            {message.isDeleted ? (
                                <button
                                    className="hover:text-foreground transition-colors"
                                    onClick={() => onRestore(message.id)}
                                    title="Restore message"
                                >
                                    <Undo2 className="h-3.5 w-3.5" />
                                </button>
                            ) : (
                                <>
                                    <button
                                        className="hover:text-foreground transition-colors"
                                        onClick={() =>
                                            onRegenerate(
                                                message.id,
                                                message.modelConfigId,
                                            )
                                        }
                                        title="Regenerate"
                                    >
                                        <RefreshCcwIcon
                                            strokeWidth={1.5}
                                            className="w-3.5 h-3.5"
                                        />
                                    </button>
                                    <SimpleCopyButton
                                        className="hover:text-foreground transition-colors"
                                        text={message.text}
                                        size="sm"
                                    />
                                    <FullScreenMessageDialog
                                        message={message}
                                        displayName={displayName}
                                    >
                                        <button
                                            className="hover:text-foreground transition-colors"
                                            title="Open full screen"
                                        >
                                            <Maximize2Icon
                                                strokeWidth={1.5}
                                                className="w-3.5 h-3.5"
                                            />
                                        </button>
                                    </FullScreenMessageDialog>
                                    {onOpenThread && (
                                        <button
                                            className="hover:text-foreground transition-colors"
                                            onClick={() =>
                                                onOpenThread(message.id)
                                            }
                                            title="Open thread"
                                        >
                                            <MessageSquareIcon
                                                strokeWidth={1.5}
                                                className="w-3.5 h-3.5"
                                            />
                                        </button>
                                    )}
                                    <button
                                        className="hover:text-foreground transition-colors"
                                        onClick={() => onDelete(message.id)}
                                        title="Delete message"
                                    >
                                        <X className="h-3.5 w-3.5" />
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                </div>

                {/* Message content */}
                <div className="p-4 pb-6 relative overflow-y-auto select-text">
                    {message.isDeleted ? (
                        <div className="text-sm text-muted-foreground italic">
                            Message deleted
                        </div>
                    ) : !message.text && isStreaming ? (
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    ) : API_KEY_ERROR_PATTERN.test(message.text) ? (
                        <ErrorMessageWithSettingsLink text={message.text} />
                    ) : (
                        <MessageMarkdown text={message.text} />
                    )}
                    {/* Tool calls */}
                    {message.toolCalls && message.toolCalls.length > 0 && (
                        <div className="mt-2">
                            {message.toolCalls.map((tc) => (
                                <GCToolCallView
                                    key={tc.id}
                                    toolCall={tc}
                                />
                            ))}
                        </div>
                    )}
                </div>
                {/* Thread reply count */}
                {threadReplyCount !== undefined && threadReplyCount > 0 && onOpenThread && (
                    <button
                        className="mt-1 px-4 pb-2 text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
                        onClick={() => onOpenThread(message.id)}
                    >
                        <MessageSquareIcon className="h-3 w-3" />
                        {threadReplyCount}{" "}
                        {threadReplyCount === 1 ? "reply" : "replies"}
                    </button>
                )}
            </div>
        </div>
    );
}

function GCMessageView({
    message,
    isStreaming,
    threadReplyCount,
    onDelete,
    onRestore,
    onRegenerate,
    onOpenThread,
}: {
    message: GCMessage;
    isStreaming?: boolean;
    threadReplyCount?: number;
    onDelete: (messageId: string) => void;
    onRestore: (messageId: string) => void;
    onRegenerate: (messageId: string, modelConfigId: string) => void;
    onOpenThread?: (messageId: string) => void;
}) {
    // tool_result messages are internal — not displayed directly
    if (message.modelConfigId === "tool_result") {
        return null;
    }

    if (message.modelConfigId === "user") {
        return (
            <UserMessageView
                message={message}
                onDelete={onDelete}
                onRestore={onRestore}
            />
        );
    }

    return (
        <AIMessageView
            message={message}
            isStreaming={isStreaming}
            threadReplyCount={threadReplyCount}
            onDelete={onDelete}
            onRestore={onRestore}
            onRegenerate={onRegenerate}
            onOpenThread={onOpenThread}
        />
    );
}

// ---------------------------------------------------------------------------
// GroupChat
// ---------------------------------------------------------------------------

export default function GroupChat() {
    const { chatId } = useParams<{ chatId: string }>();
    const { data: chat } = useChat(chatId ?? "");
    const { data: messages } = useGCMainMessages(chatId ?? "");
    const { data: threadCounts } = useGCThreadCounts(chatId ?? "");
    const sendMessage = useSendGCMessage();
    const generateAIResponses = useGenerateAIResponses();
    const deleteMessage = useDeleteGCMessage();
    const restoreMessage = useRestoreGCMessage();
    const regenerateMessage = useRegenerateGCMessage();
    const generateTitle = useGenerateGCChatTitle();

    const [generatingModels, setGeneratingModels] = useState<
        Map<string, number>
    >(new Map());
    const [openThreadId, setOpenThreadId] = useState<string | undefined>();

    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Auto-scroll only when new messages appear (not on every streaming chunk)
    const messageCount = messages?.length ?? 0;
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messageCount]);

    // Subscribe to thinking state changes
    useEffect(() => {
        if (!chatId) return;

        const handleThinkingStateChanged = (
            thinkingModels: Map<string, number>,
        ) => {
            setGeneratingModels(thinkingModels);
        };

        const eventName = `thinkingStateChanged:${chatId}:main`;
        modelThinkingTracker.on(eventName, handleThinkingStateChanged);

        return () => {
            modelThinkingTracker.off(eventName, handleThinkingStateChanged);
        };
    }, [chatId]);

    // Clear thinking state when chatId changes
    useEffect(() => {
        setGeneratingModels(new Map());
    }, [chatId]);

    // Build thinking indicator instances
    const thinkingModelInstances = useMemo(() => {
        const instances: ModelInstance[] = [];
        generatingModels.forEach((count, modelId) => {
            if (count > 0) {
                const modelName = getModelDisplayName(modelId);
                for (let i = 1; i <= count; i++) {
                    instances.push({
                        modelId,
                        displayName: modelName,
                        instanceNumber: i,
                        totalInstances: count,
                    });
                }
            }
        });
        return instances;
    }, [generatingModels]);

    const isGenerating = thinkingModelInstances.length > 0;

    // Set of model IDs currently streaming (for inline streaming indicators)
    const streamingModelIds = useMemo(() => {
        const ids = new Set<string>();
        generatingModels.forEach((count, modelId) => {
            if (count > 0) ids.add(modelId);
        });
        return ids;
    }, [generatingModels]);

    // Set of message IDs that are actively streaming (last message per streaming model)
    const streamingMessageIds = useMemo(() => {
        const ids = new Set<string>();
        if (!messages || streamingModelIds.size === 0) return ids;
        const seenModels = new Set<string>();
        for (let i = messages.length - 1; i >= 0; i--) {
            const msg = messages[i];
            if (
                streamingModelIds.has(msg.modelConfigId) &&
                !seenModels.has(msg.modelConfigId)
            ) {
                ids.add(msg.id);
                seenModels.add(msg.modelConfigId);
            }
        }
        return ids;
    }, [messages, streamingModelIds]);

    const handleSend = useCallback(
        async (text: string) => {
            if (!chatId) return;

            // Insert user message
            await sendMessage.mutateAsync({ chatId, text });

            // Generate title after first user message
            const isFirstMessage = !messages || messages.length === 0;
            if (isFirstMessage) {
                generateTitle.mutate({ chatId });
            }

            // Trigger AI responses
            generateAIResponses.mutate({ chatId, userMessage: text });
        },
        [chatId, messages, sendMessage, generateTitle, generateAIResponses],
    );

    const handleDelete = useCallback(
        (messageId: string) => {
            if (!chatId) return;
            deleteMessage.mutate({ messageId, chatId });
        },
        [chatId, deleteMessage],
    );

    const handleRestore = useCallback(
        (messageId: string) => {
            if (!chatId) return;
            restoreMessage.mutate({ messageId, chatId });
        },
        [chatId, restoreMessage],
    );

    const handleRegenerate = useCallback(
        (messageId: string, modelConfigId: string) => {
            if (!chatId) return;
            regenerateMessage.mutate({ chatId, messageId, modelConfigId });
        },
        [chatId, regenerateMessage],
    );

    const handleOpenThread = useCallback((messageId: string) => {
        setOpenThreadId(messageId);
    }, []);

    // Close thread when chatId changes
    useEffect(() => {
        setOpenThreadId(undefined);
    }, [chatId]);

    // Empty state
    if (!messages || messages.length === 0) {
        return (
            <div className="flex flex-col h-screen w-full">
                <HeaderBar positioning="absolute">
                    <span className="text-sm font-medium ml-2">
                        {chat?.title ?? "New Chat"}
                    </span>
                </HeaderBar>

                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center pt-[52px]">
                    <div className="bg-secondary rounded-full p-6 mb-6">
                        <Users className="w-12 h-12 text-secondary-foreground" />
                    </div>

                    <h1 className="text-3xl font-bold mb-3">Group Chat</h1>
                    <p className="text-muted-foreground mb-6 max-w-md">
                        Send a message to start chatting. Use @mention to talk
                        to specific models.
                    </p>
                </div>

                <Composer
                    onSend={handleSend}
                    chatId={chatId ?? ""}
                    disabled={isGenerating}
                />
            </div>
        );
    }

    return (
        <div className="flex h-screen w-full">
            {/* Main chat column */}
            <div className="flex-1 flex flex-col min-w-0">
                <HeaderBar positioning="absolute">
                    <span className="text-sm font-medium ml-2">
                        {chat?.title ?? "New Chat"}
                    </span>
                </HeaderBar>

                {/* Message list */}
                <div className="flex-1 overflow-y-auto pt-[52px] pb-4">
                    <div className="max-w-3xl mx-auto">
                        {messages.map((message) => (
                            <GCMessageView
                                key={message.id}
                                message={message}
                                isStreaming={streamingMessageIds.has(
                                    message.id,
                                )}
                                threadReplyCount={threadCounts?.get(
                                    message.id,
                                )}
                                onDelete={handleDelete}
                                onRestore={handleRestore}
                                onRegenerate={handleRegenerate}
                                onOpenThread={handleOpenThread}
                            />
                        ))}

                        {/* Thinking indicator */}
                        {thinkingModelInstances.length > 0 && (
                            <div className="px-4 mb-6">
                                <div className="rounded-md border-[0.090rem] bg-background p-4">
                                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        <span>
                                            {formatThinkingModels(
                                                thinkingModelInstances,
                                            )}
                                            {thinkingModelInstances.length === 1
                                                ? " is"
                                                : " are"}{" "}
                                            thinking...
                                        </span>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Auto-scroll anchor */}
                        <div ref={messagesEndRef} />
                    </div>
                </div>

                <Composer
                    onSend={handleSend}
                    chatId={chatId ?? ""}
                    disabled={isGenerating}
                />
            </div>

            {/* Thread panel */}
            {openThreadId && chatId && (
                <div className="w-96 border-l flex-shrink-0">
                    <GroupChatThread
                        chatId={chatId}
                        threadRootMessageId={openThreadId}
                        onClose={() => setOpenThreadId(undefined)}
                    />
                </div>
            )}
        </div>
    );
}

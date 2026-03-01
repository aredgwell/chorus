import {
    type GCMessage,
    useGCMainMessages,
    useGCThreadMessages,
    useGenerateAIResponses,
    usePromoteGCMessage,
    useSendGCMessage,
} from "@core/chorus/api/GroupChatAPI";
import { useMarkProjectContextSummaryAsStale } from "@core/chorus/api/ProjectAPI";
import { modelThinkingTracker } from "@core/chorus/gc-prototype/ModelThinkingTracker";
import { getModelDisplayName } from "@core/chorus/gc-prototype/UtilsGC";
import Composer from "@ui/components/Composer";
import { MessageMarkdown } from "@ui/components/renderers/MessageMarkdown";
import { ProviderLogo } from "@ui/components/ui/provider-logo";
import { ArrowUpFromLine, Loader2, MessageSquare, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

// NOTE: useRef is used here for auto-scroll (standard DOM pattern, same as GroupChat.tsx).

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
    const names = instances.map((i) => i.displayName);
    if (names.length === 2) return names.join(" and ");
    const last = names.pop();
    return names.join(", ") + ", and " + last;
}

// ---------------------------------------------------------------------------
// ThreadMessage — simplified message view for thread context
// ---------------------------------------------------------------------------

function ThreadMessage({
    message,
    onPromote,
}: {
    message: GCMessage;
    onPromote?: (messageId: string) => void;
}) {
    if (message.modelConfigId === "user") {
        return (
            <div className="mb-4 flex justify-end px-3">
                <div className="bg-highlight text-highlight-foreground inline-block max-w-full rounded px-4 py-2 text-sm whitespace-pre-wrap">
                    {message.text}
                </div>
            </div>
        );
    }

    if (message.modelConfigId === "tool_result") {
        return null;
    }

    const displayName = getModelDisplayName(message.modelConfigId);

    return (
        <div className="group/thread-msg mb-4 px-3">
            <div className="flex items-center gap-1.5 mb-1 text-xs text-muted-foreground">
                <ProviderLogo size="xs" modelId={message.modelConfigId} />
                <span>{displayName}</span>
                {onPromote && (
                    <button
                        className="ml-auto invisible group-hover/thread-msg:visible hover:text-foreground transition-colors"
                        onClick={() => onPromote(message.id)}
                        title="Promote to main chat"
                    >
                        <ArrowUpFromLine className="h-3 w-3" />
                    </button>
                )}
            </div>
            <div className="text-sm">
                {message.text ? (
                    <MessageMarkdown text={message.text} />
                ) : (
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                )}
            </div>
        </div>
    );
}

// ---------------------------------------------------------------------------
// GroupChatThread
// ---------------------------------------------------------------------------

export default function GroupChatThread({
    chatId,
    threadRootMessageId,
    onClose,
}: {
    chatId: string;
    threadRootMessageId: string;
    onClose: () => void;
}) {
    const { data: mainMessages } = useGCMainMessages(chatId);
    const { data: threadMessages } = useGCThreadMessages(
        chatId,
        threadRootMessageId,
    );
    const sendMessage = useSendGCMessage();
    const generateAIResponses = useGenerateAIResponses();
    const promoteMessage = usePromoteGCMessage();
    const markProjectContextSummaryAsStale =
        useMarkProjectContextSummaryAsStale();

    const [generatingModels, setGeneratingModels] = useState<
        Map<string, number>
    >(new Map());

    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Find the root message
    const rootMessage = mainMessages?.find((m) => m.id === threadRootMessageId);

    // Auto-scroll on new thread messages
    const threadMessageCount = threadMessages?.length ?? 0;
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [threadMessageCount]);

    // Subscribe to thinking state for this thread scope
    useEffect(() => {
        const handleThinkingStateChanged = (
            thinkingModels: Map<string, number>,
        ) => {
            setGeneratingModels(thinkingModels);
        };

        const eventName = `thinkingStateChanged:${chatId}:${threadRootMessageId}`;
        modelThinkingTracker.on(eventName, handleThinkingStateChanged);

        return () => {
            modelThinkingTracker.off(eventName, handleThinkingStateChanged);
        };
    }, [chatId, threadRootMessageId]);

    // Build thinking indicator
    const thinkingModelInstances: ModelInstance[] = [];
    generatingModels.forEach((count, modelId) => {
        if (count > 0) {
            const modelName = getModelDisplayName(modelId);
            for (let i = 1; i <= count; i++) {
                thinkingModelInstances.push({
                    modelId,
                    displayName: modelName,
                    instanceNumber: i,
                    totalInstances: count,
                });
            }
        }
    });

    const isGenerating = thinkingModelInstances.length > 0;

    const handleSend = useCallback(
        async (text: string) => {
            await sendMessage.mutateAsync({
                chatId,
                text,
                threadRootMessageId,
            });

            // Mark project context summary as stale so other chats in the project re-summarize
            void markProjectContextSummaryAsStale.mutateAsync({ chatId });

            generateAIResponses.mutate({
                chatId,
                userMessage: text,
                threadRootMessageId,
            });
        },
        [
            chatId,
            threadRootMessageId,
            sendMessage,
            markProjectContextSummaryAsStale,
            generateAIResponses,
        ],
    );

    const handlePromote = useCallback(
        (messageId: string) => {
            promoteMessage.mutate({ chatId, messageId });
        },
        [chatId, promoteMessage],
    );

    return (
        <div className="flex flex-col h-full">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b">
                <div className="flex items-center gap-2 text-sm font-medium">
                    <MessageSquare className="h-4 w-4" />
                    Thread
                </div>
                <button
                    className="text-muted-foreground hover:text-foreground transition-colors"
                    onClick={onClose}
                >
                    <X className="h-4 w-4" />
                </button>
            </div>

            {/* Thread content */}
            <div className="flex-1 overflow-y-auto py-4">
                {/* Root message */}
                {rootMessage && (
                    <div className="mb-4 pb-4 border-b mx-3">
                        <div className="flex items-center gap-1.5 mb-1 text-xs text-muted-foreground">
                            {rootMessage.modelConfigId === "user" ? (
                                <span className="font-medium">You</span>
                            ) : (
                                <>
                                    <ProviderLogo
                                        size="xs"
                                        modelId={rootMessage.modelConfigId}
                                    />
                                    <span>
                                        {getModelDisplayName(
                                            rootMessage.modelConfigId,
                                        )}
                                    </span>
                                </>
                            )}
                        </div>
                        <div className="text-sm">
                            <MessageMarkdown text={rootMessage.text} />
                        </div>
                    </div>
                )}

                {/* Thread replies */}
                {threadMessages?.map((message) => (
                    <ThreadMessage
                        key={message.id}
                        message={message}
                        onPromote={
                            message.modelConfigId !== "user"
                                ? handlePromote
                                : undefined
                        }
                    />
                ))}

                {/* Thinking indicator */}
                {thinkingModelInstances.length > 0 && (
                    <div className="px-3 mb-4">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            <span>
                                {formatThinkingModels(thinkingModelInstances)}{" "}
                                {thinkingModelInstances.length === 1
                                    ? "is"
                                    : "are"}{" "}
                                thinking...
                            </span>
                        </div>
                    </div>
                )}

                <div ref={messagesEndRef} />
            </div>

            {/* Composer */}
            <Composer
                onSend={handleSend}
                chatId={chatId}
                disabled={isGenerating}
            />
        </div>
    );
}

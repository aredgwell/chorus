import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useParams } from "react-router-dom";
import { Loader2, X, Undo2, Users } from "lucide-react";
import { HeaderBar } from "@ui/components/HeaderBar";
import { MessageMarkdown } from "@ui/components/renderers/MessageMarkdown";
import { ProviderLogo } from "@ui/components/ui/provider-logo";
import { Button } from "@ui/components/ui/button";
import Composer from "@ui/components/Composer";
import { displayDate, convertDate } from "@ui/lib/utils";
import { getProviderName } from "@core/chorus/Models";
import {
    useGCMainMessages,
    useSendGCMessage,
    useGenerateAIResponses,
    useDeleteGCMessage,
    useRestoreGCMessage,
    useGenerateGCChatTitle,
    type GCMessage,
} from "@core/chorus/api/GroupChatAPI";
import { useChat } from "@core/chorus/api/ChatAPI";
import { modelThinkingTracker } from "@core/chorus/gc-prototype/ModelThinkingTracker";
import {
    getModelDisplayName,
    getModelAvatar,
} from "@core/chorus/gc-prototype/UtilsGC";

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
// GCMessageView
// ---------------------------------------------------------------------------

function GCMessageView({
    message,
    onDelete,
    onRestore,
}: {
    message: GCMessage;
    onDelete: (messageId: string) => void;
    onRestore: (messageId: string) => void;
}) {
    const isUser = message.modelConfigId === "user";
    const avatar = getModelAvatar(message.modelConfigId);
    const displayName = getModelDisplayName(message.modelConfigId);

    return (
        <div className="group relative flex gap-3 py-3 px-4">
            {/* Avatar */}
            <div className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center">
                {isUser ? (
                    <div
                        className={`w-8 h-8 rounded-full ${avatar.bgColor} ${avatar.textColor} flex items-center justify-center text-xs font-medium`}
                    >
                        {avatar.initials}
                    </div>
                ) : (
                    <ProviderLogo
                        provider={getProviderName(message.modelConfigId)}
                        modelId={message.modelConfigId}
                        size="sm"
                    />
                )}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-sm font-medium">{displayName}</span>
                    <span className="text-xs text-muted-foreground">
                        {displayDate(convertDate(message.createdAt))}
                    </span>
                </div>

                {message.isDeleted ? (
                    <div className="text-sm text-muted-foreground italic">
                        Message deleted
                    </div>
                ) : (
                    <div className="text-sm">
                        {isUser ? (
                            <p className="whitespace-pre-wrap">
                                {message.text}
                            </p>
                        ) : (
                            <MessageMarkdown text={message.text} />
                        )}
                    </div>
                )}
            </div>

            {/* Hover actions */}
            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                {message.isDeleted ? (
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => onRestore(message.id)}
                        title="Restore message"
                    >
                        <Undo2 className="h-3 w-3" />
                    </Button>
                ) : (
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => onDelete(message.id)}
                        title="Delete message"
                    >
                        <X className="h-3 w-3" />
                    </Button>
                )}
            </div>
        </div>
    );
}

// ---------------------------------------------------------------------------
// GroupChat
// ---------------------------------------------------------------------------

export default function GroupChat() {
    const { chatId } = useParams<{ chatId: string }>();
    const { data: chat } = useChat(chatId ?? "");
    const { data: messages } = useGCMainMessages(chatId ?? "");
    const sendMessage = useSendGCMessage();
    const generateAIResponses = useGenerateAIResponses();
    const deleteMessage = useDeleteGCMessage();
    const restoreMessage = useRestoreGCMessage();
    const generateTitle = useGenerateGCChatTitle();

    const [generatingModels, setGeneratingModels] = useState<
        Map<string, number>
    >(new Map());

    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Auto-scroll when messages change
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

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
        <div className="flex flex-col h-screen w-full">
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
                            onDelete={handleDelete}
                            onRestore={handleRestore}
                        />
                    ))}

                    {/* Thinking indicator */}
                    {thinkingModelInstances.length > 0 && (
                        <div className="flex gap-3 py-3 px-4">
                            <div className="shrink-0 w-8 h-8 rounded-full bg-secondary flex items-center justify-center">
                                <Loader2 className="h-4 w-4 animate-spin" />
                            </div>
                            <div className="flex-1 flex items-center">
                                <span className="text-sm text-muted-foreground">
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
    );
}

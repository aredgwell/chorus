import {
    useGCConductor,
    useGCMainMessages,
    useGCThreadMessages,
    useGenerateAIResponses,
    usePromoteGCMessage,
    useSendGCMessage,
} from "@core/chorus/gc-prototype/APIGC";
import { modelThinkingTracker } from "@core/chorus/gc-prototype/ModelThinkingTracker";
import {
    getModelAvatar,
    getModelDisplayName,
} from "@core/chorus/gc-prototype/UtilsGC";
import { convertDate, displayDate } from "@ui/lib/utils";
import { ArrowUpToLine, Loader2,MessageSquare, XIcon } from "lucide-react";
import { useEffect, useMemo,useRef, useState } from "react";

import { Button } from "../ui/button";
import { CollapsibleMessage } from "./CollapsibleMessage";

// Type for tracking individual model instances
type ModelInstance = {
    modelId: string;
    displayName: string;
    instanceNumber: number;
    totalInstances: number;
};

// Helper function to format thinking models for display
function formatThinkingModels(instances: ModelInstance[]): string {
    if (instances.length === 0) return "";
    if (instances.length === 1) {
        const instance = instances[0];
        return instance.totalInstances > 1
            ? `${instance.displayName} ${instance.instanceNumber}`
            : instance.displayName;
    }

    // Group instances by model
    const groupedByModel = new Map<string, ModelInstance[]>();
    instances.forEach((instance) => {
        const key = instance.modelId;
        if (!groupedByModel.has(key)) {
            groupedByModel.set(key, []);
        }
        groupedByModel.get(key)!.push(instance);
    });

    // Format each group
    const formattedGroups: string[] = [];
    groupedByModel.forEach((modelInstances) => {
        if (
            modelInstances.length === 1 &&
            modelInstances[0].totalInstances === 1
        ) {
            // Single instance of this model
            formattedGroups.push(modelInstances[0].displayName);
        } else {
            // Multiple instances of this model
            const modelName = modelInstances[0].displayName;
            const instanceNumbers = modelInstances
                .map((i) => i.instanceNumber)
                .join(", ");
            formattedGroups.push(`${modelName} ${instanceNumbers}`);
        }
    });

    // Join with proper grammar
    if (formattedGroups.length === 1) {
        return formattedGroups[0];
    } else if (formattedGroups.length === 2) {
        return formattedGroups.join(" and ");
    } else {
        const lastGroup = formattedGroups.pop();
        return formattedGroups.join(", ") + ", and " + lastGroup;
    }
}

interface GroupChatThreadProps {
    chatId: string;
    threadRootMessageId: string;
    onClose: () => void;
}

export default function GroupChatThread({
    chatId,
    threadRootMessageId,
    onClose,
}: GroupChatThreadProps) {
    const { data: mainMessages } = useGCMainMessages(chatId);
    const { data: threadMessages } = useGCThreadMessages(
        chatId,
        threadRootMessageId,
    );
    const { data: conductor } = useGCConductor(chatId, threadRootMessageId);

    // Debug logging for conductor state in thread
    useEffect(() => {
        console.log(
            "[UI Debug] GroupChatThread conductor state changed:",
            conductor,
        );
        console.log(
            "[UI Debug] chatId:",
            chatId,
            "threadRootMessageId:",
            threadRootMessageId,
            "conductor data:",
            conductor
                ? {
                      modelId: conductor.conductorModelId,
                      isActive: conductor.isActive,
                      turnCount: conductor.turnCount,
                      scopeId: conductor.scopeId,
                  }
                : "no conductor",
        );
    }, [conductor, chatId, threadRootMessageId]);
    const sendMessage = useSendGCMessage();
    const generateAIResponses = useGenerateAIResponses();
    const promoteMessage = usePromoteGCMessage();
    const [input, setInput] = useState("");
    const [generatingModels, setGeneratingModels] = useState<
        Map<string, number>
    >(new Map());
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);

    // Calculate which models are still thinking based on the generatingModels map
    const thinkingModelInstances = useMemo(() => {
        const instances: ModelInstance[] = [];

        // Convert the Map to ModelInstance array
        generatingModels.forEach((count, modelId) => {
            if (count > 0) {
                // Find the model config to get the display name
                const modelName = getModelDisplayName(modelId);

                // Create instances for each count
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

    // Find the root message
    const rootMessage = mainMessages?.find(
        (msg) => msg.id === threadRootMessageId,
    );

    // Auto-scroll to bottom when new messages are added
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [threadMessages]);

    // Subscribe to thinking state changes for this thread scope
    useEffect(() => {
        if (!chatId || !threadRootMessageId) return;

        const handleThinkingStateChanged = (
            thinkingModels: Map<string, number>,
        ) => {
            setGeneratingModels(thinkingModels);
        };

        // Subscribe to thread-specific scope
        const eventName = `thinkingStateChanged:${chatId}:${threadRootMessageId}`;
        modelThinkingTracker.on(eventName, handleThinkingStateChanged);

        return () => {
            modelThinkingTracker.off(eventName, handleThinkingStateChanged);
        };
    }, [chatId, threadRootMessageId]);

    const handleSendMessage = async () => {
        if (!input.trim()) return;

        const userMessage = input.trim();

        // Send user message with thread root
        await sendMessage.mutateAsync({
            chatId,
            text: userMessage,
            modelConfigId: "user",
            threadRootMessageId,
        });

        setInput("");

        // Generate AI responses - thinking states are now tracked centrally
        generateAIResponses.mutate({
            chatId,
            userMessage,
            threadRootMessageId,
        });
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            void handleSendMessage();
        }
    };

    const handlePromoteMessage = async (messageId: string) => {
        try {
            await promoteMessage.mutateAsync({ messageId, chatId });
        } catch (error) {
            console.error("Failed to promote message:", error);
        }
    };

    if (!rootMessage) {
        return (
            <div className="flex items-center justify-center h-full">
                <p className="text-sm text-muted-foreground">
                    Thread not found.
                </p>
            </div>
        );
    }

    return (
        <div className="h-full bg-background flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b">
                <div className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-muted-foreground" />
                    <p className="font-semibold">Thread</p>
                </div>
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={onClose}
                    className="h-8 w-8"
                >
                    <XIcon className="h-4 w-4" />
                </Button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-4">
                {/* Root message */}
                <div className="mb-4 pb-4 border-b">
                    <div className="flex items-start gap-3 mb-2">
                        {(() => {
                            const avatar = getModelAvatar(
                                rootMessage.modelConfigId,
                            );
                            return (
                                <div
                                    className={`shrink-0 w-8 h-8 rounded-full ${avatar.bgColor} flex items-center justify-center`}
                                >
                                    <span
                                        className={`text-xs font-medium ${avatar.textColor}`}
                                    >
                                        {avatar.initials}
                                    </span>
                                </div>
                            );
                        })()}
                        <div className="flex-1">
                            <div className="flex items-baseline gap-2 mb-1">
                                <span className="font-medium text-sm">
                                    {getModelDisplayName(
                                        rootMessage.modelConfigId,
                                    )}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                    {displayDate(
                                        convertDate(rootMessage.createdAt),
                                    )}
                                </span>
                            </div>
                            <CollapsibleMessage text={rootMessage.text} />
                        </div>
                    </div>
                    {threadMessages && threadMessages.length > 0 && (
                        <p className="text-xs text-muted-foreground mt-2">
                            {threadMessages.length}{" "}
                            {threadMessages.length === 1 ? "reply" : "replies"}
                        </p>
                    )}
                </div>

                {/* Thread messages */}
                {threadMessages?.map((message) => {
                    const avatar = getModelAvatar(message.modelConfigId);
                    return (
                        <div
                            key={message.id}
                            className="flex items-start gap-3 mb-4 group"
                        >
                            <div
                                className={`shrink-0 w-8 h-8 rounded-full ${avatar.bgColor} flex items-center justify-center`}
                            >
                                <span
                                    className={`text-xs font-medium ${avatar.textColor}`}
                                >
                                    {avatar.initials}
                                </span>
                            </div>
                            <div className="flex-1 relative">
                                <div className="flex items-baseline gap-2 mb-1">
                                    <span className="font-medium text-sm">
                                        {getModelDisplayName(
                                            message.modelConfigId,
                                        )}
                                    </span>
                                    <span className="text-xs text-muted-foreground">
                                        {displayDate(
                                            convertDate(message.createdAt),
                                        )}
                                    </span>
                                </div>
                                <CollapsibleMessage text={message.text} />
                                {!message.isDeleted && (
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="absolute top-0 right-0 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                                        onClick={() =>
                                            handlePromoteMessage(message.id)
                                        }
                                        title="Send to main chat"
                                    >
                                        <ArrowUpToLine className="h-3 w-3" />
                                    </Button>
                                )}
                            </div>
                        </div>
                    );
                })}

                {/* Typing indicator */}
                {thinkingModelInstances.length > 0 && (
                    <div className="flex gap-3">
                        <div className="shrink-0 w-8 h-8 rounded-full bg-secondary flex items-center justify-center">
                            <Loader2 className="h-4 w-4 animate-spin" />
                        </div>
                        <div className="flex-1">
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
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

                <div ref={messagesEndRef} />
            </div>

            {/* Conductor indicator */}
            {conductor && (
                <div className="px-4 py-2 bg-secondary/50 border-t">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>
                            {getModelDisplayName(conductor.conductorModelId)} is
                            conducting.
                        </span>
                    </div>
                </div>
            )}

            {/* Input */}
            <div className="border-t p-4">
                <div className="flex gap-2">
                    <textarea
                        ref={inputRef}
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Reply in thread..."
                        className="flex-1 resize-none rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                        rows={1}
                    />
                </div>
            </div>
        </div>
    );
}

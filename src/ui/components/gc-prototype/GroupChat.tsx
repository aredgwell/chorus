import { useChat } from "@core/chorus/api/ChatAPI";
import {
    useDeleteGCMessage,
    useGCConductor,
    useGCMainMessages,
    useGCThreadCounts,
    useGenerateAIResponses,
    useRestoreGCMessage,
    useSendGCMessage,
} from "@core/chorus/gc-prototype/APIGC";
import { modelThinkingTracker } from "@core/chorus/gc-prototype/ModelThinkingTracker";
import {
    getModelAvatar,
    getModelDisplayName,
} from "@core/chorus/gc-prototype/UtilsGC";
import { convertDate, displayDate } from "@ui/lib/utils";
import {
    ArrowUpToLine,
    Info,
    Loader2,
    MessageSquare,
    TriangleAlert,
    Undo2,
    Users,
    X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";

import { Button } from "../ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { CollapsibleMessage } from "./CollapsibleMessage";
import GroupChatThread from "./GroupChatThread";

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

export default function GroupChat() {
    const { chatId } = useParams<{ chatId: string }>();
    const { data: chat } = useChat(chatId || "");
    const { data: messages } = useGCMainMessages(chatId || "");
    const { data: threadCounts } = useGCThreadCounts(chatId || "");
    const { data: conductor } = useGCConductor(chatId || "");

    // Debug logging for conductor state
    useEffect(() => {
        console.log("[UI Debug] GroupChat conductor state changed:", conductor);
        console.log(
            "[UI Debug] chatId:",
            chatId,
            "conductor data:",
            conductor
                ? {
                      modelId: conductor.conductorModelId,
                      isActive: conductor.isActive,
                      turnCount: conductor.turnCount,
                  }
                : "no conductor",
        );
    }, [conductor, chatId]);
    const sendMessage = useSendGCMessage();
    const generateAIResponses = useGenerateAIResponses();
    const deleteMessage = useDeleteGCMessage();
    const restoreMessage = useRestoreGCMessage();
    const [input, setInput] = useState("");
    const [generatingModels, setGeneratingModels] = useState<
        Map<string, number>
    >(new Map());
    const [threadRootMessageId, setThreadRootMessageId] = useState<
        string | null
    >(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    // Subscribe to thinking state changes for main chat scope
    useEffect(() => {
        if (!chatId) return;

        const handleThinkingStateChanged = (
            thinkingModels: Map<string, number>,
        ) => {
            setGeneratingModels(thinkingModels);
        };

        // Subscribe to main chat scope (no scopeId)
        const eventName = `thinkingStateChanged:${chatId}:main`;
        modelThinkingTracker.on(eventName, handleThinkingStateChanged);

        return () => {
            modelThinkingTracker.off(eventName, handleThinkingStateChanged);
        };
    }, [chatId]);

    // Clear generatingModels when chatId changes
    useEffect(() => {
        setGeneratingModels(new Map());
    }, [chatId]);

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

        console.log(
            "[ThinkingIndicator] Generating models:",
            Object.fromEntries(generatingModels),
        );
        console.log("[ThinkingIndicator] Thinking instances:", instances);

        return instances;
    }, [generatingModels]);

    const handleSend = async () => {
        if (!input.trim() || !chatId) return;

        const userMessage = input.trim();

        // Use the user model config
        await sendMessage.mutateAsync({
            chatId,
            text: userMessage,
            modelConfigId: "user",
        });

        setInput("");

        // Trigger AI responses - thinking states are now tracked centrally
        generateAIResponses.mutate({
            chatId,
            userMessage,
        });
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            void handleSend();
        }
    };

    if (!messages || messages.length === 0) {
        return (
            <div className="flex flex-col h-screen w-full">
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
                    <div className="bg-secondary rounded-full p-6 mb-6">
                        <Users className="w-12 h-12 text-secondary-foreground" />
                    </div>

                    <h1 className="text-3xl font-bold mb-4">Group Chat</h1>

                    <p className="mb-2">
                        Use cmd+shift+G from anywhere to make a new group chat
                    </p>

                    <div className="flex flex-row text-left gap-6">
                        <TriangleAlert />
                        <p>This is an experimental feature. May be unstable.</p>
                    </div>
                </div>

                <div className="border-t p-4">
                    <textarea
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyPress={handleKeyPress}
                        placeholder="Type a message..."
                        className="w-full min-h-[60px] px-4 py-3 rounded-lg border bg-background resize-none focus:outline-hidden focus:ring-2 focus:ring-primary"
                        rows={2}
                    />
                </div>
            </div>
        );
    }

    return (
        <div className="flex h-screen w-full">
            <div className="flex flex-col flex-1">
                {/* Header */}
                <div
                    className="border-b px-4 py-3 flex items-center gap-3"
                    data-tauri-drag-region
                >
                    <div className="bg-secondary rounded-full p-2">
                        <Users className="w-5 h-5 text-secondary-foreground" />
                    </div>
                    <h1 className="text-md">Group Chat</h1>
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button variant="outline" className="h-8">
                                <Info className="h-4 w-4" /> Tutorial
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent
                            className="w-[800px] max-h-[600px] overflow-y-auto"
                            align="start"
                        >
                            <div className="grid grid-cols-2 gap-6">
                                {/* Left column - Instructions */}
                                <div className="space-y-3">
                                    <h3 className="font-bold text-sm">
                                        Tutorial
                                    </h3>
                                    <div className="space-y-3 text-sm">
                                        <p>
                                            <span className="font-medium text-foreground">
                                                1.
                                            </span>{" "}
                                            Use cmd+shift+G to make a new group
                                            chat. (You already did this!)
                                        </p>
                                        <p>
                                            <span className="font-medium text-foreground">
                                                2.
                                            </span>{" "}
                                            The main responder is Claude Sonnet
                                            4 (@sonnet). Sonnet will respond by
                                            default.
                                        </p>
                                        <p>
                                            <span className="font-medium text-foreground">
                                                3.
                                            </span>{" "}
                                            If you want someone else to respond,
                                            just @-mention them. If you
                                            @-mention multiple models, they'll
                                            all respond in parallel. If you
                                            include{" "}
                                            <code className="bg-secondary text-secondary-foreground px-1 rounded">
                                                x2
                                            </code>{" "}
                                            (or{" "}
                                            <code className="bg-secondary text-secondary-foreground px-1 rounded">
                                                x3
                                            </code>{" "}
                                            or{" "}
                                            <code className="bg-secondary text-secondary-foreground px-1 rounded">
                                                x4
                                            </code>
                                            ) in your message, two (or three or
                                            four) instances of each model will
                                            respond.
                                        </p>
                                        <p>
                                            <span className="font-medium text-foreground">
                                                4.
                                            </span>{" "}
                                            Hover over a message and click the
                                            comment icon to start a thread.
                                        </p>
                                        <p>
                                            <span className="font-medium text-foreground">
                                                5.
                                            </span>{" "}
                                            Use the "X" to hide any message from
                                            context. You can always bring them
                                            back.
                                        </p>
                                        <p>
                                            <span className="font-medium text-foreground">
                                                6.
                                            </span>{" "}
                                            Use{" "}
                                            <code className="bg-secondary text-secondary-foreground px-1 rounded">
                                                /conduct
                                            </code>{" "}
                                            to hand over control of the chat to
                                            a model. This will give the model
                                            the ability to @-mention other
                                            models. For example, try saying{" "}
                                            <em>
                                                "Brainstorm some ideas for my
                                                rock opera, Newtopia Rising
                                                /conduct"
                                            </em>
                                            . Since Sonnet is the main
                                            responder, Sonnet becomes the
                                            conductor. It has the ability to
                                            @-mention other models.
                                        </p>
                                    </div>
                                </div>

                                {/* Right column - Model handles */}
                                <div className="space-y-4">
                                    <div>
                                        <h3 className="font-bold text-sm mb-3">
                                            Model Handles
                                        </h3>
                                        <div className="space-y-1 text-xs">
                                            <div className="flex items-center gap-2 py-1">
                                                <code className="bg-secondary text-secondary-foreground px-1.5 py-0.5 rounded text-xs font-mono font-medium min-w-[140px]">
                                                    @41 or @4.1
                                                </code>
                                                <span className="text-xs text-muted-foreground">
                                                    → GPT-4.1
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2 py-1">
                                                <code className="bg-secondary text-secondary-foreground px-1.5 py-0.5 rounded text-xs font-mono font-medium min-w-[140px]">
                                                    @4o
                                                </code>
                                                <span className="text-xs text-muted-foreground">
                                                    → GPT-4o
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2 py-1">
                                                <code className="bg-secondary text-secondary-foreground px-1.5 py-0.5 rounded text-xs font-mono font-medium min-w-[140px]">
                                                    @claude or @sonnet
                                                </code>
                                                <span className="text-xs text-muted-foreground">
                                                    → Claude Sonnet
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2 py-1">
                                                <code className="bg-secondary text-secondary-foreground px-1.5 py-0.5 rounded text-xs font-mono font-medium min-w-[140px]">
                                                    @opus
                                                </code>
                                                <span className="text-xs text-muted-foreground">
                                                    → Claude Opus
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2 py-1">
                                                <code className="bg-secondary text-secondary-foreground px-1.5 py-0.5 rounded text-xs font-mono font-medium min-w-[140px]">
                                                    @gemini
                                                </code>
                                                <span className="text-xs text-muted-foreground">
                                                    → Gemini Pro
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2 py-1">
                                                <code className="bg-secondary text-secondary-foreground px-1.5 py-0.5 rounded text-xs font-mono font-medium min-w-[140px]">
                                                    @flash
                                                </code>
                                                <span className="text-xs text-muted-foreground">
                                                    → Gemini Flash
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2 py-1">
                                                <code className="bg-secondary text-secondary-foreground px-1.5 py-0.5 rounded text-xs font-mono font-medium min-w-[140px]">
                                                    @o3 or @o3pro
                                                </code>
                                                <span className="text-xs text-muted-foreground">
                                                    → o3 or o3-pro
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    <div>
                                        <h3 className="font-bold text-sm mb-3">
                                            Presets
                                        </h3>
                                        <div className="space-y-1 text-xs">
                                            <div className="flex items-center gap-2 py-1">
                                                <code className="bg-secondary text-secondary-foreground px-1.5 py-0.5 rounded text-xs font-mono font-medium min-w-[140px]">
                                                    @brainstorm
                                                </code>
                                                <span className="text-xs text-muted-foreground">
                                                    → Gemini Flash, Claude
                                                    Sonnet, GPT-4.1
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2 py-1">
                                                <code className="bg-secondary text-secondary-foreground px-1.5 py-0.5 rounded text-xs font-mono font-medium min-w-[140px]">
                                                    @think
                                                </code>
                                                <span className="text-xs text-muted-foreground">
                                                    → o3-pro, Claude Opus,
                                                    Gemini Pro
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2 py-1">
                                                <code className="bg-secondary text-secondary-foreground px-1.5 py-0.5 rounded text-xs font-mono font-medium min-w-[140px]">
                                                    @none
                                                </code>
                                                <span className="text-xs text-muted-foreground">
                                                    → No models respond
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </PopoverContent>
                    </Popover>
                    {chat && (
                        <span className="text-sm text-muted-foreground ml-auto">
                            Created {displayDate(convertDate(chat.createdAt))}
                        </span>
                    )}
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {messages.map((message) => {
                        const avatar = getModelAvatar(message.modelConfigId);
                        return (
                            <div key={message.id} className="flex gap-3 group">
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
                                    {message.isDeleted ? (
                                        <>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-5 w-5 absolute top-0 right-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                                onClick={() => {
                                                    if (chatId) {
                                                        restoreMessage.mutate({
                                                            messageId:
                                                                message.id,
                                                            chatId,
                                                        });
                                                    }
                                                }}
                                            >
                                                <Undo2 className="h-3 w-3" />
                                            </Button>
                                            <div className="text-sm text-muted-foreground italic">
                                                Message deleted
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            <div className="absolute top-0 right-0 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-5 w-5"
                                                    onClick={() =>
                                                        setThreadRootMessageId(
                                                            message.id,
                                                        )
                                                    }
                                                    title="Reply in thread"
                                                >
                                                    <MessageSquare className="h-3 w-3" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-5 w-5"
                                                    onClick={() => {
                                                        if (chatId) {
                                                            deleteMessage.mutate(
                                                                {
                                                                    messageId:
                                                                        message.id,
                                                                    chatId,
                                                                },
                                                            );
                                                        }
                                                    }}
                                                >
                                                    <X className="h-3 w-3" />
                                                </Button>
                                            </div>
                                            <CollapsibleMessage
                                                text={message.text}
                                            />
                                            {message.promotedFromMessageId && (
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="mt-1 h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
                                                    onClick={() => {
                                                        // Find the original message's thread root
                                                        const originalMessage =
                                                            messages.find(
                                                                (m) =>
                                                                    m.id ===
                                                                    message.promotedFromMessageId,
                                                            );
                                                        if (
                                                            originalMessage?.threadRootMessageId
                                                        ) {
                                                            setThreadRootMessageId(
                                                                originalMessage.threadRootMessageId,
                                                            );
                                                        }
                                                    }}
                                                >
                                                    <ArrowUpToLine className="h-3 w-3 mr-1" />
                                                    Promoted from thread
                                                </Button>
                                            )}
                                            {threadCounts &&
                                                threadCounts[message.id] >
                                                    0 && (
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="mt-1 h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
                                                        onClick={() =>
                                                            setThreadRootMessageId(
                                                                message.id,
                                                            )
                                                        }
                                                    >
                                                        <MessageSquare className="h-3 w-3 mr-1" />
                                                        {
                                                            threadCounts[
                                                                message.id
                                                            ]
                                                        }{" "}
                                                        {threadCounts[
                                                            message.id
                                                        ] === 1
                                                            ? "reply"
                                                            : "replies"}
                                                    </Button>
                                                )}
                                        </>
                                    )}
                                </div>
                            </div>
                        );
                    })}

                    {/* Unified typing indicator */}
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
                                {getModelDisplayName(
                                    conductor.conductorModelId,
                                )}{" "}
                                is conducting.
                            </span>
                        </div>
                    </div>
                )}

                {/* Input */}
                <div className="border-t p-4">
                    <textarea
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyPress={handleKeyPress}
                        placeholder="Type a message..."
                        className="w-full min-h-[60px] px-4 py-3 rounded-lg border bg-background resize-none focus:outline-hidden focus:ring-2 focus:ring-primary"
                        rows={2}
                    />
                </div>
            </div>

            {/* Thread Sidebar */}
            {threadRootMessageId && chatId && (
                <div className="w-96 border-l shrink-0">
                    <GroupChatThread
                        chatId={chatId}
                        threadRootMessageId={threadRootMessageId}
                        onClose={() => setThreadRootMessageId(null)}
                    />
                </div>
            )}
        </div>
    );
}

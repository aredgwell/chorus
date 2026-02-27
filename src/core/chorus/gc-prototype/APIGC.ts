import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as db from "@core/chorus/DB";
import * as ModelsAPI from "@core/chorus/api/ModelsAPI";
import * as gcdb from "@core/chorus/gc-prototype/DBGC";
import { v4 as uuidv4 } from "uuid";
import { chatQueries } from "@core/chorus/api/ChatAPI";
import { getApiKeys } from "@core/chorus/api/AppMetadataAPI";
import { LLMMessage, ModelConfig, streamResponse } from "@core/chorus/Models";
import { modelThinkingTracker } from "@core/chorus/gc-prototype/ModelThinkingTracker";
import {
    getChatFormatPrompt,
    getConductorPrompt,
    getNonConductorPrompt,
    getConductorReminder,
} from "@core/chorus/gc-prototype/PromptsGC";

// Command detection utilities
export function containsConductCommand(text: string): boolean {
    return text.includes("/conduct");
}

export function containsYieldCommand(text: string): boolean {
    return text.includes("/yield");
}

export const gcMessageQueries = {
    list: (chatId: string) => ({
        queryKey: ["gcMessages", chatId] as const,
        queryFn: () => gcdb.fetchGCMessages(chatId),
    }),
    mainMessages: (chatId: string) => ({
        queryKey: ["gcMainMessages", chatId] as const,
        queryFn: () => gcdb.fetchGCMainMessages(chatId),
    }),
    threadMessages: (chatId: string, threadRootId: string) => ({
        queryKey: ["gcThreadMessages", chatId, threadRootId] as const,
        queryFn: () => gcdb.fetchGCThreadMessages(chatId, threadRootId),
    }),
    threadCounts: (chatId: string) => ({
        queryKey: ["gcThreadCounts", chatId] as const,
        queryFn: async () => {
            const messages = await gcdb.fetchGCMainMessages(chatId);
            const counts: Record<string, number> = {};
            for (const message of messages) {
                counts[message.id] = await gcdb.countGCThreadReplies(
                    chatId,
                    message.id,
                );
            }
            return counts;
        },
    }),
};

export const gcConductorQueries = {
    activeConductor: (chatId: string, scopeId?: string) => {
        // Normalize scopeId to ensure consistency with database
        const normalizedScopeId = scopeId ?? null;
        const queryKey = ["gcConductor", chatId, normalizedScopeId] as const;
        return {
            queryKey,
            queryFn: async () => {
                const result = await gcdb.fetchActiveConductor(chatId, scopeId);
                // TanStack Query requires a defined value - use null instead of undefined
                return result ?? null;
            },
        };
    },
};

export function useGCMessages(chatId: string) {
    return useQuery(gcMessageQueries.list(chatId));
}

export function useGCMainMessages(chatId: string) {
    return useQuery(gcMessageQueries.mainMessages(chatId));
}

export function useGCThreadMessages(chatId: string, threadRootId: string) {
    return useQuery(gcMessageQueries.threadMessages(chatId, threadRootId));
}

export function useGCThreadCounts(chatId: string) {
    return useQuery(gcMessageQueries.threadCounts(chatId));
}

export function useGCConductor(chatId: string, scopeId?: string) {
    return useQuery(gcConductorQueries.activeConductor(chatId, scopeId));
}

/**
 * Hook to clear conductor with automatic query invalidation
 * Centralizes conductor clearing logic to ensure consistency
 */
export function useClearConductor() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationKey: ["clearConductor"] as const,
        mutationFn: async ({
            chatId,
            scopeId,
        }: {
            chatId: string;
            scopeId?: string;
        }) => {
            await gcdb.clearConductor(chatId, scopeId);
        },
        onSuccess: async (_, variables) => {
            // Always invalidate the conductor query when clearing
            await queryClient.invalidateQueries({
                queryKey: [
                    "gcConductor",
                    variables.chatId,
                    variables.scopeId ?? null,
                ],
            });
        },
    });
}

/**
 * Main orchestration function for conductor sessions
 * Manages the conductor lifecycle and automatic invocations
 */
export async function orchestrateConductorSession({
    chatId,
    scopeId,
    conductorModelId,
    queryClient,
    onConductorComplete,
    onConductorError,
}: {
    chatId: string;
    scopeId?: string;
    conductorModelId: string;
    queryClient: ReturnType<typeof useQueryClient>;
    onConductorComplete?: () => void;
    onConductorError?: (error: unknown) => void;
}) {
    try {
        // Set the new conductor
        await gcdb.setConductor(chatId, scopeId, conductorModelId);

        // Invalidate conductor queries
        await queryClient.invalidateQueries({
            queryKey: ["gcConductor", chatId, scopeId ?? null],
        });

        // Perform ONE conductor turn
        // The conductor will be invoked again after models respond (unless it yields or hits turn limit)
        const turnCount = await gcdb.incrementConductorTurn(chatId, scopeId);
        console.log("[Conductor] Turn count:", turnCount);

        // Re-fetch messages to get latest state
        await queryClient.refetchQueries(gcMessageQueries.list(chatId));
        const currentMessages = await queryClient.ensureQueryData(
            gcMessageQueries.list(chatId),
        );

        // Encode conversation from conductor's POV with conductor instructions
        const encodedConversation = await encodeConversation(
            currentMessages,
            conductorModelId,
            !!scopeId,
            scopeId,
            true, // isConductor = true
        );

        // Generate conductor response
        const responseText = await generateGroupChatResponse(
            conductorModelId,
            encodedConversation,
            chatId,
            scopeId,
        );

        // Check for /yield command
        if (containsYieldCommand(responseText)) {
            console.log("[Conductor] Conductor yielded control");
            // Clear conductor and exit
            await gcdb.clearConductor(chatId, scopeId);

            // Save conductor response with yield
            const messageId = uuidv4().toLowerCase();
            await gcdb.insertGCMessage(
                chatId,
                messageId,
                responseText,
                conductorModelId,
                scopeId,
            );

            // Invalidate queries
            await queryClient.invalidateQueries({
                queryKey: ["gcMessages", chatId],
            });
            await queryClient.invalidateQueries({
                queryKey: ["gcMainMessages", chatId],
            });
            await queryClient.invalidateQueries({
                queryKey: ["gcThreadMessages", chatId],
            });
            await queryClient.invalidateQueries({
                queryKey: ["gcConductor", chatId, scopeId ?? null],
            });

            if (onConductorComplete) {
                onConductorComplete();
            }
            return;
        }

        // Save conductor response
        const messageId = uuidv4().toLowerCase();
        await gcdb.insertGCMessage(
            chatId,
            messageId,
            responseText,
            conductorModelId,
            scopeId,
        );

        // Invalidate queries
        await queryClient.invalidateQueries({
            queryKey: ["gcMessages", chatId],
        });
        await queryClient.invalidateQueries({
            queryKey: ["gcMainMessages", chatId],
        });
        await queryClient.invalidateQueries({
            queryKey: ["gcThreadMessages", chatId],
        });

        // Check if conductor mentioned any models
        const { models } = await getRespondingModels(responseText);
        console.log("[Conductor] Models mentioned by conductor:", models);

        if (models.length > 0) {
            // Generate responses from mentioned models
            await Promise.all(
                models.map(async (model) => {
                    try {
                        const modelMessages = await queryClient.ensureQueryData(
                            gcMessageQueries.list(chatId),
                        );

                        const modelConversation = await encodeConversation(
                            modelMessages,
                            model.id,
                            !!scopeId,
                            scopeId,
                        );

                        const modelResponse = await generateGroupChatResponse(
                            model.id,
                            modelConversation,
                            chatId,
                            scopeId,
                        );

                        const modelMessageId = uuidv4().toLowerCase();
                        await gcdb.insertGCMessage(
                            chatId,
                            modelMessageId,
                            modelResponse,
                            model.id,
                            scopeId,
                        );
                    } catch (error) {
                        console.error(
                            `Conductor failed to get response from ${model.name}:`,
                            error,
                        );
                    }
                }),
            );

            // Invalidate queries after all model responses
            await queryClient.invalidateQueries({
                queryKey: ["gcMessages", chatId],
            });
            await queryClient.invalidateQueries({
                queryKey: ["gcMainMessages", chatId],
            });
            await queryClient.invalidateQueries({
                queryKey: ["gcThreadMessages", chatId],
            });
        }

        // Check if we hit the turn limit
        if (turnCount >= 10) {
            await gcdb.clearConductor(chatId, scopeId);
            await queryClient.invalidateQueries({
                queryKey: ["gcConductor", chatId, scopeId ?? null],
            });

            if (onConductorComplete) {
                onConductorComplete();
            }
            return;
        }

        // If we're still under the turn limit and haven't yielded, continue conducting
        await orchestrateConductorSession({
            chatId,
            scopeId,
            conductorModelId,
            queryClient,
            onConductorComplete,
            onConductorError,
        });
    } catch (error) {
        console.error("Conductor session error:", error);

        // Clear conductor on error
        await gcdb.clearConductor(chatId, scopeId);
        await queryClient.invalidateQueries({
            queryKey: ["gcConductor", chatId, scopeId ?? null],
        });

        if (onConductorError) {
            onConductorError(error);
        }
    }
}

export function useSendGCMessage() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationKey: ["sendGCMessage"] as const,
        mutationFn: async ({
            chatId,
            text,
            modelConfigId,
            threadRootMessageId,
        }: {
            chatId: string;
            text: string;
            modelConfigId: string;
            threadRootMessageId?: string;
        }) => {
            const messageId = uuidv4().toLowerCase();
            await gcdb.insertGCMessage(
                chatId,
                messageId,
                text,
                modelConfigId,
                threadRootMessageId,
            );

            // Update the chat's updated_at timestamp
            await db.db.execute(
                `UPDATE chats SET updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
                [chatId],
            );

            return messageId;
        },
        onSuccess: async (_, variables) => {
            // Invalidate all message queries for this chat
            await queryClient.invalidateQueries({
                queryKey: ["gcMessages", variables.chatId],
            });
            await queryClient.invalidateQueries({
                queryKey: ["gcMainMessages", variables.chatId],
            });
            await queryClient.invalidateQueries({
                queryKey: ["gcThreadMessages", variables.chatId],
            });
            await queryClient.invalidateQueries({
                queryKey: ["gcThreadCounts", variables.chatId],
            });
            // Also invalidate the chat queries to update the sidebar
            await queryClient.invalidateQueries(chatQueries.list());
        },
    });
}

export function useDeleteGCMessage() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationKey: ["deleteGCMessage"] as const,
        mutationFn: async ({
            messageId,
            chatId,
        }: {
            messageId: string;
            chatId: string;
        }) => {
            await gcdb.softDeleteGCMessage(messageId);

            // Update the chat's updated_at timestamp
            await db.db.execute(
                `UPDATE chats SET updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
                [chatId],
            );
        },
        onSuccess: async (_, variables) => {
            // Invalidate all message queries for this chat
            await queryClient.invalidateQueries({
                queryKey: ["gcMessages", variables.chatId],
            });
            await queryClient.invalidateQueries({
                queryKey: ["gcMainMessages", variables.chatId],
            });
            await queryClient.invalidateQueries({
                queryKey: ["gcThreadMessages", variables.chatId],
            });
            await queryClient.invalidateQueries({
                queryKey: ["gcThreadCounts", variables.chatId],
            });
            // Also invalidate the chat queries to update the sidebar
            await queryClient.invalidateQueries(chatQueries.list());
        },
    });
}

export function useRestoreGCMessage() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationKey: ["restoreGCMessage"] as const,
        mutationFn: async ({
            messageId,
            chatId,
        }: {
            messageId: string;
            chatId: string;
        }) => {
            await gcdb.restoreGCMessage(messageId);

            // Update the chat's updated_at timestamp
            await db.db.execute(
                `UPDATE chats SET updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
                [chatId],
            );
        },
        onSuccess: async (_, variables) => {
            // Invalidate all message queries for this chat
            await queryClient.invalidateQueries({
                queryKey: ["gcMessages", variables.chatId],
            });
            await queryClient.invalidateQueries({
                queryKey: ["gcMainMessages", variables.chatId],
            });
            await queryClient.invalidateQueries({
                queryKey: ["gcThreadMessages", variables.chatId],
            });
            await queryClient.invalidateQueries({
                queryKey: ["gcThreadCounts", variables.chatId],
            });
            // Also invalidate the chat queries to update the sidebar
            await queryClient.invalidateQueries(chatQueries.list());
        },
    });
}

/**
 * Encodes a group chat conversation into LLMMessages from a specific model's POV
 * @param messages - The group chat messages to encode
 * @param povModelConfigId - The model config ID whose POV we're encoding from
 * @param isThread - Whether we're encoding for a thread context
 * @param threadRootId - The root message ID if in a thread
 * @returns Array of LLMMessage objects suitable for sending to an LLM
 */
export async function encodeConversation(
    messages: gcdb.GCMessage[],
    povModelConfigId: string,
    isThread: boolean = false,
    threadRootId?: string,
    isConductor: boolean = false,
): Promise<LLMMessage[]> {
    const result: LLMMessage[] = [];

    // Fetch model configs to get the display name
    const allConfigs = await ModelsAPI.fetchModelConfigs();
    const modelConfig = allConfigs.find(
        (config) => config.modelId === povModelConfigId,
    );
    const modelName = modelConfig?.displayName || povModelConfigId;

    // Add chat format explanation prompt (for all models)
    result.push({
        role: "user",
        content: getChatFormatPrompt(modelName),
        attachments: [],
    });

    // Add conductor/non-conductor specific prompts
    if (isConductor) {
        result.push({
            role: "user",
            content: getConductorPrompt(modelName),
            attachments: [],
        });
    } else {
        result.push({
            role: "user",
            content: getNonConductorPrompt(modelName),
            attachments: [],
        });
    }

    // Filter messages based on context (main chat vs thread)
    let activeMessages = messages.filter((m) => !m.isDeleted);

    if (isThread && threadRootId) {
        // In a thread: include main messages up to and including root, plus thread messages
        const rootIndex = activeMessages.findIndex(
            (m) => m.id === threadRootId,
        );
        const mainMessagesUpToRoot = activeMessages
            .slice(0, rootIndex + 1)
            .filter((m) => !m.threadRootMessageId);
        const threadMessages = activeMessages.filter(
            (m) => m.threadRootMessageId === threadRootId,
        );
        activeMessages = [...mainMessagesUpToRoot, ...threadMessages];
    } else {
        // In main chat: exclude all thread messages
        activeMessages = activeMessages.filter((m) => !m.threadRootMessageId);
    }

    for (const message of activeMessages) {
        if (message.modelConfigId === povModelConfigId) {
            // Messages from POV model become assistant messages
            result.push({
                role: "assistant",
                content: message.text,
                model: povModelConfigId,
                toolCalls: [],
            });
        } else if (message.modelConfigId === "user") {
            // User messages stay as user messages
            result.push({
                role: "user",
                content: message.text,
                attachments: [],
            });
        } else {
            // Messages from other models are wrapped in chorus_message tags
            result.push({
                role: "user",
                content: `<chorus_message sender="${message.modelConfigId}">${message.text}</chorus_message>`,
                attachments: [],
            });
        }
    }

    // Add conductor reminder at the end if this is a conductor
    if (isConductor) {
        result.push({
            role: "user",
            content: getConductorReminder(),
            attachments: [],
        });
    }

    return result;
}

/**
 * Mapping of model handles to model config IDs
 * Handles can map to a single model ID (string) or multiple model IDs (array)
 */
export const MODEL_HANDLE_MAP: Record<string, string | string[]> = {
    // Claude models
    claude: "anthropic::claude-sonnet-4-latest",
    sonnet: "anthropic::claude-sonnet-4-latest",
    opus: "anthropic::claude-opus-4-latest",

    // Gemini models
    gemini: "google::gemini-2.5-pro-latest",
    flash: "google::gemini-2.5-flash-preview-04-17",

    // OpenAI models
    "41": "openai::gpt-4.1",
    o3: "openai::o3",
    o3pro: "openai::o3-pro",

    // Legacy handles for backward compatibility
    "4o": "openai::gpt-4o",
    "4.1": "openai::gpt-4.1",

    // Multi-model handles
    brainstorm: [
        "google::gemini-2.5-flash-preview-04-17",
        "anthropic::claude-sonnet-4-latest",
        "openai::gpt-4.1",
    ],
    think: [
        "openai::o3-pro",
        "anthropic::claude-opus-4-latest",
        "google::gemini-2.5-pro-latest",
    ],
};

/**
 * Wrapper around streamResponse that collects the full response without streaming
 * @param modelConfig - The model configuration
 * @param conversation - The conversation messages
 * @param chatId - The chat ID for tracking thinking state
 * @param scopeId - Optional scope ID (thread root message ID) for tracking thinking state
 * @returns The complete response text
 */
async function generateResponseWithStreamAPI(
    modelConfig: ModelConfig,
    conversation: LLMMessage[],
    chatId: string,
    scopeId?: string,
): Promise<string> {
    const apiKeys = await getApiKeys();
    let fullResponse = "";
    let error: string | null = null;

    // Start thinking tracking
    modelThinkingTracker.startThinking(modelConfig.modelId, chatId, scopeId);

    try {
        await streamResponse({
            modelConfig,
            llmConversation: conversation,
            apiKeys,
            onChunk: (chunk: string) => {
                fullResponse += chunk;
            },
            onComplete: async () => {
                // Response completed successfully
                modelThinkingTracker.stopThinking(
                    modelConfig.modelId,
                    chatId,
                    scopeId,
                );
                await Promise.resolve(); // Satisfy async requirement
            },
            onError: (errorMessage: string) => {
                error = errorMessage;
                modelThinkingTracker.stopThinking(
                    modelConfig.modelId,
                    chatId,
                    scopeId,
                );
            },
            additionalHeaders: {
                "X-Melty-Request-Type": "gc_prototype_chat",
            },
        });

        if (error) {
            throw new Error(error);
        }

        return fullResponse;
    } catch (err) {
        // Ensure we stop thinking on any error
        modelThinkingTracker.stopThinking(modelConfig.modelId, chatId, scopeId);
        throw err;
    }
}

/**
 * Generates a response from an AI model for the group chat
 * @param modelId - The model ID (e.g., "openai::gpt-4.1")
 * @param conversation - The encoded conversation from the model's POV
 * @param chatId - The chat ID for tracking thinking state
 * @param scopeId - Optional scope ID (thread root message ID) for tracking thinking state
 * @returns The generated response text
 */
async function generateGroupChatResponse(
    modelId: string,
    conversation: LLMMessage[],
    chatId: string,
    scopeId?: string,
): Promise<string> {
    // Fetch all model configs to find the one we need
    const allConfigs = await ModelsAPI.fetchModelConfigs();
    const modelConfig = allConfigs.find((config) => config.modelId === modelId);

    if (!modelConfig) {
        throw new Error(`Model config not found for: ${modelId}`);
    }

    // Use the unified stream API wrapper
    return generateResponseWithStreamAPI(
        modelConfig,
        conversation,
        chatId,
        scopeId,
    );
}

/**
 * Extracts multiplier from message text (x2, x3, x4)
 * @param text - The message text
 * @returns The multiplier value (1-4)
 */
export function extractMultiplier(text: string): number {
    const match = text.match(/\bx([2-4])\b/i);
    if (match) {
        return parseInt(match[1], 10);
    }
    return 1;
}

/**
 * Determines which models should respond based on message content
 * @param text - The user's message text
 * @returns Array of model IDs that should respond with multiplier
 */
async function getRespondingModels(text: string): Promise<{
    models: Array<{ id: string; name: string }>;
    multiplier: number;
}> {
    // Default model for group chat (Claude Sonnet)
    const defaultModelId = "anthropic::claude-sonnet-4-latest";

    // Extract multiplier
    const multiplier = extractMultiplier(text);

    // Check for @none - no models should respond
    if (text.toLowerCase().includes("@none")) {
        return { models: [], multiplier };
    }

    // Check for model handles in the text
    const mentionedModelIds: string[] = [];
    const lowerText = text.toLowerCase();

    for (const [handle, modelIdOrIds] of Object.entries(MODEL_HANDLE_MAP)) {
        if (lowerText.includes(`@${handle}`)) {
            // Handle can map to a single model or multiple models
            if (Array.isArray(modelIdOrIds)) {
                mentionedModelIds.push(...modelIdOrIds);
            } else {
                mentionedModelIds.push(modelIdOrIds);
            }
        }
    }

    let models: Array<{ id: string; name: string }>;
    if (mentionedModelIds.length > 0) {
        // Fetch model configs to get display names
        const allConfigs = await ModelsAPI.fetchModelConfigs();
        models = mentionedModelIds
            .map((id) => {
                const config = allConfigs.find((c) => c.modelId === id);
                return config ? { id, name: config.displayName } : null;
            })
            .filter((m): m is { id: string; name: string } => m !== null);
    } else {
        // Default: only the default model responds
        models = [{ id: defaultModelId, name: "Claude Sonnet" }];
    }

    return { models, multiplier };
}

/**
 * Hook to generate AI responses after a user message
 */
export function useGenerateAIResponses() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationKey: ["generateAIResponses"] as const,
        mutationFn: async ({
            chatId,
            userMessage,
            threadRootMessageId,
        }: {
            chatId: string;
            userMessage: string;
            threadRootMessageId?: string;
        }) => {
            // Check if this is a /conduct command from the user
            if (containsConductCommand(userMessage)) {
                console.log("[generateAIResponses] /conduct command detected");
                // Get the models that should respond to determine the conductor
                const { models: aiModels } =
                    await getRespondingModels(userMessage);
                console.log(
                    "[generateAIResponses] Models for conductor:",
                    aiModels,
                );

                if (aiModels.length > 0) {
                    // First model becomes the conductor
                    const conductorModelId = aiModels[0].id;
                    console.log(
                        "[generateAIResponses] Setting conductor:",
                        conductorModelId,
                    );

                    // Start conductor session
                    await orchestrateConductorSession({
                        chatId,
                        scopeId: threadRootMessageId,
                        conductorModelId,
                        queryClient,
                    });

                    return [{ model: conductorModelId, success: true }];
                }
            }

            // Check if there's an active conductor for this scope
            const activeConductor = await gcdb.fetchActiveConductor(
                chatId,
                threadRootMessageId,
            );
            if (activeConductor) {
                // If there's an active conductor, let it handle the response
                await orchestrateConductorSession({
                    chatId,
                    scopeId: threadRootMessageId,
                    conductorModelId: activeConductor.conductorModelId,
                    queryClient,
                });

                return [
                    { model: activeConductor.conductorModelId, success: true },
                ];
            }

            // Normal flow - no conductor active
            // Determine which models should respond based on the user message
            const { models: aiModels, multiplier } =
                await getRespondingModels(userMessage);

            // Create array of model instances based on multiplier
            const modelInstances: Array<{
                id: string;
                name: string;
                instance: number;
            }> = [];
            for (const model of aiModels) {
                for (let i = 1; i <= multiplier; i++) {
                    modelInstances.push({
                        ...model,
                        instance: i,
                    });
                }
            }

            // Generate responses in parallel but handle each completion individually
            const results: Array<{
                model: string;
                success: boolean;
                error?: unknown;
            }> = [];

            await Promise.all(
                modelInstances.map(async (modelInstance) => {
                    try {
                        // Re-fetch messages right before encoding to get any new messages
                        await queryClient.refetchQueries(
                            gcMessageQueries.list(chatId),
                        );
                        const currentMessages =
                            await queryClient.ensureQueryData(
                                gcMessageQueries.list(chatId),
                            );

                        // Encode conversation from this model's POV
                        const encodedConversation = await encodeConversation(
                            currentMessages,
                            modelInstance.id,
                            !!threadRootMessageId,
                            threadRootMessageId,
                        );

                        // Add instance indicator if this is a duplicate
                        if (multiplier > 1) {
                            const varietyPrompts = [
                                "Provide a unique perspective or approach to this question.",
                                "Offer a different angle or solution than what might be typical.",
                                "Share an alternative viewpoint or method.",
                                "Approach this from a fresh perspective.",
                            ];
                            const promptIndex =
                                (modelInstance.instance - 1) %
                                varietyPrompts.length;
                            encodedConversation.unshift({
                                role: "user",
                                content: varietyPrompts[promptIndex],
                                attachments: [],
                            });
                        }

                        // Generate response
                        const responseText = await generateGroupChatResponse(
                            modelInstance.id,
                            encodedConversation,
                            chatId,
                            threadRootMessageId,
                        );

                        // Save response to database
                        const messageId = uuidv4().toLowerCase();
                        await gcdb.insertGCMessage(
                            chatId,
                            messageId,
                            responseText,
                            modelInstance.id,
                            threadRootMessageId,
                        );

                        // Invalidate queries immediately when this model completes
                        await queryClient.invalidateQueries({
                            queryKey: ["gcMessages", chatId],
                        });
                        await queryClient.invalidateQueries({
                            queryKey: ["gcMainMessages", chatId],
                        });
                        await queryClient.invalidateQueries({
                            queryKey: ["gcThreadMessages", chatId],
                        });
                        await queryClient.invalidateQueries({
                            queryKey: ["gcThreadCounts", chatId],
                        });

                        const result = {
                            model: modelInstance.id,
                            success: true,
                        };
                        results.push(result);
                        return result;
                    } catch (error) {
                        console.error(
                            `Failed to generate response from ${modelInstance.name} (instance ${modelInstance.instance}):`,
                            error,
                        );

                        // Save error message to database
                        const messageId = uuidv4().toLowerCase();
                        const errorMessage = `Sorry, I encountered an error: ${error instanceof Error ? error.message : "Unknown error"}`;
                        await gcdb.insertGCMessage(
                            chatId,
                            messageId,
                            errorMessage,
                            modelInstance.id,
                            threadRootMessageId,
                        );

                        // Invalidate queries even on error
                        await queryClient.invalidateQueries(
                            gcMessageQueries.list(chatId),
                        );

                        const result = {
                            model: modelInstance.id,
                            success: false,
                            error,
                        };
                        results.push(result);
                        return result;
                    }
                }),
            );

            // Update the chat's updated_at timestamp
            await db.db.execute(
                `UPDATE chats SET updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
                [chatId],
            );

            return results;
        },
        onSuccess: async (_, variables) => {
            // Invalidate all message queries for this chat
            await queryClient.invalidateQueries({
                queryKey: ["gcMessages", variables.chatId],
            });
            await queryClient.invalidateQueries({
                queryKey: ["gcMainMessages", variables.chatId],
            });
            await queryClient.invalidateQueries({
                queryKey: ["gcThreadMessages", variables.chatId],
            });
            await queryClient.invalidateQueries({
                queryKey: ["gcThreadCounts", variables.chatId],
            });
            // Also invalidate the chat queries to update the sidebar
            await queryClient.invalidateQueries(chatQueries.list());
        },
    });
}

export function usePromoteGCMessage() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationKey: ["promoteGCMessage"] as const,
        mutationFn: async ({
            messageId,
            chatId,
        }: {
            messageId: string;
            chatId: string;
        }) => {
            const newMessageId = uuidv4().toLowerCase();
            await gcdb.promoteGCMessageToMain(messageId, newMessageId);

            // Update the chat's updated_at timestamp
            await db.db.execute(
                `UPDATE chats SET updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
                [chatId],
            );

            return newMessageId;
        },
        onSuccess: async (_, variables) => {
            // Invalidate all message queries for this chat
            await queryClient.invalidateQueries({
                queryKey: ["gcMessages", variables.chatId],
            });
            await queryClient.invalidateQueries({
                queryKey: ["gcMainMessages", variables.chatId],
            });
            await queryClient.invalidateQueries({
                queryKey: ["gcThreadMessages", variables.chatId],
            });
            await queryClient.invalidateQueries({
                queryKey: ["gcThreadCounts", variables.chatId],
            });
            // Also invalidate the chat queries to update the sidebar
            await queryClient.invalidateQueries(chatQueries.list());
        },
    });
}

import {
    useMutation,
    useQuery,
    useQueryClient,
} from "@tanstack/react-query";
import { produce } from "immer";
import { v4 as uuidv4 } from "uuid";
import { db } from "@core/chorus/DB";
import { chatQueries } from "@core/chorus/api/ChatAPI";
import * as ModelsAPI from "@core/chorus/api/ModelsAPI";
import { getApiKeys } from "@core/chorus/api/AppMetadataAPI";
import { LLMMessage, ModelConfig, streamResponse } from "@core/chorus/Models";
import { simpleLLM } from "@core/chorus/simpleLLM";
import { modelThinkingTracker } from "@core/chorus/gc-prototype/ModelThinkingTracker";
import {
    getChatFormatPrompt,
    getNonConductorPrompt,
} from "@core/chorus/gc-prototype/PromptsGC";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type GCMessageDBRow = {
    chat_id: string;
    id: string;
    text: string;
    model_config_id: string;
    created_at: string;
    updated_at: string;
    is_deleted: number;
    thread_root_message_id: string | null;
    promoted_from_message_id: string | null;
};

export type GCMessage = {
    chatId: string;
    id: string;
    text: string;
    modelConfigId: string; // "user" for human messages, model ID for AI
    createdAt: string;
    updatedAt: string;
    isDeleted: boolean;
    threadRootMessageId?: string;
    promotedFromMessageId?: string;
};

function readGCMessage(row: GCMessageDBRow): GCMessage {
    return {
        chatId: row.chat_id,
        id: row.id,
        text: row.text,
        modelConfigId: row.model_config_id,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        isDeleted: row.is_deleted === 1,
        threadRootMessageId: row.thread_root_message_id ?? undefined,
        promotedFromMessageId: row.promoted_from_message_id ?? undefined,
    };
}

// ---------------------------------------------------------------------------
// DB helpers (private)
// ---------------------------------------------------------------------------

async function fetchGCMainMessages(chatId: string): Promise<GCMessage[]> {
    const rows = await db.select<GCMessageDBRow[]>(
        `SELECT * FROM gc_messages
         WHERE chat_id = ? AND thread_root_message_id IS NULL
         ORDER BY created_at`,
        [chatId],
    );
    return rows.map(readGCMessage);
}

async function insertGCMessage(
    chatId: string,
    id: string,
    text: string,
    modelConfigId: string,
): Promise<void> {
    await db.execute(
        `INSERT INTO gc_messages (chat_id, id, text, model_config_id)
         VALUES (?, ?, ?, ?)`,
        [chatId, id, text, modelConfigId],
    );
}

async function softDeleteGCMessage(messageId: string): Promise<void> {
    await db.execute(
        `UPDATE gc_messages SET is_deleted = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [messageId],
    );
}

async function restoreGCMessage(messageId: string): Promise<void> {
    await db.execute(
        `UPDATE gc_messages SET is_deleted = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [messageId],
    );
}

// ---------------------------------------------------------------------------
// Query keys & factories
// ---------------------------------------------------------------------------

const gcMessageKeys = {
    all: (chatId: string) => ["gcMessages", chatId] as const,
    main: (chatId: string) => ["gcMainMessages", chatId] as const,
};

export const gcMessageQueries = {
    mainMessages: (chatId: string) => ({
        queryKey: gcMessageKeys.main(chatId),
        queryFn: () => fetchGCMainMessages(chatId),
    }),
};

// ---------------------------------------------------------------------------
// Model handle map (hardcoded for Phase 1)
// ---------------------------------------------------------------------------

const MODEL_HANDLE_MAP: Record<string, string | string[]> = {
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
    "4o": "openai::gpt-4o",
    "4.1": "openai::gpt-4.1",

    // Multi-model presets
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

export { MODEL_HANDLE_MAP };

const DEFAULT_MODEL_ID = "anthropic::claude-sonnet-4-latest";

// ---------------------------------------------------------------------------
// encodeConversation — build LLMMessage[] from a model's POV
// ---------------------------------------------------------------------------

export async function encodeConversation(
    messages: GCMessage[],
    povModelConfigId: string,
): Promise<LLMMessage[]> {
    const result: LLMMessage[] = [];

    const allConfigs = await ModelsAPI.fetchModelConfigs();
    const modelConfig = allConfigs.find(
        (c) => c.modelId === povModelConfigId,
    );
    const modelName = modelConfig?.displayName || povModelConfigId;

    // System prompts explaining the group chat format
    result.push({
        role: "user",
        content: getChatFormatPrompt(modelName),
        attachments: [],
    });
    result.push({
        role: "user",
        content: getNonConductorPrompt(modelName),
        attachments: [],
    });

    const activeMessages = messages.filter(
        (m) => !m.isDeleted && !m.threadRootMessageId,
    );

    for (const message of activeMessages) {
        if (message.modelConfigId === povModelConfigId) {
            result.push({
                role: "assistant",
                content: message.text,
                model: povModelConfigId,
                toolCalls: [],
            });
        } else if (message.modelConfigId === "user") {
            result.push({
                role: "user",
                content: message.text,
                attachments: [],
            });
        } else {
            // Resolve display name for the other model
            const senderConfig = allConfigs.find(
                (c) => c.modelId === message.modelConfigId,
            );
            const senderName =
                senderConfig?.displayName || message.modelConfigId;
            result.push({
                role: "user",
                content: `<chorus_message sender="${senderName}">${message.text}</chorus_message>`,
                attachments: [],
            });
        }
    }

    return result;
}

// ---------------------------------------------------------------------------
// getRespondingModels — parse @mentions from user text
// ---------------------------------------------------------------------------

function extractMultiplier(text: string): number {
    const match = text.match(/\bx([2-4])\b/i);
    return match ? parseInt(match[1], 10) : 1;
}

async function getRespondingModels(text: string): Promise<{
    models: Array<{ id: string; name: string }>;
    multiplier: number;
}> {
    const multiplier = extractMultiplier(text);

    if (text.toLowerCase().includes("@none")) {
        return { models: [], multiplier };
    }

    const mentionedModelIds: string[] = [];
    const lowerText = text.toLowerCase();

    for (const [handle, modelIdOrIds] of Object.entries(MODEL_HANDLE_MAP)) {
        if (lowerText.includes(`@${handle}`)) {
            if (Array.isArray(modelIdOrIds)) {
                mentionedModelIds.push(...modelIdOrIds);
            } else {
                mentionedModelIds.push(modelIdOrIds);
            }
        }
    }

    const allConfigs = await ModelsAPI.fetchModelConfigs();

    if (mentionedModelIds.length > 0) {
        // Deduplicate (e.g. @claude and @sonnet both resolve to same model)
        const unique = [...new Set(mentionedModelIds)];
        const models = unique
            .map((id) => {
                const config = allConfigs.find((c) => c.modelId === id);
                return config ? { id, name: config.displayName } : undefined;
            })
            .filter(
                (m): m is { id: string; name: string } => m !== undefined,
            );
        return { models, multiplier };
    }

    // Default: only the default model responds
    const defaultConfig = allConfigs.find(
        (c) => c.modelId === DEFAULT_MODEL_ID,
    );
    return {
        models: [
            {
                id: DEFAULT_MODEL_ID,
                name: defaultConfig?.displayName || "Claude Sonnet",
            },
        ],
        multiplier,
    };
}

// ---------------------------------------------------------------------------
// generateResponseWithStreamAPI — collect full response (no partial streaming)
// ---------------------------------------------------------------------------

async function generateResponseWithStreamAPI(
    modelConfig: ModelConfig,
    conversation: LLMMessage[],
    chatId: string,
): Promise<string> {
    const apiKeys = await getApiKeys();
    let fullResponse = "";
    let error: string | undefined;

    modelThinkingTracker.startThinking(modelConfig.modelId, chatId, "main");

    try {
        await streamResponse({
            modelConfig,
            llmConversation: conversation,
            apiKeys,
            onChunk: (chunk: string) => {
                fullResponse += chunk;
            },
            onComplete: async () => {
                modelThinkingTracker.stopThinking(
                    modelConfig.modelId,
                    chatId,
                    "main",
                );
                await Promise.resolve();
            },
            onError: (errorMessage: string) => {
                error = errorMessage;
                modelThinkingTracker.stopThinking(
                    modelConfig.modelId,
                    chatId,
                    "main",
                );
            },
            additionalHeaders: {
                "X-Melty-Request-Type": "gc_chat",
            },
        });

        if (error) {
            throw new Error(error);
        }
        return fullResponse;
    } catch (err) {
        modelThinkingTracker.stopThinking(
            modelConfig.modelId,
            chatId,
            "main",
        );
        throw err;
    }
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

export function useGCMainMessages(chatId: string) {
    return useQuery({
        ...gcMessageQueries.mainMessages(chatId),
        enabled: !!chatId,
    });
}

export function useSendGCMessage() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationKey: ["sendGCMessage"] as const,
        mutationFn: async ({
            chatId,
            text,
        }: {
            chatId: string;
            text: string;
        }) => {
            const messageId = uuidv4().toLowerCase();
            await insertGCMessage(chatId, messageId, text, "user");

            // Mark chat as no longer "new"
            await db.execute(
                `UPDATE chats SET is_new_chat = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
                [chatId],
            );

            return messageId;
        },
        onSuccess: async (_, variables) => {
            await queryClient.invalidateQueries(
                gcMessageQueries.mainMessages(variables.chatId),
            );
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
        }: {
            messageId: string;
            chatId: string;
        }) => {
            await softDeleteGCMessage(messageId);
        },
        onMutate: async (variables) => {
            const queryOptions = gcMessageQueries.mainMessages(
                variables.chatId,
            );
            await queryClient.cancelQueries(queryOptions);

            const previous = queryClient.getQueryData(queryOptions.queryKey);

            queryClient.setQueryData(
                queryOptions.queryKey,
                produce(previous, (draft: GCMessage[] | undefined) => {
                    if (!draft) return;
                    const msg = draft.find(
                        (m) => m.id === variables.messageId,
                    );
                    if (msg) msg.isDeleted = true;
                }),
            );

            return { previous };
        },
        onError: (_error, variables, context) => {
            if (context?.previous) {
                queryClient.setQueryData(
                    gcMessageQueries.mainMessages(variables.chatId).queryKey,
                    context.previous,
                );
            }
        },
        onSettled: async (_, __, variables) => {
            await queryClient.invalidateQueries(
                gcMessageQueries.mainMessages(variables.chatId),
            );
        },
    });
}

export function useRestoreGCMessage() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationKey: ["restoreGCMessage"] as const,
        mutationFn: async ({
            messageId,
        }: {
            messageId: string;
            chatId: string;
        }) => {
            await restoreGCMessage(messageId);
        },
        onMutate: async (variables) => {
            const queryOptions = gcMessageQueries.mainMessages(
                variables.chatId,
            );
            await queryClient.cancelQueries(queryOptions);

            const previous = queryClient.getQueryData(queryOptions.queryKey);

            queryClient.setQueryData(
                queryOptions.queryKey,
                produce(previous, (draft: GCMessage[] | undefined) => {
                    if (!draft) return;
                    const msg = draft.find(
                        (m) => m.id === variables.messageId,
                    );
                    if (msg) msg.isDeleted = false;
                }),
            );

            return { previous };
        },
        onError: (_error, variables, context) => {
            if (context?.previous) {
                queryClient.setQueryData(
                    gcMessageQueries.mainMessages(variables.chatId).queryKey,
                    context.previous,
                );
            }
        },
        onSettled: async (_, __, variables) => {
            await queryClient.invalidateQueries(
                gcMessageQueries.mainMessages(variables.chatId),
            );
        },
    });
}

export function useGenerateAIResponses() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationKey: ["generateGCAIResponses"] as const,
        mutationFn: async ({
            chatId,
            userMessage,
        }: {
            chatId: string;
            userMessage: string;
        }) => {
            const { models: aiModels, multiplier } =
                await getRespondingModels(userMessage);

            // Build model instances with multiplier
            const modelInstances: Array<{
                id: string;
                name: string;
                instance: number;
            }> = [];
            for (const model of aiModels) {
                for (let i = 1; i <= multiplier; i++) {
                    modelInstances.push({ ...model, instance: i });
                }
            }

            const allConfigs = await ModelsAPI.fetchModelConfigs();
            const results: Array<{
                model: string;
                success: boolean;
                error?: unknown;
            }> = [];

            const varietyPrompts = [
                "Provide a unique perspective or approach to this question.",
                "Offer a different angle or solution than what might be typical.",
                "Share an alternative viewpoint or method.",
                "Approach this from a fresh perspective.",
            ];

            await Promise.all(
                modelInstances.map(async (modelInstance) => {
                    try {
                        // Fetch latest messages for this model's POV
                        const currentMessages =
                            await fetchGCMainMessages(chatId);

                        const encodedConversation =
                            await encodeConversation(
                                currentMessages,
                                modelInstance.id,
                            );

                        // Add variety prompt for multiplied instances
                        if (multiplier > 1) {
                            const promptIndex =
                                (modelInstance.instance - 1) %
                                varietyPrompts.length;
                            encodedConversation.unshift({
                                role: "user",
                                content: varietyPrompts[promptIndex],
                                attachments: [],
                            });
                        }

                        const modelConfig = allConfigs.find(
                            (c) => c.modelId === modelInstance.id,
                        );
                        if (!modelConfig) {
                            throw new Error(
                                `Model config not found for: ${modelInstance.id}`,
                            );
                        }

                        const responseText =
                            await generateResponseWithStreamAPI(
                                modelConfig,
                                encodedConversation,
                                chatId,
                            );

                        const messageId = uuidv4().toLowerCase();
                        await insertGCMessage(
                            chatId,
                            messageId,
                            responseText,
                            modelInstance.id,
                        );

                        // Invalidate immediately so the message appears in the UI
                        await queryClient.invalidateQueries({
                            queryKey: gcMessageKeys.main(chatId),
                        });

                        results.push({
                            model: modelInstance.id,
                            success: true,
                        });
                    } catch (error) {
                        console.error(
                            `Failed to generate response from ${modelInstance.name}:`,
                            error,
                        );

                        // Save error message so the user sees something
                        const messageId = uuidv4().toLowerCase();
                        const errorText = `Sorry, I encountered an error: ${error instanceof Error ? error.message : "Unknown error"}`;
                        await insertGCMessage(
                            chatId,
                            messageId,
                            errorText,
                            modelInstance.id,
                        );
                        await queryClient.invalidateQueries({
                            queryKey: gcMessageKeys.main(chatId),
                        });

                        results.push({
                            model: modelInstance.id,
                            success: false,
                            error,
                        });
                    }
                }),
            );

            // Update chat timestamp
            await db.execute(
                `UPDATE chats SET updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
                [chatId],
            );

            return results;
        },
        onSuccess: async (_, variables) => {
            await queryClient.invalidateQueries({
                queryKey: gcMessageKeys.main(variables.chatId),
            });
            await queryClient.invalidateQueries(chatQueries.list());
        },
    });
}

export function useGenerateGCChatTitle() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationKey: ["generateGCChatTitle"] as const,
        mutationFn: async ({ chatId }: { chatId: string }) => {
            const chat = await queryClient.ensureQueryData(
                chatQueries.detail(chatId),
            );
            if (chat?.title && chat.title !== "Untitled Chat") {
                return { skipped: true };
            }

            const messages = await fetchGCMainMessages(chatId);
            const firstUserMessage = messages.find(
                (m) => m.modelConfigId === "user",
            );
            if (!firstUserMessage) {
                return { skipped: true };
            }

            const fullResponse = await simpleLLM(
                `Based on this first message, write a 1-5 word title for the conversation. Try to put the most important words first. Format your response as <title>YOUR TITLE HERE</title>.
If there's no information in the message, just return "Untitled Chat".
<message>
${firstUserMessage.text}
</message>`,
                { maxTokens: 100 },
            );

            const match = fullResponse.match(/<title>(.*?)<\/title>/s);
            if (!match?.[1]) {
                return { skipped: true };
            }

            const cleanTitle = match[1]
                .trim()
                .slice(0, 40)
                .replace(/["']/g, "");
            if (cleanTitle) {
                await db.execute(
                    "UPDATE chats SET title = $1 WHERE id = $2",
                    [cleanTitle, chatId],
                );
            }
            return { skipped: false };
        },
        onSuccess: async (data, variables) => {
            if (!data?.skipped) {
                await queryClient.invalidateQueries(chatQueries.list());
                await queryClient.invalidateQueries(
                    chatQueries.detail(variables.chatId),
                );
            }
        },
    });
}

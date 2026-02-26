import {
    QueryClient,
    useMutation,
    useQuery,
    useQueryClient,
} from "@tanstack/react-query";
import { produce } from "immer";
import { v4 as uuidv4 } from "uuid";
import { db } from "@core/chorus/DB";
import { invoke } from "@tauri-apps/api/core";
import { chatQueries } from "@core/chorus/api/ChatAPI";
import * as ModelsAPI from "@core/chorus/api/ModelsAPI";
import { getApiKeys } from "@core/chorus/api/AppMetadataAPI";
import {
    LLMMessage,
    ModelConfig,
    UsageData,
    streamResponse,
} from "@core/chorus/Models";
import {
    UserTool,
    UserToolCall,
    UserToolResult,
} from "@core/chorus/Toolsets";
import { ToolsetsManager } from "@core/chorus/ToolsetsManager";
import { useGetToolsets } from "@core/chorus/api/ToolsetsAPI";
import { simpleLLM } from "@core/chorus/simpleLLM";
import { modelThinkingTracker } from "@core/chorus/gc-prototype/ModelThinkingTracker";
import {
    getChatFormatPrompt,
    getNonConductorPrompt,
    getConductorPrompt,
    getConductorReminder,
} from "@core/chorus/gc-prototype/PromptsGC";
import { UpdateQueue } from "@core/chorus/UpdateQueue";

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
    tool_calls: string | null;
};

export type GCMessage = {
    chatId: string;
    id: string;
    text: string;
    modelConfigId: string; // "user" for human messages, model ID for AI, "tool_result" for tool results
    createdAt: string;
    updatedAt: string;
    isDeleted: boolean;
    threadRootMessageId?: string;
    promotedFromMessageId?: string;
    toolCalls?: UserToolCall[];
};

function readGCMessage(row: GCMessageDBRow): GCMessage {
    let toolCalls: UserToolCall[] | undefined;
    if (row.tool_calls) {
        try {
            toolCalls = JSON.parse(row.tool_calls) as UserToolCall[];
        } catch {
            console.warn("Failed to parse tool_calls for message", row.id);
        }
    }

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
        toolCalls,
    };
}

// ---------------------------------------------------------------------------
// DB helpers (private)
// ---------------------------------------------------------------------------

export async function fetchGCMainMessages(chatId: string): Promise<GCMessage[]> {
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
    options?: {
        toolCalls?: UserToolCall[];
        threadRootMessageId?: string;
    },
): Promise<void> {
    const toolCallsJson = options?.toolCalls
        ? JSON.stringify(options.toolCalls)
        : undefined;
    await db.execute(
        `INSERT INTO gc_messages (chat_id, id, text, model_config_id, tool_calls, thread_root_message_id)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
            chatId,
            id,
            text,
            modelConfigId,
            toolCallsJson ?? null,
            options?.threadRootMessageId ?? null,
        ],
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

async function fetchGCThreadMessages(
    chatId: string,
    threadRootMessageId: string,
): Promise<GCMessage[]> {
    const rows = await db.select<GCMessageDBRow[]>(
        `SELECT * FROM gc_messages
         WHERE chat_id = ? AND thread_root_message_id = ?
         ORDER BY created_at ASC`,
        [chatId, threadRootMessageId],
    );
    return rows.map(readGCMessage);
}

async function fetchGCThreadCounts(
    chatId: string,
): Promise<Map<string, number>> {
    const rows = await db.select<
        { thread_root_message_id: string; count: number }[]
    >(
        `SELECT thread_root_message_id, COUNT(*) as count
         FROM gc_messages
         WHERE chat_id = ? AND thread_root_message_id IS NOT NULL AND is_deleted = 0
         GROUP BY thread_root_message_id`,
        [chatId],
    );
    const map = new Map<string, number>();
    for (const row of rows) {
        map.set(row.thread_root_message_id, row.count);
    }
    return map;
}

async function promoteGCMessageToMain(
    originalMessageId: string,
    newMessageId: string,
): Promise<void> {
    const rows = await db.select<GCMessageDBRow[]>(
        `SELECT * FROM gc_messages WHERE id = ?`,
        [originalMessageId],
    );

    if (rows.length === 0) {
        throw new Error(`Message not found: ${originalMessageId}`);
    }

    const original = rows[0];
    const prefixedText = `[Promoted from thread] ${original.text}`;
    await db.execute(
        `INSERT INTO gc_messages (chat_id, id, text, model_config_id, promoted_from_message_id)
         VALUES (?, ?, ?, ?, ?)`,
        [
            original.chat_id,
            newMessageId,
            prefixedText,
            original.model_config_id,
            originalMessageId,
        ],
    );
}

// ---------------------------------------------------------------------------
// Conductor DB helpers
// ---------------------------------------------------------------------------

export type GCConductor = {
    chatId: string;
    scopeId?: string;
    conductorModelId: string;
    turnCount: number;
    isActive: boolean;
    createdAt: string;
};

type GCConductorDBRow = {
    chat_id: string;
    scope_id: string | null;
    conductor_model_id: string;
    turn_count: number;
    is_active: number;
    created_at: string;
};

function readGCConductor(row: GCConductorDBRow): GCConductor {
    return {
        chatId: row.chat_id,
        scopeId: row.scope_id ?? undefined,
        conductorModelId: row.conductor_model_id,
        turnCount: row.turn_count,
        isActive: row.is_active === 1,
        createdAt: row.created_at,
    };
}

async function fetchActiveConductor(
    chatId: string,
    scopeId?: string,
): Promise<GCConductor | undefined> {
    const rows = await db.select<GCConductorDBRow[]>(
        `SELECT chat_id, scope_id, conductor_model_id, turn_count, is_active, created_at
         FROM gc_conductors
         WHERE chat_id = ? AND scope_id IS ? AND is_active = 1
         LIMIT 1`,
        [chatId, scopeId ?? null],
    );
    if (rows.length === 0) return undefined;
    return readGCConductor(rows[0]);
}

async function setConductor(
    chatId: string,
    scopeId: string | undefined,
    modelId: string,
): Promise<void> {
    await db.execute(
        `INSERT OR REPLACE INTO gc_conductors (chat_id, scope_id, conductor_model_id, turn_count, is_active)
         VALUES (?, ?, ?, 0, 1)`,
        [chatId, scopeId ?? null, modelId],
    );
}

async function incrementConductorTurn(
    chatId: string,
    scopeId?: string,
): Promise<number> {
    return invoke<number>("increment_conductor_turn", {
        chatId,
        scopeId: scopeId ?? null,
    });
}

async function clearConductor(
    chatId: string,
    scopeId?: string,
): Promise<void> {
    await db.execute(
        `UPDATE gc_conductors
         SET is_active = 0
         WHERE chat_id = ? AND scope_id IS ?`,
        [chatId, scopeId ?? null],
    );
}

// ---------------------------------------------------------------------------
// Query keys & factories
// ---------------------------------------------------------------------------

const gcMessageKeys = {
    all: (chatId: string) => ["gcMessages", chatId] as const,
    main: (chatId: string) => ["gcMainMessages", chatId] as const,
    thread: (chatId: string, threadRootId: string) =>
        ["gcThreadMessages", chatId, threadRootId] as const,
    threadCounts: (chatId: string) => ["gcThreadCounts", chatId] as const,
    conductor: (chatId: string, scopeId?: string) =>
        ["gcConductor", chatId, scopeId ?? null] as const,
};

export const gcMessageQueries = {
    mainMessages: (chatId: string) => ({
        queryKey: gcMessageKeys.main(chatId),
        queryFn: () => fetchGCMainMessages(chatId),
    }),
    threadMessages: (chatId: string, threadRootId: string) => ({
        queryKey: gcMessageKeys.thread(chatId, threadRootId),
        queryFn: () => fetchGCThreadMessages(chatId, threadRootId),
    }),
    threadCounts: (chatId: string) => ({
        queryKey: gcMessageKeys.threadCounts(chatId),
        queryFn: () => fetchGCThreadCounts(chatId),
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
    options?: {
        threadRootMessageId?: string;
        threadMessages?: GCMessage[];
        isConductor?: boolean;
    },
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
    if (options?.isConductor) {
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

    let activeMessages: GCMessage[];
    if (options?.threadRootMessageId && options.threadMessages) {
        // Thread mode: main messages up to and including the root, then thread replies
        const mainMessages = messages.filter(
            (m) => !m.isDeleted && !m.threadRootMessageId,
        );
        const rootIndex = mainMessages.findIndex(
            (m) => m.id === options.threadRootMessageId,
        );
        const mainUpToRoot =
            rootIndex >= 0 ? mainMessages.slice(0, rootIndex + 1) : mainMessages;
        const threadReplies = options.threadMessages.filter(
            (m) => !m.isDeleted,
        );
        activeMessages = [...mainUpToRoot, ...threadReplies];
    } else {
        activeMessages = messages.filter(
            (m) => !m.isDeleted && !m.threadRootMessageId,
        );
    }

    for (const message of activeMessages) {
        if (message.modelConfigId === "tool_result") {
            // Tool results: parse the JSON text back into UserToolResult[]
            try {
                const toolResults = JSON.parse(
                    message.text,
                ) as UserToolResult[];
                result.push({
                    role: "tool_results",
                    toolResults,
                });
            } catch {
                console.warn(
                    "Failed to parse tool_result message",
                    message.id,
                );
            }
        } else if (message.modelConfigId === povModelConfigId) {
            result.push({
                role: "assistant",
                content: message.text,
                model: povModelConfigId,
                toolCalls: message.toolCalls ?? [],
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
// streamGCResponse — stream response with live cache + DB updates
// ---------------------------------------------------------------------------

async function streamGCResponse(params: {
    chatId: string;
    messageId: string;
    modelConfig: ModelConfig;
    conversation: LLMMessage[];
    queryClient: QueryClient;
    scopeId?: string;
    tools?: UserTool[];
    cacheKey?: readonly string[];
}): Promise<{ toolCalls?: UserToolCall[] }> {
    const { chatId, messageId, modelConfig, conversation, queryClient, scopeId, tools } =
        params;
    const effectiveCacheKey = params.cacheKey ?? gcMessageKeys.main(chatId);
    const apiKeys = await getApiKeys();
    const scope = scopeId ?? "main";

    let partialResponse = "";
    let priority = 0;
    let error: string | undefined;
    let resultToolCalls: UserToolCall[] | undefined;

    const streamKey = UpdateQueue.getInstance().startUpdateStream();

    modelThinkingTracker.startThinking(modelConfig.modelId, chatId, scope);

    const updateMessageTextInCache = (text: string) => {
        queryClient.setQueryData(
            effectiveCacheKey,
            produce(
                queryClient.getQueryData(effectiveCacheKey),
                (draft: GCMessage[] | undefined) => {
                    if (!draft) return;
                    const msg = draft.find((m) => m.id === messageId);
                    if (msg) msg.text = text;
                },
            ),
        );
    };

    try {
        await streamResponse({
            modelConfig,
            llmConversation: conversation,
            tools: tools && tools.length > 0 ? tools : undefined,
            apiKeys,
            onChunk: (chunk: string) => {
                partialResponse += chunk;
                priority += 1;

                // Optimistic UI update
                updateMessageTextInCache(partialResponse);

                // Queue batched DB write
                const textSnapshot = partialResponse;
                UpdateQueue.getInstance().addUpdate(
                    streamKey,
                    priority,
                    async () => {
                        await db.execute(
                            `UPDATE gc_messages SET text = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
                            [textSnapshot, messageId],
                        );
                    },
                );
            },
            onComplete: async (
                finalText?: string,
                toolCalls?: UserToolCall[],
                _usageData?: UsageData,
            ) => {
                const text = finalText ?? partialResponse;
                resultToolCalls = toolCalls;

                // Final cache update
                updateMessageTextInCache(text);

                // Final DB write (bypasses queue for guaranteed write)
                await db.execute(
                    `UPDATE gc_messages SET text = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
                    [text, messageId],
                );

                UpdateQueue.getInstance().closeUpdateStream(streamKey);
                modelThinkingTracker.stopThinking(
                    modelConfig.modelId,
                    chatId,
                    scope,
                );
            },
            onError: (errorMessage: string) => {
                error = errorMessage;
                UpdateQueue.getInstance().closeUpdateStream(streamKey);
                modelThinkingTracker.stopThinking(
                    modelConfig.modelId,
                    chatId,
                    scope,
                );
            },
            additionalHeaders: {
                "X-Melty-Request-Type": "gc_chat",
            },
        });

        if (error) {
            // Save error text to the message so the user sees it
            const errorText = `Sorry, I encountered an error: ${error}`;
            updateMessageTextInCache(errorText);
            await db.execute(
                `UPDATE gc_messages SET text = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
                [errorText, messageId],
            );
            throw new Error(error);
        }

        return { toolCalls: resultToolCalls };
    } catch (err) {
        UpdateQueue.getInstance().closeUpdateStream(streamKey);
        modelThinkingTracker.stopThinking(
            modelConfig.modelId,
            chatId,
            scope,
        );
        throw err;
    }
}

// ---------------------------------------------------------------------------
// streamGCResponseWithTools — tool call loop for a single model
// ---------------------------------------------------------------------------

const MAX_TOOL_TURNS = 40;

async function streamGCResponseWithTools(params: {
    chatId: string;
    modelConfig: ModelConfig;
    queryClient: QueryClient;
    getTools: () => UserTool[];
    scopeId?: string;
    prefixMessages?: LLMMessage[];
    threadRootMessageId?: string;
}): Promise<void> {
    const {
        chatId,
        modelConfig,
        queryClient,
        getTools,
        scopeId,
        prefixMessages,
        threadRootMessageId,
    } = params;

    const cacheKey = threadRootMessageId
        ? gcMessageKeys.thread(chatId, threadRootMessageId)
        : gcMessageKeys.main(chatId);

    for (let turn = 0; turn < MAX_TOOL_TURNS; turn++) {
        // Fetch latest messages and encode conversation
        const currentMessages = await fetchGCMainMessages(chatId);
        const threadMessages = threadRootMessageId
            ? await fetchGCThreadMessages(chatId, threadRootMessageId)
            : undefined;
        const conversation = await encodeConversation(
            currentMessages,
            modelConfig.modelId,
            threadRootMessageId
                ? { threadRootMessageId, threadMessages }
                : undefined,
        );

        // Add any prefix messages (e.g. variety prompts for multiplied instances)
        if (prefixMessages && turn === 0) {
            conversation.unshift(...prefixMessages);
        }

        // Gather tools if model supports them
        const tools = modelConfig.supportsToolUse ? getTools() : [];

        // Pre-insert empty AI message
        const messageId = uuidv4().toLowerCase();
        await insertGCMessage(chatId, messageId, "", modelConfig.modelId, {
            threadRootMessageId,
        });

        // Optimistically add to cache
        queryClient.setQueryData(
            cacheKey,
            produce(
                queryClient.getQueryData(cacheKey),
                (draft: GCMessage[] | undefined) => {
                    if (!draft) return;
                    draft.push({
                        chatId,
                        id: messageId,
                        text: "",
                        modelConfigId: modelConfig.modelId,
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString(),
                        isDeleted: false,
                        threadRootMessageId,
                    });
                },
            ),
        );

        // Stream response
        const { toolCalls } = await streamGCResponse({
            chatId,
            messageId,
            modelConfig,
            conversation,
            queryClient,
            scopeId: scopeId ?? threadRootMessageId,
            tools,
            cacheKey,
        });

        // If no tool calls, we're done
        if (!toolCalls || toolCalls.length === 0) {
            break;
        }

        // Save tool calls on the AI message
        await db.execute(
            `UPDATE gc_messages SET tool_calls = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
            [JSON.stringify(toolCalls), messageId],
        );

        // Update cache with tool calls
        queryClient.setQueryData(
            cacheKey,
            produce(
                queryClient.getQueryData(cacheKey),
                (draft: GCMessage[] | undefined) => {
                    if (!draft) return;
                    const msg = draft.find((m) => m.id === messageId);
                    if (msg) msg.toolCalls = toolCalls;
                },
            ),
        );

        // Execute each tool call
        const toolResults: UserToolResult[] = await Promise.all(
            toolCalls.map((toolCall) =>
                ToolsetsManager.instance.executeToolCall(
                    toolCall,
                    modelConfig.displayName,
                ),
            ),
        );

        // Insert tool_result message
        const toolResultId = uuidv4().toLowerCase();
        await insertGCMessage(
            chatId,
            toolResultId,
            JSON.stringify(toolResults),
            "tool_result",
            { threadRootMessageId },
        );

        // Optimistically add tool result to cache
        queryClient.setQueryData(
            cacheKey,
            produce(
                queryClient.getQueryData(cacheKey),
                (draft: GCMessage[] | undefined) => {
                    if (!draft) return;
                    draft.push({
                        chatId,
                        id: toolResultId,
                        text: JSON.stringify(toolResults),
                        modelConfigId: "tool_result",
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString(),
                        isDeleted: false,
                        threadRootMessageId,
                    });
                },
            ),
        );

        // Continue to next turn — model will see the tool results
    }
}

// ---------------------------------------------------------------------------
// orchestrateConductorSession — recursive conductor loop
// ---------------------------------------------------------------------------

const MAX_CONDUCTOR_TURNS = 10;

async function orchestrateConductorSession(params: {
    chatId: string;
    conductorModelId: string;
    queryClient: QueryClient;
    getTools: () => UserTool[];
    scopeId?: string;
    threadRootMessageId?: string;
}): Promise<void> {
    const {
        chatId,
        conductorModelId,
        queryClient,
        getTools,
        scopeId,
        threadRootMessageId,
    } = params;

    try {
        // Initialize conductor on first call
        const existing = await fetchActiveConductor(chatId, scopeId);
        if (!existing) {
            await setConductor(chatId, scopeId, conductorModelId);
        }

        // Increment turn, then invalidate so UI sees the updated count
        const turnCount = await incrementConductorTurn(chatId, scopeId);

        await queryClient.invalidateQueries({
            queryKey: gcMessageKeys.conductor(chatId, scopeId),
        });

        // Generate conductor's response
        const allConfigs = await ModelsAPI.fetchModelConfigs();
        const conductorConfig = allConfigs.find(
            (c) => c.modelId === conductorModelId,
        );
        if (!conductorConfig) {
            throw new Error(
                `Conductor model config not found: ${conductorModelId}`,
            );
        }

        // Encode conversation with isConductor=true
        const currentMessages = await fetchGCMainMessages(chatId);
        const threadMessages = threadRootMessageId
            ? await fetchGCThreadMessages(chatId, threadRootMessageId)
            : undefined;

        const conversation = await encodeConversation(
            currentMessages,
            conductorModelId,
            {
                isConductor: true,
                threadRootMessageId,
                threadMessages,
            },
        );

        // Add conductor reminder if not first turn
        if (turnCount > 1) {
            conversation.push({
                role: "user",
                content: getConductorReminder(),
                attachments: [],
            });
        }

        const cacheKey = threadRootMessageId
            ? gcMessageKeys.thread(chatId, threadRootMessageId)
            : gcMessageKeys.main(chatId);

        // Pre-insert empty conductor message
        const messageId = uuidv4().toLowerCase();
        await insertGCMessage(
            chatId,
            messageId,
            "",
            conductorModelId,
            { threadRootMessageId },
        );

        // Optimistically add to cache
        queryClient.setQueryData(
            cacheKey,
            produce(
                queryClient.getQueryData(cacheKey),
                (draft: GCMessage[] | undefined) => {
                    if (!draft) return;
                    draft.push({
                        chatId,
                        id: messageId,
                        text: "",
                        modelConfigId: conductorModelId,
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString(),
                        isDeleted: false,
                        threadRootMessageId,
                    });
                },
            ),
        );

        // Gather tools
        const tools = conductorConfig.supportsToolUse ? getTools() : [];

        // Stream conductor's response
        await streamGCResponse({
            chatId,
            messageId,
            modelConfig: conductorConfig,
            conversation,
            queryClient,
            scopeId: scopeId ?? threadRootMessageId,
            tools,
            cacheKey,
        });

        // Read the conductor's response text
        const updatedMessages = threadRootMessageId
            ? await fetchGCThreadMessages(chatId, threadRootMessageId)
            : await fetchGCMainMessages(chatId);
        const conductorMsg = updatedMessages.find((m) => m.id === messageId);
        const responseText = conductorMsg?.text ?? "";

        // Check for /yield
        if (responseText.includes("/yield")) {
            await clearConductor(chatId, scopeId);
            await queryClient.invalidateQueries({
                queryKey: gcMessageKeys.conductor(chatId, scopeId),
            });
            return;
        }

        // Parse @mentions from conductor's response
        const { models: mentionedModels } =
            await getRespondingModels(responseText);

        // Filter out the conductor itself
        const respondingModels = mentionedModels.filter(
            (m) => m.id !== conductorModelId,
        );

        // Generate parallel responses from mentioned models
        if (respondingModels.length > 0) {
            await Promise.all(
                respondingModels.map(async (model) => {
                    const modelConfig = allConfigs.find(
                        (c) => c.modelId === model.id,
                    );
                    if (!modelConfig) return;

                    await streamGCResponseWithTools({
                        chatId,
                        modelConfig,
                        queryClient,
                        getTools,
                        scopeId,
                        threadRootMessageId,
                    });
                }),
            );
        }

        // Check turn limit
        if (turnCount >= MAX_CONDUCTOR_TURNS) {
            await clearConductor(chatId, scopeId);
            await queryClient.invalidateQueries({
                queryKey: gcMessageKeys.conductor(chatId, scopeId),
            });
            return;
        }

        // Recurse for next conductor turn
        await orchestrateConductorSession(params);
    } catch (error) {
        // Clear conductor on error
        await clearConductor(chatId, scopeId);
        await queryClient.invalidateQueries({
            queryKey: gcMessageKeys.conductor(chatId, scopeId),
        });
        throw error;
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

export function useGCThreadMessages(
    chatId: string,
    threadRootId: string | undefined,
) {
    return useQuery({
        ...gcMessageQueries.threadMessages(chatId, threadRootId ?? ""),
        enabled: !!chatId && !!threadRootId,
    });
}

export function useGCThreadCounts(chatId: string) {
    return useQuery({
        ...gcMessageQueries.threadCounts(chatId),
        enabled: !!chatId,
    });
}

export function useGCConductor(chatId: string, scopeId?: string) {
    return useQuery({
        queryKey: gcMessageKeys.conductor(chatId, scopeId),
        queryFn: () => fetchActiveConductor(chatId, scopeId),
        enabled: !!chatId,
    });
}

export function useClearConductor() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationKey: ["clearGCConductor"] as const,
        mutationFn: async ({
            chatId,
            scopeId,
        }: {
            chatId: string;
            scopeId?: string;
        }) => {
            await clearConductor(chatId, scopeId);
        },
        onSuccess: async (_, variables) => {
            await queryClient.invalidateQueries({
                queryKey: gcMessageKeys.conductor(
                    variables.chatId,
                    variables.scopeId,
                ),
            });
        },
    });
}

export function usePromoteGCMessage() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationKey: ["promoteGCMessage"] as const,
        mutationFn: async (variables: {
            chatId: string;
            messageId: string;
        }) => {
            const newId = uuidv4().toLowerCase();
            await promoteGCMessageToMain(variables.messageId, newId);
            return newId;
        },
        onSuccess: async (_, variables) => {
            await queryClient.invalidateQueries({
                queryKey: gcMessageKeys.main(variables.chatId),
            });
        },
    });
}

export function useSendGCMessage() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationKey: ["sendGCMessage"] as const,
        mutationFn: async ({
            chatId,
            text,
            threadRootMessageId,
        }: {
            chatId: string;
            text: string;
            threadRootMessageId?: string;
        }) => {
            const messageId = uuidv4().toLowerCase();
            await insertGCMessage(chatId, messageId, text, "user", {
                threadRootMessageId,
            });

            // Mark chat as no longer "new"
            await db.execute(
                `UPDATE chats SET is_new_chat = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
                [chatId],
            );

            return messageId;
        },
        onSuccess: async (_, variables) => {
            if (variables.threadRootMessageId) {
                await queryClient.invalidateQueries({
                    queryKey: gcMessageKeys.thread(
                        variables.chatId,
                        variables.threadRootMessageId,
                    ),
                });
                await queryClient.invalidateQueries({
                    queryKey: gcMessageKeys.threadCounts(variables.chatId),
                });
            } else {
                await queryClient.invalidateQueries(
                    gcMessageQueries.mainMessages(variables.chatId),
                );
            }
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

export function useRegenerateGCMessage() {
    const queryClient = useQueryClient();
    const getToolsets = useGetToolsets();

    return useMutation({
        mutationKey: ["regenerateGCMessage"] as const,
        mutationFn: async ({
            chatId,
            messageId,
            modelConfigId,
        }: {
            chatId: string;
            messageId: string;
            modelConfigId: string;
        }) => {
            // Delete the old message
            await softDeleteGCMessage(messageId);
            await queryClient.invalidateQueries({
                queryKey: gcMessageKeys.main(chatId),
            });

            const allConfigs = await ModelsAPI.fetchModelConfigs();
            const modelConfig = allConfigs.find(
                (c) => c.modelId === modelConfigId,
            );
            if (!modelConfig) {
                throw new Error(
                    `Model config not found for: ${modelConfigId}`,
                );
            }

            // Resolve tools
            const toolsets = await getToolsets();
            const tools = toolsets.flatMap((toolset) => toolset.listTools());

            // Use the tool-aware streaming loop (handles message insertion internally)
            await streamGCResponseWithTools({
                chatId,
                modelConfig,
                queryClient,
                getTools: () => tools,
            });
        },
        onSuccess: async (_, variables) => {
            await queryClient.invalidateQueries({
                queryKey: gcMessageKeys.main(variables.chatId),
            });
        },
    });
}

export function useGenerateAIResponses() {
    const queryClient = useQueryClient();
    const getToolsets = useGetToolsets();

    return useMutation({
        mutationKey: ["generateGCAIResponses"] as const,
        mutationFn: async ({
            chatId,
            userMessage,
            threadRootMessageId,
        }: {
            chatId: string;
            userMessage: string;
            threadRootMessageId?: string;
        }) => {
            // Check for /conduct command
            if (userMessage.toLowerCase().startsWith("/conduct")) {
                const { models } = await getRespondingModels(userMessage);
                const conductorModelId =
                    models[0]?.id ?? DEFAULT_MODEL_ID;
                const toolsets = await getToolsets();
                const tools = toolsets.flatMap((t) => t.listTools());

                const scopeId = threadRootMessageId;
                await orchestrateConductorSession({
                    chatId,
                    conductorModelId,
                    queryClient,
                    getTools: () => tools,
                    scopeId,
                    threadRootMessageId,
                });

                return [
                    {
                        model: conductorModelId,
                        success: true,
                    },
                ];
            }

            // Check for /yield command
            if (userMessage.toLowerCase().startsWith("/yield")) {
                const scopeId = threadRootMessageId;
                await clearConductor(chatId, scopeId);
                await queryClient.invalidateQueries({
                    queryKey: gcMessageKeys.conductor(chatId, scopeId),
                });
                return [];
            }

            // Check if there's an active conductor
            const scopeId = threadRootMessageId;
            const activeConductor = await fetchActiveConductor(
                chatId,
                scopeId,
            );
            if (activeConductor) {
                const toolsets = await getToolsets();
                const tools = toolsets.flatMap((t) => t.listTools());

                // Continue conductor session
                await orchestrateConductorSession({
                    chatId,
                    conductorModelId: activeConductor.conductorModelId,
                    queryClient,
                    getTools: () => tools,
                    scopeId,
                    threadRootMessageId,
                });

                return [
                    {
                        model: activeConductor.conductorModelId,
                        success: true,
                    },
                ];
            }

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

            // Resolve tools once for all models
            const toolsets = await getToolsets();
            const tools = toolsets.flatMap((toolset) => toolset.listTools());

            const varietyPrompts = [
                "Provide a unique perspective or approach to this question.",
                "Offer a different angle or solution than what might be typical.",
                "Share an alternative viewpoint or method.",
                "Approach this from a fresh perspective.",
            ];

            await Promise.all(
                modelInstances.map(async (modelInstance) => {
                    try {
                        const modelConfig = allConfigs.find(
                            (c) => c.modelId === modelInstance.id,
                        );
                        if (!modelConfig) {
                            throw new Error(
                                `Model config not found for: ${modelInstance.id}`,
                            );
                        }

                        // Build variety prompt for multiplied instances
                        const prefixMessages: LLMMessage[] = [];
                        if (multiplier > 1) {
                            const promptIndex =
                                (modelInstance.instance - 1) %
                                varietyPrompts.length;
                            prefixMessages.push({
                                role: "user",
                                content: varietyPrompts[promptIndex],
                                attachments: [],
                            });
                        }

                        // Use the tool-aware streaming loop
                        await streamGCResponseWithTools({
                            chatId,
                            modelConfig,
                            queryClient,
                            getTools: () => tools,
                            prefixMessages:
                                prefixMessages.length > 0
                                    ? prefixMessages
                                    : undefined,
                            threadRootMessageId,
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
            if (variables.threadRootMessageId) {
                await queryClient.invalidateQueries({
                    queryKey: gcMessageKeys.thread(
                        variables.chatId,
                        variables.threadRootMessageId,
                    ),
                });
                await queryClient.invalidateQueries({
                    queryKey: gcMessageKeys.threadCounts(variables.chatId),
                });
            } else {
                await queryClient.invalidateQueries({
                    queryKey: gcMessageKeys.main(variables.chatId),
                });
            }
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

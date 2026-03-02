// Saved model config hooks

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { v4 as uuidv4 } from "uuid";

import { db } from "../DB";

const modelConfigChatKeys = {
    savedModelConfigChat: (chatId: string) =>
        ["savedModelConfig", chatId] as const,
};

// Saved model config functions
async function fetchSavedModelConfigChat(
    chatId: string,
): Promise<string[] | undefined> {
    const rows = await db.select<{ model_ids: string }[]>(
        `SELECT model_ids FROM saved_model_configs_chats WHERE chat_id = ?`,
        [chatId],
    );

    if (rows.length === 0) {
        return undefined;
    }

    // Parse the JSON array of model IDs
    try {
        return JSON.parse(rows[0].model_ids) as string[];
    } catch {
        return undefined;
    }
}

export async function updateSavedModelConfigChat(
    chatId: string,
    modelIds: string[],
): Promise<void> {
    // First check if a config already exists for this chat
    const existing = await db.select<{ id: string }[]>(
        `SELECT id FROM saved_model_configs_chats WHERE chat_id = ?`,
        [chatId],
    );

    if (existing.length > 0) {
        // Update existing config
        await db.execute(
            `UPDATE saved_model_configs_chats 
             SET model_ids = ?, updated_at = CURRENT_TIMESTAMP 
             WHERE chat_id = ?`,
            [JSON.stringify(modelIds), chatId],
        );
    } else {
        // Create new config with a unique ID
        const id = uuidv4();
        await db.execute(
            `INSERT INTO saved_model_configs_chats (id, chat_id, model_ids, created_at, updated_at) 
             VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
            [id, chatId, JSON.stringify(modelIds)],
        );
    }
}

export function useSavedModelConfigChat(chatId: string) {
    return useQuery({
        queryKey: modelConfigChatKeys.savedModelConfigChat(chatId),
        queryFn: () => fetchSavedModelConfigChat(chatId),
    });
}

export function useUpdateSavedModelConfigChat() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({
            chatId,
            modelIds,
        }: {
            chatId: string;
            modelIds: string[];
        }) => updateSavedModelConfigChat(chatId, modelIds),
        onSuccess: (_data, variables) => {
            void queryClient.invalidateQueries({
                queryKey: modelConfigChatKeys.savedModelConfigChat(
                    variables.chatId,
                ),
            });
        },
    });
}

// Convenience hook for reply chats - gets just the first model ID
export function useReplyModelConfig(chatId: string) {
    const savedModelConfig = useSavedModelConfigChat(chatId);
    return {
        ...savedModelConfig,
        data: savedModelConfig.data?.[0] ?? undefined,
    };
}

// Convenience hook for updating reply model - updates with a single model ID
export function useUpdateReplyModelConfig() {
    const updateSavedModelConfig = useUpdateSavedModelConfigChat();

    return useMutation({
        mutationFn: ({
            chatId,
            modelId,
        }: {
            chatId: string;
            modelId: string;
        }) =>
            updateSavedModelConfig.mutateAsync({ chatId, modelIds: [modelId] }),
    });
}

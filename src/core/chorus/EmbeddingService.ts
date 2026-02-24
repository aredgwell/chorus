import OpenAI from "openai";
import { invoke } from "@tauri-apps/api/core";
import { getApiKeys } from "@core/chorus/api/AppMetadataAPI";

export interface SimilarChat {
    chatId: string;
    title: string | undefined;
    distance: number;
    projectId: string | undefined;
    updatedAt: string | undefined;
}

async function getEmbedding(
    apiKey: string,
    text: string,
): Promise<number[]> {
    const client = new OpenAI({
        apiKey,
        dangerouslyAllowBrowser: true,
    });
    const response = await client.embeddings.create({
        model: "text-embedding-3-small",
        input: text.slice(0, 8000),
    });
    return response.data[0].embedding;
}

/**
 * Generate an embedding from text and store it for a chat.
 * Silently skips if no OpenAI key is configured.
 */
export async function generateAndStoreEmbedding(
    chatId: string,
    text: string,
): Promise<void> {
    const apiKeys = await getApiKeys();
    if (!apiKeys.openai) return;

    const embedding = await getEmbedding(apiKeys.openai, text);
    await invoke("upsert_chat_embedding", { chatId, embedding });
}

/**
 * Find chats whose embeddings are closest to the given text.
 * Returns empty array if no OpenAI key is configured.
 */
export async function findSimilarChats(
    chatId: string,
    text: string,
    limit = 10,
): Promise<SimilarChat[]> {
    const apiKeys = await getApiKeys();
    if (!apiKeys.openai) return [];

    const embedding = await getEmbedding(apiKeys.openai, text);
    const results = await invoke<SimilarChat[]>("find_similar_chats", {
        embedding,
        limit,
        excludeChatId: chatId,
    });
    return results;
}

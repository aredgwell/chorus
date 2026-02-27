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

export interface SimilarItem {
    type: "chat" | "note";
    id: string;
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
 * Queues embedding generation requests, deduplicating by ID and
 * limiting concurrency. If the same ID is enqueued multiple times
 * before processing, only the latest text is used.
 * Works for both chat and note embeddings (notes use "note:" prefixed keys).
 */
class EmbeddingQueue {
    private readonly pending = new Map<string, string>();
    private running = 0;
    private readonly MAX_CONCURRENT = 3;

    enqueue(id: string, text: string): void {
        this.pending.set(id, text);
        void this.drain();
    }

    private drain(): void {
        while (this.running < this.MAX_CONCURRENT && this.pending.size > 0) {
            const entry = this.pending.entries().next().value;
            if (!entry) break;
            const [id, text] = entry;
            this.pending.delete(id);
            this.running++;
            generateAndStoreEmbedding(id, text)
                .catch(console.error)
                .finally(() => {
                    this.running--;
                    void this.drain();
                });
        }
    }
}

export const embeddingQueue = new EmbeddingQueue();

/**
 * Generate an embedding from text and store it.
 * The chatId parameter is a generic key — use "note:{noteId}" for notes.
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
 * Delete an embedding by its ID (e.g. "note:{noteId}").
 */
export async function deleteEmbedding(id: string): Promise<void> {
    try {
        await invoke("delete_embedding", { id });
    } catch {
        // Silently ignore — the item may not have had an embedding
    }
}

/**
 * Find chats whose embeddings are closest to the given text.
 * Returns empty array if no OpenAI key is configured.
 */
export async function findSimilarChats(
    text: string,
    limit = 10,
    excludeChatId?: string,
): Promise<SimilarChat[]> {
    const apiKeys = await getApiKeys();
    if (!apiKeys.openai) return [];

    const embedding = await getEmbedding(apiKeys.openai, text);
    const results = await invoke<SimilarChat[]>("find_similar_chats", {
        embedding,
        limit,
        excludeChatId,
    });
    return results;
}

/**
 * Find items (chats and notes) whose embeddings are closest to the given text.
 * Returns empty array if no OpenAI key is configured.
 */
export async function findSimilarItems(
    text: string,
    limit = 10,
    excludeId?: string,
): Promise<SimilarItem[]> {
    const apiKeys = await getApiKeys();
    if (!apiKeys.openai) return [];

    const embedding = await getEmbedding(apiKeys.openai, text);
    const results = await invoke<SimilarItem[]>("find_similar_items", {
        embedding,
        limit,
        excludeId,
    });
    return results;
}

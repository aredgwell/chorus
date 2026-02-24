import { useQuery } from "@tanstack/react-query";
import { db } from "../DB";

/**
 * Escape a user query for FTS5 MATCH syntax.
 * Wraps each token in double quotes to treat them as literals,
 * preventing FTS5 syntax errors from special characters.
 */
function escapeFtsQuery(query: string): string {
    return query
        .split(/\s+/)
        .filter((token) => token.length > 0)
        .map((token) => `"${token.replace(/"/g, '""')}"`)
        .join(" ");
}

const searchQuery = (query: string) => ({
    queryKey: ["searchResults", query] as const,
    queryFn: async () => {
        const ftsQuery = escapeFtsQuery(query);
        if (!ftsQuery) return [];

        // FTS5 search across message content + fallback LIKE for chat titles
        const results = await db.select<SearchResult[]>(
            `
                SELECT DISTINCT
                    m.id,
                    m.chat_id,
                    CASE
                        WHEN m.model = 'user' THEN COALESCE(m.text, '')
                        ELSE COALESCE(NULLIF(m.text, ''), mp.content, '')
                    END as text,
                    m.model,
                    m.created_at,
                    c.title,
                    ms.type,
                    CASE
                        WHEN m.model = 'user' THEN 'You'
                        ELSE m.model
                    END as message_type,
                    c.project_id,
                    c.parent_chat_id,
                    c.reply_to_id
                FROM messages_fts fts
                INNER JOIN messages m ON fts.message_id = m.id AND fts.chat_id = m.chat_id
                INNER JOIN chats c ON m.chat_id = c.id
                LEFT JOIN message_sets ms ON m.message_set_id = ms.id
                LEFT JOIN message_parts mp ON m.id = mp.message_id AND m.chat_id = mp.chat_id
                WHERE messages_fts MATCH $1

                UNION

                SELECT DISTINCT
                    m.id,
                    m.chat_id,
                    COALESCE(m.text, '') as text,
                    m.model,
                    m.created_at,
                    c.title,
                    ms.type,
                    CASE
                        WHEN m.model = 'user' THEN 'You'
                        ELSE m.model
                    END as message_type,
                    c.project_id,
                    c.parent_chat_id,
                    c.reply_to_id
                FROM chats c
                INNER JOIN messages m ON m.chat_id = c.id
                LEFT JOIN message_sets ms ON m.message_set_id = ms.id
                LEFT JOIN message_parts mp ON m.id = mp.message_id AND m.chat_id = mp.chat_id
                WHERE c.title LIKE '%' || $2 || '%'
                    AND c.title IS NOT NULL
                    AND c.title != 'Untitled Chat'

                ORDER BY created_at DESC
                LIMIT 50
            `,
            [ftsQuery, query],
        );

        // Deduplicate by chat_id, keeping the most recent message
        const chatMap = new Map<string, SearchResult>();
        for (const result of results) {
            if (!chatMap.has(result.chat_id)) {
                chatMap.set(result.chat_id, result);
            }
        }

        return Array.from(chatMap.values());
    },
});

export interface SearchResult {
    id: string;
    chat_id: string;
    text: string;
    model: string;
    created_at: string;
    title?: string;
    type?: string; // "user" or "ai" message
    message_type?: string; // The message type (e.g., "user", model name)
    project_id?: string; // The project ID this chat belongs to
    parent_chat_id?: string; // The parent chat ID if this is a reply
    reply_to_id?: string; // The ID to set as replyID query param
}

export function useSearchMessages(query: string) {
    return useQuery(searchQuery(query));
}

/**
 * Full search query that returns all matching messages (not deduplicated by chat).
 * Used by the dedicated search view for richer results.
 */
const fullSearchQuery = (query: string) => ({
    queryKey: ["searchResults", "full", query] as const,
    queryFn: async () => {
        const ftsQuery = escapeFtsQuery(query);
        if (!ftsQuery) return [];

        const results = await db.select<SearchResult[]>(
            `
                SELECT DISTINCT
                    m.id,
                    m.chat_id,
                    CASE
                        WHEN m.model = 'user' THEN COALESCE(m.text, '')
                        ELSE COALESCE(NULLIF(m.text, ''), mp.content, '')
                    END as text,
                    m.model,
                    m.created_at,
                    c.title,
                    ms.type,
                    CASE
                        WHEN m.model = 'user' THEN 'You'
                        ELSE m.model
                    END as message_type,
                    c.project_id,
                    c.parent_chat_id,
                    c.reply_to_id
                FROM messages_fts fts
                INNER JOIN messages m ON fts.message_id = m.id AND fts.chat_id = m.chat_id
                INNER JOIN chats c ON m.chat_id = c.id
                LEFT JOIN message_sets ms ON m.message_set_id = ms.id
                LEFT JOIN message_parts mp ON m.id = mp.message_id AND m.chat_id = mp.chat_id
                WHERE messages_fts MATCH $1

                UNION

                SELECT DISTINCT
                    m.id,
                    m.chat_id,
                    COALESCE(m.text, '') as text,
                    m.model,
                    m.created_at,
                    c.title,
                    ms.type,
                    CASE
                        WHEN m.model = 'user' THEN 'You'
                        ELSE m.model
                    END as message_type,
                    c.project_id,
                    c.parent_chat_id,
                    c.reply_to_id
                FROM chats c
                INNER JOIN messages m ON m.chat_id = c.id
                LEFT JOIN message_sets ms ON m.message_set_id = ms.id
                LEFT JOIN message_parts mp ON m.id = mp.message_id AND m.chat_id = mp.chat_id
                WHERE c.title LIKE '%' || $2 || '%'
                    AND c.title IS NOT NULL
                    AND c.title != 'Untitled Chat'

                ORDER BY created_at DESC
                LIMIT 200
            `,
            [ftsQuery, query],
        );

        return results;
    },
});

export function useFullSearchMessages(query: string) {
    return useQuery(fullSearchQuery(query));
}

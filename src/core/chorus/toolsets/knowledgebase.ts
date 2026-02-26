import { Toolset } from "@core/chorus/Toolsets";
import { db } from "@core/chorus/DB";
import { findSimilarItems, SimilarItem } from "@core/chorus/EmbeddingService";
import { escapeFtsQuery } from "@core/chorus/api/SearchAPI";
import { fetchNote } from "@core/chorus/api/NoteAPI";

const NOTE_CONTENT_CAP = 2000;

type NoteFtsRow = {
    id: string;
    title: string;
    content: string;
};

type ChatFtsRow = {
    chat_id: string;
    title: string;
};

/**
 * Search notes via FTS5 keyword matching.
 */
async function searchNotesFts(query: string): Promise<NoteFtsRow[]> {
    const ftsQuery = escapeFtsQuery(query);
    if (!ftsQuery) return [];

    return db.select<NoteFtsRow[]>(
        `SELECT n.id, n.title, n.content
         FROM notes_fts fts
         INNER JOIN notes n ON fts.note_id = n.id
         WHERE notes_fts MATCH $1
         ORDER BY rank
         LIMIT 10`,
        [ftsQuery],
    );
}

/**
 * Search chat titles via FTS5 keyword matching.
 */
async function searchChatsFts(query: string): Promise<ChatFtsRow[]> {
    const ftsQuery = escapeFtsQuery(query);
    if (!ftsQuery) return [];

    return db.select<ChatFtsRow[]>(
        `SELECT DISTINCT c.id as chat_id, c.title
         FROM messages_fts fts
         INNER JOIN messages m ON fts.message_id = m.id AND fts.chat_id = m.chat_id
         INNER JOIN chats c ON m.chat_id = c.id
         WHERE messages_fts MATCH $1
         LIMIT 10`,
        [ftsQuery],
    );
}

function truncate(text: string, max: number): string {
    if (text.length <= max) return text;
    return text.slice(0, max) + "…";
}

/**
 * Format search results into a readable string for the model.
 */
async function formatResults(
    semanticResults: SimilarItem[],
    noteFtsResults: NoteFtsRow[],
    chatFtsResults: ChatFtsRow[],
): Promise<string> {
    // Deduplicate: collect all unique IDs
    const seenNotes = new Set<string>();
    const seenChats = new Set<string>();
    const sections: string[] = [];

    // Process semantic results first (ranked by relevance)
    const noteEntries: string[] = [];
    const chatEntries: string[] = [];

    for (const item of semanticResults) {
        if (item.type === "note" && !seenNotes.has(item.id)) {
            seenNotes.add(item.id);
            try {
                const note = await fetchNote(item.id);
                const content = truncate(note.content || "", NOTE_CONTENT_CAP);
                noteEntries.push(
                    `- **${note.title || "Untitled Note"}** (similarity: ${(1 - item.distance).toFixed(2)})\n  ${content}`,
                );
            } catch {
                // Note may have been deleted
            }
        } else if (item.type === "chat" && !seenChats.has(item.id)) {
            seenChats.add(item.id);
            chatEntries.push(
                `- **${item.title || "Untitled Chat"}** (similarity: ${(1 - item.distance).toFixed(2)})`,
            );
        }
    }

    // Add FTS note results not already seen
    for (const row of noteFtsResults) {
        if (seenNotes.has(row.id)) continue;
        seenNotes.add(row.id);
        const content = truncate(row.content || "", NOTE_CONTENT_CAP);
        noteEntries.push(
            `- **${row.title || "Untitled Note"}** (keyword match)\n  ${content}`,
        );
    }

    // Add FTS chat results not already seen
    for (const row of chatFtsResults) {
        if (seenChats.has(row.chat_id)) continue;
        seenChats.add(row.chat_id);
        chatEntries.push(
            `- **${row.title || "Untitled Chat"}** (keyword match)`,
        );
    }

    if (noteEntries.length > 0) {
        sections.push(`## Notes\n\n${noteEntries.join("\n\n")}`);
    }
    if (chatEntries.length > 0) {
        sections.push(`## Chats\n\n${chatEntries.join("\n")}`);
    }

    if (sections.length === 0) {
        return "No results found.";
    }

    return sections.join("\n\n");
}

export class ToolsetKnowledgeBase extends Toolset {
    constructor() {
        super(
            "knowledge",
            "Knowledge Base",
            {},
            "Search your notes and chat history",
            "",
        );

        this.addCustomTool(
            "search",
            {
                type: "object",
                properties: {
                    query: {
                        type: "string",
                        description:
                            "Search query — a natural language description of what to look for in notes and chat history.",
                    },
                },
                required: ["query"],
                additionalProperties: false,
            },
            async (args) => {
                const query = args.query as string;

                // Run semantic and keyword searches in parallel
                const [semanticResults, noteFtsResults, chatFtsResults] =
                    await Promise.all([
                        findSimilarItems(query, 10).catch(
                            (): SimilarItem[] => [],
                        ),
                        searchNotesFts(query).catch((): NoteFtsRow[] => []),
                        searchChatsFts(query).catch((): ChatFtsRow[] => []),
                    ]);

                return formatResults(
                    semanticResults,
                    noteFtsResults,
                    chatFtsResults,
                );
            },
            `Search your knowledge base — notes and chat history — for information relevant to a query.
Combines semantic search (meaning-based) with keyword search (exact terms) for best results.
Use this when the user asks about something they may have written about or discussed before.`,
        );
    }
}

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { db } from "../DB";
import { simpleLLM } from "../simpleLLM";
import { SimpleCompletionMode } from "../ModelProviders/simple/ISimpleCompletionProvider";
import { CHAT_SUMMARY_TO_NOTE_PROMPT } from "../prompts/prompts";
import { llmConversation } from "../ChatState";
import { useGetMessageSets } from "./MessageAPI";
import { chatQueries } from "./ChatAPI";
import { noteQueries } from "./NoteAPI";

// ── Types ──────────────────────────────────────────────────────────────

export type LinkType = "manual" | "summary" | "context";

export type NoteChatLink = {
    noteId: string;
    chatId: string;
    linkType: LinkType;
    createdAt: string;
};

type NoteChatLinkDBRow = {
    note_id: string;
    chat_id: string;
    link_type: string;
    created_at: string;
};

function readLink(row: NoteChatLinkDBRow): NoteChatLink {
    return {
        noteId: row.note_id,
        chatId: row.chat_id,
        linkType: row.link_type as LinkType,
        createdAt: row.created_at,
    };
}

// ── Query keys ─────────────────────────────────────────────────────────

const linkKeys = {
    all: () => ["noteChatLinks"] as const,
    forNote: (noteId: string) =>
        ["noteChatLinks", "note", noteId] as const,
    forChat: (chatId: string) =>
        ["noteChatLinks", "chat", chatId] as const,
};

// ── Query definitions ──────────────────────────────────────────────────

export const linkQueries = {
    forNote: (noteId: string) => ({
        queryKey: linkKeys.forNote(noteId),
        queryFn: () => fetchLinksForNote(noteId),
        enabled: !!noteId,
    }),
    forChat: (chatId: string) => ({
        queryKey: linkKeys.forChat(chatId),
        queryFn: () => fetchLinksForChat(chatId),
        enabled: !!chatId,
    }),
};

// ── Fetch functions ────────────────────────────────────────────────────

export async function fetchLinksForNote(
    noteId: string,
): Promise<NoteChatLink[]> {
    return await db
        .select<NoteChatLinkDBRow[]>(
            `SELECT note_id, chat_id, link_type, created_at
             FROM note_chat_links
             WHERE note_id = ?
             ORDER BY created_at DESC`,
            [noteId],
        )
        .then((rows) => rows.map(readLink));
}

export async function fetchLinksForChat(
    chatId: string,
): Promise<NoteChatLink[]> {
    return await db
        .select<NoteChatLinkDBRow[]>(
            `SELECT note_id, chat_id, link_type, created_at
             FROM note_chat_links
             WHERE chat_id = ?
             ORDER BY created_at DESC`,
            [chatId],
        )
        .then((rows) => rows.map(readLink));
}

// ── Hooks ──────────────────────────────────────────────────────────────

export function useLinksForNote(noteId: string | undefined) {
    return useQuery({
        ...linkQueries.forNote(noteId ?? ""),
        enabled: noteId !== undefined,
    });
}

export function useLinksForChat(chatId: string | undefined) {
    return useQuery({
        ...linkQueries.forChat(chatId ?? ""),
        enabled: chatId !== undefined,
    });
}

// ── Mutations ──────────────────────────────────────────────────────────

export function useCreateLink() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationKey: ["createNoteChatLink"] as const,
        mutationFn: async ({
            noteId,
            chatId,
            linkType = "manual",
        }: {
            noteId: string;
            chatId: string;
            linkType?: LinkType;
        }) => {
            await db.execute(
                `INSERT OR IGNORE INTO note_chat_links (note_id, chat_id, link_type)
                 VALUES (?, ?, ?)`,
                [noteId, chatId, linkType],
            );
        },
        onSuccess: async (_data, variables) => {
            await queryClient.invalidateQueries({
                queryKey: linkKeys.forNote(variables.noteId),
            });
            await queryClient.invalidateQueries({
                queryKey: linkKeys.forChat(variables.chatId),
            });
        },
    });
}

export function useDeleteLink() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationKey: ["deleteNoteChatLink"] as const,
        mutationFn: async ({
            noteId,
            chatId,
        }: {
            noteId: string;
            chatId: string;
        }) => {
            await db.execute(
                `DELETE FROM note_chat_links
                 WHERE note_id = ? AND chat_id = ?`,
                [noteId, chatId],
            );
        },
        onSuccess: async (_data, variables) => {
            await queryClient.invalidateQueries({
                queryKey: linkKeys.forNote(variables.noteId),
            });
            await queryClient.invalidateQueries({
                queryKey: linkKeys.forChat(variables.chatId),
            });
        },
    });
}

// ── Summarize chat to note ─────────────────────────────────────────────

export function useSummarizeChatToNote() {
    const queryClient = useQueryClient();
    const getMessageSets = useGetMessageSets();

    return useMutation({
        mutationKey: ["summarizeChatToNote"] as const,
        mutationFn: async ({ chatId }: { chatId: string }) => {
            // 1. Get chat details (for projectId and title)
            const chat = await queryClient.ensureQueryData(
                chatQueries.detail(chatId),
            );

            // 2. Build conversation text
            const messageSets = await getMessageSets(chatId);
            if (messageSets.length === 0) {
                throw new Error("No messages to summarize");
            }
            const conversationText = llmConversation(messageSets)
                .filter((m) => m.role === "user" || m.role === "assistant")
                .map((m) => `${m.role}: ${m.content}`)
                .join("\n\n");

            // 3. Generate summary via LLM
            const summary = await simpleLLM(
                CHAT_SUMMARY_TO_NOTE_PROMPT(conversationText),
                {
                    model: SimpleCompletionMode.SUMMARIZER,
                    maxTokens: 8192,
                },
            );

            // 4. Create a new note with the summary
            const noteTitle = `Summary: ${chat.title || "Untitled Chat"}`;
            const noteResult = await db.select<{ id: string }[]>(
                `INSERT INTO notes (id, title, content, project_id)
                 VALUES (lower(hex(randomblob(16))), ?, ?, ?)
                 RETURNING id`,
                [noteTitle, summary, chat.projectId],
            );

            if (noteResult.length === 0) {
                throw new Error("Failed to create note");
            }

            const noteId = noteResult[0].id;

            // 5. Link the note to the chat
            await db.execute(
                `INSERT OR IGNORE INTO note_chat_links (note_id, chat_id, link_type)
                 VALUES (?, ?, 'summary')`,
                [noteId, chatId],
            );

            return { noteId, chatId };
        },
        onSuccess: async (data) => {
            await queryClient.invalidateQueries(noteQueries.list());
            await queryClient.invalidateQueries({
                queryKey: linkKeys.forNote(data.noteId),
            });
            await queryClient.invalidateQueries({
                queryKey: linkKeys.forChat(data.chatId),
            });
        },
    });
}

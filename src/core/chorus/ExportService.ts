import { db } from "./DB";

interface ExportMessage {
    model: string;
    text: string;
    created_at: string;
    cost_usd: number | undefined;
    parts: ExportMessagePart[];
}

interface ExportMessagePart {
    content: string;
    content_type: string;
}

interface ExportChat {
    id: string;
    title: string;
    created_at: string;
    updated_at: string;
    project_id: string;
    total_cost_usd: number | undefined;
    messages: ExportMessage[];
}

interface MessageRow {
    id: string;
    model: string;
    text: string | null;
    created_at: string;
    cost_usd: number | null;
    message_set_id: string;
}

interface PartRow {
    message_id: string;
    content: string | null;
    content_type: string | null;
}

interface ChatRow {
    id: string;
    title: string;
    created_at: string;
    updated_at: string;
    project_id: string;
    total_cost_usd: number | null;
}

async function fetchChatForExport(chatId: string): Promise<ExportChat> {
    const chatRows = await db.select<ChatRow[]>(
        `SELECT id, title, created_at, updated_at, project_id, total_cost_usd
         FROM chats WHERE id = ?`,
        [chatId],
    );

    if (!chatRows.length) throw new Error(`Chat not found: ${chatId}`);
    const chat = chatRows[0];

    // Get all active messages in conversation order
    const messages = await db.select<MessageRow[]>(
        `SELECT m.id, m.model, m.text, m.created_at, m.cost_usd, m.message_set_id
         FROM messages m
         INNER JOIN message_sets ms ON m.message_set_id = ms.id
         WHERE m.chat_id = ? AND m.state != 'error'
         AND m.id = ms.active_message_id
         ORDER BY ms.ordering ASC`,
        [chatId],
    );

    // Get message parts for all messages
    const messageIds = messages.map((m) => m.id);
    let parts: PartRow[] = [];
    if (messageIds.length > 0) {
        // SQLite doesn't support array params, so we query per message
        for (const msgId of messageIds) {
            const msgParts = await db.select<PartRow[]>(
                `SELECT message_id, content, content_type
                 FROM message_parts
                 WHERE message_id = ?
                 ORDER BY ordering ASC`,
                [msgId],
            );
            parts = parts.concat(msgParts);
        }
    }

    const partsByMessage = new Map<string, PartRow[]>();
    for (const part of parts) {
        const existing = partsByMessage.get(part.message_id) ?? [];
        existing.push(part);
        partsByMessage.set(part.message_id, existing);
    }

    return {
        id: chat.id,
        title: chat.title,
        created_at: chat.created_at,
        updated_at: chat.updated_at,
        project_id: chat.project_id,
        total_cost_usd: chat.total_cost_usd ?? undefined,
        messages: messages.map((m) => ({
            model: m.model,
            text: m.text ?? "",
            created_at: m.created_at,
            cost_usd: m.cost_usd ?? undefined,
            parts: (partsByMessage.get(m.id) ?? []).map((p) => ({
                content: p.content ?? "",
                content_type: p.content_type ?? "text",
            })),
        })),
    };
}

/**
 * Export a chat as Markdown.
 */
export async function exportChatAsMarkdown(chatId: string): Promise<string> {
    const chat = await fetchChatForExport(chatId);
    const lines: string[] = [];

    lines.push(`# ${chat.title}`);
    lines.push("");
    lines.push(`_Exported from Chorus on ${new Date().toISOString().slice(0, 10)}_`);
    lines.push("");

    for (const message of chat.messages) {
        const role = message.model === "user" ? "You" : message.model;
        lines.push(`## ${role}`);
        lines.push("");

        // Prefer message parts content for AI messages, fall back to text
        if (
            message.model !== "user" &&
            message.parts.length > 0 &&
            message.parts.some((p) => p.content)
        ) {
            for (const part of message.parts) {
                if (part.content_type === "tool_call") {
                    lines.push(`> Tool call: ${part.content}`);
                } else if (part.content_type === "tool_result") {
                    lines.push(`> Tool result: ${part.content.slice(0, 500)}`);
                } else {
                    lines.push(part.content);
                }
                lines.push("");
            }
        } else {
            lines.push(message.text);
            lines.push("");
        }

        lines.push("---");
        lines.push("");
    }

    return lines.join("\n");
}

/**
 * Export a chat as JSON with full fidelity.
 */
export async function exportChatAsJSON(chatId: string): Promise<string> {
    const chat = await fetchChatForExport(chatId);
    return JSON.stringify(chat, null, 2);
}

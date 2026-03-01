import Database from "@tauri-apps/plugin-sql";
import { v4 as uuidv4 } from "uuid";

import { MessageSetDBRow } from "../api/MessageAPI";
import { UserToolCall, UserToolResult } from "../Toolsets";

/**
 * Handy util functions for importing chat history from other LLM providers' UIs.
 * Mostly does the heavy lifting of writing to the database + simple data preparation.
 *
 * Because we're writing chats / message sets / messages / message parts that have
 * already finished streaming, we use a different write path than the typical
 * useMutation calls in API.ts. We don't stand to gain much by sharing right now
 * since writing is often interleaved with the actual streaming process in API.ts.
 *
 * We could try to standardize the plain SQL writes themselves (like we standardize
 * reads in DB.ts), though it's likely not worth the lift at this time. - Omid
 */

/**
 * Formats a Date object to SQLite datetime format: "YYYY-MM-DD HH:MM:SS"
 */
export function formatSQLiteDateTime(date: Date): string {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, "0");
    const day = String(date.getUTCDate()).padStart(2, "0");
    const hours = String(date.getUTCHours()).padStart(2, "0");
    const minutes = String(date.getUTCMinutes()).padStart(2, "0");
    const seconds = String(date.getUTCSeconds()).padStart(2, "0");
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

export async function createProject(
    name: string,
    db: Database,
): Promise<string> {
    // Check if project already exists
    // sorta hacky, but fine since we're just going for presentational purposes here
    const existingProject = await db.select<{ id: string }[]>(
        `SELECT id FROM projects WHERE name = ?`,
        [name],
    );

    if (existingProject.length > 0) {
        console.log(`Using existing '${name}' project`);
        return existingProject[0].id;
    }

    const projectId = uuidv4().toLowerCase();
    const now = new Date().toISOString();

    await db.execute(
        `INSERT INTO projects (id, name, created_at, updated_at, is_collapsed, magic_projects_enabled, is_imported) 
            VALUES (?, ?, ?, ?, 0, 0, 1)`,
        [projectId, name, now, now],
    );

    console.log(`Created '${name}' project for conversation import`);
    return projectId;
}

export async function createChat(
    title: string,
    createdAt: string,
    updatedAt: string,
    projectId: string,
    db: Database,
): Promise<string> {
    const chatId = uuidv4().toLowerCase();
    const createdAtFormatted = formatSQLiteDateTime(new Date(createdAt));
    const updatedAtFormatted = formatSQLiteDateTime(new Date(updatedAt));

    await db.execute(
        `INSERT INTO chats (id, title, project_id, created_at, updated_at, quick_chat, is_new_chat, pinned) 
            VALUES (?, ?, ?, ?, ?, 0, 0, 0)`,
        [chatId, title, projectId, createdAtFormatted, updatedAtFormatted],
    );

    return chatId;
}

/**
 * Helper to write a chat's original updated_at timestamp to the database.
 *
 * This is necessary because as we iterate through the (unsorted) conversation list
 * that providers send to us, a trigger updates the updated_at timestamp of the chat.
 *
 * So we need to restore the original updated_at timestamp to the chat after finishing each
 * conversation import.
 */
export async function restoreChatUpdatedAt(
    chatId: string,
    updatedAt: string,
    db: Database,
) {
    await db.execute(`UPDATE chats SET updated_at = ? WHERE id = ?`, [
        formatSQLiteDateTime(new Date(updatedAt)),
        chatId,
    ]);
}

export type ImportedMessageSet = Pick<MessageSetDBRow, "chat_id" | "level">;
// NOTE: This cannot be the precise DB type since that does not have the full serialized UserToolCall and UserToolResult type
export interface ProcessedMessagePart {
    content: string;
    tool_calls: UserToolCall[];
    tool_results: UserToolResult[];
}

export async function createMessageSet(
    messageSet: ImportedMessageSet,
    humanMessage: string | null,
    assistantMessage: string | null,
    messageParts: ProcessedMessagePart[] | null,
    db: Database,
): Promise<void> {
    // Create USER message set
    const userMessageSetId = uuidv4().toLowerCase();

    await db.execute(
        `INSERT INTO message_sets (id, chat_id, level, type, selected_block_type) 
            VALUES (?, ?, ?, 'user', 'user')`,
        [userMessageSetId, messageSet.chat_id, messageSet.level * 2], // level * 2 because we're creating pairs
    );

    // Create user message
    const userMessageId = uuidv4().toLowerCase();

    await db.execute(
        `INSERT INTO messages (
                id, chat_id, message_set_id, text, model, selected, 
                block_type, state, is_review, level
            ) VALUES (?, ?, ?, ?, 'user', 1, 'user', 'idle', 0, NULL)`,
        [userMessageId, messageSet.chat_id, userMessageSetId, humanMessage],
    );

    // Create AI message set and message if assistant message exists
    if (assistantMessage) {
        const aiMessageSetId = uuidv4().toLowerCase();

        // Create AI message set with 'tools' as the selected_block_type (matching UI behavior)
        await db.execute(
            `INSERT INTO message_sets (id, chat_id, level, type, selected_block_type) 
                VALUES (?, ?, ?, 'ai', 'tools')`,
            [aiMessageSetId, messageSet.chat_id, messageSet.level * 2 + 1],
        );

        const assistantMessageId = uuidv4().toLowerCase();

        // Create assistant message with block_type='tools' to match the selected_block_type
        await db.execute(
            `INSERT INTO messages (
                    id, chat_id, message_set_id, text, model, selected, 
                    block_type, state, is_review, level
                ) VALUES (?, ?, ?, ?, 'anthropic::claude-3-sonnet', 1, 'tools', 'idle', 0, 0)`,
            [
                assistantMessageId,
                messageSet.chat_id,
                aiMessageSetId,
                assistantMessage,
            ],
        );

        if (!messageParts) return;

        // Create message parts with proper tool calls/results
        for (let i = 0; i < messageParts.length; i++) {
            const part = messageParts[i];
            await db.execute(
                `INSERT INTO message_parts (
                        chat_id, message_id, level, content, tool_calls, tool_results
                    ) VALUES (?, ?, ?, ?, ?, ?)`,
                [
                    messageSet.chat_id,
                    assistantMessageId,
                    i,
                    part.content,
                    part.tool_calls && part.tool_calls.length > 0
                        ? JSON.stringify(part.tool_calls)
                        : null,
                    part.tool_results && part.tool_results.length > 0
                        ? JSON.stringify(part.tool_results)
                        : null,
                ],
            );
        }
    }
}

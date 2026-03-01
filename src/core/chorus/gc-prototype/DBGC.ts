import { config } from "@core/config";
import Database from "@tauri-apps/plugin-sql";

// Get database instance
const db = await Database.load(config.dbUrl);

export type GCMessage = {
    chatId: string;
    id: string;
    text: string;
    modelConfigId: string;
    createdAt: string;
    updatedAt: string;
    isDeleted: boolean;
    threadRootMessageId?: string;
    promotedFromMessageId?: string;
};

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

export async function fetchGCMessages(chatId: string): Promise<GCMessage[]> {
    const rows = await db.select<GCMessageDBRow[]>(
        `SELECT chat_id, id, text, model_config_id, created_at, updated_at, is_deleted, thread_root_message_id, promoted_from_message_id
         FROM gc_prototype_messages
         WHERE chat_id = ?
         ORDER BY created_at ASC`,
        [chatId],
    );
    return rows.map(readGCMessage);
}

export async function insertGCMessage(
    chatId: string,
    id: string,
    text: string,
    modelConfigId: string,
    threadRootMessageId?: string,
): Promise<void> {
    await db.execute(
        `INSERT INTO gc_prototype_messages (chat_id, id, text, model_config_id, thread_root_message_id)
         VALUES (?, ?, ?, ?, ?)`,
        [chatId, id, text, modelConfigId, threadRootMessageId ?? null],
    );
}

export async function softDeleteGCMessage(messageId: string): Promise<void> {
    await db.execute(
        `UPDATE gc_prototype_messages SET is_deleted = 1 WHERE id = ?`,
        [messageId],
    );
}

export async function restoreGCMessage(messageId: string): Promise<void> {
    await db.execute(
        `UPDATE gc_prototype_messages SET is_deleted = 0 WHERE id = ?`,
        [messageId],
    );
}

export async function fetchGCThreadMessages(
    chatId: string,
    threadRootMessageId: string,
): Promise<GCMessage[]> {
    const rows = await db.select<GCMessageDBRow[]>(
        `SELECT chat_id, id, text, model_config_id, created_at, updated_at, is_deleted, thread_root_message_id, promoted_from_message_id
         FROM gc_prototype_messages
         WHERE chat_id = ? AND thread_root_message_id = ?
         ORDER BY created_at ASC`,
        [chatId, threadRootMessageId],
    );
    return rows.map(readGCMessage);
}

export async function fetchGCMainMessages(
    chatId: string,
): Promise<GCMessage[]> {
    const rows = await db.select<GCMessageDBRow[]>(
        `SELECT chat_id, id, text, model_config_id, created_at, updated_at, is_deleted, thread_root_message_id, promoted_from_message_id
         FROM gc_prototype_messages
         WHERE chat_id = ? AND thread_root_message_id IS NULL
         ORDER BY created_at ASC`,
        [chatId],
    );
    return rows.map(readGCMessage);
}

export async function countGCThreadReplies(
    chatId: string,
    messageId: string,
): Promise<number> {
    const result = await db.select<{ count: number }[]>(
        `SELECT COUNT(*) as count
         FROM gc_prototype_messages
         WHERE chat_id = ? AND thread_root_message_id = ? AND is_deleted = 0`,
        [chatId, messageId],
    );
    return result[0]?.count ?? 0;
}

export async function promoteGCMessageToMain(
    originalMessageId: string,
    newMessageId: string,
): Promise<void> {
    // Fetch the original message
    const originalMessage = await db.select<GCMessageDBRow[]>(
        `SELECT chat_id, id, text, model_config_id, created_at, updated_at, is_deleted, thread_root_message_id, promoted_from_message_id
         FROM gc_prototype_messages
         WHERE id = ?`,
        [originalMessageId],
    );

    if (originalMessage.length === 0) {
        throw new Error(`Message not found: ${originalMessageId}`);
    }

    const original = originalMessage[0];

    // Create a new message in the main chat with prefixed content
    const prefixedText = `[Promoted from thread] ${original.text}`;
    await db.execute(
        `INSERT INTO gc_prototype_messages (chat_id, id, text, model_config_id, promoted_from_message_id)
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

/// ------------------------------------------------------------------------------------------------

export type GCConductor = {
    chatId: string;
    scopeId: string | undefined;
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

export async function fetchActiveConductor(
    chatId: string,
    scopeId?: string,
): Promise<GCConductor | undefined> {
    console.log(
        "[DB Debug] fetchActiveConductor called with chatId:",
        chatId,
        "scopeId:",
        scopeId,
    );
    console.log("[DB Debug] SQL scopeId value will be:", scopeId ?? null);

    const rows = await db.select<GCConductorDBRow[]>(
        `SELECT chat_id, scope_id, conductor_model_id, turn_count, is_active, created_at
         FROM gc_prototype_conductors
         WHERE chat_id = ? AND scope_id IS ? AND is_active = 1
         LIMIT 1`,
        [chatId, scopeId ?? null],
    );

    console.log(
        "[DB Debug] fetchActiveConductor query returned",
        rows.length,
        "rows",
    );
    if (rows.length > 0) {
        console.log(
            "[DB Debug] Active conductor found:",
            rows[0].conductor_model_id,
            "is_active:",
            rows[0].is_active,
        );
    }

    if (rows.length === 0) {
        return undefined;
    }

    return readGCConductor(rows[0]);
}

export async function setConductor(
    chatId: string,
    scopeId: string | undefined,
    modelId: string,
): Promise<void> {
    // Use INSERT OR REPLACE to either insert a new conductor or update an existing one
    // This resets turn_count to 0 and sets is_active to 1
    await db.execute(
        `INSERT OR REPLACE INTO gc_prototype_conductors (chat_id, scope_id, conductor_model_id, turn_count, is_active)
         VALUES (?, ?, ?, 0, 1)`,
        [chatId, scopeId ?? null, modelId],
    );
}

export async function incrementConductorTurn(
    chatId: string,
    scopeId?: string,
): Promise<number> {
    // Increment turn count and return the new value
    await db.execute(
        `UPDATE gc_prototype_conductors
         SET turn_count = turn_count + 1
         WHERE chat_id = ? AND scope_id IS ? AND is_active = 1`,
        [chatId, scopeId ?? null],
    );

    // Fetch the updated turn count
    const result = await db.select<{ turn_count: number }[]>(
        `SELECT turn_count
         FROM gc_prototype_conductors
         WHERE chat_id = ? AND scope_id IS ? AND is_active = 1`,
        [chatId, scopeId ?? null],
    );

    return result[0]?.turn_count ?? 0;
}

export async function clearConductor(
    chatId: string,
    scopeId?: string,
): Promise<void> {
    console.log(
        "[DB Debug] clearConductor called with chatId:",
        chatId,
        "scopeId:",
        scopeId,
    );
    console.log("[DB Debug] SQL scopeId value will be:", scopeId ?? null);

    await db.execute(
        `UPDATE gc_prototype_conductors
         SET is_active = 0
         WHERE chat_id = ? AND scope_id IS ?`,
        [chatId, scopeId ?? null],
    );

    console.log("[DB Debug] clearConductor UPDATE completed");
}

import { db } from "../DB";

/**
 * Delete ungrouped chats and notes that haven't been updated in 7 days.
 * Ungrouped = project_id is 'default'. Pinned chats are preserved.
 * Called once on app startup.
 */
export async function cleanupExpiredUngroupedItems(): Promise<void> {
    await db.execute(
        `DELETE FROM chats
         WHERE project_id = 'default'
           AND pinned = 0
           AND updated_at < datetime('now', '-7 days')
           AND quick_chat = 0`,
    );

    await db.execute(
        `DELETE FROM notes
         WHERE project_id = 'default'
           AND updated_at < datetime('now', '-7 days')`,
    );
}

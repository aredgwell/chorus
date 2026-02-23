import { drizzle } from "drizzle-orm/sqlite-proxy";
import { db as tauriDb } from "../DB";
import * as schema from "./schema";

/**
 * Drizzle ORM instance backed by the Tauri SQL plugin via sqlite-proxy.
 *
 * Usage:
 *   import { drizzleDb } from "@core/chorus/db/drizzle";
 *   const rows = await drizzleDb.select().from(schema.chats).where(...);
 *
 * Existing raw SQL queries (db.select / db.execute) remain unchanged.
 * New queries should prefer this typed interface.
 */
export const drizzleDb = drizzle(
    async (sql, params, method) => {
        if (method === "run") {
            await tauriDb.execute(sql, params as unknown[]);
            return { rows: [] };
        }
        const rows = await tauriDb.select<Record<string, unknown>[]>(
            sql,
            params as unknown[],
        );
        return { rows: rows.map((row) => Object.values(row)) };
    },
    { schema },
);

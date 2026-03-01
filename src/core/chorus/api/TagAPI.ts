import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { db } from "../DB";

const tagKeys = {
    all: () => ["tags"] as const,
    itemTags: (itemType: string, itemId: string) =>
        ["tags", "item", itemType, itemId] as const,
};

export const tagQueries = {
    list: () => ({
        queryKey: [...tagKeys.all(), "list"] as const,
        queryFn: () => fetchTags(),
    }),
    forItem: (itemType: ItemType, itemId: string) => ({
        queryKey: tagKeys.itemTags(itemType, itemId),
        queryFn: () => fetchTagsForItem(itemType, itemId),
        enabled: !!itemId,
    }),
};

export type ItemType = "chat" | "note";

export type Tag = {
    id: string;
    name: string;
    color?: string;
    createdAt: string;
};

type TagDBRow = {
    id: string;
    name: string;
    color: string | null;
    created_at: string;
};

function readTag(row: TagDBRow): Tag {
    return {
        id: row.id,
        name: row.name,
        color: row.color ?? undefined,
        createdAt: row.created_at,
    };
}

export async function fetchTags(): Promise<Tag[]> {
    return await db
        .select<TagDBRow[]>(
            `SELECT id, name, color, created_at
            FROM tags
            ORDER BY name ASC`,
        )
        .then((rows) => rows.map(readTag));
}

export async function fetchTagsForItem(
    itemType: ItemType,
    itemId: string,
): Promise<Tag[]> {
    return await db
        .select<TagDBRow[]>(
            `SELECT t.id, t.name, t.color, t.created_at
            FROM tags t
            INNER JOIN item_tags it ON t.id = it.tag_id
            WHERE it.item_type = ? AND it.item_id = ?
            ORDER BY t.name ASC`,
            [itemType, itemId],
        )
        .then((rows) => rows.map(readTag));
}

export function useTags() {
    return useQuery(tagQueries.list());
}

export function useItemTags(itemType: ItemType, itemId: string | undefined) {
    return useQuery({
        ...tagQueries.forItem(itemType, itemId ?? ""),
        enabled: itemId !== undefined,
    });
}

export function useCreateTag() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationKey: ["createTag"] as const,
        mutationFn: async ({
            name,
            color,
        }: {
            name: string;
            color?: string;
        }) => {
            const result = await db.select<{ id: string }[]>(
                `INSERT INTO tags (id, name, color)
                 VALUES (lower(hex(randomblob(16))), ?, ?)
                 RETURNING id`,
                [name, color ?? null],
            );

            if (!result.length) {
                throw new Error("Failed to create tag");
            }

            return result[0].id;
        },
        onSuccess: async () => {
            await queryClient.invalidateQueries(tagQueries.list());
        },
    });
}

export function useDeleteTag() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationKey: ["deleteTag"] as const,
        mutationFn: async ({ tagId }: { tagId: string }) => {
            await db.execute("DELETE FROM item_tags WHERE tag_id = ?", [tagId]);
            await db.execute("DELETE FROM tags WHERE id = ?", [tagId]);
        },
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: tagKeys.all() });
        },
    });
}

export function useAddTagToItem() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationKey: ["addTagToItem"] as const,
        mutationFn: async ({
            tagId,
            itemType,
            itemId,
        }: {
            tagId: string;
            itemType: ItemType;
            itemId: string;
        }) => {
            await db.execute(
                `INSERT OR IGNORE INTO item_tags (tag_id, item_type, item_id)
                 VALUES (?, ?, ?)`,
                [tagId, itemType, itemId],
            );
        },
        onSuccess: async (_data, variables) => {
            await queryClient.invalidateQueries({
                queryKey: tagKeys.itemTags(
                    variables.itemType,
                    variables.itemId,
                ),
            });
        },
    });
}

export function useRemoveTagFromItem() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationKey: ["removeTagFromItem"] as const,
        mutationFn: async ({
            tagId,
            itemType,
            itemId,
        }: {
            tagId: string;
            itemType: ItemType;
            itemId: string;
        }) => {
            await db.execute(
                `DELETE FROM item_tags
                 WHERE tag_id = ? AND item_type = ? AND item_id = ?`,
                [tagId, itemType, itemId],
            );
        },
        onSuccess: async (_data, variables) => {
            await queryClient.invalidateQueries({
                queryKey: tagKeys.itemTags(
                    variables.itemType,
                    variables.itemId,
                ),
            });
        },
    });
}

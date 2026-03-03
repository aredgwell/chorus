import { deleteEmbedding, embeddingQueue } from "@core/chorus/EmbeddingService";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";

import { db } from "../DB";

const noteKeys = {
    all: () => ["notes"] as const,
    allDetails: () => [...noteKeys.all(), "detail"] as const,
};

export const noteQueries = {
    list: () => ({
        queryKey: [...noteKeys.all(), "list"] as const,
        queryFn: () => fetchNotes(),
    }),
    detail: (noteId: string | undefined) => ({
        queryKey: [...noteKeys.allDetails(), noteId] as const,
        queryFn: () => fetchNote(noteId!),
        enabled: noteId !== undefined,
    }),
};

export type Note = {
    id: string;
    title: string;
    content: string;
    projectId: string;
    pinned: boolean;
    createdAt: string;
    updatedAt: string;
};

type NoteDBRow = {
    id: string;
    title: string;
    content: string;
    project_id: string;
    pinned: number;
    created_at: string;
    updated_at: string;
};

function readNote(row: NoteDBRow): Note {
    return {
        id: row.id,
        title: row.title,
        content: row.content,
        projectId: row.project_id,
        pinned: !!row.pinned,
        createdAt: row.created_at,
        updatedAt: row.updated_at || row.created_at,
    };
}

export async function fetchNote(noteId: string): Promise<Note> {
    const rows = await db.select<NoteDBRow[]>(
        `SELECT id, title, content, project_id, pinned, created_at, updated_at
        FROM notes
        WHERE id = $1;`,
        [noteId],
    );
    if (rows.length < 1) {
        throw new Error(`Note not found: ${noteId}`);
    }
    return readNote(rows[0]);
}

export async function fetchNotes(): Promise<Note[]> {
    return await db
        .select<NoteDBRow[]>(
            `SELECT id, title, content, project_id, pinned, created_at, updated_at
            FROM notes
            ORDER BY updated_at DESC`,
        )
        .then((rows) => rows.map(readNote));
}

export function useNotes() {
    return useQuery(noteQueries.list());
}

export function useNote(noteId: string | undefined) {
    return useQuery(noteQueries.detail(noteId));
}

export function useCreateNote() {
    const queryClient = useQueryClient();
    const navigate = useNavigate();

    return useMutation({
        mutationKey: ["createNote"] as const,
        mutationFn: async ({
            projectId = "default",
        }: { projectId?: string } = {}) => {
            const result = await db.select<{ id: string }[]>(
                `INSERT INTO notes (id, project_id, content, created_at, updated_at)
                 VALUES (lower(hex(randomblob(16))), ?, '# ', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                 RETURNING id`,
                [projectId],
            );

            if (!result.length) {
                throw new Error("Failed to create note");
            }

            return result[0].id;
        },
        onSuccess: async (
            noteId: string,
            variables: { projectId?: string },
        ) => {
            // Optimistically add the note to the cache so it appears immediately
            const now = new Date().toISOString();
            queryClient.setQueryData<Note[]>(
                noteQueries.list().queryKey,
                (old) => [
                    {
                        id: noteId,
                        title: "",
                        content: "# ",
                        projectId: variables.projectId ?? "default",
                        pinned: false,
                        createdAt: now,
                        updatedAt: now,
                    },
                    ...(old ?? []),
                ],
            );
            // Also refetch to ensure consistency
            await queryClient.invalidateQueries(noteQueries.list());
            navigate(`/note/${noteId}`);
        },
    });
}

export function useUpdateNote() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationKey: ["updateNote"] as const,
        mutationFn: async ({
            noteId,
            title,
            content,
        }: {
            noteId: string;
            title?: string;
            content?: string;
        }) => {
            const updates: string[] = [];
            const params: (string | undefined)[] = [];

            if (title !== undefined) {
                updates.push("title = ?");
                params.push(title);
            }
            if (content !== undefined) {
                updates.push("content = ?");
                params.push(content);
            }

            if (updates.length === 0) return;

            updates.push("updated_at = CURRENT_TIMESTAMP");
            params.push(noteId);

            await db.execute(
                `UPDATE notes SET ${updates.join(", ")} WHERE id = ?`,
                params,
            );
        },
        onMutate: async (variables) => {
            // Optimistically update the note in the list cache so title/content
            // changes appear immediately (e.g., H1 → sidebar title)
            await queryClient.cancelQueries(noteQueries.list());
            const previousNotes = queryClient.getQueryData<Note[]>(
                noteQueries.list().queryKey,
            );
            queryClient.setQueryData<Note[]>(
                noteQueries.list().queryKey,
                (old) =>
                    old?.map((n) =>
                        n.id === variables.noteId
                            ? {
                                  ...n,
                                  ...(variables.title !== undefined && {
                                      title: variables.title,
                                  }),
                                  ...(variables.content !== undefined && {
                                      content: variables.content,
                                  }),
                                  updatedAt: new Date().toISOString(),
                              }
                            : n,
                    ),
            );
            return { previousNotes };
        },
        onError: (_err, _vars, context) => {
            if (context?.previousNotes) {
                queryClient.setQueryData(
                    noteQueries.list().queryKey,
                    context.previousNotes,
                );
            }
        },
        onSettled: async (_data, _error, variables) => {
            await queryClient.invalidateQueries(noteQueries.list());
            void queryClient.invalidateQueries(
                noteQueries.detail(variables.noteId),
            );

            // Enqueue embedding generation when note content changes
            try {
                const note = await fetchNote(variables.noteId);
                const text = [note.title, note.content]
                    .filter(Boolean)
                    .join("\n\n");
                if (text.trim()) {
                    embeddingQueue.enqueue(`note:${variables.noteId}`, text);
                }
            } catch {
                // Note may have been deleted between mutation and callback
            }
        },
    });
}

export function useRenameNote() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationKey: ["renameNote"] as const,
        mutationFn: async ({
            noteId,
            newTitle,
        }: {
            noteId: string;
            newTitle: string;
        }) => {
            await db.execute(
                "UPDATE notes SET title = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                [newTitle, noteId],
            );
        },
        onSuccess: async (_data, variables) => {
            await queryClient.invalidateQueries(noteQueries.list());

            // Re-generate embedding with updated title
            try {
                const note = await fetchNote(variables.noteId);
                const text = [note.title, note.content]
                    .filter(Boolean)
                    .join("\n\n");
                if (text.trim()) {
                    embeddingQueue.enqueue(`note:${variables.noteId}`, text);
                }
            } catch {
                // Note may have been deleted between mutation and callback
            }
        },
    });
}

export function useDeleteNote() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationKey: ["deleteNote"] as const,
        mutationFn: async ({ noteId }: { noteId: string }) => {
            await db.execute("DELETE FROM notes WHERE id = ?", [noteId]);
        },
        onMutate: async ({ noteId }) => {
            await queryClient.cancelQueries(noteQueries.list());
            const previousNotes = queryClient.getQueryData<Note[]>(
                noteQueries.list().queryKey,
            );
            queryClient.setQueryData<Note[]>(
                noteQueries.list().queryKey,
                (old) => old?.filter((n) => n.id !== noteId),
            );
            return { previousNotes };
        },
        onError: (_err, _vars, context) => {
            if (context?.previousNotes) {
                queryClient.setQueryData(
                    noteQueries.list().queryKey,
                    context.previousNotes,
                );
            }
        },
        onSettled: async (_data, _error, variables) => {
            await queryClient.invalidateQueries(noteQueries.list());

            // Clean up embedding when note is deleted
            void deleteEmbedding(`note:${variables.noteId}`);
        },
    });
}

export function useSetNoteProject() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationKey: ["setNoteProject"] as const,
        mutationFn: async ({
            noteId,
            projectId,
        }: {
            noteId: string;
            projectId: string;
        }) => {
            await db.execute(
                "UPDATE notes SET project_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                [projectId, noteId],
            );
        },
        onSuccess: async () => {
            await queryClient.invalidateQueries(noteQueries.list());
        },
    });
}

export function useTogglePinNote() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationKey: ["togglePinNote"] as const,
        mutationFn: async ({
            noteId,
            pinned,
        }: {
            noteId: string;
            pinned: boolean;
        }) => {
            await db.execute("UPDATE notes SET pinned = ? WHERE id = ?", [
                pinned ? 1 : 0,
                noteId,
            ]);
        },
        onMutate: async ({ noteId, pinned }) => {
            await queryClient.cancelQueries(noteQueries.list());
            const previousNotes = queryClient.getQueryData<Note[]>(
                noteQueries.list().queryKey,
            );
            queryClient.setQueryData<Note[]>(
                noteQueries.list().queryKey,
                (old) =>
                    old?.map((n) => (n.id === noteId ? { ...n, pinned } : n)),
            );
            return { previousNotes };
        },
        onError: (_err, _vars, context) => {
            if (context?.previousNotes) {
                queryClient.setQueryData(
                    noteQueries.list().queryKey,
                    context.previousNotes,
                );
            }
        },
        onSettled: async () => {
            await queryClient.invalidateQueries(noteQueries.list());
        },
    });
}

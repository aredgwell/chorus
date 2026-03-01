import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useReactQueryAutoSync } from "use-react-query-auto-sync";

import { db } from "../DB";
import {
    Attachment,
    AttachmentAssociationDraft,
    AttachmentDBRow,
    readAttachment,
} from "./AttachmentsAPI";
import { fetchMessageDraft } from "./MessageAPI";

export const draftKeys = {
    messageDraft: (chatId: string) => ["messageDraft", chatId] as const,
    messageDraftAttachments: (chatId: string) =>
        ["messageDraftAttachments", chatId] as const,
};

async function fetchDraftAttachments(chatId: string): Promise<Attachment[]> {
    const result = await db.select<AttachmentDBRow[]>(
        `SELECT attachments.id, attachments.type, attachments.original_name, attachments.path, attachments.is_loading, attachments.ephemeral
        FROM draft_attachments
        JOIN attachments ON draft_attachments.attachment_id = attachments.id
        WHERE draft_attachments.chat_id = ?
        ORDER BY attachments.created_at`,
        [chatId],
    );
    return result.map(readAttachment);
}

export function setMessageDraft(chatId: string, content: string) {
    return db.execute(
        "INSERT OR REPLACE INTO message_drafts (chat_id, content) VALUES ($1, $2)",
        [chatId, content],
    );
}

export function useAutoSyncMessageDraft(chatId: string, wait: number = 500) {
    return useReactQueryAutoSync({
        queryOptions: {
            queryKey: draftKeys.messageDraft(chatId),
            queryFn: () => fetchMessageDraft(chatId),
        },
        mutationOptions: {
            mutationFn: async (content: string) => {
                await setMessageDraft(chatId, content);
                return content;
            },
        },
        autoSaveOptions: { wait }, // update in db every 500ms
    });
}

export function useDraftAttachments(chatId: string) {
    return useQuery({
        queryKey: draftKeys.messageDraftAttachments(chatId),
        queryFn: () => fetchDraftAttachments(chatId),
    });
}

export function useDeleteAttachmentFromDraft({ chatId }: { chatId: string }) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationKey: ["deleteAttachmentFromDraft"] as const,
        mutationFn: async ({ attachmentId }: { attachmentId: string }) => {
            // Delete from draft_attachments first to maintain referential integrity
            await db.execute(
                "DELETE FROM draft_attachments WHERE attachment_id = ?",
                [attachmentId],
            );
            await db.execute("DELETE FROM attachments WHERE id = ?", [
                attachmentId,
            ]);
        },
        onSuccess: async () => {
            await queryClient.invalidateQueries({
                queryKey: draftKeys.messageDraftAttachments(chatId),
            });
        },
    });
}

export function useDeleteDraftAttachment() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationKey: ["deleteDraftAttachment"] as const,
        mutationFn: async ({
            attachmentId,
        }: {
            attachmentId: string;
            association: AttachmentAssociationDraft;
        }) => {
            await db.execute("DELETE FROM attachments WHERE id = ?", [
                attachmentId,
            ]);
            await db.execute(
                "DELETE FROM draft_attachments WHERE attachment_id = ?",
                [attachmentId],
            );
        },
        onSuccess: async (_data, variables) => {
            await queryClient.invalidateQueries({
                queryKey: draftKeys.messageDraftAttachments(
                    variables.association.chatId,
                ),
            });
        },
    });
}

export function useFinalizeAttachmentForDraft() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationKey: ["finalizeAttachmentForDraft"] as const,
        mutationFn: async ({
            attachmentId,
            storedPath,
        }: {
            chatId: string;
            attachmentId: string;
            storedPath: string;
        }) => {
            await db.execute(
                "UPDATE attachments SET is_loading = 0, path = ? WHERE id = ?",
                [storedPath, attachmentId],
            );
        },
        onSuccess: async (_data, variables) => {
            await queryClient.invalidateQueries({
                queryKey: draftKeys.messageDraftAttachments(variables.chatId),
            });
        },
    });
}

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { v4 as uuidv4 } from "uuid";

import { db } from "../DB";
import * as Models from "../Models";
import { draftKeys } from "./DraftAPI";
import { projectContextQueries } from "./ProjectAPI";

export const attachmentKeys = {
    attachmentContents: (attachmentPath: string, attachmentType?: string) =>
        ["attachmentContents", attachmentPath, attachmentType] as const,
};

export type AttachmentDBRow = {
    id: string;
    type: Models.AttachmentType;
    original_name: string;
    path: string;
    is_loading: number;
    ephemeral: number;
};

export type Attachment = {
    id: string;
    type: Models.AttachmentType;
    originalName: string;
    path: string;
    isLoading: boolean;
    ephemeral: boolean;
};

export function readAttachment(row: AttachmentDBRow): Attachment {
    return {
        id: row.id,
        type: row.type,
        originalName: row.original_name,
        path: row.path,
        isLoading: row.is_loading === 1,
        ephemeral: row.ephemeral === 1,
    };
}

export function useAttachmentContents(attachment: Attachment) {
    return useQuery({
        queryKey: attachmentKeys.attachmentContents(
            attachment.id,
            attachment.type,
        ),
        queryFn: () => {
            switch (attachment.type) {
                case "text": {
                    return Models.readTextAttachment(attachment);
                }
                case "webpage": {
                    return Models.readWebpageAttachment(attachment);
                }
                case "image": {
                    return Models.readImageAttachment(attachment);
                }
                case "pdf": {
                    return Models.readPdfAttachment(attachment);
                }
            }
        },
        enabled: !attachment.isLoading,
    });
}

export type AttachmentAssociationProject = {
    type: "project";
    projectId: string;
};
export type AttachmentAssociationMessage = {
    type: "message";
    messageId: string;
};
export type AttachmentAssociationDraft = { type: "draft"; chatId: string };

export type AttachmentAssociation =
    | AttachmentAssociationProject
    | AttachmentAssociationMessage
    | AttachmentAssociationDraft;

export function useCreateAttachment() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationKey: ["createAttachment"] as const,
        mutationFn: async ({
            type,
            originalName,
            path,
            association,
            isLoading = true,
            ephemeral = false,
        }: {
            type: string;
            originalName: string;
            path: string;
            association: AttachmentAssociation;
            isLoading?: boolean;
            ephemeral?: boolean;
        }) => {
            const result = await db.select<{ id: string }[]>(
                "INSERT INTO attachments (id, type, original_name, path, is_loading, ephemeral) VALUES (?, ?, ?, ?, ?, ?) RETURNING id",
                [
                    uuidv4(),
                    type,
                    originalName,
                    path,
                    isLoading ? 1 : 0,
                    ephemeral ? 1 : 0,
                ],
            );
            if (result.length === 0) {
                throw new Error("Failed to create attachment");
            }

            // insert into junction table
            switch (association.type) {
                case "project": {
                    await db.execute(
                        "INSERT INTO project_attachments (project_id, attachment_id) VALUES (?, ?)",
                        [association.projectId, result[0].id],
                    );
                    break;
                }
                case "draft": {
                    await db.execute(
                        "INSERT INTO draft_attachments (chat_id, attachment_id) VALUES (?, ?)",
                        [association.chatId, result[0].id],
                    );
                    break;
                }
                case "message": {
                    await db.execute(
                        "INSERT INTO message_attachments (message_id, attachment_id) VALUES (?, ?)",
                        [association.messageId, result[0].id],
                    );
                    break;
                }
                default: {
                    console.error("message association not supported"); // only create message associations by copying from drafts
                }
            }

            return result[0].id;
        },
        onSuccess: async (_data, variables) => {
            if (variables.association.type === "project") {
                await queryClient.invalidateQueries(
                    projectContextQueries.attachments(
                        variables.association.projectId,
                    ),
                );
            } else if (variables.association.type === "draft") {
                await queryClient.invalidateQueries({
                    queryKey: draftKeys.messageDraftAttachments(
                        variables.association.chatId,
                    ),
                });
            }
        },
    });
}

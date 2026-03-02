import * as ChatAPI from "@core/chorus/api/ChatAPI";
import * as NoteAPI from "@core/chorus/api/NoteAPI";
import { useCreateLink } from "@core/chorus/api/NoteChatLinkAPI";
import { dialogActions, useDialogStore } from "@core/infra/DialogStore";
import type { Editor } from "@tiptap/core";
import _ from "lodash";
import { MessageSquareIcon, TrashIcon } from "lucide-react";
import { useCallback, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";

import { HeaderBar } from "./HeaderBar";
import { LinkedItems } from "./LinkedItems";
import { EditorToolbar, MarkdownEditor } from "./MarkdownEditor";
import { TagInput } from "./TagInput";
import { Button } from "./ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "./ui/dialog";
import RetroSpinner from "./ui/retro-spinner";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";

const deleteNoteDialogId = (noteId: string) => `delete-note-dialog-${noteId}`;

export default function NoteEditor() {
    const { noteId } = useParams<{ noteId: string }>();
    const navigate = useNavigate();
    const noteQuery = NoteAPI.useNote(noteId);
    const updateNote = NoteAPI.useUpdateNote();
    const deleteNote = NoteAPI.useDeleteNote();
    const createChat = ChatAPI.useCreateNewChat();
    const createLink = useCreateLink();
    const [editor, setEditor] = useState<Editor | null>(null);

    const isDeleteDialogOpen = useDialogStore((state) =>
        noteId ? state.activeDialogId === deleteNoteDialogId(noteId) : false,
    );

    // Debounced save — called by MarkdownEditor on each edit
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const debouncedSave = useCallback(
        _.debounce((id: string, markdown: string, title: string) => {
            void updateNote.mutateAsync({
                noteId: id,
                content: markdown,
                title,
            });
        }, 500),
        [updateNote],
    );

    const handleUpdate = useCallback(
        (markdown: string) => {
            if (noteId) {
                // Extract first H1 heading as note title
                const h1Match = /^#\s+(.+)$/m.exec(markdown);
                const extractedTitle = h1Match ? h1Match[1].trim() : "";
                debouncedSave(noteId, markdown, extractedTitle);
            }
        },
        [noteId, debouncedSave],
    );

    const handleAskAboutNote = useCallback(async () => {
        if (!noteId || !noteQuery.data) return;
        const projectId = noteQuery.data.projectId ?? "ungrouped";
        const chatId = await createChat.mutateAsync({ projectId });
        await createLink.mutateAsync({
            noteId,
            chatId,
            linkType: "context",
        });
        navigate(`/chat/${chatId}?noteContext=${noteId}`);
    }, [noteId, noteQuery.data, createChat, createLink, navigate]);

    const handleConfirmDelete = async () => {
        if (!noteId) return;
        await deleteNote.mutateAsync({ noteId });
        dialogActions.closeDialog();
        toast("Note deleted");
        navigate("/");
    };

    if (!noteId) {
        return <div>Note ID not found</div>;
    }

    if (noteQuery.isPending) {
        return <RetroSpinner />;
    }

    if (noteQuery.isError) {
        return <div>Error loading note: {JSON.stringify(noteQuery.error)}</div>;
    }

    const note = noteQuery.data;
    if (!note) {
        return <div>Note not found</div>;
    }

    return (
        <div className="flex flex-col h-full">
            <HeaderBar
                actions={
                    <div className="flex items-center gap-1">
                        {editor && <EditorToolbar editor={editor} />}

                        <div className="editor-toolbar-separator" />

                        <TagInput itemType="note" itemId={noteId} />
                        <LinkedItems noteId={noteId} />

                        <div className="editor-toolbar-separator" />

                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="iconSm"
                                    onClick={() => void handleAskAboutNote()}
                                >
                                    <MessageSquareIcon
                                        strokeWidth={1.5}
                                        className="size-3.5!"
                                    />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>Ask about this note</TooltipContent>
                        </Tooltip>

                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="iconSm"
                                    onClick={() =>
                                        dialogActions.openDialog(
                                            deleteNoteDialogId(noteId),
                                        )
                                    }
                                >
                                    <TrashIcon
                                        strokeWidth={1.5}
                                        className="size-3.5!"
                                    />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>Delete note</TooltipContent>
                        </Tooltip>
                    </div>
                }
            />

            <div className="note-editor-content">
                <MarkdownEditor
                    key={noteId}
                    content={note.content}
                    onUpdate={handleUpdate}
                    onEditorReady={setEditor}
                    placeholder="Start writing..."
                    autoFocus={note.content.trim() === "#"}
                />
            </div>

            {/* Delete confirmation dialog */}
            <Dialog id={deleteNoteDialogId(noteId)} open={isDeleteDialogOpen}>
                <DialogContent className="sm:max-w-md p-5">
                    <DialogHeader>
                        <DialogTitle>
                            Delete &ldquo;{note.title || "Untitled note"}
                            &rdquo;
                        </DialogTitle>
                        <DialogDescription>
                            Are you sure you want to delete this note? This
                            action cannot be undone.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => dialogActions.closeDialog()}
                            tabIndex={-1}
                        >
                            Cancel{" "}
                            <span className="ml-1 text-sm text-muted-foreground/70">
                                Esc
                            </span>
                        </Button>
                        <Button
                            type="button"
                            variant="default"
                            size="sm"
                            onClick={() => void handleConfirmDelete()}
                            tabIndex={1}
                        >
                            Delete <span className="ml-1 text-sm">↵</span>
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

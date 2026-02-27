import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "./ui/dialog";
import { Button } from "./ui/button";

import { dialogActions, useDialogStore } from "@core/infra/DialogStore";
import RetroSpinner from "./ui/retro-spinner";
import * as NoteAPI from "@core/chorus/api/NoteAPI";
import _ from "lodash";

const deleteNoteDialogId = (noteId: string) =>
    `delete-note-dialog-${noteId}`;

export default function NoteEditor() {
    const { noteId } = useParams<{ noteId: string }>();
    const navigate = useNavigate();
    const noteQuery = NoteAPI.useNote(noteId);
    const updateNote = NoteAPI.useUpdateNote();
    const deleteNote = NoteAPI.useDeleteNote();
    const [content, setContent] = useState("");
    const [isInitialized, setIsInitialized] = useState(false);

    const isDeleteDialogOpen = useDialogStore((state) =>
        noteId
            ? state.activeDialogId === deleteNoteDialogId(noteId)
            : false,
    );

    // Initialize content from query data
    useEffect(() => {
        if (noteQuery.data && !isInitialized) {
            setContent(noteQuery.data.content);
            setIsInitialized(true);
        }
    }, [noteQuery.data, isInitialized]);

    // Reset initialization when noteId changes
    useEffect(() => {
        setIsInitialized(false);
    }, [noteId]);

    // Debounced save
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const debouncedSave = useCallback(
        _.debounce((noteId: string, content: string) => {
            void updateNote.mutateAsync({ noteId, content });
        }, 500),
        [updateNote],
    );

    const handleContentChange = (
        e: React.ChangeEvent<HTMLTextAreaElement>,
    ) => {
        const newContent = e.target.value;
        setContent(newContent);
        if (noteId) {
            debouncedSave(noteId, newContent);
        }
    };

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
        return (
            <div>Error loading note: {JSON.stringify(noteQuery.error)}</div>
        );
    }

    const note = noteQuery.data;
    if (!note) {
        return <div>Note not found</div>;
    }

    return (
        <div className="flex flex-col h-full">
            <div className="container py-8 px-16 mx-auto max-w-5xl flex-1 overflow-y-auto">
                <textarea
                    value={content}
                    onChange={handleContentChange}
                    placeholder="Start writing..."
                    className="w-full min-h-[calc(100vh-200px)] bg-transparent border-none ring-0 outline-hidden resize-none text-base leading-relaxed placeholder:text-muted-foreground/50"
                />
            </div>

            {/* Delete confirmation dialog */}
            <Dialog
                id={deleteNoteDialogId(noteId)}
                open={isDeleteDialogOpen}
            >
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
                            Delete{" "}
                            <span className="ml-1 text-sm">↵</span>
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { FileTextIcon, TrashIcon, PencilIcon, EyeIcon } from "lucide-react";
import { MessageMarkdown } from "@ui/components/renderers/MessageMarkdown";
import { Button } from "./ui/button";
import { toast } from "sonner";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "./ui/dialog";
import { EditableTitle } from "./EditableTitle";
import { HeaderBar } from "./HeaderBar";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";
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
    const renameNote = NoteAPI.useRenameNote();

    const [content, setContent] = useState("");
    const [isInitialized, setIsInitialized] = useState(false);
    const [isEditing, setIsEditing] = useState(false);

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
        <div className="container py-28 px-16 mx-auto max-w-5xl relative">
            <HeaderBar
                positioning="fixed"
                actions={
                    <div className="flex items-center gap-2 mr-2">
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="iconSm"
                                    onClick={() =>
                                        setIsEditing((prev) => !prev)
                                    }
                                >
                                    {isEditing ? (
                                        <EyeIcon
                                            strokeWidth={1.5}
                                            className="w-4! h-4!"
                                        />
                                    ) : (
                                        <PencilIcon
                                            strokeWidth={1.5}
                                            className="w-4! h-4!"
                                        />
                                    )}
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent side="bottom">
                                {isEditing
                                    ? "Preview markdown"
                                    : "Edit note"}
                            </TooltipContent>
                        </Tooltip>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="iconSm"
                                    onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        dialogActions.openDialog(
                                            deleteNoteDialogId(noteId),
                                        );
                                    }}
                                >
                                    <TrashIcon
                                        strokeWidth={1.5}
                                        className="w-4! h-4!"
                                    />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent side="bottom">
                                Delete note
                            </TooltipContent>
                        </Tooltip>
                    </div>
                }
            >
                <div className="flex items-center gap-2 text-sm text-muted-foreground ml-4">
                    <FileTextIcon className="w-4 h-4" />
                    <EditableTitle
                        title={note.title}
                        onUpdate={async (newTitle) => {
                            await renameNote.mutateAsync({
                                noteId,
                                newTitle,
                            });
                        }}
                        className="font-normal"
                        editClassName="h-6 text-sm px-1 py-0 border-none"
                        placeholder="Untitled note"
                        showEditIcon={false}
                        disabled={false}
                    />
                </div>
            </HeaderBar>

            {isEditing ? (
                <textarea
                    value={content}
                    onChange={handleContentChange}
                    onBlur={() => setIsEditing(false)}
                    autoFocus
                    placeholder="Start writing..."
                    className="w-full min-h-[calc(100vh-200px)] bg-transparent border-none ring-0 outline-hidden resize-none text-base leading-relaxed placeholder:text-muted-foreground/50"
                />
            ) : content ? (
                <div
                    onClick={() => setIsEditing(true)}
                    className="w-full min-h-[calc(100vh-200px)] cursor-text prose prose-sm dark:prose-invert max-w-none"
                >
                    <MessageMarkdown text={content} />
                </div>
            ) : (
                <div
                    onClick={() => setIsEditing(true)}
                    className="w-full min-h-[calc(100vh-200px)] cursor-text text-base leading-relaxed text-muted-foreground/50"
                >
                    Start writing...
                </div>
            )}

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

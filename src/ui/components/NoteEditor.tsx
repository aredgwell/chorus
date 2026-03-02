import * as ChatAPI from "@core/chorus/api/ChatAPI";
import * as NoteAPI from "@core/chorus/api/NoteAPI";
import { useCreateLink } from "@core/chorus/api/NoteChatLinkAPI";
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
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import RetroSpinner from "./ui/retro-spinner";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";

export default function NoteEditor() {
    const { noteId } = useParams<{ noteId: string }>();
    const navigate = useNavigate();
    const noteQuery = NoteAPI.useNote(noteId);
    const updateNote = NoteAPI.useUpdateNote();
    const deleteNote = NoteAPI.useDeleteNote();
    const createChat = ChatAPI.useCreateNewChat();
    const createLink = useCreateLink();
    const [editor, setEditor] = useState<Editor | null>(null);
    const [deletePopoverOpen, setDeletePopoverOpen] = useState(false);

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
        setDeletePopoverOpen(false);
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
                leftActions={
                    editor ? <EditorToolbar editor={editor} /> : undefined
                }
                actions={
                    <div className="flex items-center gap-1">
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

                        <Popover
                            open={deletePopoverOpen}
                            onOpenChange={setDeletePopoverOpen}
                        >
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant="ghost"
                                            size="iconSm"
                                        >
                                            <TrashIcon
                                                strokeWidth={1.5}
                                                className="size-3.5!"
                                            />
                                        </Button>
                                    </PopoverTrigger>
                                </TooltipTrigger>
                                <TooltipContent>Delete note</TooltipContent>
                            </Tooltip>
                            <PopoverContent
                                align="end"
                                className="w-56 p-3"
                            >
                                <p className="text-sm mb-3">
                                    Delete &ldquo;
                                    {note.title || "Untitled note"}
                                    &rdquo;? This cannot be undone.
                                </p>
                                <div className="flex justify-end gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() =>
                                            setDeletePopoverOpen(false)
                                        }
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        variant="destructive"
                                        size="sm"
                                        onClick={() =>
                                            void handleConfirmDelete()
                                        }
                                    >
                                        Delete
                                    </Button>
                                </div>
                            </PopoverContent>
                        </Popover>
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
        </div>
    );
}

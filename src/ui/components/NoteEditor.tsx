import { useEffect, useCallback, useState } from "react";
import { useParams } from "react-router-dom";
import type { Editor } from "@tiptap/core";
import RetroSpinner from "./ui/retro-spinner";
import * as NoteAPI from "@core/chorus/api/NoteAPI";
import { MarkdownEditor, EditorToolbar } from "./MarkdownEditor";
import _ from "lodash";

export default function NoteEditor() {
    const { noteId } = useParams<{ noteId: string }>();
    const [editor, setEditor] = useState<Editor | null>(null);
    const noteQuery = NoteAPI.useNote(noteId);
    const updateNote = NoteAPI.useUpdateNote();

    // Debounced save — receives markdown string from MarkdownEditor.
    // noteId is captured in closure; safe because key={noteId} on MarkdownEditor
    // forces remount (and thus a new debounce instance) when noteId changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const debouncedSave = useCallback(
        _.debounce((markdown: string) => {
            if (noteId) {
                void updateNote.mutateAsync({ noteId, content: markdown });
            }
        }, 500),
        [noteId, updateNote],
    );

    // Flush any pending save on unmount (e.g. navigating away)
    useEffect(() => {
        return () => {
            debouncedSave.flush();
        };
    }, [debouncedSave]);

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
        <div className="note-editor-container">
            <div className="note-toolbar-bar">
                {editor && <EditorToolbar editor={editor} />}
            </div>
            <div className="note-editor-content">
                <MarkdownEditor
                    key={noteId}
                    content={note.content}
                    onUpdate={debouncedSave}
                    onEditorReady={setEditor}
                />
            </div>
        </div>
    );
}

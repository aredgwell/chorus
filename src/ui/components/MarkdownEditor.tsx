import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Markdown } from "tiptap-markdown";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import {
    Table,
    TableRow,
    TableCell,
    TableHeader,
} from "@tiptap/extension-table";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import Typography from "@tiptap/extension-typography";
import { createLowlight, common } from "lowlight";
import "@ui/styles/tiptap.css";

const lowlight = createLowlight(common);

interface MarkdownEditorProps {
    /** Markdown string to initialize the editor with */
    content: string;
    /** Called with the updated markdown string on each edit */
    onUpdate: (markdown: string) => void;
    /** Placeholder text shown when the editor is empty */
    placeholder?: string;
    /** Additional CSS class names for the editor container */
    className?: string;
}

export function MarkdownEditor({
    content,
    onUpdate,
    placeholder = "Start writing...",
    className,
}: MarkdownEditorProps) {
    const editor = useEditor({
        extensions: [
            StarterKit.configure({
                codeBlock: false, // replaced by CodeBlockLowlight
            }),
            CodeBlockLowlight.configure({ lowlight }),
            Markdown.configure({
                html: false,
                transformPastedText: true,
                transformCopiedText: true,
            }),
            Table.configure({ resizable: false }),
            TableRow,
            TableCell,
            TableHeader,
            TaskList,
            TaskItem.configure({ nested: true }),
            Link.configure({
                openOnClick: true,
                autolink: true,
            }),
            Image,
            Placeholder.configure({ placeholder }),
            Typography,
        ],
        content,
        onUpdate: ({ editor: ed }) => {
            // tiptap-markdown adds getMarkdown() to editor.storage.markdown,
            // but Tiptap's Storage type is an empty interface that doesn't
            // include third-party extension shapes.
            // @ts-expect-error — tiptap-markdown runtime extension storage
            const md = ed.storage.markdown.getMarkdown() as string;
            onUpdate(md);
        },
        editorProps: {
            attributes: {
                class: [
                    "prose prose-sm dark:prose-invert max-w-none",
                    "focus:outline-none",
                    "min-h-[calc(100vh-200px)]",
                    className ?? "",
                ]
                    .filter(Boolean)
                    .join(" "),
            },
        },
    });

    return <EditorContent editor={editor} />;
}

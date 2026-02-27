import {
    useEditor,
    EditorContent,
    NodeViewWrapper,
    NodeViewContent,
    ReactNodeViewRenderer,
} from "@tiptap/react";
import type { NodeViewProps } from "@tiptap/core";
import { BubbleMenu } from "@tiptap/react/menus";
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
import {
    BoldIcon,
    ItalicIcon,
    StrikethroughIcon,
    CodeIcon,
    Heading1Icon,
    Heading2Icon,
    Heading3Icon,
    LinkIcon,
    ListIcon,
    ListOrderedIcon,
    QuoteIcon,
} from "lucide-react";
import "@ui/styles/tiptap.css";

const lowlight = createLowlight(common);
const languages = lowlight.listLanguages().sort();

// Custom code block node view with language selector
function CodeBlockView({
    node,
    updateAttributes,
}: NodeViewProps) {
    return (
        <NodeViewWrapper className="code-block-wrapper">
            <select
                contentEditable={false}
                value={node.attrs.language ?? ""}
                onChange={(e) =>
                    updateAttributes({ language: e.target.value || null })
                }
            >
                <option value="">auto</option>
                {languages.map((lang) => (
                    <option key={lang} value={lang}>
                        {lang}
                    </option>
                ))}
            </select>
            <pre>
                <NodeViewContent<"code"> as="code" />
            </pre>
        </NodeViewWrapper>
    );
}

const CustomCodeBlock = CodeBlockLowlight.extend({
    addNodeView() {
        return ReactNodeViewRenderer(CodeBlockView);
    },
});

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
                codeBlock: false, // replaced by CustomCodeBlock
            }),
            CustomCodeBlock.configure({ lowlight }),
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

    return (
        <>
            {editor && (
                <BubbleMenu
                    editor={editor}
                    options={{ placement: "top" }}
                >
                    <div className="bubble-menu">
                        <button
                            type="button"
                            onClick={() =>
                                editor
                                    .chain()
                                    .focus()
                                    .toggleBold()
                                    .run()
                            }
                            className={
                                editor.isActive("bold") ? "is-active" : ""
                            }
                            title="Bold"
                        >
                            <BoldIcon size={14} />
                        </button>
                        <button
                            type="button"
                            onClick={() =>
                                editor
                                    .chain()
                                    .focus()
                                    .toggleItalic()
                                    .run()
                            }
                            className={
                                editor.isActive("italic") ? "is-active" : ""
                            }
                            title="Italic"
                        >
                            <ItalicIcon size={14} />
                        </button>
                        <button
                            type="button"
                            onClick={() =>
                                editor
                                    .chain()
                                    .focus()
                                    .toggleStrike()
                                    .run()
                            }
                            className={
                                editor.isActive("strike") ? "is-active" : ""
                            }
                            title="Strikethrough"
                        >
                            <StrikethroughIcon size={14} />
                        </button>
                        <button
                            type="button"
                            onClick={() =>
                                editor
                                    .chain()
                                    .focus()
                                    .toggleCode()
                                    .run()
                            }
                            className={
                                editor.isActive("code") ? "is-active" : ""
                            }
                            title="Inline code"
                        >
                            <CodeIcon size={14} />
                        </button>

                        <div className="separator" />

                        <button
                            type="button"
                            onClick={() =>
                                editor
                                    .chain()
                                    .focus()
                                    .toggleHeading({ level: 1 })
                                    .run()
                            }
                            className={
                                editor.isActive("heading", { level: 1 })
                                    ? "is-active"
                                    : ""
                            }
                            title="Heading 1"
                        >
                            <Heading1Icon size={14} />
                        </button>
                        <button
                            type="button"
                            onClick={() =>
                                editor
                                    .chain()
                                    .focus()
                                    .toggleHeading({ level: 2 })
                                    .run()
                            }
                            className={
                                editor.isActive("heading", { level: 2 })
                                    ? "is-active"
                                    : ""
                            }
                            title="Heading 2"
                        >
                            <Heading2Icon size={14} />
                        </button>
                        <button
                            type="button"
                            onClick={() =>
                                editor
                                    .chain()
                                    .focus()
                                    .toggleHeading({ level: 3 })
                                    .run()
                            }
                            className={
                                editor.isActive("heading", { level: 3 })
                                    ? "is-active"
                                    : ""
                            }
                            title="Heading 3"
                        >
                            <Heading3Icon size={14} />
                        </button>

                        <div className="separator" />

                        <button
                            type="button"
                            onClick={() =>
                                editor
                                    .chain()
                                    .focus()
                                    .toggleBulletList()
                                    .run()
                            }
                            className={
                                editor.isActive("bulletList")
                                    ? "is-active"
                                    : ""
                            }
                            title="Bullet list"
                        >
                            <ListIcon size={14} />
                        </button>
                        <button
                            type="button"
                            onClick={() =>
                                editor
                                    .chain()
                                    .focus()
                                    .toggleOrderedList()
                                    .run()
                            }
                            className={
                                editor.isActive("orderedList")
                                    ? "is-active"
                                    : ""
                            }
                            title="Ordered list"
                        >
                            <ListOrderedIcon size={14} />
                        </button>
                        <button
                            type="button"
                            onClick={() =>
                                editor
                                    .chain()
                                    .focus()
                                    .toggleBlockquote()
                                    .run()
                            }
                            className={
                                editor.isActive("blockquote")
                                    ? "is-active"
                                    : ""
                            }
                            title="Blockquote"
                        >
                            <QuoteIcon size={14} />
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                const url = window.prompt("URL:");
                                if (url) {
                                    editor
                                        .chain()
                                        .focus()
                                        .setLink({ href: url })
                                        .run();
                                }
                            }}
                            className={
                                editor.isActive("link") ? "is-active" : ""
                            }
                            title="Link"
                        >
                            <LinkIcon size={14} />
                        </button>
                    </div>
                </BubbleMenu>
            )}
            <EditorContent editor={editor} />
        </>
    );
}

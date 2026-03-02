import "@ui/styles/tiptap.css";

import type { Editor, NodeViewProps } from "@tiptap/core";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import {
    Table,
    TableCell,
    TableHeader,
    TableRow,
} from "@tiptap/extension-table";
import TaskItem from "@tiptap/extension-task-item";
import TaskList from "@tiptap/extension-task-list";
import Typography from "@tiptap/extension-typography";
import {
    EditorContent,
    NodeViewContent,
    NodeViewWrapper,
    ReactNodeViewRenderer,
    useEditor,
} from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { common, createLowlight } from "lowlight";
import {
    BoldIcon,
    CodeIcon,
    Heading1Icon,
    Heading2Icon,
    Heading3Icon,
    ItalicIcon,
    LinkIcon,
    ListIcon,
    ListOrderedIcon,
    QuoteIcon,
    StrikethroughIcon,
} from "lucide-react";
import { useEffect } from "react";
import { Markdown } from "tiptap-markdown";

const lowlight = createLowlight(common);
const languages = lowlight.listLanguages().sort();

import { KatexBlockView } from "./tiptap/KatexBlockView";
import { MermaidBlockView } from "./tiptap/MermaidBlockView";

// Standard code block node view with language selector
function CodeBlockView({ node, updateAttributes }: NodeViewProps) {
    return (
        <NodeViewWrapper className="code-block-wrapper">
            <select
                contentEditable={false}
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
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

/** Dispatches to specialised NodeViews based on the code block language */
function CodeBlockNodeView(props: NodeViewProps) {
    const language = (props.node.attrs.language ?? "") as string;
    if (language === "latex" || language === "math") {
        return <KatexBlockView {...props} />;
    }
    if (language === "mermaid") {
        return <MermaidBlockView {...props} />;
    }
    return <CodeBlockView {...props} />;
}

const CustomCodeBlock = CodeBlockLowlight.extend({
    addNodeView() {
        return ReactNodeViewRenderer(CodeBlockNodeView);
    },
});

/** Toolbar button for the editor formatting bar */
function ToolbarButton({
    action,
    isActive,
    title,
    children,
}: {
    action: () => void;
    isActive: boolean;
    title: string;
    children: React.ReactNode;
}) {
    return (
        <button
            type="button"
            onMouseDown={(e) => {
                // Prevent stealing focus from editor
                e.preventDefault();
                action();
            }}
            className={`editor-toolbar-btn ${isActive ? "is-active" : ""}`}
            title={title}
        >
            {children}
        </button>
    );
}

/** Fixed formatting toolbar — rendered in the header bar by NoteEditor */
export function EditorToolbar({ editor }: { editor: Editor }) {
    return (
        <div className="editor-toolbar">
            <ToolbarButton
                action={() => editor.chain().focus().toggleBold().run()}
                isActive={editor.isActive("bold")}
                title="Bold"
            >
                <BoldIcon size={14} />
            </ToolbarButton>
            <ToolbarButton
                action={() => editor.chain().focus().toggleItalic().run()}
                isActive={editor.isActive("italic")}
                title="Italic"
            >
                <ItalicIcon size={14} />
            </ToolbarButton>
            <ToolbarButton
                action={() => editor.chain().focus().toggleStrike().run()}
                isActive={editor.isActive("strike")}
                title="Strikethrough"
            >
                <StrikethroughIcon size={14} />
            </ToolbarButton>
            <ToolbarButton
                action={() => editor.chain().focus().toggleCode().run()}
                isActive={editor.isActive("code")}
                title="Inline code"
            >
                <CodeIcon size={14} />
            </ToolbarButton>

            <div className="editor-toolbar-separator" />

            <ToolbarButton
                action={() =>
                    editor.chain().focus().toggleHeading({ level: 1 }).run()
                }
                isActive={editor.isActive("heading", { level: 1 })}
                title="Heading 1"
            >
                <Heading1Icon size={14} />
            </ToolbarButton>
            <ToolbarButton
                action={() =>
                    editor.chain().focus().toggleHeading({ level: 2 }).run()
                }
                isActive={editor.isActive("heading", { level: 2 })}
                title="Heading 2"
            >
                <Heading2Icon size={14} />
            </ToolbarButton>
            <ToolbarButton
                action={() =>
                    editor.chain().focus().toggleHeading({ level: 3 }).run()
                }
                isActive={editor.isActive("heading", { level: 3 })}
                title="Heading 3"
            >
                <Heading3Icon size={14} />
            </ToolbarButton>

            <div className="editor-toolbar-separator" />

            <ToolbarButton
                action={() => editor.chain().focus().toggleBulletList().run()}
                isActive={editor.isActive("bulletList")}
                title="Bullet list"
            >
                <ListIcon size={14} />
            </ToolbarButton>
            <ToolbarButton
                action={() => editor.chain().focus().toggleOrderedList().run()}
                isActive={editor.isActive("orderedList")}
                title="Ordered list"
            >
                <ListOrderedIcon size={14} />
            </ToolbarButton>
            <ToolbarButton
                action={() => editor.chain().focus().toggleBlockquote().run()}
                isActive={editor.isActive("blockquote")}
                title="Blockquote"
            >
                <QuoteIcon size={14} />
            </ToolbarButton>
            <ToolbarButton
                action={() => {
                    const url = window.prompt("URL:");
                    if (url) {
                        editor.chain().focus().setLink({ href: url }).run();
                    }
                }}
                isActive={editor.isActive("link")}
                title="Link"
            >
                <LinkIcon size={14} />
            </ToolbarButton>
        </div>
    );
}

interface MarkdownEditorProps {
    /** Markdown string to initialize the editor with */
    content: string;
    /** Called with the updated markdown string on each edit */
    onUpdate: (markdown: string) => void;
    /** Called when the editor instance is ready (or destroyed) */
    onEditorReady?: (editor: Editor | null) => void;
    /** Placeholder text shown when the editor is empty */
    placeholder?: string;
    /** Additional CSS class names for the editor container */
    className?: string;
    /** Auto-focus the editor and place cursor at end when ready */
    autoFocus?: boolean;
}

export function MarkdownEditor({
    content,
    onUpdate,
    onEditorReady,
    placeholder = "Start writing...",
    className,
    autoFocus = false,
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
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
            const md = ed.storage.markdown.getMarkdown() as string;
            onUpdate(md);
        },
        editorProps: {
            attributes: {
                class: [
                    "prose dark:prose-invert max-w-none",
                    "focus:outline-none",
                    "min-h-[calc(100vh-200px)]",
                    className ?? "",
                ]
                    .filter(Boolean)
                    .join(" "),
            },
        },
    });

    // Notify parent when the editor instance becomes available (or is destroyed).
    // Using useEffect instead of onCreate/onDestroy because onCreate fires
    // synchronously inside the useEditor hook's useState initializer, before
    // React can process the parent's state update.
    useEffect(() => {
        onEditorReady?.(editor ?? null);
    }, [editor, onEditorReady]);

    // Auto-focus and place cursor at end of content when editor is ready
    useEffect(() => {
        if (editor && autoFocus) {
            editor.commands.focus("end");
        }
    }, [editor, autoFocus]);

    return <EditorContent editor={editor} />;
}

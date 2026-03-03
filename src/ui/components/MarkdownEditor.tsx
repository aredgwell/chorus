import "@ui/styles/tiptap.css";

import {
    type Editor,
    type NodeViewProps,
    textblockTypeInputRule,
} from "@tiptap/core";
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
    useEditorState,
} from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
    BoldIcon,
    CheckIcon,
    ChevronDownIcon,
    ClipboardIcon,
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
import { useEffect, useState } from "react";

import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import {
    codeBlockLanguages,
    lowlight,
} from "./tiptap/codeBlockLanguages";
import { Markdown } from "tiptap-markdown";

import { KatexBlockView } from "./tiptap/KatexBlockView";
import { MermaidBlockView } from "./tiptap/MermaidBlockView";

/** Copy-to-clipboard button with brief checkmark feedback */
function CopyButton({ getText }: { getText: () => string }) {
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
        void navigator.clipboard.writeText(getText()).then(() => {
            setCopied(true);
        });
    };

    useEffect(() => {
        if (!copied) return;
        const id = window.setTimeout(() => setCopied(false), 1500);
        return () => window.clearTimeout(id);
    }, [copied]);

    return (
        <button
            type="button"
            className="block-view-toggle"
            onClick={handleCopy}
            title="Copy to clipboard"
            contentEditable={false}
        >
            {copied ? <CheckIcon size={12} /> : <ClipboardIcon size={12} />}
        </button>
    );
}

// Standard code block node view with language selector
function CodeBlockView({
    node,
    updateAttributes,
    editor,
    getPos,
}: NodeViewProps) {
    const language = (node.attrs.language ?? "") as string;
    const isEmpty = !node.textContent.trim() && !language;

    const focusContent = () => {
        const pos = getPos();
        if (typeof pos === "number") {
            editor.commands.focus(pos + 1);
        }
    };

    return (
        <NodeViewWrapper className="code-block-wrapper">
            <div className="block-view-header" contentEditable={false}>
                <DropdownMenu defaultOpen={isEmpty}>
                    <DropdownMenuTrigger asChild>
                        <button
                            type="button"
                            className="block-view-label flex items-center gap-1 cursor-pointer"
                        >
                            {language || "auto"}
                            <ChevronDownIcon size={10} />
                        </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                        align="start"
                        className="max-h-[300px] overflow-y-auto"
                    >
                        <DropdownMenuItem
                            onSelect={() => {
                                updateAttributes({ language: null });
                                focusContent();
                            }}
                        >
                            auto
                        </DropdownMenuItem>
                        {codeBlockLanguages.map((lang) => (
                            <DropdownMenuItem
                                key={lang}
                                onSelect={() => {
                                    updateAttributes({ language: lang });
                                    focusContent();
                                }}
                            >
                                {lang}
                            </DropdownMenuItem>
                        ))}
                    </DropdownMenuContent>
                </DropdownMenu>
                <div className="block-view-actions">
                    <CopyButton getText={() => node.textContent} />
                </div>
            </div>
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
    addInputRules() {
        return [
            textblockTypeInputRule({
                find: /^```([a-z]*)$/,
                type: this.type,
                getAttributes: (match) => ({
                    language: match[1] || undefined,
                }),
            }),
        ];
    },
    addKeyboardShortcuts() {
        return {
            ...this.parent?.(),
            // Insert a tab (two spaces) instead of moving focus
            Tab: ({ editor: ed }) => {
                if (!ed.isActive("codeBlock")) return false;
                return ed.commands.insertContent("  ");
            },
            // Convert a line starting with ``` into a code block on Enter
            Enter: ({ editor: ed }) => {
                const { $from, empty } = ed.state.selection;
                if (
                    !empty ||
                    $from.parent.type.name !== "paragraph" ||
                    $from.parent.childCount !== 1
                )
                    return false;
                const text = $from.parent.textContent;
                const match = /^```([a-z]*)$/.exec(text);
                if (!match) return false;
                const language = match[1] || undefined;
                return ed
                    .chain()
                    .clearContent()
                    .setCodeBlock(language ? { language } : undefined)
                    .run();
            },
        };
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

/** Link popover — styled like the tag input popover */
function LinkPopover({ editor }: { editor: Editor }) {
    const [open, setOpen] = useState(false);
    const [url, setUrl] = useState("");

    const isActive = useEditorState({
        editor,
        selector: (snapshot) => snapshot.editor.isActive("link"),
    });

    const handleOpen = (nextOpen: boolean) => {
        if (nextOpen) {
            // Pre-fill with existing link href if cursor is on a link
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
            const existing = editor.getAttributes("link").href;
            setUrl(typeof existing === "string" ? existing : "");
        }
        setOpen(nextOpen);
    };

    const handleSubmit = () => {
        const trimmed = url.trim();
        if (trimmed) {
            editor.chain().focus().setLink({ href: trimmed }).run();
        } else {
            editor.chain().focus().unsetLink().run();
        }
        setOpen(false);
        setUrl("");
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter") {
            e.preventDefault();
            handleSubmit();
        }
        if (e.key === "Escape") {
            setOpen(false);
        }
    };

    return (
        <Popover open={open} onOpenChange={handleOpen}>
            <PopoverTrigger asChild>
                <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    className={`editor-toolbar-btn ${isActive ? "is-active" : ""}`}
                    title="Link"
                >
                    <LinkIcon size={14} />
                </button>
            </PopoverTrigger>
            <PopoverContent
                align="start"
                className="w-64 p-2"
                onOpenAutoFocus={(e) => e.preventDefault()}
            >
                <input
                    type="text"
                    className="tag-search-input"
                    placeholder="Paste or type a URL..."
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    onKeyDown={handleKeyDown}
                    autoFocus
                />
                <div className="flex gap-1 mt-1">
                    <button
                        type="button"
                        className="tag-suggestion-item flex-1 justify-center"
                        onClick={handleSubmit}
                    >
                        {url.trim() ? "Apply" : "Remove link"}
                    </button>
                </div>
            </PopoverContent>
        </Popover>
    );
}

/** Fixed formatting toolbar — rendered in the header bar by NoteEditor */
export function EditorToolbar({ editor }: { editor: Editor }) {
    // Subscribe to editor transactions so active states update on cursor move
    const active = useEditorState({
        editor,
        selector: (snapshot) => ({
            bold: snapshot.editor.isActive("bold"),
            italic: snapshot.editor.isActive("italic"),
            strike: snapshot.editor.isActive("strike"),
            code: snapshot.editor.isActive("code"),
            h1: snapshot.editor.isActive("heading", { level: 1 }),
            h2: snapshot.editor.isActive("heading", { level: 2 }),
            h3: snapshot.editor.isActive("heading", { level: 3 }),
            bulletList: snapshot.editor.isActive("bulletList"),
            orderedList: snapshot.editor.isActive("orderedList"),
            blockquote: snapshot.editor.isActive("blockquote"),
        }),
    });

    return (
        <div className="editor-toolbar">
            <ToolbarButton
                action={() => editor.chain().focus().toggleBold().run()}
                isActive={active.bold}
                title="Bold"
            >
                <BoldIcon size={14} />
            </ToolbarButton>
            <ToolbarButton
                action={() => editor.chain().focus().toggleItalic().run()}
                isActive={active.italic}
                title="Italic"
            >
                <ItalicIcon size={14} />
            </ToolbarButton>
            <ToolbarButton
                action={() => editor.chain().focus().toggleStrike().run()}
                isActive={active.strike}
                title="Strikethrough"
            >
                <StrikethroughIcon size={14} />
            </ToolbarButton>
            <ToolbarButton
                action={() => editor.chain().focus().toggleCode().run()}
                isActive={active.code}
                title="Inline code"
            >
                <CodeIcon size={14} />
            </ToolbarButton>

            <div className="editor-toolbar-separator" />

            <ToolbarButton
                action={() =>
                    editor.chain().focus().toggleHeading({ level: 1 }).run()
                }
                isActive={active.h1}
                title="Heading 1"
            >
                <Heading1Icon size={14} />
            </ToolbarButton>
            <ToolbarButton
                action={() =>
                    editor.chain().focus().toggleHeading({ level: 2 }).run()
                }
                isActive={active.h2}
                title="Heading 2"
            >
                <Heading2Icon size={14} />
            </ToolbarButton>
            <ToolbarButton
                action={() =>
                    editor.chain().focus().toggleHeading({ level: 3 }).run()
                }
                isActive={active.h3}
                title="Heading 3"
            >
                <Heading3Icon size={14} />
            </ToolbarButton>

            <div className="editor-toolbar-separator" />

            <ToolbarButton
                action={() => editor.chain().focus().toggleBulletList().run()}
                isActive={active.bulletList}
                title="Bullet list"
            >
                <ListIcon size={14} />
            </ToolbarButton>
            <ToolbarButton
                action={() => editor.chain().focus().toggleOrderedList().run()}
                isActive={active.orderedList}
                title="Ordered list"
            >
                <ListOrderedIcon size={14} />
            </ToolbarButton>
            <ToolbarButton
                action={() => editor.chain().focus().toggleBlockquote().run()}
                isActive={active.blockquote}
                title="Blockquote"
            >
                <QuoteIcon size={14} />
            </ToolbarButton>
            <LinkPopover editor={editor} />
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

    // Auto-focus and place cursor at start of content when editor is ready
    useEffect(() => {
        if (editor && autoFocus) {
            editor.commands.focus("start");
        }
    }, [editor, autoFocus]);

    return <EditorContent editor={editor} />;
}

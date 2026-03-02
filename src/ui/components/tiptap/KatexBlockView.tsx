import "katex/dist/katex.min.css";

import type { NodeViewProps } from "@tiptap/core";
import { NodeViewContent, NodeViewWrapper } from "@tiptap/react";
import { CheckIcon, ClipboardIcon, CodeIcon, EyeIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { BlockMath } from "react-katex";

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
        >
            {copied ? <CheckIcon size={12} /> : <ClipboardIcon size={12} />}
        </button>
    );
}

/**
 * Tiptap NodeView for ```latex / ```math code blocks.
 * Shows rendered KaTeX by default; toggle to see/edit source.
 */
export function KatexBlockView({ node, editor, getPos }: NodeViewProps) {
    const textContent = node.textContent.trim();
    const [showSource, setShowSource] = useState(!textContent);

    // When freshly created (empty, source mode), focus the cursor into the code block
    useEffect(() => {
        if (showSource && !textContent) {
            const pos = getPos();
            if (typeof pos === "number") {
                // +1 to move inside the code block node
                editor.commands.focus(pos + 1);
            }
        }
        // Only on mount
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <NodeViewWrapper className="katex-block-wrapper">
            <div className="block-view-header" contentEditable={false}>
                <span className="block-view-label">LaTeX</span>
                <div className="block-view-actions">
                    <CopyButton getText={() => node.textContent} />
                    <button
                        type="button"
                        className="block-view-toggle"
                        onClick={() => setShowSource((prev) => !prev)}
                        title={showSource ? "Show preview" : "Show source"}
                    >
                        {showSource ? (
                            <EyeIcon size={12} />
                        ) : (
                            <CodeIcon size={12} />
                        )}
                    </button>
                </div>
            </div>

            {showSource ? (
                <pre className="block-view-source">
                    <NodeViewContent<"code"> as="code" />
                </pre>
            ) : (
                <>
                    {/* Hidden editable content — keeps ProseMirror in sync */}
                    <div className="block-view-hidden-content">
                        <pre>
                            <NodeViewContent<"code"> as="code" />
                        </pre>
                    </div>
                    <div
                        className="katex-block-preview"
                        contentEditable={false}
                        onClick={() => setShowSource(true)}
                    >
                        {textContent ? (
                            <KatexRenderer expression={textContent} />
                        ) : (
                            <span className="block-view-empty">
                                Click to add LaTeX
                            </span>
                        )}
                    </div>
                </>
            )}
        </NodeViewWrapper>
    );
}

function KatexRenderer({ expression }: { expression: string }) {
    try {
        return <BlockMath math={expression} />;
    } catch {
        return <code className="text-destructive">{expression}</code>;
    }
}

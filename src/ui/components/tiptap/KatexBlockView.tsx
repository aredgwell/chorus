import "katex/dist/katex.min.css";

import type { NodeViewProps } from "@tiptap/core";
import { NodeViewContent, NodeViewWrapper } from "@tiptap/react";
import { CodeIcon, EyeIcon } from "lucide-react";
import { useState } from "react";
import { BlockMath } from "react-katex";

/**
 * Tiptap NodeView for ```latex / ```math code blocks.
 * Shows rendered KaTeX by default; toggle to see/edit source.
 */
export function KatexBlockView({ node }: NodeViewProps) {
    const [showSource, setShowSource] = useState(false);
    const textContent = node.textContent.trim();

    return (
        <NodeViewWrapper className="katex-block-wrapper">
            <div className="block-view-header" contentEditable={false}>
                <span className="block-view-label">LaTeX</span>
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

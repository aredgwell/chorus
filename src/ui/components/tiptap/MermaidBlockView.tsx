import { useState, useDeferredValue } from "react";
import { NodeViewWrapper, NodeViewContent } from "@tiptap/react";
import type { NodeViewProps } from "@tiptap/core";
import { MermaidPreview } from "@ui/components/renderers/Mermaid";
import { CodeIcon, EyeIcon } from "lucide-react";

/**
 * Tiptap NodeView for ```mermaid code blocks.
 * Shows rendered diagram by default; toggle to see/edit source.
 */
export function MermaidBlockView({ node }: NodeViewProps) {
    const [showSource, setShowSource] = useState(false);
    const textContent = node.textContent.trim();
    const deferredContent = useDeferredValue(textContent);

    return (
        <NodeViewWrapper className="mermaid-block-wrapper">
            <div className="block-view-header" contentEditable={false}>
                <span className="block-view-label">Mermaid</span>
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
                        className="mermaid-block-preview"
                        contentEditable={false}
                        onClick={() => setShowSource(true)}
                    >
                        {deferredContent ? (
                            <MermaidPreview content={deferredContent} />
                        ) : (
                            <span className="block-view-empty">
                                Click to add Mermaid diagram
                            </span>
                        )}
                    </div>
                </>
            )}
        </NodeViewWrapper>
    );
}

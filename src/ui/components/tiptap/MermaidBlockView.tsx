import { useState, useDeferredValue, useEffect } from "react";
import { NodeViewWrapper, NodeViewContent } from "@tiptap/react";
import type { NodeViewProps } from "@tiptap/core";
import { CodeIcon, EyeIcon } from "lucide-react";
import mermaid from "mermaid";

let mermaidIdCounter = 0;

/**
 * Renders a Mermaid diagram from source text using the mermaid v8 API directly.
 * v8's render() is synchronous and returns the SVG string.
 * Avoids react-mermaid2 because its hooks conflict with Tiptap's NodeView
 * React rendering context.
 */
function MermaidDiagram({ source }: { source: string }) {
    const [svg, setSvg] = useState("");
    const [error, setError] = useState<string | undefined>();

    useEffect(() => {
        let cancelled = false;
        const id = `mermaid-nodeview-${++mermaidIdCounter}`;

        mermaid.initialize({
            startOnLoad: false,
            theme: document.documentElement.classList.contains("dark")
                ? "dark"
                : "default",
            securityLevel: "strict",
        });

        try {
            // mermaid v8 render() is synchronous — returns SVG string directly
            const rendered = mermaid.render(id, source);
            if (!cancelled) {
                setSvg(rendered);
                setError(undefined);
            }
        } catch (err: unknown) {
            if (!cancelled) {
                setError(
                    err instanceof Error ? err.message : "Render error",
                );
                setSvg("");
            }
        }

        return () => {
            cancelled = true;
        };
    }, [source]);

    if (error) {
        return (
            <div className="text-sm text-destructive p-2">
                Mermaid error: {error}
            </div>
        );
    }

    if (!svg) {
        return (
            <div className="text-sm text-muted-foreground p-2">
                Rendering...
            </div>
        );
    }

    return (
        <div
            className="bg-background overflow-x-auto"
            dangerouslySetInnerHTML={{ __html: svg }}
        />
    );
}

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
                            <MermaidDiagram source={deferredContent} />
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

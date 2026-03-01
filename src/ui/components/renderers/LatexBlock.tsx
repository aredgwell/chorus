import "katex/dist/katex.min.css";

import { CheckIcon, Copy } from "lucide-react";
import React, { useState } from "react";
import { BlockMath, InlineMath } from "react-katex";
import { useCopyToClipboard } from "usehooks-ts";

const CopyButton = ({
    onClick,
    copied,
}: {
    onClick: (e: React.MouseEvent) => void;
    copied: boolean;
}) => (
    <button
        onClick={onClick}
        className="absolute right-2 top-2 p-1.5 rounded bg-accent/50 hover:bg-accent transition-all text-foreground"
        aria-label="Copy LaTeX"
    >
        <div className="relative w-3.5 h-3.5">
            <div
                className={`absolute inset-0 ${copied ? "opacity-0" : "opacity-100"}`}
            >
                <Copy className="w-3.5 h-3.5" />
            </div>
            <div
                className={`absolute inset-0 ${copied ? "opacity-100" : "opacity-0"}`}
            >
                <CheckIcon className="w-3.5 h-3.5" />
            </div>
        </div>
    </button>
);

interface LatexBlockProps {
    children: React.ReactNode;
    inline?: boolean;
}

export const LatexBlock = ({ children, inline = false }: LatexBlockProps) => {
    const [copied, setCopied] = useState(false);
    const [_, copy] = useCopyToClipboard();
    // eslint-disable-next-line @typescript-eslint/no-base-to-string
    const mathExpression = String(children).trim();

    if (!mathExpression) return null;

    const cleanExpression = mathExpression.replace(/`/g, "");

    const handleCopy = async (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        await copy(cleanExpression);
        setCopied(true);
        setTimeout(() => setCopied(false), 500);
    };

    try {
        return (
            <div className="relative group bg-background text-foreground p-2">
                {inline ? (
                    <InlineMath math={cleanExpression} />
                ) : (
                    <BlockMath math={cleanExpression} />
                )}
                <CopyButton
                    onClick={(e) => void handleCopy(e)}
                    copied={copied}
                />
            </div>
        );
    } catch (error) {
        console.error("Failed to render LaTeX:", error);
        return <code className="text-red-500">{cleanExpression}</code>;
    }
};

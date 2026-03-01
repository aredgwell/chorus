import "react-lowlight/all";

import { Command } from "@tauri-apps/plugin-shell";
import { CheckIcon, Copy, Play, Terminal, X } from "lucide-react";
import React, { useRef, useState } from "react";
import Lowlight from "react-lowlight";
import { useCopyToClipboard } from "usehooks-ts";

import { Button } from "../ui/button";
import RetroSpinner from "../ui/retro-spinner";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";

interface CodeBlockProps {
    className?: string;
    content: string;
    language?: string;
    overrideRunCommand?: boolean;
    /**
     * If provided, this will be used for the text to copy when the user clicks the copy button.
     * Otherwise, `content` will be used.
     */
    contentToCopy?: string;
}

export const CodeBlock = React.memo(
    ({
        className,
        content,
        language = undefined,
        overrideRunCommand = false,
        contentToCopy,
    }: CodeBlockProps) => {
        if (typeof content !== "string") {
            throw new Error("CodeBlock must receive content");
        }

        const [copied, setCopied] = useState(false);
        const [_, copy] = useCopyToClipboard();
        const codeCopyRef = useRef<HTMLDivElement>(null);
        const [commandOutput, setCommandOutput] = useState<string>("");
        const [isRunning, setIsRunning] = useState(false);

        const handleCopy = async (e: React.MouseEvent) => {
            e.preventDefault();
            e.stopPropagation();

            const textToCopy =
                contentToCopy || codeCopyRef.current?.textContent;
            if (!textToCopy) return;

            await copy(textToCopy.trim());
            setCopied(true);
            setTimeout(() => setCopied(false), 500);
        };

        const handleRunCommand = async (e: React.MouseEvent) => {
            e.preventDefault();
            e.stopPropagation();
            try {
                setIsRunning(true);
                // Split the command into program and arguments, respecting quotes
                const trimmedContent = content.trim();
                const command = Command.create("exec-sh", [
                    "-c",
                    trimmedContent,
                ]);
                const result = await command.execute();
                setCommandOutput(result.stdout || result.stderr);
                setIsRunning(false);
            } catch (error: unknown) {
                setCommandOutput(`Error executing command: ${String(error)}`);
                setIsRunning(false);
            }
        };

        // Derive the language from className (e.g., "language-javascript") or prop
        const languageFromClass =
            /language-(\w+)/.exec(className || "")?.[1] || language || "text";

        const isBashCommand = ["bash", "shell", "sh"].includes(
            languageFromClass.toLowerCase(),
        );

        const isRunnable = isBashCommand && !overrideRunCommand;

        const contentNoFinalNewline = content.replace(/\n$/, "");

        return (
            <>
                <div
                    // this container lets the copy button stay in the top-right corner
                    className={[
                        `relative w-full group/code-block not-prose text-sm
                        select-text text-foreground rounded-sm
                        overflow-auto
                        min-h-[35px]
                        hljs-container`,
                    ].join(" ")}
                >
                    <div
                        // make scroll happen here instead of on the containing `pre` element, and
                        // set the background to match the inner (code) background
                        className={`
                            relative
                            max-h-[500px] w-full
                            overflow-auto
                            p-2`}
                        ref={codeCopyRef}
                    >
                        {Lowlight.hasLanguage(languageFromClass) ? (
                            <Lowlight
                                language={languageFromClass}
                                value={contentNoFinalNewline}
                                markers={[]}
                            />
                        ) : (
                            <pre className="p-1">
                                <code>{contentNoFinalNewline}</code>
                            </pre>
                        )}
                    </div>

                    <button
                        onClick={(e) => void handleCopy(e)}
                        className="absolute right-2 top-2 p-1.5 rounded bg-background invisible group-hover/code-block:visible transition-all text-muted-foreground hover:text-foreground"
                        aria-label="Copy code"
                    >
                        {copied ? (
                            <CheckIcon className="w-3.5 h-3.5" />
                        ) : (
                            <Copy className="w-3.5 h-3.5" />
                        )}
                    </button>
                    {isRunnable && (
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <button
                                    className="absolute right-10 top-2 p-1.5 rounded bg-accent/50 invisible group-hover/code-block:visible transition-all text-foreground"
                                    onClick={(e) => void handleRunCommand(e)}
                                    aria-label="Run command"
                                    disabled={isRunning}
                                >
                                    {isRunning ? (
                                        <RetroSpinner className="w-3.5 h-3.5" />
                                    ) : (
                                        <Play className="w-3.5 h-3.5" />
                                    )}
                                </button>
                            </TooltipTrigger>
                            <TooltipContent className="font-sans">
                                <p>Run command</p>
                            </TooltipContent>
                        </Tooltip>
                    )}
                </div>
                {commandOutput && (
                    <div className="relative overflow-auto">
                        <div className="sticky top-0 flex bg-background border-t border-b justify-between items-center">
                            <p className="text-sm font-medium font-sans px-2 py-2 my-0 bg-none flex items-center gap-2">
                                <Terminal className="w-3.5 h-3.5" /> Output
                            </p>
                            <Button
                                variant="ghost"
                                size="iconSm"
                                className="text-sm font-sans mr-2"
                                onClick={() => setCommandOutput("")}
                            >
                                <X className="w-3.5 h-3.5" />
                            </Button>
                        </div>
                        {Lowlight.hasLanguage("sh") ? (
                            <Lowlight
                                language={"sh"}
                                value={commandOutput}
                                markers={[]}
                            />
                        ) : (
                            <pre className="p-1">
                                <code>{commandOutput}</code>
                            </pre>
                        )}
                    </div>
                )}
            </>
        );
    },
    (prevProps, nextProps) => {
        return (
            prevProps.content === nextProps.content &&
            prevProps.className === nextProps.className &&
            prevProps.language === nextProps.language
        );
    },
);

CodeBlock.displayName = "CodeBlockMemoized";

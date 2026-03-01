import * as path from "@tauri-apps/api/path";
import * as fs from "@tauri-apps/plugin-fs";
import { open } from "@tauri-apps/plugin-fs";
import { useEffect,useRef } from "react";
import { toast } from "sonner";

interface HTMLPreviewProps {
    content: string;
    filePath: string;
}

export const HTMLPreview = ({ content, filePath }: HTMLPreviewProps) => {
    const iframeRef = useRef<HTMLIFrameElement>(null);

    useEffect(() => {
        const handleError = async (title: string, error: unknown) => {
            const errorMessage =
                error instanceof Error ? error.message : String(error);
            const formattedErrorMessage = `${new Date().toISOString()} - ${title}: ${errorMessage}\n`;

            // Show toast notification
            toast.error(title, {
                description: `${formattedErrorMessage} \nMelty will see this error next time you send a message.`,
            });

            try {
                const parentDir = await path.dirname(filePath);

                // Open file in append mode
                const file = await open(
                    await path.join(parentDir, "html_errors.txt"),
                    {
                        append: true,
                        create: true,
                    },
                );

                // Write error message
                await file.write(
                    new TextEncoder().encode(formattedErrorMessage),
                );
                await file.close();
            } catch (fileError) {
                console.error("Failed to write to error log:", fileError);
            }
        };

        const processHTML = async () => {
            if (!iframeRef.current) return;

            const doc = iframeRef.current.contentDocument;
            if (!doc) return;

            try {
                const parser = new DOMParser();
                const htmlDoc = parser.parseFromString(content, "text/html");

                // Process CSS files
                const cssLinks = Array.from(
                    htmlDoc.getElementsByTagName("link"),
                ).filter((link) => link.rel === "stylesheet" && link.href);

                // Load and replace each local CSS file
                for (const link of cssLinks) {
                    const cssPath = link.getAttribute("href");
                    if (!cssPath) continue;

                    // Calculate absolute path relative to HTML file
                    const absoluteCssPath = `${filePath}/${cssPath}`;

                    try {
                        // Fetch the CSS content
                        const cssResponse =
                            await fs.readTextFile(absoluteCssPath);
                        if (!cssResponse)
                            throw new Error(`Failed to load ${cssPath}`);

                        const cssContent = cssResponse;

                        // Replace link with style tag
                        const styleTag = htmlDoc.createElement("style");
                        styleTag.textContent = cssContent;
                        link.parentNode?.replaceChild(styleTag, link);
                    } catch (error) {
                        await handleError("CSS Load Error", error);
                    }
                }

                // Process JavaScript files
                // Process Inline JavaScript Scripts
                const inlineScriptTags = Array.from(
                    htmlDoc.getElementsByTagName("script"),
                ).filter((script) => !script.getAttribute("src"));

                for (const script of inlineScriptTags) {
                    try {
                        let scriptContent = script.textContent;

                        // Extract function names and attach them to window
                        const functionNames = [
                            ...(scriptContent?.matchAll(
                                /function\s+([a-zA-Z0-9_]+)/g,
                            ) ?? []),
                        ].map((match) => match[1]);

                        functionNames.forEach((fnName) => {
                            scriptContent += `
                window.${fnName} = ${fnName};
            `;
                        });

                        const newScript = htmlDoc.createElement("script");
                        // Wrap the content in an IIFE
                        newScript.textContent = `
            (function() {
                ${scriptContent}
            })();
        `;
                        // Copy any other attributes
                        Array.from(script.attributes).forEach((attr) => {
                            newScript.setAttribute(attr.name, attr.value);
                        });
                        script.parentNode?.replaceChild(newScript, script);
                    } catch (error) {
                        await handleError(
                            "Inline JavaScript Processing Error",
                            error,
                        );
                    }
                }

                // Inject error handler script
                const errorHandler = `
                    <script>
                        window.onerror = function(msg, url, line, col, error) {
                            window.parent.postMessage({
                                type: 'error',
                                payload: {
                                    message: msg,
                                    line: line,
                                    column: col,
                                    error: error?.stack
                                }
                            }, '*');
                            return false;
                        };

                        window.addEventListener('unhandledrejection', function(event) {
                            window.parent.postMessage({
                                type: 'error',
                                payload: {
                                    message: 'Unhandled Promise Rejection',
                                    error: event.reason?.stack || event.reason
                                }
                            }, '*');
                        });
                    </script>
                `;

                // Insert error handler and write the modified HTML
                doc.open();
                doc.write(errorHandler + htmlDoc.documentElement.outerHTML);
                doc.close();

                // Make links open in new tab
                const anchorElements = doc.getElementsByTagName("a");
                for (const link of anchorElements) {
                    link.target = "_blank";
                    link.rel = "noopener noreferrer";
                }
            } catch (error) {
                await handleError("Error", error);
            }
        };

        void processHTML();

        // Then update the message handler and other error handlers
        const handleMessage = async (event: MessageEvent) => {
            const data = event.data as { type: string; payload: unknown };
            if (data.type === "error") {
                const error = data.payload as {
                    message: string;
                    line?: number;
                };
                const message = `${error.message} ${
                    error.line ? `(Line: ${error.line})` : ""
                }`;
                await handleError("JavaScript Error", message);
            }
        };

        window.addEventListener(
            "message",
            (event) => void handleMessage(event),
        );
        return () =>
            window.removeEventListener(
                "message",
                (event) => void handleMessage(event),
            );
    }, [content, filePath]);

    return <iframe ref={iframeRef} className="w-full min-h-screen bg-white" />;
};

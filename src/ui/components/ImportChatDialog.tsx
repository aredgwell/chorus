import { useEffect, useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@ui/components/ui/dialog";
import { Button } from "@ui/components/ui/button";
import { openUrl } from "@tauri-apps/plugin-opener";
import { open } from "@tauri-apps/plugin-dialog";
import { readTextFile, readFile } from "@tauri-apps/plugin-fs";
import JSZip from "jszip";
import { AnthropicImporter } from "@core/chorus/importers/AnthropicImporter";
import { OpenAIImporter } from "@core/chorus/importers/OpenAIImporter";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Upload, ExternalLink, FileJson, Check } from "lucide-react";
import { cn } from "../lib/utils";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { DialogDescription } from "@radix-ui/react-dialog";
import posthog from "posthog-js";
import { useDialogStore } from "@core/infra/DialogStore";

interface ImportChatDialogProps {
    provider: "openai" | "anthropic";
}

export default function ImportChatDialog({ provider }: ImportChatDialogProps) {
    const queryClient = useQueryClient();
    const [isDragging, setIsDragging] = useState(false);
    const [isImporting, setIsImporting] = useState(false);
    const [numImported, setNumImported] = useState(0);
    const [importProgress, setImportProgress] = useState({
        current: 0,
        total: 0,
    });

    const dialogId = `import-${provider}`;
    const isImportDialogOpen = useDialogStore(
        (state) => state.activeDialogId === dialogId,
    );

    const providerConfig = {
        openai: {
            name: "OpenAI",
            exportUrl: "https://chatgpt.com/#settings/DataControls",
            exportButtonText: "Export data",
            fileName: "conversations.json",
            steps: [
                {
                    number: 1,
                    title: "Go to OpenAI Settings",
                    description:
                        "Visit the Data Controls page in your OpenAI settings",
                    action: () =>
                        void openUrl(
                            "https://chatgpt.com/#settings/DataControls",
                        ),
                    actionLabel: "Go to OpenAI Settings",
                },
                {
                    number: 2,
                    title: "Export your data",
                    description:
                        "Click the 'Export' button to request your chat history",
                },
                {
                    number: 3,
                    title: "Check your email",
                    description:
                        "OpenAI will send you an email with a download link (this can take up to several hours - you can always come back later.)",
                },
                {
                    number: 4,
                    title: "Upload your export",
                    description:
                        "Upload the conversations.json file or the entire ZIP file",
                },
            ],
        },
        anthropic: {
            name: "Anthropic",
            exportUrl: "https://claude.ai/settings/data-privacy-controls",
            exportButtonText: "Export your data",
            fileName: "conversations.json",
            steps: [
                {
                    number: 1,
                    title: "Go to Claude Settings",
                    description:
                        "Visit the Data Privacy Controls page in your Claude settings",
                    action: () =>
                        void openUrl(
                            "https://claude.ai/settings/data-privacy-controls",
                        ),
                    actionLabel: "Go to Claude Settings",
                },
                {
                    number: 2,
                    title: "Export your data",
                    description:
                        "Click the 'Export data' button to request your chat history",
                },
                {
                    number: 3,
                    title: "Check your email",
                    description:
                        "Anthropic will send you an email with your data export (usually within 1 minute)",
                },
                {
                    number: 4,
                    title: "Upload your export",
                    description:
                        "Upload the conversations.json file or the entire ZIP file",
                },
            ],
        },
    };

    const config = providerConfig[provider];

    const handleFileSelect = async () => {
        try {
            const selected = await open({
                multiple: false,
                filters: [
                    {
                        name: "Export files",
                        extensions: ["json", "zip"],
                    },
                ],
                title: `Select ${config.name} conversations export`,
            });

            if (!selected) return;

            // Check if it's a ZIP file
            if (selected.toLowerCase().endsWith(".zip")) {
                await handleZipFile(selected);
            } else {
                const fileContent = await readTextFile(selected);
                await processFile(fileContent);
            }
        } catch (error) {
            console.error("Error selecting file:", error);
            toast.error("Error", {
                description: "Failed to select file",
            });
        }
    };

    const handleZipFile = async (zipPath: string) => {
        try {
            setIsImporting(true);
            setImportProgress({ current: 0, total: 0 });

            // Read the ZIP file as binary data
            const zipData = await readFile(zipPath);

            // Load the ZIP file
            const zip = await JSZip.loadAsync(zipData);

            // Look for conversations.json in the ZIP
            let conversationsFile: JSZip.JSZipObject | null = null;

            // Check for conversations.json at root or in subdirectories
            const files = Object.keys(zip.files);
            for (const fileName of files) {
                if (
                    fileName.endsWith("conversations.json") &&
                    !fileName.startsWith("__MACOSX/")
                ) {
                    conversationsFile = zip.files[fileName];
                    break;
                }
            }

            if (!conversationsFile) {
                throw new Error(
                    "No conversations.json file found in the ZIP archive",
                );
            }

            // Extract the JSON content
            const jsonContent = await conversationsFile.async("string");
            await processFile(jsonContent);
        } catch (error) {
            console.error("Error processing ZIP file:", error);
            toast.error("Import Failed", {
                description:
                    error instanceof Error
                        ? error.message
                        : "Failed to process ZIP file",
            });
            setIsImporting(false);
            setNumImported(0);
            setImportProgress({ current: 0, total: 0 });
        }
    };

    const processFile = async (fileContent: string) => {
        try {
            setIsImporting(true);
            let importedCount = 0;
            let failedCount = 0;

            const progressCallback = (current: number, total: number) => {
                setImportProgress({ current, total });
            };

            if (provider === "anthropic") {
                const importer = new AnthropicImporter();
                const { imported, failed } = await importer.importConversations(
                    JSON.parse(fileContent),
                    progressCallback,
                );
                importedCount = imported;
                failedCount = failed;
            } else {
                const importer = new OpenAIImporter();
                const { imported, failed } = await importer.importConversations(
                    JSON.parse(fileContent),
                    progressCallback,
                );

                importedCount = imported;
                failedCount = failed;
            }

            if (failedCount > 0) {
                toast("Import Failed", {
                    description: `Imported ${importedCount} conversations from ${config.name}. ${failedCount} conversations failed to import.`,
                });
                posthog?.capture("chat_import_failed", {
                    provider,
                    imported_count: importedCount,
                    failed_count: failedCount,
                });
            } else if (failedCount === 0 && importedCount === 0) {
                toast("Import Failed", {
                    description: `No conversations were imported from ${config.name}`,
                });
                posthog?.capture("chat_import_empty", {
                    provider,
                });
            } else {
                setNumImported(importedCount);
                toast.success("Import Succeeded", {
                    description: `Imported ${importedCount} conversations from ${config.name}`,
                });
                posthog?.capture("chat_import_succeeded", {
                    provider,
                    imported_count: importedCount,
                });
            }

            // Refresh the chat list
            await queryClient.invalidateQueries({ queryKey: ["chats"] });
            await queryClient.invalidateQueries({ queryKey: ["project"] });
        } catch (error) {
            console.error("Error importing chat history:", error);
            toast.error("Import Failed", {
                description:
                    error instanceof Error
                        ? error.message
                        : "Failed to import chat history",
            });
            posthog?.capture("chat_import_error", {
                provider,
                error: error instanceof Error ? error.message : "Unknown error",
            });
            setNumImported(0);
            setImportProgress({ current: 0, total: 0 });
        } finally {
            setIsImporting(false);
        }
    };

    const handleDrop = async (paths: string[]) => {
        setIsDragging(false);

        // Find the first valid file path (JSON or ZIP)
        const validFilePath = paths.find(
            (path) => path.endsWith(".json") || path.endsWith(".zip"),
        );

        if (!validFilePath) {
            toast.error("Invalid file", {
                description: "Please upload a JSON or ZIP file",
            });
            return;
        }

        try {
            if (validFilePath.toLowerCase().endsWith(".zip")) {
                await handleZipFile(validFilePath);
            } else {
                // Read the JSON file content
                const content = await readTextFile(validFilePath);
                await processFile(content);
            }
        } catch (error) {
            console.error("Error reading file:", error);
            toast.error("Error", {
                description: "Failed to read file",
            });
        }
    };

    useEffect(() => {
        const unlisten = getCurrentWebview().onDragDropEvent((event) => {
            if (event.payload.type === "drop" && isImportDialogOpen) {
                setIsDragging(false);
                void handleDrop(event.payload.paths);
            } else if (event.payload.type === "over" && isImportDialogOpen) {
                setIsDragging(true);
            } else if (event.payload.type === "leave" && isImportDialogOpen) {
                setIsDragging(false);
            }
        });

        return () => {
            void unlisten.then((unlistenFn) => unlistenFn());
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isImportDialogOpen]);

    return (
        <Dialog
            id={dialogId}
            onOpenChange={(open) => {
                if (open) {
                    posthog?.capture("chat_import_dialog_opened", {
                        provider,
                    });
                }
                if (!open) {
                    setIsImporting(false);
                    setNumImported(0);
                    setImportProgress({ current: 0, total: 0 });
                }
            }}
        >
            <DialogContent className="p-4">
                <DialogHeader>
                    <DialogTitle>
                        Import chat history from {config.name}
                    </DialogTitle>
                    <DialogDescription className="text-sm text-muted-foreground">
                        Note: Not all conversation data can be imported due to
                        platform limitations, including attachments and some
                        tool usage.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-6 mt-6">
                    {/* Step by step instructions */}
                    <div className="space-y-4">
                        {config.steps.map((step) => (
                            <div key={step.number} className="flex gap-4">
                                <div className="shrink-0">
                                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-semibold">
                                        {step.number}
                                    </div>
                                </div>
                                <div className="flex-1 space-y-2">
                                    <h4 className="font-semibold">
                                        {step.title}
                                    </h4>
                                    <p className="text-sm text-muted-foreground">
                                        {step.description}
                                    </p>
                                    {step.action && (
                                        <Button
                                            onClick={step.action}
                                            variant="default"
                                            size="sm"
                                            className="mt-2"
                                        >
                                            {step.actionLabel}{" "}
                                            <ExternalLink className="ml-2 h-4 w-4" />
                                        </Button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Upload area */}
                    <div className="mt-8">
                        <div
                            className={cn(
                                "border-2 border-dashed rounded-lg p-8 text-center transition-colors",
                                isDragging
                                    ? "border-primary bg-primary/5"
                                    : "border-muted-foreground/25 hover:border-muted-foreground/50",
                                numImported > 0 &&
                                    "border-green-500 bg-green-500/5",
                            )}
                        >
                            {numImported > 0 ? (
                                <div className="flex flex-col items-center gap-4">
                                    <Check className="h-12 w-12 text-green-500" />
                                    <p className="font-semibold text-green-600">
                                        Imported {numImported} conversations
                                        from {config.name}
                                    </p>
                                </div>
                            ) : (
                                <>
                                    <div className="flex flex-col items-center gap-4">
                                        {isImporting ? (
                                            <>
                                                <FileJson className="h-12 w-12 text-muted-foreground animate-pulse" />
                                                <div className="w-full space-y-2">
                                                    <p className="font-semibold">
                                                        {importProgress.total >
                                                        0
                                                            ? `Importing conversation ${importProgress.current} of ${importProgress.total}...`
                                                            : "Starting import..."}
                                                    </p>
                                                    {importProgress.total >
                                                        0 && (
                                                        <div className="w-full bg-muted rounded h-2.5">
                                                            <div
                                                                className="bg-primary h-2.5 rounded-full transition-all duration-300"
                                                                style={{
                                                                    width: `${(importProgress.current / importProgress.total) * 100}%`,
                                                                }}
                                                            />
                                                        </div>
                                                    )}
                                                    <p className="text-sm text-muted-foreground">
                                                        Please do not close this
                                                        dialog.
                                                    </p>
                                                </div>
                                            </>
                                        ) : (
                                            <>
                                                <Upload className="h-12 w-12 text-muted-foreground" />
                                                <div>
                                                    <p className="font-semibold">
                                                        Drop your{" "}
                                                        {config.fileName} or ZIP
                                                        file here
                                                    </p>
                                                    <p className="text-sm text-muted-foreground mt-1">
                                                        or click to browse
                                                    </p>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                    {!isImporting && (
                                        <Button
                                            onClick={handleFileSelect}
                                            variant="outline"
                                            className="mt-4"
                                            disabled={isImporting}
                                        >
                                            Select file
                                        </Button>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

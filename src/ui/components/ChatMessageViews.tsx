import { useEffect, useRef, useState, useCallback, memo, useMemo } from "react";
import React from "react";
import { useParams, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "./ui/button";
import {
    FileTextIcon,
    PlusIcon,
    ChevronRightIcon,
    FolderOpenIcon,
    ReplyIcon,
    SplitIcon,
    Pencil,
    Loader2,
    Maximize2Icon,
    RemoveFormattingIcon,
    RefreshCcwIcon,
    StopCircleIcon,
    CircleXIcon,
    BellIcon,
    CircleAlertIcon,
} from "lucide-react";
import { ChevronDownIcon, CheckIcon, XIcon } from "lucide-react";
import RetroSpinner from "./ui/retro-spinner";
import { TooltipContent } from "./ui/tooltip";
import { Tooltip } from "./ui/tooltip";
import { TooltipTrigger } from "./ui/tooltip";
import { AttachmentPillsList } from "./AttachmentsViews";
import * as Models from "@core/chorus/Models";
import { ProviderLogo } from "@ui/components/ui/provider-logo";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogTitle,
    DialogTrigger,
} from "./ui/dialog";
import { MessageMarkdown } from "./renderers/MessageMarkdown";
import {
    Message,
    UserBlock,
    ToolsBlock,
    MessagePart,
} from "@core/chorus/ChatState";
import { Separator } from "./ui/separator";
import { Toggle } from "./ui/toggle";
import { CollapsibleContent, CollapsibleTrigger } from "./ui/collapsible";
import { Collapsible } from "./ui/collapsible";
import * as _ from "lodash";
import {
    getToolsetIcon,
    UserToolCall,
    UserToolResult,
} from "@core/chorus/Toolsets";
import { CodeBlock } from "./renderers/CodeBlock";
import * as Toolsets from "@core/chorus/Toolsets";
import { projectDisplayName } from "@ui/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { ManageModelsBox } from "./ManageModelsBox";
import useElementScrollDetection from "@ui/hooks/useScrollDetection";
import { dialogActions } from "@core/infra/DialogStore";
import { ANTHROPIC_IMPORT_PREFIX } from "@core/chorus/importers/AnthropicImporter";
import { OPENAI_IMPORT_PREFIX } from "@core/chorus/importers/OpenAIImporter";
import { readFile } from "@tauri-apps/plugin-fs";
import { filterReplyMessageSets } from "@ui/lib/replyUtils";
import * as MessageAPI from "@core/chorus/api/MessageAPI";
import * as ChatAPI from "@core/chorus/api/ChatAPI";
import * as ProjectAPI from "@core/chorus/api/ProjectAPI";
import * as ModelsAPI from "@core/chorus/api/ModelsAPI";
import * as AttachmentsAPI from "@core/chorus/api/AttachmentsAPI";
import * as DraftAPI from "@core/chorus/api/DraftAPI";
import SimpleCopyButton from "./unused/CopyButton";
import { MessageCostDisplay } from "./MessageCostDisplay";
import { useWaitForAppMetadata } from "@ui/hooks/useWaitForAppMetadata";
import { useEditable } from "use-editable";
import { EditableTitle } from "./EditableTitle";
import {
    CompareBlockView,
    ChatBlockView,
    BrainstormBlockView,
} from "@ui/components/MultiChatDeprecationPath";
import { resizeAndStoreFileData } from "@core/chorus/AttachmentsHelpers";
import { sendTauriNotification } from "@ui/lib/utils";
import {
    isPermissionGranted,
    requestPermission,
} from "@tauri-apps/plugin-notification";

function ErrorView({ message }: { message: Message }) {
    if (!message.errorMessage) {
        return null;
    }

    const isContextLimitError = Models.detectContextLimitError(
        message.errorMessage,
        message.model,
    );

    if (isContextLimitError) {
        return <ContextLimitError chatId={message.chatId} />;
    }

    return (
        <div>
            <CircleAlertIcon className="w-3 h-3 inline-block mr-1 mb-0.5" />
            Model did not return a response
            {message.errorMessage && (
                <div className="text-md rounded-md my-1 items-center justify-between font-[350]">
                    <div className="flex items-center text-destructive">
                        {message.errorMessage}
                    </div>
                </div>
            )}
        </div>
    );
}

function ContextLimitError({ chatId }: { chatId: string }) {
    const [isSummarizing, setIsSummarizing] = useState(false);
    const summarizeChat = MessageAPI.useSummarizeChat();
    const chatQuery = ChatAPI.useChat(chatId);
    const messageSetsQuery = MessageAPI.useMessageSets(chatId);
    const createNewChat = ChatAPI.useCreateNewChat();
    const createAttachment = AttachmentsAPI.useCreateAttachment();
    const finalizeAttachmentForDraft = DraftAPI.useFinalizeAttachmentForDraft();
    const navigate = useNavigate();

    // Find the last user message
    const lastUserMessage = useMemo(() => {
        if (!messageSetsQuery.data) return null;

        // Find the last message set with type "user"
        for (let i = messageSetsQuery.data.length - 1; i >= 0; i--) {
            const messageSet = messageSetsQuery.data[i];
            if (messageSet.type === "user" && messageSet.userBlock.message) {
                return messageSet.userBlock.message;
            }
        }
        return null;
    }, [messageSetsQuery.data]);

    const handleSummarizeChat = useCallback(async () => {
        if (!lastUserMessage) {
            toast.error("No user message found to continue with");
            return;
        }

        setIsSummarizing(true);
        try {
            // 1. First, summarize the current chat
            const result = await summarizeChat.mutateAsync({
                chatId,
                forceRefresh: true,
                source: "out_of_context",
            });

            if (!result.summary) {
                throw new Error("Failed to generate summary");
            }

            // 2. Create a new chat
            const newChatId = await createNewChat.mutateAsync({
                projectId: chatQuery.data?.projectId || "default",
            });

            // 3. Create the markdown content for the attachment
            const contextContent = `# The following is context from a previous chat which exceeded the models' context limit. The chat was called: "${chatQuery.data?.title || "Untitled"}". Please continue the conversation below.\n\n${result.summary}`;

            // 4. Set just the user's message as the draft
            await DraftAPI.setMessageDraft(newChatId, lastUserMessage.text);

            // 5. Create the context summary as a markdown attachment
            const fileName = "summary.md";
            const contextFile = new File([contextContent], fileName, {
                type: "text/markdown",
            });

            // 4. Create the context attachment record
            const contextAttachmentId = await createAttachment.mutateAsync({
                type: "text",
                originalName: fileName,
                path: fileName, // Temporary path, will be updated
                association: { type: "draft", chatId: newChatId },
            });

            // 5. Store the context file data
            const { storedPath } = await resizeAndStoreFileData(contextFile);

            // 6. Finalize the context attachment with the actual stored path
            await finalizeAttachmentForDraft.mutateAsync({
                attachmentId: contextAttachmentId,
                storedPath,
                chatId: newChatId,
            });

            // 7. Copy over attachments from the last user message if any
            if (
                lastUserMessage.attachments &&
                lastUserMessage.attachments.length > 0
            ) {
                for (const originalAttachment of lastUserMessage.attachments) {
                    try {
                        // Read the original attachment file
                        const fileData = await readFile(
                            originalAttachment.path,
                        );

                        // Create a new attachment record
                        const attachmentId = await createAttachment.mutateAsync(
                            {
                                type: originalAttachment.type,
                                originalName: originalAttachment.originalName,
                                path: originalAttachment.originalName,
                                association: {
                                    type: "draft",
                                    chatId: newChatId,
                                },
                            },
                        );

                        // For non-image files, we can use storeFile directly
                        // For images, create a File object and use resizeAndStoreFileData
                        let newStoredPath: string;
                        if (originalAttachment.type === "image") {
                            const file = new File(
                                [fileData as BlobPart],
                                originalAttachment.originalName,
                                {
                                    type: `image/${originalAttachment.originalName.split(".").pop()}`,
                                },
                            );
                            const result = await resizeAndStoreFileData(file);
                            newStoredPath = result.storedPath;
                        } else {
                            // For non-images, we need to create a temporary file first
                            const tempFile = new File(
                                [fileData as BlobPart],
                                originalAttachment.originalName,
                            );
                            const result =
                                await resizeAndStoreFileData(tempFile);
                            newStoredPath = result.storedPath;
                        }

                        // Finalize the copied attachment
                        await finalizeAttachmentForDraft.mutateAsync({
                            attachmentId,
                            storedPath: newStoredPath,
                            chatId: newChatId,
                        });
                    } catch (error) {
                        console.error(
                            `Failed to copy attachment ${originalAttachment.originalName}:`,
                            error,
                        );
                        // Continue with other attachments even if one fails
                    }
                }
            }

            // 8. Navigate to the new chat
            navigate(`/chat/${newChatId}`);
        } catch (error) {
            console.error("Error summarizing and creating new chat:", error);
            toast.error("Failed to create new chat");
        } finally {
            setIsSummarizing(false);
        }
    }, [
        chatId,
        summarizeChat,
        chatQuery.data,
        createNewChat,
        createAttachment,
        finalizeAttachmentForDraft,
        navigate,
        lastUserMessage,
    ]);

    return (
        <div className="text-md rounded-md">
            <div className="flex items-start gap-2">
                <CircleAlertIcon className="w-5 h-5 text-destructive mt-0.5 shrink-0" />
                <div className="flex-1">
                    <div className="font-medium text-destructive">
                        Context limit reached
                    </div>
                    <div className="text-sm text-muted-foreground mt-1">
                        This conversation has exceeded this model's context
                        window. We recommend summarizing this chat and
                        continuing in a new one.
                    </div>
                    <Button
                        onClick={handleSummarizeChat}
                        disabled={isSummarizing}
                        size="sm"
                        className="self-start mt-4"
                        variant="secondary"
                    >
                        {isSummarizing ? (
                            <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Summarizing...
                            </>
                        ) : (
                            <>
                                <FileTextIcon className="w-4 h-4 mr-1" />
                                Summarize Into New Chat
                            </>
                        )}
                    </Button>
                </div>
            </div>
        </div>
    );
}

export function ProjectSwitcher() {
    const { chatId } = useParams();
    const chat = useQuery(ChatAPI.chatQueries.detail(chatId));
    const currentProjectQuery = useQuery(
        ProjectAPI.projectQueries.detail(chat.data?.projectId),
    );
    const navigate = useNavigate();
    const renameChat = ChatAPI.useRenameChat();

    const projectsQuery = useQuery(ProjectAPI.projectQueries.list());
    if (!projectsQuery.isSuccess || !currentProjectQuery.isSuccess) {
        return null;
    }

    const currentProject = currentProjectQuery.data;

    return (
        <div className="flex items-center ml-1 text-sidebar-muted-foreground">
            {currentProject.id !== "default" && (
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button
                            variant="ghost"
                            size="iconSm"
                            className="hover:text-foreground hover:bg-transparent"
                            tabIndex={-1}
                            onClick={() => {
                                if (currentProject.id !== "default") {
                                    navigate(`/projects/${currentProject.id}`);
                                }
                            }}
                        >
                            <FolderOpenIcon
                                strokeWidth={1.5}
                                className="size-3.5! mr-0.5"
                            />

                            <span className="text-sm">
                                {projectDisplayName(currentProject.name)}
                            </span>
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>
                            {currentProject.id === "default"
                                ? "Chat is not in a project"
                                : `Go to ${projectDisplayName(currentProject.name)}`}
                        </p>
                    </TooltipContent>
                </Tooltip>
            )}
            {chat.data && (
                <div className="flex items-center px-1">
                    {currentProject.id !== "default" && (
                        <span className="text-sm mr-1 font-light">
                            <ChevronRightIcon className="size-3.5!" />
                        </span>
                    )}
                    <EditableTitle
                        title={chat.data.title || ""}
                        onUpdate={async (newTitle) => {
                            await renameChat.mutateAsync({
                                chatId: chat.data.id,
                                newTitle,
                            });
                        }}
                        className="ml-1 text-sm border-none text-sidebar-foreground hover:text-foreground"
                        editClassName="h-6 text-sm px-1 py-0 border-none"
                        placeholder="Untitled Chat"
                        showEditIcon={false}
                        disabled={false}
                    />
                </div>
            )}
        </div>
    );
}

export function EditableMessage({
    originalMessage,
    onCancelEdit,
    onSaveEdit,
    className,
    cautiousEnter,
}: {
    originalMessage: string;
    onCancelEdit: () => void;
    onSaveEdit: (newText: string) => void;
    className?: string;
    cautiousEnter: boolean;
}) {
    const [editedMessage, setEditedMessage] = useState(originalMessage);
    const ref = useRef<HTMLDivElement>(null);

    const edit = useEditable(ref, setEditedMessage);

    // on first render, focus editor with caret at end
    useEffect(() => {
        edit.move(originalMessage.length);
    }, [edit, originalMessage]);

    const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
        if (cautiousEnter) {
            // Cautious mode: Cmd+Enter to submit
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                e.preventDefault();
                onSaveEdit(editedMessage);
            } else if (e.key === "Escape") {
                onCancelEdit();
                e.stopPropagation();
            }
        } else {
            // Normal mode: Enter to submit, Shift+Enter for newline
            if (!e.shiftKey && e.key === "Enter") {
                e.preventDefault();
                onSaveEdit(editedMessage);
            } else if (e.key === "Escape") {
                onCancelEdit();
                e.stopPropagation();
            }
        }
    };

    return (
        <div
            ref={ref}
            onBlur={onCancelEdit}
            onKeyDown={handleKeyDown}
            className={className}
        >
            {editedMessage}
        </div>
    );
}

export function UserMessageView({
    message,
    isQuickChatWindow,
}: {
    message: Message;
    isQuickChatWindow: boolean;
}) {
    const appMetadata = useWaitForAppMetadata();
    const cautiousEnter = appMetadata["cautious_enter"] === "true";

    const { chatId } = useParams();
    const [isEditing, setIsEditing] = useState(false);
    const editMessage = MessageAPI.useEditMessage(chatId!, isQuickChatWindow);

    const saveEdit = (newText: string) => {
        editMessage.mutate({
            messageId: message.id,
            messageSetId: message.messageSetId,
            newText,
        });
        setIsEditing(false);
    };

    const startEdit = () => {
        setIsEditing(true);
    };

    const cancelEdit = () => {
        setIsEditing(false);
    };

    const messageBoxClasses = [
        isQuickChatWindow ? "px-4 py-2 rounded-xl" : "px-5 py-3 rounded",
        "text-base whitespace-pre-wrap",
    ].join(" ");

    return (
        <div className="group/message-set-view">
            <div
                key={message.id}
                id={`message-${message.id}`}
                className={`relative bg-highlight hover:bg-highlight/90 text-highlight-foreground inline-block max-w-full
                    ${isQuickChatWindow ? "rounded-xl" : "rounded"}
                    `}
            >
                {/* header */}
                <div className="flex items-center justify-end absolute -top-2.5 left-0 right-1 invisible group-hover/message-set-view:visible text-muted-foreground">
                    <div className="bg-background rounded-lg flex items-center justify-center px-2 py-1 gap-2">
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                startEdit();
                            }}
                            className="hover:text-foreground"
                            disabled={isEditing}
                        >
                            <Pencil className="h-3.5 w-3.5" strokeWidth={1.5} />
                        </button>
                        <SimpleCopyButton
                            className="hover:text-foreground"
                            text={message.text}
                            size="sm"
                        />
                    </div>
                </div>

                {isEditing ? (
                    <EditableMessage
                        originalMessage={message.text}
                        onCancelEdit={cancelEdit}
                        onSaveEdit={saveEdit}
                        cautiousEnter={cautiousEnter}
                        className={`${messageBoxClasses} outline-hidden ring-1 ring-border-accent`}
                    />
                ) : (
                    <div className={`${messageBoxClasses} wrap-break-word`}>
                        <div
                            onClick={startEdit}
                            className="hover:cursor-pointer"
                        >
                            {message.text}
                        </div>
                        {message.attachments &&
                            message.attachments.length > 0 && (
                                <AttachmentPillsList
                                    attachments={message.attachments}
                                    className="mt-2"
                                />
                            )}
                    </div>
                )}
            </div>
            {isEditing && !isQuickChatWindow && (
                <div className="text-muted-foreground mt-1">
                    {cautiousEnter ? "Cmd+Enter to save." : "Enter to save."}{" "}
                    Esc to cancel.
                </div>
            )}
        </div>
    );
}

export type ToolCallWithResult = UserToolCall & {
    toolResult?: UserToolResult;
};

export type MessagePartWithResults = MessagePart & {
    toolCallsAndResults: ToolCallWithResult[];
};

function MessagePartView({
    part,
    messageState,
}: {
    part: MessagePartWithResults;
    messageState: Message["state"];
}) {
    return (
        <>
            <MessageMarkdown text={part.content} />
            {part.toolCallsAndResults.map((toolCallWithResult) => (
                <ToolCallView
                    key={toolCallWithResult.id}
                    toolCallWithResult={toolCallWithResult}
                    messageState={messageState}
                />
            ))}
        </>
    );
}

function ToolCallView({
    toolCallWithResult,
    messageState,
}: {
    toolCallWithResult: ToolCallWithResult;
    messageState: Message["state"];
}) {
    // Check if this is an imported tool
    const isImportedTool: boolean = useMemo(() => {
        return (
            toolCallWithResult.namespacedToolName?.startsWith(
                ANTHROPIC_IMPORT_PREFIX,
            ) ||
            toolCallWithResult.namespacedToolName?.startsWith(
                OPENAI_IMPORT_PREFIX,
            )
        );
    }, [toolCallWithResult.namespacedToolName]);

    const formattedArgs = useMemo(() => {
        const argsList = toolCallWithResult.args as {
            [k: string]: unknown;
        };

        // If we have a proper inputSchema with properties, use it
        if (
            toolCallWithResult.toolMetadata?.inputSchema &&
            typeof toolCallWithResult.toolMetadata.inputSchema === "object" &&
            "properties" in toolCallWithResult.toolMetadata.inputSchema
        ) {
            const inputSchema = toolCallWithResult.toolMetadata
                ?.inputSchema as {
                properties: Record<
                    string,
                    {
                        type: string;
                        description: string;
                    }
                >;
                required: string[];
            };
            try {
                return Object.entries(argsList).map(([key, value]) => ({
                    key,
                    value: JSON.stringify(value, null, 2),
                    type: inputSchema.properties[key]?.type || "unknown",
                    description: inputSchema.properties[key]?.description || "",
                    required: inputSchema.required?.includes(key) || false,
                }));
            } catch {
                console.warn(
                    "failed to parse args with schema",
                    toolCallWithResult.args,
                );
            }
        }

        // Fallback: display args without schema information (e.g., from imports)
        try {
            return Object.entries(argsList).map(([key, value]) => ({
                key,
                value:
                    typeof value === "string"
                        ? value
                        : JSON.stringify(value, null, 2),
                type: typeof value,
                description: "",
                required: false,
            }));
        } catch {
            console.warn("failed to parse args", toolCallWithResult.args);
            return [];
        }
    }, [toolCallWithResult.args, toolCallWithResult.toolMetadata]);

    const formattedResults = useMemo(() => {
        if (!toolCallWithResult.toolResult) {
            return undefined;
        }
        try {
            // if a tool result is JSON, we format it just to be helpful
            return JSON.stringify(
                JSON.parse(toolCallWithResult.toolResult.content),
                null,
                2,
            );
        } catch {
            // if it's not valid JSON, just return the raw text
            return toolCallWithResult.toolResult?.content;
        }
    }, [toolCallWithResult.toolResult]);

    const toolsetLabel = useMemo(() => {
        return isImportedTool
            ? toolCallWithResult.namespacedToolName
                  .replace(ANTHROPIC_IMPORT_PREFIX + "_", "")
                  .replace(OPENAI_IMPORT_PREFIX + "_", "")
            : (toolCallWithResult.namespacedToolName ?? "tool");
    }, [isImportedTool, toolCallWithResult.namespacedToolName]);

    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <Collapsible className="my-4 rounded-md text-muted-foreground text-sm py-1.5 px-1.5 border w-fit max-w-full">
                    <CollapsibleTrigger
                        className="group font-geist-mono font-[350] text-left flex items-center justify-left hover:text-foreground"
                        onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                            e.stopPropagation(); // prevent message from selecting
                        }}
                    >
                        {formattedResults ? (
                            // finished tool call
                            <div className="flex items-center">
                                <div className="mr-2">
                                    {getToolsetIcon(toolsetLabel)}
                                </div>
                                {toolsetLabel}
                            </div>
                        ) : messageState === "streaming" ? (
                            // streaming tool call
                            <span className="flex items-center animate-pulse">
                                <Loader2 className="w-3 h-3 mr-2 animate-spin" />
                                {toolsetLabel}
                            </span>
                        ) : (
                            // interrupted tool call
                            <span className="flex items-center">
                                <CircleXIcon className="w-3 h-3 mr-2" />
                                {toolsetLabel}
                            </span>
                        )}
                        <div className="ml-auto flex items-center">
                            <ChevronDownIcon className="w-3 h-3 ml-4 inline-block transition-transform group-data-[state=open]:rotate-180" />
                        </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="">
                        <div className="border-b">
                            {formattedArgs.length > 0 && (
                                <div className="">
                                    <ul className="space-y-5 pb-6 pt-3">
                                        {formattedArgs.map((arg) => (
                                            <li key={arg.key}>
                                                <div className="flex flex-col items-star gap-1">
                                                    <div className="font-sans text-sm tracking-tight font-[350]">
                                                        {arg.key} ={" "}
                                                        <span className="font-geist-mono font-[350]">
                                                            {arg.value}
                                                        </span>
                                                    </div>
                                                    <div>
                                                        <span className="text-gray-500">
                                                            {arg.description}
                                                        </span>
                                                    </div>
                                                </div>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                        <div className="">
                            {formattedResults ? (
                                <div className="hljs-container">
                                    <CodeBlock
                                        content={formattedResults}
                                        language="json"
                                    />
                                </div>
                            ) : messageState === "streaming" ? (
                                <RetroSpinner />
                            ) : (
                                Toolsets.TOOL_CALL_INTERRUPTED_MESSAGE
                            )}
                        </div>
                    </CollapsibleContent>
                </Collapsible>
            </TooltipTrigger>
            <TooltipContent className="max-w-prose">
                <p>{toolCallWithResult.toolMetadata?.description}</p>
            </TooltipContent>
        </Tooltip>
    );
}

const fullscreenToolsDialogId = (messageId: string) =>
    `tools-message-fullscreen-dialog-${messageId}`;

function ToolsMessageFullScreenDialogView({
    message,
    children,
}: {
    message: Message;
    children: React.ReactNode;
}) {
    const [raw, setRaw] = useState(false);

    const modelConfigsQuery = ModelsAPI.useModelConfigs();
    const modelConfig = modelConfigsQuery.data?.find(
        (m) => m.id === message.model,
    );
    const modelName = modelConfig?.displayName;

    const fullText = message.parts.map((p) => p.content).join("\n");

    return (
        <Dialog id={fullscreenToolsDialogId(message.id)}>
            <DialogTrigger asChild>{children}</DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[95vh] w-full overflow-auto">
                <DialogTitle className="pt-2 px-3">
                    <div className="flex items-center justify-between">
                        <h1 className="text-lg font-medium">{modelName}</h1>
                        <div className="flex items-center gap-2.5">
                            <Tooltip>
                                <TooltipTrigger asChild tabIndex={-1}>
                                    <Toggle
                                        pressed={raw}
                                        onPressedChange={() => {
                                            setRaw(!raw);
                                        }}
                                    >
                                        <RemoveFormattingIcon className="w-3 h-3" />
                                    </Toggle>
                                </TooltipTrigger>
                                <TooltipContent
                                    className="font-normal"
                                    side="bottom"
                                >
                                    Toggle raw text
                                </TooltipContent>
                            </Tooltip>
                            <Tooltip>
                                <TooltipTrigger asChild tabIndex={-1}>
                                    <SimpleCopyButton text={fullText} />
                                </TooltipTrigger>
                                <TooltipContent
                                    className="font-normal"
                                    side="bottom"
                                >
                                    Copy
                                </TooltipContent>
                            </Tooltip>
                            <Tooltip>
                                <TooltipTrigger asChild tabIndex={-1}>
                                    <button
                                        className="w-3 h-3"
                                        onClick={() =>
                                            dialogActions.closeDialog()
                                        }
                                    >
                                        <XIcon className="w-3 h-3" />
                                    </button>
                                </TooltipTrigger>
                                <TooltipContent
                                    className="font-normal"
                                    side="bottom"
                                >
                                    Close
                                </TooltipContent>
                            </Tooltip>
                        </div>
                    </div>
                </DialogTitle>
                <Separator />
                <DialogDescription className="px-3 pb-4">
                    {raw ? (
                        <div className="text-sm text-muted-foreground whitespace-pre-wrap">
                            {fullText}
                        </div>
                    ) : (
                        <MessageMarkdown text={fullText} />
                    )}
                </DialogDescription>
            </DialogContent>
        </Dialog>
    );
}

// Simple handler to send notification with deep link when deep research completes
function DeepResearchNotificationHandler({ message }: { message: Message }) {
    const prevStateRef = useRef(message.state);
    const { chatId } = useParams();

    const modelConfigsQuery = ModelsAPI.useModelConfigs();
    const modelConfig = modelConfigsQuery.data?.find(
        (m) => m.id === message.model,
    );
    const isDeepResearch = modelConfig?.modelId === "openai::o3-deep-research";

    useEffect(() => {
        if (!isDeepResearch || !chatId) {
            return;
        }

        const justCompleted =
            prevStateRef.current === "streaming" &&
            message.state !== "streaming";

        if (justCompleted && message.parts.length > 0) {
            void sendTauriNotification(
                "Deep Research Complete",
                `Your o3-deep-research query has finished. Click to view.`,
            );
        }

        prevStateRef.current = message.state;
    }, [message.state, message.parts.length, isDeepResearch, chatId]);

    return null;
}

function DeepResearchNotificationButton({ message }: { message: Message }) {
    const [hasPermission, setHasPermission] = useState(false);

    const modelConfigsQuery = ModelsAPI.useModelConfigs();
    const modelConfig = modelConfigsQuery.data?.find(
        (m) => m.id === message.model,
    );
    const isDeepResearch = modelConfig?.modelId === "openai::o3-deep-research";

    useEffect(() => {
        // Check if we already have Tauri notification permission
        async function checkPermission() {
            const granted = await isPermissionGranted();
            setHasPermission(granted);
        }
        void checkPermission();
    }, []);

    // Only show for o3-deep-research
    if (!isDeepResearch) {
        return null;
    }

    const handleRequestPermission = async () => {
        // Check Tauri notification permission
        if (!hasPermission) {
            const permission = await requestPermission();
            const granted = permission === "granted";
            setHasPermission(granted);
        }
    };

    return (
        <div className="mt-4">
            {hasPermission ? (
                <div className="text-xs text-muted-foreground flex items-center">
                    <BellIcon className="w-3 h-3 mr-1 fill-current" />
                    <span className="flex items-center">
                        Will notify when complete{" "}
                        <CheckIcon className="w-3 h-3 ml-1" />
                    </span>
                </div>
            ) : (
                <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => void handleRequestPermission()}
                    className="text-xs"
                >
                    <BellIcon className="w-3 h-3 mr-1" />
                    Enable notifications
                </Button>
            )}
        </div>
    );
}

function ToolsAIMessageViewInner({
    message,
    isQuickChatWindow,
}: {
    message: Message;
    isQuickChatWindow: boolean;
}) {
    // combine tool calls with tool results
    const messagePartsSandwiched: MessagePartWithResults[] = message.parts
        .map((part, index) => {
            if (part.toolResults) {
                return undefined; // skip it
            }
            if (!part.toolCalls) {
                return {
                    ...part,
                    toolCallsAndResults: [],
                };
            }

            const toolCalls = part.toolCalls;
            const toolResults = message.parts[index + 1]?.toolResults ?? [];

            // note that in using zip, we assume the tool calls order corresponds to the tool results order
            // this is safe for now but safer still would be to match them up by id
            const toolCallsAndResults: ToolCallWithResult[] = _.zipWith(
                toolCalls,
                toolResults,
                (
                    toolCall: UserToolCall,
                    toolResult: UserToolResult | undefined,
                ): ToolCallWithResult => ({
                    ...toolCall,
                    toolResult,
                }),
            );
            return {
                ...part,
                toolCallsAndResults: toolCallsAndResults,
            };
        })
        .filter((p) => p !== undefined);
    return (
        <div
            className={`relative overflow-y-auto select-text ${
                isQuickChatWindow
                    ? "py-2.5 border border-special! max-w-full inline-block wrap-break-word px-3.5 rounded-xl"
                    : "p-4 pb-6"
            }`}
        >
            {(message.parts.length === 0 ||
                _.every(message.parts.map((p) => !p.content))) &&
            message.state === "idle" ? (
                <div className="text-sm text-muted-foreground/50 uppercase font-[350] font-geist-mono tracking-wider">
                    <ErrorView message={message} />
                </div>
            ) : (
                <>
                    {messagePartsSandwiched.map((part) => (
                        <MessagePartView
                            key={part.level}
                            part={part}
                            messageState={message.state}
                        />
                    ))}
                    {message.state === "streaming" && (
                        <RetroSpinner className="mt-2" />
                    )}
                    <DeepResearchNotificationHandler message={message} />
                    <DeepResearchNotificationButton message={message} />
                    {message.errorMessage && (
                        <div className="text-md rounded-md my-1 items-center justify-between font-[350]">
                            <div className="flex items-center text-destructive font-medium">
                                {message.errorMessage}
                            </div>
                        </div>
                    )}
                </>
            )}
            {/* // {streamStartTime && !isQuickChatWindow && (
                                //     <Metrics
                                //         text={message.text}
                                //         startTime={streamStartTime}
                                //         isStreaming={message.state === "streaming"}
                                //     />
                                // )} */}
            <MessageCostDisplay
                costUsd={message.costUsd}
                promptTokens={message.promptTokens}
                completionTokens={message.completionTokens}
                isStreaming={message.state === "streaming"}
                isQuickChatWindow={isQuickChatWindow}
            />
        </div>
    );
}

export function ToolsReplyCountView({
    replyChatId,
    onReplyClick,
}: {
    replyChatId: string;
    onReplyClick: () => void;
}) {
    const chatQuery = ChatAPI.useChat(replyChatId);
    // Fetching full message sets (not just the count) is intentional:
    // the same query is reused when rendering the reply thread, so React Query caches it.
    const messageSetsQuery = MessageAPI.useMessageSets(replyChatId);

    const replyCount = useMemo(() => {
        console.log(messageSetsQuery.data, chatQuery.data);
        return filterReplyMessageSets(
            messageSetsQuery.data,
            chatQuery.data,
            false,
        ).length;
    }, [messageSetsQuery.data, chatQuery.data]);

    if (replyCount === 0) {
        return null;
    }

    return (
        <div
            className="mt-1.5 mx-2 text-sm flex justify-start hover:cursor-pointer hover:bg-muted rounded py-1.5 px-1 group/reply-count"
            onClick={onReplyClick}
        >
            <div className="flex items-center gap-2">
                <ReplyIcon className="size-4 text-muted-foreground" />
                <span>
                    {replyCount} {replyCount === 1 ? "reply" : "replies"}
                </span>
            </div>
        </div>
    );
}

export function ToolsMessageView({
    message,
    isQuickChatWindow,
    isLastRow,
    isOnlyMessage,
    isReply = false,
}: {
    message: Message;
    isQuickChatWindow: boolean;
    isLastRow: boolean;
    isOnlyMessage: boolean;
    isReply?: boolean;
}) {
    const navigate = useNavigate();
    // const [raw, setRaw] = useState(false);
    // const [streamStartTime, setStreamStartTime] = useState<Date>();

    const selectMessage = MessageAPI.useSelectMessage();
    const stopMessage = MessageAPI.useStopMessage();
    const restartMessage = MessageAPI.useRestartMessage(
        message.chatId,
        message.messageSetId,
        message.id,
    );
    const branchChat = MessageAPI.useBranchChat({
        chatId: message.chatId,
        messageSetId: message.messageSetId,
        messageId: message.id,
        blockType: "tools",
    });
    const replyToMessage = MessageAPI.useBranchChat({
        chatId: message.chatId,
        messageSetId: message.messageSetId,
        messageId: message.id,
        blockType: "tools",
        replyToId: message.id,
    });
    const modelConfigsQuery = ModelsAPI.useModelConfigs();
    // // Set stream start time when streaming begins
    // useEffect(() => {
    //     if (message.state === "streaming" && !streamStartTime) {
    //         setStreamStartTime(new Date());
    //     }
    // }, [message.state, streamStartTime]);

    // this should only happen in some intermediate state
    if (!message) {
        return null;
    }
    const fullText = message.parts.map((p) => p.content).join("\n");
    const modelConfig = modelConfigsQuery.data?.find(
        (m) => m.id === message.model,
    );

    const messageClasses = [
        "relative",
        !isQuickChatWindow && "rounded-md border-[0.090rem]",
        isQuickChatWindow ? "text-sm" : "bg-background",
        !isQuickChatWindow && (message.selected || isReply)
            ? "border-special!"
            : "",
        isLastRow && !isQuickChatWindow && !message.selected
            ? "cursor-pointer"
            : "",
        !message.selected ? "opacity-70 hover:opacity-100" : "",
    ]
        .filter(Boolean)
        .join(" ");

    function onReplyClick() {
        if (message.replyChatId) {
            navigate(`/chat/${message.chatId}?replyId=${message.replyChatId}`);
        } else {
            replyToMessage.mutate();
        }
    }

    return (
        <div id={`message-${message.id}`} className={"flex w-full select-none"}>
            <div className={`${isQuickChatWindow ? "pt-4" : "pt-2 w-full"}`}>
                <div className={`group/message-set-view`}>
                    <div
                        className={messageClasses}
                        style={{
                            overflowWrap: "anywhere", // tailwind doesn't support this yet
                        }}
                        onClick={(e) => {
                            if (message.selected) return;
                            // Don't trigger selection if user is selecting text
                            if (window.getSelection()?.toString()) {
                                e.stopPropagation();
                                return;
                            }
                            if (isLastRow) {
                                selectMessage.mutate({
                                    chatId: message.chatId,
                                    messageSetId: message.messageSetId,
                                    messageId: message.id,
                                    blockType: "tools",
                                });
                            }
                        }}
                    >
                        {/* message header (model name + buttons) */}
                        <div
                            className={`absolute left-0 right-0 -top-3 h-6
                            flex items-center justify-between z-5
                            `}
                            onClick={(e) => {
                                e.stopPropagation(); // prevent message from being selected
                            }}
                        >
                            <div
                                className={`flex items-center h-6 gap-2 ${isQuickChatWindow ? "invisible" : ""}`}
                            >
                                <div
                                    className={`ml-2 px-2 bg-background ${
                                        message.selected
                                            ? "text-foreground"
                                            : "text-muted-foreground"
                                    }`}
                                >
                                    {modelConfig && (
                                        <div className="flex items-center gap-2 h-6">
                                            <ProviderLogo
                                                size="sm"
                                                modelId={modelConfig.modelId}
                                                className="-mt-px"
                                            />
                                            <div className="text-sm">
                                                {modelConfig?.displayName}
                                            </div>
                                        </div>
                                    )}
                                </div>
                                {!isOnlyMessage && (
                                    <div
                                        className={`text-accent-600 px-2 flex text-sm tracking-wider font-[350]
                                        ${isQuickChatWindow ? "bg-gray-200" : "bg-background"} animate-brief-flash font-geist-mono uppercase
                                        ${message.selected ? "opacity-100" : "opacity-0"}`}
                                    >
                                        In Chat
                                    </div>
                                )}
                            </div>
                            <div
                                className={`no-print mr-3 flex items-center h-6 gap-2
                                `}
                            >
                                <div
                                    className={`gap-2 text-muted-foreground px-2
                                    hidden group-hover/message-set-view:flex
                                    bg-background
                                    ${isQuickChatWindow ? "rounded-lg p-1" : ""}`}
                                >
                                    {message.state === "streaming" ? (
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <button
                                                    className="hover:text-foreground"
                                                    onClick={() => {
                                                        stopMessage.mutate({
                                                            chatId: message.chatId,
                                                            messageId:
                                                                message.id,
                                                        });
                                                    }}
                                                >
                                                    <StopCircleIcon className="w-3.5 h-3.5" />
                                                </button>
                                            </TooltipTrigger>
                                            <TooltipContent>
                                                Stop
                                            </TooltipContent>
                                        </Tooltip>
                                    ) : isLastRow ? (
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <button
                                                    disabled={!modelConfig}
                                                    className="hover:text-foreground"
                                                    onClick={() => {
                                                        if (modelConfig) {
                                                            restartMessage.mutate(
                                                                {
                                                                    modelConfig,
                                                                },
                                                            );
                                                        }
                                                    }}
                                                >
                                                    <RefreshCcwIcon
                                                        strokeWidth={1.5}
                                                        className="w-3.5 h-3.5"
                                                    />
                                                </button>
                                            </TooltipTrigger>
                                            <TooltipContent>
                                                Regenerate
                                            </TooltipContent>
                                        </Tooltip>
                                    ) : null}

                                    {!isReply && !isQuickChatWindow && (
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <button
                                                    className="hover:text-foreground"
                                                    onClick={() =>
                                                        branchChat.mutate()
                                                    }
                                                >
                                                    <SplitIcon className="w-3 h-3" />
                                                </button>
                                            </TooltipTrigger>
                                            <TooltipContent>
                                                Branch chat
                                            </TooltipContent>
                                        </Tooltip>
                                    )}

                                    {/* DUPLICATE x1000 BUTTON - FOR TESTING */}
                                    {/* {!isQuickChatWindow &&
                                            config.tellPostHogIAmATestUser && (

                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <button
                                                                className="hover:text-foreground"
                                                                onClick={() => {
                                                                    for (
                                                                        let i = 0;
                                                                        i <
                                                                        1000;
                                                                        i++
                                                                    ) {
                                                                        branchChat.mutate();
                                                                    }
                                                                }}
                                                            >
                                                                *1000
                                                            </button>
                                                        </TooltipTrigger>
                                                        <TooltipContent>
                                                            Duplicate chat 1000x
                                                            times
                                                        </TooltipContent>
                                                    </Tooltip>

                                            )} */}

                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <SimpleCopyButton
                                                className="hover:text-foreground"
                                                text={fullText}
                                                size="sm"
                                            />
                                        </TooltipTrigger>
                                        <TooltipContent>Copy</TooltipContent>
                                    </Tooltip>

                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <span>
                                                <ToolsMessageFullScreenDialogView
                                                    message={message}
                                                >
                                                    <button className="hover:text-foreground">
                                                        <Maximize2Icon
                                                            strokeWidth={1.5}
                                                            className="w-3.5 h-3.5"
                                                        />
                                                    </button>
                                                </ToolsMessageFullScreenDialogView>
                                            </span>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                            Open full screen
                                        </TooltipContent>
                                    </Tooltip>

                                    {!isQuickChatWindow && !isReply && (
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <button
                                                    className="hover:text-foreground"
                                                    onClick={onReplyClick}
                                                >
                                                    <ReplyIcon
                                                        strokeWidth={1.5}
                                                        className="w-3.5 h-3.5"
                                                    />
                                                </button>
                                            </TooltipTrigger>
                                            <TooltipContent>
                                                Reply to this message
                                            </TooltipContent>
                                        </Tooltip>
                                    )}
                                </div>
                            </div>
                        </div>

                        <ToolsAIMessageViewInner
                            message={message}
                            isQuickChatWindow={isQuickChatWindow}
                        />

                        {/* Reply button at bottom overlapping border (only show if there are no replies) */}
                        {!isQuickChatWindow &&
                            !isReply &&
                            !message.replyChatId && (
                                <div className="absolute bottom-0 left-3 transform translate-y-1/2 z-10">
                                    <button
                                        className="text-highlight-foreground hover:text-foreground transition-color flex items-center gap-2 bg-background px-2 py-1"
                                        onClick={onReplyClick}
                                    >
                                        <ReplyIcon
                                            strokeWidth={1.5}
                                            className="w-3.5 h-3.5"
                                        />
                                        Reply
                                    </button>
                                </div>
                            )}
                    </div>
                </div>

                {/* Reply count display - outside the message box */}
                {!isReply && message.replyChatId && (
                    <ToolsReplyCountView
                        replyChatId={message.replyChatId}
                        onReplyClick={onReplyClick}
                    />
                )}
            </div>
        </div>
    );
}

export const MANAGE_MODELS_TOOLS_DIALOG_ID = "manage-models-compare";
export const MANAGE_MODELS_TOOLS_INLINE_DIALOG_ID =
    "manage-models-compare-inline"; // dialog for the inline add model button

function ToolsBlockView({
    messageSetId,
    toolsBlock,
    isLastRow = false,
    isQuickChatWindow,
}: {
    messageSetId: string;
    toolsBlock: ToolsBlock;
    isLastRow: boolean;
    isQuickChatWindow: boolean;
}) {
    const { chatId } = useParams();
    const { elementRef, shouldShowScrollbar } = useElementScrollDetection();

    const addModelToCompareConfigs = MessageAPI.useAddModelToCompareConfigs();
    const addMessageToToolsBlock = MessageAPI.useAddMessageToToolsBlock(
        chatId!,
    );
    const handleAddModel = (modelId: string) => {
        // First add the model to the selected models list
        addModelToCompareConfigs.mutate({
            newSelectedModelConfigId: modelId,
        });
        // Then add it to the current message set
        addMessageToToolsBlock.mutate({
            messageSetId,
            modelId,
        });
    };

    return (
        <div
            ref={elementRef}
            className={`flex w-full h-fit pb-2 pr-5 gap-2 ${
                // get horizontal scroll bars, plus hackily disable y scrolling
                // because we're seeing scroll bars when we shouldn't
                "overflow-x-auto scrollbar-on-scroll overflow-y-hidden"
            }
            ${shouldShowScrollbar ? "is-scrolling" : ""}
            ${!isQuickChatWindow ? "px-10" : ""}`}
        >
            {toolsBlock.chatMessages.map((message, _index) => (
                <div
                    key={message.id}
                    className={
                        isQuickChatWindow
                            ? "w-full max-w-prose"
                            : `w-full flex-1 min-w-[450px] max-w-[550px]`
                    }
                >
                    <ToolsMessageView
                        message={message}
                        // shortcutNumber={isLastRow ? index + 1 : undefined}
                        isLastRow={isLastRow}
                        isQuickChatWindow={isQuickChatWindow}
                        isOnlyMessage={toolsBlock.chatMessages.length === 1}
                    />
                </div>
            ))}
            {isLastRow && !isQuickChatWindow && (
                <div>
                    <button
                        // brighten border in dark mode bc it's hard to see
                        className="w-14 flex-none text-sm text-muted-foreground hover:text-foreground rounded-md border-[0.090rem] py-[0.6rem] px-2 mt-2 h-fit border-dashed"
                        onClick={() => {
                            dialogActions.openDialog(
                                MANAGE_MODELS_TOOLS_INLINE_DIALOG_ID,
                            );
                        }}
                    >
                        <div className="flex flex-col items-center gap-1 py-1">
                            <PlusIcon className="font-medium w-3 h-3" />
                            Add
                        </div>
                    </button>

                    {/* Add Model dialog (can go basically anywhere, but shouldn't be inside the button) */}
                    <ManageModelsBox
                        id={MANAGE_MODELS_TOOLS_INLINE_DIALOG_ID}
                        mode={{
                            type: "add",
                            checkedModelConfigIds: toolsBlock.chatMessages.map(
                                (m) => m.model,
                            ),
                            onAddModel: handleAddModel,
                        }}
                    />
                </div>
            )}
        </div>
    );
}

function UserBlockView({
    userBlock,
    userMessageRef,
    isQuickChatWindow,
}: {
    userBlock: UserBlock;
    userMessageRef?: React.RefObject<HTMLDivElement | null>;
    isQuickChatWindow: boolean;
}) {
    return (
        <div
            className={`ml-10 max-w-prose ${isQuickChatWindow ? "ml-auto" : ""}`}
            ref={userMessageRef}
        >
            {userBlock.message && (
                <UserMessageView
                    message={userBlock.message}
                    isQuickChatWindow={isQuickChatWindow}
                />
            )}
        </div>
    );
}

export type MessageSetViewProps = {
    messageSetId: string;
    isLastRow?: boolean;
    isQuickChatWindow: boolean;
    userMessageRef: React.RefObject<HTMLDivElement | null> | undefined;
    messageSetRef: React.RefObject<HTMLDivElement | null> | undefined;
};

export const MessageSetView = memo(
    ({
        messageSetId,
        isLastRow = false,
        isQuickChatWindow,
        userMessageRef, // a ref that will be applied to user message container, if there is one
        messageSetRef, // a ref that will be applied to the message set container
    }: MessageSetViewProps) => {
        const { chatId } = useParams();

        const messageSetQuery = MessageAPI.useMessageSet(chatId!, messageSetId);

        if (messageSetQuery.isPending) {
            return <RetroSpinner />;
        }
        if (messageSetQuery.error) {
            return <div>Error: {messageSetQuery.error.message}</div>;
        }

        const messageSet = messageSetQuery.data?.[0];

        if (messageSet?.selectedBlockType === "compare" && isQuickChatWindow) {
            console.error(
                "Error: shouldn't render compare block in quick chat window",
            );
        }

        return (
            <div
                ref={messageSetRef}
                className={`relative text-sm flex flex-col w-full ${
                    messageSet.type === "ai" ? "mb-10" : ""
                }`}
            >
                <div
                    className={`
                        ${
                            // pre-allocate space to avoid too much scroll anchor jank
                            !isQuickChatWindow &&
                            messageSet.type === "ai" &&
                            isLastRow
                                ? "min-h-[200px]"
                                : ""
                        } ${isQuickChatWindow ? "flex w-full" : ""}`}
                    data-tauri-drag-region={
                        isQuickChatWindow ? "true" : undefined
                    }
                >
                    {messageSet.selectedBlockType === "user" ? (
                        <UserBlockView
                            userBlock={messageSet.userBlock}
                            userMessageRef={userMessageRef}
                            isQuickChatWindow={isQuickChatWindow}
                        />
                    ) : messageSet.selectedBlockType === "compare" ? (
                        <CompareBlockView
                            messageSetId={messageSetId}
                            compareBlock={messageSet.compareBlock}
                            isLastRow={isLastRow}
                            isQuickChatWindow={isQuickChatWindow}
                        />
                    ) : messageSet.selectedBlockType === "chat" ? (
                        <ChatBlockView
                            messageSetId={messageSetId}
                            chatBlock={messageSet.chatBlock}
                            isLastRow={isLastRow}
                            isQuickChatWindow={isQuickChatWindow}
                        />
                    ) : messageSet.selectedBlockType === "tools" ? (
                        <ToolsBlockView
                            messageSetId={messageSetId}
                            toolsBlock={messageSet.toolsBlock}
                            isLastRow={isLastRow}
                            isQuickChatWindow={isQuickChatWindow}
                        />
                    ) : messageSet.selectedBlockType === "brainstorm" ? (
                        <BrainstormBlockView
                            brainstormBlock={messageSet.brainstormBlock}
                        />
                    ) : null}
                </div>
            </div>
        );
    },
);

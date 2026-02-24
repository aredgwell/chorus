import { useEffect, useMemo, useState } from "react";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { convertFileSrc } from "@tauri-apps/api/core";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";
import {
    FileTextIcon,
    GlobeIcon,
    X,
    Loader2,
    PaperclipIcon,
    Upload,
} from "lucide-react";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogTitle } from "./ui/dialog";
import * as AttachmentsAPI from "@core/chorus/api/AttachmentsAPI";
import { Attachment } from "@core/chorus/api/AttachmentsAPI";
import { QuestionMarkCircledIcon } from "@radix-ui/react-icons";
import { dialogActions } from "@core/infra/DialogStore";
import { useDialogStore } from "@core/infra/DialogStore";
import { cn } from "@ui/lib/utils";
import SimpleCopyButton from "./CopyButton";

function truncate(text: string | undefined, maxLength: number = 35) {
    if (!text) return "";
    // remove https://
    text = text.replace("https://", "");
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength - 3) + "...";
}

function AttachmentSmallView({ attachment }: { attachment: Attachment }) {
    const isImage = attachment.type === "image";
    const icon =
        attachment.type === "pdf" ? (
            <FileTextIcon className="size-4 text-muted-foreground" />
        ) : attachment.type === "text" ? (
            <FileTextIcon className="size-4 text-muted-foreground" />
        ) : attachment.type === "webpage" ? (
            <GlobeIcon className="size-4 text-blue-500" />
        ) : (
            <QuestionMarkCircledIcon className="size-4 text-muted-foreground" />
        );

    return (
        <div className="flex items-center border border-border bg-popover gap-2 rounded px-2 py-1.5">
            <div className="shrink-0 size-8 border bg-background border-border rounded overflow-hidden flex items-center justify-center">
                {attachment.isLoading ? (
                    <Loader2 className="size-3 text-muted-foreground animate-spin" />
                ) : isImage ? (
                    <img
                        src={convertFileSrc(attachment.path)}
                        alt={attachment.originalName}
                        className="w-full h-full object-cover"
                    />
                ) : (
                    icon
                )}
            </div>
            <div className="flex flex-col min-w-0 gap-y-0 mr-1 mt-0.5">
                <span className="font-medium text-sm truncate">
                    {truncate(attachment.originalName, 20)}
                </span>
                <span className="uppercase -mt-0.5 text-[10px] text-muted-foreground font-geist-mono tracking-wider">
                    {attachment.type}
                </span>
            </div>
        </div>
    );
}

function AttachmentBigView({ attachment }: { attachment: Attachment }) {
    // For images and PDFs, use the file path directly
    // For text and webpage, we still need to load the content
    const needsContent =
        attachment.type === "text" || attachment.type === "webpage";
    const contentQuery = AttachmentsAPI.useAttachmentContents(attachment);

    // Truncate text content to first 100000 characters
    const MAX_PREVIEW_LENGTH = 100000;
    const content = contentQuery.data;
    const displayContent =
        content && content.length > MAX_PREVIEW_LENGTH
            ? content.slice(0, MAX_PREVIEW_LENGTH) + "..."
            : content;

    if (needsContent && contentQuery.isPending) {
        return <Loader2 className="w-5 h-5 animate-spin" />;
    }
    if (needsContent && contentQuery.isError) {
        return <div>Error loading attachment</div>;
    }

    switch (attachment.type) {
        case "image":
            return (
                <img
                    src={convertFileSrc(attachment.path)}
                    alt={attachment.originalName}
                    className="max-h-[80vh] max-w-full"
                />
            );
        case "pdf":
            return (
                <iframe
                    src={convertFileSrc(attachment.path)}
                    className="w-full h-[80vh]"
                />
            );
        case "text":
            return (
                <pre className="max-h-[80vh] overflow-auto whitespace-pre-wrap">
                    {displayContent ?? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                    )}
                </pre>
            );
        case "webpage":
            return (
                <pre className="max-h-[80vh] overflow-auto whitespace-pre-wrap">
                    {displayContent ?? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                    )}
                </pre>
            );
        default:
            return null;
    }
}

const attachmentPreviewDialogId = (attachmentId: string) =>
    `attachment-preview-dialog-${attachmentId}`;

function AttachmentPreviewHeader({ attachment }: { attachment: Attachment }) {
    const needsContent =
        attachment.type === "text" || attachment.type === "webpage";
    const contentQuery = AttachmentsAPI.useAttachmentContents(attachment);
    const content = contentQuery.data;

    const showCopyButton =
        needsContent &&
        content &&
        !contentQuery.isPending &&
        !contentQuery.isError;

    return (
        <div className="flex items-center justify-between py-2">
            <DialogTitle className="text-md font-normal">
                {attachment.originalName}
            </DialogTitle>
            {showCopyButton && (
                <Tooltip delayDuration={100}>
                    <TooltipTrigger asChild>
                        <div
                            className="p-2 hover:bg-muted/50 rounded-md transition-colors"
                            aria-label="Copy file contents to clipboard"
                        >
                            <SimpleCopyButton
                                text={content}
                                size="md"
                                className=""
                            />
                        </div>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" sideOffset={5}>
                        <p>Copy file contents to clipboard</p>
                    </TooltipContent>
                </Tooltip>
            )}
        </div>
    );
}

export function AttachmentPillsList({
    attachments,
    onRemove,
    className,
}: {
    attachments: Attachment[];
    onRemove?: (attachmentId: string) => void;
    className?: string;
}) {
    const nonEphemeralAttachments = useMemo(
        () => attachments.filter((a) => !a.ephemeral),
        [attachments],
    );
    if (!nonEphemeralAttachments || nonEphemeralAttachments?.length === 0) {
        return null;
    }
    return (
        <div className={`flex flex-wrap gap-1 my-2 ${className}`}>
            <ul className="flex flex-wrap gap-2">
                {nonEphemeralAttachments.map((attachment: Attachment) => (
                    <li key={attachment.id}>
                        <AttachmentPillButton
                            attachment={attachment}
                            onRemove={
                                onRemove
                                    ? () => onRemove(attachment.id)
                                    : undefined
                            }
                        />
                    </li>
                ))}
            </ul>
        </div>
    );
}
export function AttachmentPillButton({
    attachment,
    onRemove,
}: {
    attachment: Attachment;
    onRemove?: () => void;
}) {
    const isAttachmentPreviewDialogOpen = useDialogStore(
        (state) =>
            state.activeDialogId === attachmentPreviewDialogId(attachment.id),
    );

    return (
        <>
            <div
                className={`relative group/pill`}
                onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (!attachment.isLoading) {
                        dialogActions.openDialog(
                            attachmentPreviewDialogId(attachment.id),
                        );
                    }
                }}
                style={{ cursor: attachment.isLoading ? "default" : "pointer" }}
            >
                <AttachmentSmallView attachment={attachment} />
                {onRemove && (
                    <button
                        className="group-hover/pill:flex hidden absolute top-1 right-1 rounded-full h-4 w-4 items-center justify-center bg-gray-600 hover:bg-gray-700 text-white z-10"
                        onClick={(e) => {
                            e.stopPropagation();
                            onRemove();
                        }}
                    >
                        <X className="w-3 h-3" />
                    </button>
                )}
            </div>

            {!attachment.isLoading && (
                <Dialog
                    open={isAttachmentPreviewDialogOpen}
                    id={attachmentPreviewDialogId(attachment.id)}
                >
                    <DialogContent
                        className="max-w-4xl p-4"
                        aria-describedby={undefined}
                    >
                        <AttachmentPreviewHeader attachment={attachment} />
                        <AttachmentBigView attachment={attachment} />
                    </DialogContent>
                </Dialog>
            )}
        </>
    );
}

export function AttachmentAddButton({
    className,
    onSelect,
    labelText = false,
}: {
    className?: string;
    onSelect: () => void;
    labelText?: boolean;
}) {
    return (
        <div className={className}>
            <Tooltip>
                <TooltipTrigger asChild>
                    <Button
                        variant="ghost"
                        size="iconSm"
                        onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                            e.preventDefault();
                            onSelect();
                        }}
                    >
                        <PaperclipIcon className="w-4! h-4!" />
                        {labelText && (
                            <span className="text-base text-muted-foreground font-[350]">
                                Add
                            </span>
                        )}
                    </Button>
                </TooltipTrigger>
                <TooltipContent>
                    <p>Add attachments</p>
                </TooltipContent>
            </Tooltip>
        </div>
    );
}

export function AttachmentAddPill({ onSelect }: { onSelect: () => void }) {
    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <Button
                    variant="ghost"
                    className="rounded-full"
                    size="iconSm"
                    onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                        e.preventDefault();
                        onSelect();
                    }}
                >
                    <PaperclipIcon
                        strokeWidth={1.5}
                        className="w-4! h-4! text-muted-foreground"
                    />
                </Button>
            </TooltipTrigger>
            <TooltipContent>
                <p>Add attachments</p>
            </TooltipContent>
        </Tooltip>
    );
}

export function AttachmentDropArea({
    attachments,
    onFileDrop,
    onRemove,
    inline = false,
}: {
    attachments: Attachment[];
    onFileDrop: (paths: string[]) => void;
    onRemove: (id: string) => void;
    inline?: boolean;
}) {
    const [isDragging, setIsDragging] = useState(false);
    const isDialogOpen = useDialogStore(
        (state) => state.activeDialogId !== null,
    );

    useEffect(() => {
        const unlisten = getCurrentWebview().onDragDropEvent((event) => {
            if (event.payload.type === "drop" && !isDialogOpen) {
                setIsDragging(false);
                onFileDrop(event.payload.paths);
            } else if (event.payload.type === "over" && !isDialogOpen) {
                setIsDragging(true);
            } else if (event.payload.type === "leave" && !isDialogOpen) {
                setIsDragging(false);
            }
        });

        return () => {
            void unlisten.then((unlistenFn) => unlistenFn());
        };
    }, [onFileDrop, isDialogOpen]);

    if (inline) {
        // For inline mode, we only show attachments when they exist, not the drop zone
        if (attachments.length > 0) {
            return (
                <div className="px-3 pb-2">
                    <AttachmentPillsList
                        attachments={attachments}
                        onRemove={onRemove}
                    />
                </div>
            );
        } else {
            return null;
        }
    }

    if (!isDragging && attachments.length === 0) {
        // prevent any layout shift when nothing is shown
        return null;
    }

    return (
        <div
            className={cn(
                "mt-2 mb-2",
                !isDragging && attachments.length > 0
                    ? ""
                    : "transition-all duration-200",
            )}
        >
            {isDragging ? (
                <div
                    className={`
                        relative overflow-hidden
                        rounded-lg p-4 h-28
                        flex items-center justify-center
                        transition-all duration-200
                        bg-primary/5
                    `}
                >
                    <div className="flex flex-col items-center justify-center gap-2 pointer-events-none">
                        <div className="rounded-full p-2 transition-all duration-200 bg-primary/10 scale-110">
                            <Upload className="size-3 transition-all duration-200 text-primary" />
                        </div>
                        <div className="text-center">
                            <p className="text-sm transition-colors duration-200 text-primary">
                                Drop files here
                            </p>
                            <p className="mt-0.5 text-xs text-muted-foreground">
                                Images, PDFs, and text files
                            </p>
                        </div>
                    </div>
                </div>
            ) : (
                <AttachmentPillsList
                    attachments={attachments}
                    onRemove={onRemove}
                />
            )}
        </div>
    );
}

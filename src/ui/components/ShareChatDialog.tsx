import { Button } from "./ui/button";
import {
    ExternalLinkIcon,
    CircleAlertIcon,
    Trash2Icon,
} from "lucide-react";
import { CopyIcon, CheckIcon } from "lucide-react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "./ui/dialog";

export const SHARE_CHAT_DIALOG_ID = "share-chat-dialog";

export function ShareChatDialog({
    shareUrl,
    copiedUrl,
    onCopyShareUrl,
    onOpenShareUrl,
    onDeleteShare,
    onClose,
}: {
    shareUrl: string | null;
    copiedUrl: boolean;
    onCopyShareUrl: () => void;
    onOpenShareUrl: () => void;
    onDeleteShare: () => void;
    onClose: () => void;
}) {
    return (
        <Dialog
            id={SHARE_CHAT_DIALOG_ID}
            onOpenChange={(open) => !open && onClose()}
        >
            <DialogContent className="p-5">
                <DialogHeader>
                    <DialogTitle>Share Chat</DialogTitle>
                    <DialogDescription className="space-y-4">
                        <div className="flex items-center gap-2 mt-2">
                            <CircleAlertIcon className="h-4 w-4 shrink-0" />
                            <p className="text-sm">
                                Anyone with this link can view your chat.
                            </p>
                        </div>
                        <button
                            onClick={onCopyShareUrl}
                            className="text-left focus:outline-hidden border text-sm hover:bg-muted/50 rounded-md p-2 w-full"
                            autoFocus
                        >
                            <code>{shareUrl}</code>
                        </button>
                    </DialogDescription>
                </DialogHeader>
                <DialogFooter className="flex-col gap-2 sm:flex-row">
                    <Button
                        variant="secondary"
                        size="sm"
                        onClick={onDeleteShare}
                        className="sm:mr-auto"
                    >
                        <Trash2Icon className="w-4 h-4" />
                        Delete Link
                    </Button>
                    <div className="flex gap-2 w-full sm:w-auto">
                        <Button
                            size="sm"
                            onClick={onCopyShareUrl}
                            className="flex-1 sm:flex-initial"
                        >
                            {copiedUrl ? (
                                <CheckIcon className="w-4 h-4 text-green-500" />
                            ) : (
                                <CopyIcon className="w-4 h-4" />
                            )}
                            <span className="ml-1">
                                {copiedUrl ? "Copied" : "Copy"}
                            </span>
                            <span className="ml-1 text-sm">↵</span>
                        </Button>
                        <Button
                            size="sm"
                            onClick={onOpenShareUrl}
                            className="flex-1 sm:flex-initial"
                        >
                            <ExternalLinkIcon className="w-4 h-4" />
                            <span className="ml-1">Open</span>
                            <span className="ml-1 text-sm">⌘↵</span>
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

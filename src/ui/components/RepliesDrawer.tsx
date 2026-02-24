import { useEffect } from "react";
import { XIcon } from "lucide-react";
import ReplyChat from "./ReplyChat";
import * as ChatAPI from "@core/chorus/api/ChatAPI";
import { useSidebar } from "@ui/hooks/useSidebar";

interface RepliesDrawerProps {
    onOpenChange: (open: boolean) => void;
    replyChatId: string;
}

export default function RepliesDrawer({
    onOpenChange,
    replyChatId,
}: RepliesDrawerProps) {
    // Fetch the reply chat via the replyID (which is really just a chat ID in the db)
    const chatQuery = ChatAPI.useChat(replyChatId);
    const { isMobile } = useSidebar();

    // Handle escape key to close
    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                onOpenChange(false);
            }
        };

        document.addEventListener("keydown", handleEscape);
        return () => document.removeEventListener("keydown", handleEscape);
    }, [onOpenChange]);

    const errorState = (
        <div className="flex items-center justify-center space-x-2 h-full">
            <p className="text-sm text-muted-foreground">Reply not found.</p>
            <button
                onClick={() => onOpenChange(false)}
                className="text-muted-foreground hover:text-foreground transition-colors"
            >
                <XIcon className="size-4" />
            </button>
        </div>
    );

    if (!replyChatId || !chatQuery.data) return errorState;

    const repliedToMessageId = chatQuery.data.replyToId;
    if (!repliedToMessageId) return errorState;

    return (
        <>
            <div className="@2xl:translate-y-[50px] @2xl:h-[calc(100vh-50px)] h-full bg-background flex flex-col transition-all duration-300 ease-in-out overflow-hidden w-full">
                {/* Header */}
                <div
                    className={`flex items-center justify-between px-6 pb-3 shrink-0 transition-opacity duration-300 ${isMobile ? "pt-8" : "pt-4"}`}
                >
                    <p className="font-semibold whitespace-nowrap">Replies</p>
                    <button
                        onClick={() => onOpenChange(false)}
                        className="text-muted-foreground hover:text-foreground transition-colors ml-4"
                    >
                        <XIcon className="size-4" />
                    </button>
                </div>

                {/* Content - ReplyChat for the reply thread */}
                <div className="flex-1 overflow-hidden transition-opacity duration-300">
                    <ReplyChat
                        chatId={replyChatId}
                        replyToId={repliedToMessageId}
                    />
                </div>
            </div>
        </>
    );
}

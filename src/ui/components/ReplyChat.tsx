import { useRef, useEffect, useState } from "react";
import * as ChatAPI from "@core/chorus/api/ChatAPI";
import * as MessageAPI from "@core/chorus/api/MessageAPI";
import { ChatInput } from "./ChatInput";
import { MouseTrackingEyeRef } from "./MouseTrackingEye";
import { Skeleton } from "./ui/skeleton";
import { ToolsMessageView, UserMessageView } from "./MultiChat";
import { filterReplyMessageSets } from "@ui/lib/replyUtils";

interface ReplyChatProps {
    chatId: string;
    replyToId: string; // The ID of the message being replied to
}

export default function ReplyChat({ chatId, replyToId }: ReplyChatProps) {
    const chatQuery = ChatAPI.useChat(chatId);
    const messageSetsQuery = MessageAPI.useMessageSets(chatId);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const eyeRef = useRef<MouseTrackingEyeRef>(null);
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    const [showScrollbar, setShowScrollbar] = useState(false);

    const handleMouseEnter = () => {
        setShowScrollbar(true);
    };

    const handleMouseLeave = () => {
        setShowScrollbar(false);
    };

    const repliedToMessage = (() => {
        if (!messageSetsQuery.data) return;

        for (const messageSet of messageSetsQuery.data) {
            const foundMessage = messageSet.toolsBlock.chatMessages.find(
                (message) => message.branchedFromId === replyToId,
            );
            if (foundMessage) return foundMessage;
        }
    })();

    // Filter message sets to only show those created after the chat was created
    // This excludes the copied message sets from the original chat
    const replyMessageSets = filterReplyMessageSets(
        messageSetsQuery.data,
        chatQuery.data,
    );

    // Remove auto-scroll when new messages are added to allow users to scroll up while streaming

    // Auto-scroll to bottom when reply thread is first opened
    useEffect(() => {
        if (
            scrollContainerRef.current &&
            !chatQuery.isLoading &&
            !messageSetsQuery.isLoading
        ) {
            // Small timeout to ensure DOM is fully rendered
            setTimeout(() => {
                if (scrollContainerRef.current) {
                    scrollContainerRef.current.scrollTop =
                        scrollContainerRef.current.scrollHeight;
                }
            }, 50);
        }
    }, [chatQuery.isLoading, messageSetsQuery.isLoading]);

    if (chatQuery.isLoading || messageSetsQuery.isLoading) {
        return (
            <div className="flex items-center justify-center h-full">
                <Skeleton className="h-4 w-32" />
            </div>
        );
    }

    if (!chatQuery.data || !messageSetsQuery.data) {
        return null;
    }

    const currentMessageSet =
        messageSetsQuery.data[messageSetsQuery.data.length - 1];

    return (
        <div
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            className={`flex flex-col h-full`}
        >
            {/* Messages container with proper scrolling */}
            <div
                ref={scrollContainerRef}
                className={`flex-1 overflow-y-scroll min-h-0 ${showScrollbar ? "" : "invisible-scrollbar"}`}
            >
                <div className="pl-4 pr-3 pt-4 pb-3">
                    {/* Show the replied-to message first if we have one */}
                    {repliedToMessage && (
                        <div className="flex w-full select-none">
                            <ToolsMessageView
                                message={repliedToMessage}
                                isQuickChatWindow={false}
                                isLastRow={false}
                                isOnlyMessage={true}
                                isReply={true}
                            />
                        </div>
                    )}

                    <div className="pt-6 pb-2 shrink-0">
                        <p className="text-sm font-medium text-muted-foreground">
                            Replies are not added to context.
                        </p>
                    </div>

                    {/* Show only NEW messages in this reply thread (created after the chat) */}
                    {replyMessageSets.length > 0 && (
                        <div className="space-y-2">
                            {replyMessageSets.map(
                                (replyMessageSet, replyMessageSetIndex) => (
                                    <div
                                        key={replyMessageSet.id}
                                        className="space-y-4"
                                    >
                                        {/* Show user messages from new message sets in the reply thread */}
                                        {replyMessageSet.userBlock.message && (
                                            <div
                                                className="flex w-full max-w-prose select-none pt-2"
                                                data-message-id={
                                                    replyMessageSet.userBlock
                                                        .message.id
                                                }
                                            >
                                                <UserMessageView
                                                    message={
                                                        replyMessageSet
                                                            .userBlock.message
                                                    }
                                                    isQuickChatWindow={false}
                                                />
                                            </div>
                                        )}

                                        {/* Show AI messages from the reply thread */}
                                        {replyMessageSet.toolsBlock.chatMessages
                                            .filter(
                                                (message) => message.selected,
                                            )
                                            .map((message) => (
                                                <div
                                                    key={message.id}
                                                    className="flex w-full select-none pt-2"
                                                    data-message-id={message.id}
                                                >
                                                    <ToolsMessageView
                                                        message={message}
                                                        isQuickChatWindow={
                                                            false
                                                        }
                                                        isLastRow={
                                                            replyMessageSetIndex ===
                                                            replyMessageSets.length -
                                                                1
                                                        }
                                                        isOnlyMessage={true}
                                                        isReply={true}
                                                    />
                                                </div>
                                            ))}
                                    </div>
                                ),
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Input - with dedicated space */}
            <div className="shrink-0">
                <ChatInput
                    isNewChat={false}
                    chatId={chatId}
                    inputRef={inputRef}
                    eyeRef={eyeRef}
                    currentMessageSet={currentMessageSet}
                    scrollToLatestMessageSet={() => {
                        if (scrollContainerRef.current) {
                            // Scroll the new message to the top of the screen
                            const messages =
                                scrollContainerRef.current.querySelectorAll(
                                    "[data-message-id]",
                                );
                            const lastMessage = messages[messages.length - 1];
                            if (lastMessage) {
                                lastMessage.scrollIntoView({
                                    behavior: "smooth",
                                    block: "start",
                                });
                            }
                        }
                    }}
                    isReply={true}
                    defaultReplyToModel={repliedToMessage?.model}
                />
            </div>
        </div>
    );
}

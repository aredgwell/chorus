import { Chat } from "@core/chorus/api/ChatAPI";
import { MessageSetDetail } from "@core/chorus/ChatState";

export function filterReplyMessageSets(
    messageSets: MessageSetDetail[] | undefined,
    chat: Chat | undefined,
    includeAIMessageSets: boolean = true,
) {
    if (!messageSets || !chat) return [];

    const chatCreatedAt = new Date(chat.createdAt).getTime();

    return messageSets.filter((messageSet) => {
        const messageSetCreatedAt = new Date(messageSet.createdAt).getTime();

        return (
            messageSetCreatedAt > chatCreatedAt &&
            (includeAIMessageSets || messageSet.type !== "ai")
        );
    });
}

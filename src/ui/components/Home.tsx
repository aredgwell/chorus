import { useAppContext } from "@ui/hooks/useAppContext";
import RetroSpinner from "./ui/retro-spinner";
import * as ChatAPI from "@core/chorus/api/ChatAPI";
import { useEffect } from "react";

export default function Home() {
    const { isQuickChatWindow } = useAppContext();
    const getOrCreateNewQuickChat = ChatAPI.useGetOrCreateNewQuickChat();

    // Quick chat windows still auto-create a chat
    useEffect(() => {
        if (isQuickChatWindow && getOrCreateNewQuickChat.isIdle) {
            getOrCreateNewQuickChat.mutate();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    if (isQuickChatWindow) {
        return (
            <div className="flex h-full items-center justify-center">
                <RetroSpinner />
            </div>
        );
    }

    // In the three-pane layout, Home shows an empty state
    return (
        <div className="flex h-full items-center justify-center text-muted-foreground">
            <p>Select a note or chat</p>
        </div>
    );
}

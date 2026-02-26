import { useAppContext } from "@ui/hooks/useAppContext";
import RetroSpinner from "./ui/retro-spinner";
import * as ChatAPI from "@core/chorus/api/ChatAPI";
import { useEffect } from "react";

export default function Home() {
    const { isQuickChatWindow } = useAppContext();
    const getOrCreateNewChat = ChatAPI.useGetOrCreateNewChat();
    const getOrCreateNewQuickChat = ChatAPI.useGetOrCreateNewQuickChat();

    useEffect(() => {
        if (isQuickChatWindow && getOrCreateNewQuickChat.isIdle) {
            getOrCreateNewQuickChat.mutate();
        } else if (!isQuickChatWindow && getOrCreateNewChat.isIdle) {
            // Automatically create a new chat and redirect
            getOrCreateNewChat.mutate({ projectId: "default" });
        }
        // We need to disable hooks so this doesn't run on re-renders
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Show spinner while creating/redirecting
    return (
        <div className="flex h-full items-center justify-center">
            <RetroSpinner />
        </div>
    );
}

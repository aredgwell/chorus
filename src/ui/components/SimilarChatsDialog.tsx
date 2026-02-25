import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "./ui/dialog";
import { dialogActions, useDialogStore } from "@core/infra/DialogStore";
import { findSimilarChats, SimilarChat } from "@core/chorus/EmbeddingService";
import { chatQueries } from "@core/chorus/api/ChatAPI";
import { useQueryClient } from "@tanstack/react-query";
import RetroSpinner from "./ui/retro-spinner";
import { convertDate, displayDate } from "@ui/lib/utils";

export const SIMILAR_CHATS_DIALOG_ID = "similar-chats-dialog";

export function SimilarChatsDialog() {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const isOpen = useDialogStore(
        (state) => state.activeDialogId === SIMILAR_CHATS_DIALOG_ID,
    );
    const [results, setResults] = useState<SimilarChat[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | undefined>();
    const [chatId, setChatId] = useState<string | undefined>();

    // Expose a way for callers to trigger a search
    useEffect(() => {
        const handler = (e: CustomEvent<{ chatId: string }>) => {
            setChatId(e.detail.chatId);
        };
        window.addEventListener(
            "find-similar-chats" as string,
            handler as EventListener,
        );
        return () =>
            window.removeEventListener(
                "find-similar-chats" as string,
                handler as EventListener,
            );
    }, []);

    useEffect(() => {
        if (!isOpen || !chatId) return;
        let cancelled = false;

        const run = async () => {
            setLoading(true);
            setError(undefined);
            setResults([]);

            const chat = await queryClient.ensureQueryData(
                chatQueries.detail(chatId),
            );
            if (!chat?.summary) {
                setError(
                    "This chat has no summary yet. Generate a summary first, then try again.",
                );
                setLoading(false);
                return;
            }

            try {
                const similar = await findSimilarChats(chat.summary, 10, chatId);
                if (!cancelled) {
                    setResults(similar);
                }
            } catch (err) {
                if (!cancelled) {
                    setError(String(err));
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        };

        void run();
        return () => {
            cancelled = true;
        };
    }, [isOpen, chatId, queryClient]);

    const handleClick = useCallback(
        (targetChatId: string) => {
            dialogActions.closeDialog();
            navigate(`/chat/${targetChatId}`);
        },
        [navigate],
    );

    return (
        <Dialog id={SIMILAR_CHATS_DIALOG_ID}>
            <DialogContent className="sm:max-w-lg p-5 max-h-[70vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Similar conversations</DialogTitle>
                    <DialogDescription>
                        Chats with the most similar content based on AI
                        embeddings.
                    </DialogDescription>
                </DialogHeader>

                {loading && (
                    <div className="flex items-center gap-2 py-4">
                        <RetroSpinner />
                        <span className="text-sm text-muted-foreground">
                            Searching for similar chats...
                        </span>
                    </div>
                )}

                {error && (
                    <p className="text-sm text-muted-foreground py-4">
                        {error}
                    </p>
                )}

                {!loading && !error && results.length === 0 && (
                    <p className="text-sm text-muted-foreground py-4">
                        No similar chats found.
                    </p>
                )}

                {results.length > 0 && (
                    <ul className="space-y-1">
                        {results.map((r) => (
                            <li key={r.chatId}>
                                <button
                                    className="w-full text-left px-3 py-2 rounded-md hover:bg-accent transition-colors"
                                    onClick={() => handleClick(r.chatId)}
                                >
                                    <div className="text-sm font-medium truncate">
                                        {r.title || "Untitled Chat"}
                                    </div>
                                    <div className="text-xs text-muted-foreground flex gap-2">
                                        <span>
                                            Similarity:{" "}
                                            {(
                                                (1 - r.distance) *
                                                100
                                            ).toFixed(0)}
                                            %
                                        </span>
                                        {r.updatedAt && (
                                            <span>
                                                {displayDate(
                                                    convertDate(r.updatedAt),
                                                )}
                                            </span>
                                        )}
                                    </div>
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
            </DialogContent>
        </Dialog>
    );
}

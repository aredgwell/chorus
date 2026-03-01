import { useSetSelectedCollectionId } from "@core/chorus/api/AppMetadataAPI";
import { chatQueries } from "@core/chorus/api/ChatAPI";
import { noteQueries } from "@core/chorus/api/NoteAPI";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";

/**
 * Auto-syncs the selected collection with the current route.
 * When the user navigates to a chat or note (e.g. via command menu or deep link),
 * this hook updates selectedCollectionId to match the item's projectId,
 * so the middle pane stays in sync.
 *
 * Only triggers on route changes — not when the user manually selects a collection.
 */
export function useAutoSyncCollection() {
    const location = useLocation();
    const setSelectedCollectionId = useSetSelectedCollectionId();
    const chatsQuery = useQuery(chatQueries.list());
    const notesQuery = useQuery(noteQueries.list());
    const prevPathname = useRef(location.pathname);

    useEffect(() => {
        // Only sync when the route actually changes (user navigated)
        if (location.pathname === prevPathname.current) return;
        prevPathname.current = location.pathname;

        const chatMatch = location.pathname.match(/^\/chat\/(.+)$/);
        const noteMatch = location.pathname.match(/^\/note\/(.+)$/);

        if (chatMatch) {
            const chatId = chatMatch[1];
            const chat = (chatsQuery.data ?? []).find((c) => c.id === chatId);
            if (chat) {
                setSelectedCollectionId.mutate(chat.projectId);
            }
        } else if (noteMatch) {
            const noteId = noteMatch[1];
            const note = (notesQuery.data ?? []).find((n) => n.id === noteId);
            if (note) {
                setSelectedCollectionId.mutate(note.projectId);
            }
        }
    }, [
        location.pathname,
        chatsQuery.data,
        notesQuery.data,
        setSelectedCollectionId,
    ]);
}

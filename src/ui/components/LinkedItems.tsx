import type { Chat } from "@core/chorus/api/ChatAPI";
import { chatQueries } from "@core/chorus/api/ChatAPI";
import type { Note } from "@core/chorus/api/NoteAPI";
import { noteQueries } from "@core/chorus/api/NoteAPI";
import {
    useDeleteLink,
    useLinksForChat,
    useLinksForNote,
} from "@core/chorus/api/NoteChatLinkAPI";
import { useQuery } from "@tanstack/react-query";
import { FileTextIcon, LinkIcon,MessageSquareIcon, XIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface LinkedItemsProps {
    noteId?: string;
    chatId?: string;
}

/**
 * Renders linked chats (when given noteId) or linked notes (when given chatId)
 * as compact chips with navigation and unlink actions.
 */
export function LinkedItems({ noteId, chatId }: LinkedItemsProps) {
    const noteLinksQuery = useLinksForNote(noteId);
    const chatLinksQuery = useLinksForChat(chatId);
    const deleteLink = useDeleteLink();
    const navigate = useNavigate();

    // Look up all chats/notes to resolve titles
    const chatsQuery = useQuery(chatQueries.list());
    const notesQuery = useQuery(noteQueries.list());

    const allChats = chatsQuery.data ?? [];
    const allNotes = notesQuery.data ?? [];

    const chatsById = new Map(allChats.map((c) => [c.id, c]));
    const notesById = new Map(allNotes.map((n) => [n.id, n]));

    // When viewing a note, show linked chats
    const linkedChats: { chat: Chat; linkNoteId: string }[] = [];
    if (noteId && noteLinksQuery.data) {
        for (const link of noteLinksQuery.data) {
            const chat = chatsById.get(link.chatId);
            if (chat) {
                linkedChats.push({ chat, linkNoteId: link.noteId });
            }
        }
    }

    // When viewing a chat, show linked notes
    const linkedNotes: { note: Note; linkChatId: string }[] = [];
    if (chatId && chatLinksQuery.data) {
        for (const link of chatLinksQuery.data) {
            const note = notesById.get(link.noteId);
            if (note) {
                linkedNotes.push({ note, linkChatId: link.chatId });
            }
        }
    }

    const hasLinks = linkedChats.length > 0 || linkedNotes.length > 0;
    if (!hasLinks) return null;

    return (
        <div className="linked-items-container">
            <LinkIcon className="size-3 text-muted-foreground shrink-0" />
            {linkedChats.map(({ chat, linkNoteId }) => (
                <span key={chat.id} className="linked-item-chip">
                    <MessageSquareIcon className="size-3 shrink-0" />
                    <button
                        type="button"
                        className="linked-item-name"
                        onClick={() => navigate(`/chat/${chat.id}`)}
                    >
                        {chat.title || "Untitled Chat"}
                    </button>
                    <button
                        type="button"
                        className="linked-item-remove"
                        onClick={() =>
                            void deleteLink.mutateAsync({
                                noteId: linkNoteId,
                                chatId: chat.id,
                            })
                        }
                    >
                        <XIcon size={10} />
                    </button>
                </span>
            ))}
            {linkedNotes.map(({ note, linkChatId }) => (
                <span key={note.id} className="linked-item-chip">
                    <FileTextIcon className="size-3 shrink-0" />
                    <button
                        type="button"
                        className="linked-item-name"
                        onClick={() => navigate(`/note/${note.id}`)}
                    >
                        {note.title || "Untitled Note"}
                    </button>
                    <button
                        type="button"
                        className="linked-item-remove"
                        onClick={() =>
                            void deleteLink.mutateAsync({
                                noteId: note.id,
                                chatId: linkChatId,
                            })
                        }
                    >
                        <XIcon size={10} />
                    </button>
                </span>
            ))}
        </div>
    );
}

import { type Chat } from "@core/chorus/api/ChatAPI";
import { type Note } from "@core/chorus/api/NoteAPI";

export type SidebarItem =
    | { type: "chat"; data: Chat }
    | { type: "note"; data: Note };

export function sidebarItemUpdatedAt(item: SidebarItem): string {
    return item.data.updatedAt || item.data.createdAt;
}

export function sidebarItemTitle(item: SidebarItem): string {
    return item.data.title || "";
}

export function sidebarItemIsPinned(item: SidebarItem): boolean {
    return item.data.pinned;
}

export type SortMode = "date" | "name" | "type";

export function sortItems(
    items: SidebarItem[],
    sortMode: SortMode,
): SidebarItem[] {
    const sorted = [...items];
    if (sortMode === "name") {
        sorted.sort((a, b) => {
            const aPinned = sidebarItemIsPinned(a);
            const bPinned = sidebarItemIsPinned(b);
            if (aPinned !== bPinned) return aPinned ? -1 : 1;
            return sidebarItemTitle(a).localeCompare(sidebarItemTitle(b));
        });
    } else if (sortMode === "type") {
        sorted.sort((a, b) => {
            const aPinned = sidebarItemIsPinned(a);
            const bPinned = sidebarItemIsPinned(b);
            if (aPinned !== bPinned) return aPinned ? -1 : 1;
            if (a.type !== b.type) {
                return a.type === "note" ? -1 : 1;
            }
            return (
                new Date(sidebarItemUpdatedAt(b)).getTime() -
                new Date(sidebarItemUpdatedAt(a)).getTime()
            );
        });
    } else {
        sorted.sort((a, b) => {
            const aPinned = sidebarItemIsPinned(a);
            const bPinned = sidebarItemIsPinned(b);
            if (aPinned !== bPinned) return aPinned ? -1 : 1;
            return (
                new Date(sidebarItemUpdatedAt(b)).getTime() -
                new Date(sidebarItemUpdatedAt(a)).getTime()
            );
        });
    }
    return sorted;
}

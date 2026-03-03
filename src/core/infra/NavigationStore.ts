import { create } from "zustand";

export interface NavigableItem {
    type: "note" | "chat";
    id: string;
}

interface NavigationStore {
    /** Ordered list of items currently visible in the middle pane */
    visibleItems: NavigableItem[];
}

export const useNavigationStore = create<NavigationStore>(() => ({
    visibleItems: [],
}));

/** Set the visible items list (called by ListPane when items change) */
export const setVisibleItems = (items: NavigableItem[]) =>
    useNavigationStore.setState({ visibleItems: items });

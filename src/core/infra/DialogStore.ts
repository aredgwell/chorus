import { create } from "zustand";

interface DialogStore {
    activeDialogId: string | null;
    /** Which settings tab to show when the settings dialog opens */
    pendingSettingsTab: string | undefined;
    openDialog: (id: string) => void;
    closeDialog: (id?: string) => void;
    setPendingSettingsTab: (tab: string | undefined) => void;
}

const useDialogStore = create<DialogStore>((set, _get) => ({
    activeDialogId: null,
    pendingSettingsTab: undefined,
    openDialog: (id) => set({ activeDialogId: id }),
    closeDialog: (id) =>
        set((state) => {
            // Only close if no ID provided or if the ID matches
            if (!id || state.activeDialogId === id) {
                return { activeDialogId: null, pendingSettingsTab: undefined };
            }
            return state;
        }),
    setPendingSettingsTab: (tab) => set({ pendingSettingsTab: tab }),
}));

// Export stable actions that won't cause re-renders
export const dialogActions = {
    openDialog: (id: string) => useDialogStore.getState().openDialog(id),
    closeDialog: (id?: string) => useDialogStore.getState().closeDialog(id),
    openSettings: (tab: string) => {
        useDialogStore.getState().setPendingSettingsTab(tab);
        useDialogStore.getState().openDialog("settings");
    },
};

export { useDialogStore };

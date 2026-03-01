import { db } from "@core/chorus/DB";
import { ToolPermissionType } from "@core/chorus/Toolsets";
import { create } from "zustand";

export interface ToolPermissionRequest {
    id: string;
    toolsetName: string;
    toolName: string;
    toolDescription?: string;
    args: Record<string, unknown>;
    modelName: string;
    timestamp: Date;
    _resolver?: (allowed: boolean) => void;
}

interface ToolPermissionStore {
    pendingRequests: ToolPermissionRequest[];
    currentRequest: ToolPermissionRequest | null;

    addRequest: (request: ToolPermissionRequest) => void;
    processNextRequest: () => void;
    resolveCurrentRequest: (
        permission: "allow" | "deny",
        savePreference: boolean,
        preferenceType?: ToolPermissionType,
    ) => Promise<void>;
    clearRequests: () => void;
}

const useToolPermissionStore = create<ToolPermissionStore>()((set, get) => ({
    pendingRequests: [],
    currentRequest: null,

    addRequest: (request) => {
        set((state) => ({
            pendingRequests: [...state.pendingRequests, request],
        }));

        // If no current request, process immediately
        const { currentRequest } = get();
        if (!currentRequest) {
            get().processNextRequest();
        }
    },

    processNextRequest: () => {
        const { pendingRequests } = get();
        if (pendingRequests.length > 0) {
            const [next, ...remaining] = pendingRequests;
            set({
                currentRequest: next,
                pendingRequests: remaining,
            });
        }
    },

    resolveCurrentRequest: async (
        permission,
        savePreference,
        preferenceType,
    ) => {
        const { currentRequest } = get();
        if (!currentRequest) return;

        // Save permission preference if requested
        if (savePreference && preferenceType) {
            try {
                const now = new Date().toISOString();
                await db.execute(
                    `INSERT OR REPLACE INTO tool_permissions 
                    (toolset_name, tool_name, permission_type, last_asked_at, last_response, created_at, updated_at) 
                    VALUES (?, ?, ?, ?, ?, 
                        COALESCE((SELECT created_at FROM tool_permissions WHERE toolset_name = ? AND tool_name = ?), ?),
                        ?)`,
                    [
                        currentRequest.toolsetName,
                        currentRequest.toolName,
                        preferenceType,
                        permission ? now : null,
                        permission || null,
                        currentRequest.toolsetName,
                        currentRequest.toolName,
                        now,
                        now,
                    ],
                );
            } catch (error) {
                console.error(
                    "Failed to save tool permission preference:",
                    error,
                );
            }
        }

        // Resolve the permission request
        if (currentRequest._resolver) {
            currentRequest._resolver(permission === "allow");
        }

        // Clear current request and process next
        set({ currentRequest: null });
        get().processNextRequest();
    },

    clearRequests: () => {
        set({
            pendingRequests: [],
            currentRequest: null,
        });
    },
}));

// Export stable actions
export const toolPermissionActions = {
    addRequest: (request: ToolPermissionRequest) =>
        useToolPermissionStore.getState().addRequest(request),
    resolveCurrentRequest: (
        permission: "allow" | "deny",
        savePreference: boolean,
        preferenceType?: ToolPermissionType,
    ) =>
        useToolPermissionStore
            .getState()
            .resolveCurrentRequest(permission, savePreference, preferenceType),
    clearRequests: () => useToolPermissionStore.getState().clearRequests(),
};

export { useToolPermissionStore };

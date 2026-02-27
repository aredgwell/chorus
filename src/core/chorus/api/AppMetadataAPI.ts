import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { db } from "../DB";
import { SettingsManager } from "@core/utilities/Settings";
import * as Models from "../Models";

export const appMetadataKeys = {
    appMetadata: () => ["appMetadata"] as const,
};

export async function fetchAppMetadata(): Promise<Record<string, string>> {
    return (
        await db.select<{ key: string; value: string }[]>(
            `SELECT * FROM app_metadata`,
        )
    ).reduce(
        (acc, row) => {
            acc[row.key] = row.value;
            return acc;
        },
        {} as Record<string, string>,
    );
}

export function useAppMetadata() {
    return useQuery({
        queryKey: appMetadataKeys.appMetadata(),
        queryFn: async () =>
            (
                await db.select<{ key: string; value: string }[]>(
                    "SELECT key, value FROM app_metadata",
                )
            ).reduce(
                (acc, { key, value }) => {
                    acc[key] = value;
                    return acc;
                },
                {} as Record<string, string>,
            ),
    });
}

export function useSkipOnboarding() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationKey: ["skipOnboarding"] as const,
        mutationFn: async () => {
            await db.execute(
                "UPDATE app_metadata SET value = 'true' WHERE key = 'has_dismissed_onboarding'",
            );
        },
        onSuccess: async () => {
            await queryClient.invalidateQueries({
                queryKey: appMetadataKeys.appMetadata(),
            });
        },
    });
}

export function useSetOnboardingStep() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationKey: ["setOnboardingStep"] as const,
        mutationFn: async ({ step }: { step: number }) => {
            await db.execute(
                "INSERT OR REPLACE INTO app_metadata (key, value) VALUES (?, ?)",
                ["onboarding_step", step.toString()],
            );
        },
        onSuccess: async () => {
            await queryClient.invalidateQueries({
                queryKey: appMetadataKeys.appMetadata(),
            });
        },
    });
}

export function useOnboardingStep() {
    const { data: appMetadata } = useAppMetadata();
    const stepValue = appMetadata?.["onboarding_step"];
    return stepValue ? parseInt(stepValue, 10) : 0;
}

export function useSetShowOpenRouter() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationKey: ["setShowOpenRouter"] as const,
        mutationFn: async (show: boolean) => {
            await db.execute(
                "INSERT OR REPLACE INTO app_metadata (key, value) VALUES (?, ?)",
                ["show_openrouter", show ? "true" : "false"],
            );
        },
        onSuccess: async () => {
            await queryClient.invalidateQueries({
                queryKey: appMetadataKeys.appMetadata(),
            });
        },
    });
}

export function useShowOpenRouter() {
    const { data: appMetadata } = useAppMetadata();
    return appMetadata?.["show_openrouter"] === "true";
}

export function useHasDismissedOnboarding() {
    const { data: appMetadata } = useAppMetadata();
    return appMetadata?.["has_dismissed_onboarding"] === "true";
}

export function useDismissedAlertVersion() {
    const { data: appMetadata } = useAppMetadata();
    return appMetadata?.["dismissed_alert_version"];
}

export function useSetDismissedAlertVersion() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationKey: ["setDismissedAlertVersion"] as const,
        mutationFn: async ({ version }: { version: string }) => {
            await db.execute(
                "INSERT OR REPLACE INTO app_metadata (key, value) VALUES (?, ?)",
                ["dismissed_alert_version", version],
            );
        },
        onSuccess: async () => {
            await queryClient.invalidateQueries({
                queryKey: appMetadataKeys.appMetadata(),
            });
        },
    });
}

export function useYoloMode() {
    const { data: appMetadata } = useAppMetadata();
    return {
        data: appMetadata?.["yolo_mode"] === "true",
    };
}

export function useSetYoloMode() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationKey: ["setYoloMode"] as const,
        mutationFn: async (enabled: boolean) => {
            await db.execute(
                "INSERT OR REPLACE INTO app_metadata (key, value) VALUES (?, ?)",
                ["yolo_mode", enabled ? "true" : "false"],
            );
        },
        onSuccess: async () => {
            await queryClient.invalidateQueries({
                queryKey: appMetadataKeys.appMetadata(),
            });
        },
    });
}

export function useSetVisionModeEnabled() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationKey: ["setVisionModeEnabled"] as const,
        mutationFn: async (enabled: boolean) => {
            await db.execute(
                "UPDATE app_metadata SET value = $1 WHERE key = 'vision_mode_enabled'",
                [enabled ? "true" : "false"],
            );
        },
        onSuccess: async () => {
            await queryClient.invalidateQueries({
                queryKey: appMetadataKeys.appMetadata(),
            });
        },
    });
}

export async function getApiKeys() {
    const settingsManager = SettingsManager.getInstance();
    return (await settingsManager.getApiKeys()) as Models.ApiKeys;
}

export async function getCustomBaseUrl() {
    const result = await db.select<{ value: string }[]>(
        "SELECT value FROM app_metadata WHERE key = 'custom_base_url'",
    );
    return result[0]?.value || undefined;
}

/**
 * Hook to access the custom base URL
 */
export function useCustomBaseUrl() {
    const { data: appMetadata } = useAppMetadata();
    return appMetadata?.["custom_base_url"];
}

/**
 * Hook to set the custom base URL
 */
export function useSetCustomBaseUrl() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationKey: ["setCustomBaseUrl"] as const,
        mutationFn: async (url: string) => {
            if (url) {
                await db.execute(
                    "INSERT OR REPLACE INTO app_metadata (key, value) VALUES (?, ?)",
                    ["custom_base_url", url],
                );
            } else {
                await db.execute(
                    "DELETE FROM app_metadata WHERE key = 'custom_base_url'",
                );
            }
        },
        onSuccess: async () => {
            await queryClient.invalidateQueries({
                queryKey: appMetadataKeys.appMetadata(),
            });
            // Also invalidate API keys since they might depend on the base URL
            await queryClient.invalidateQueries({
                queryKey: ["apiKeys"],
            });
        },
    });
}

/**
 * Hook to access the user's API keys
 */
export function useApiKeys() {
    return useQuery({
        queryKey: ["apiKeys"],
        queryFn: getApiKeys,
    });
}

export function useZoomLevel() {
    const { data: appMetadata } = useAppMetadata();
    return parseFloat(appMetadata?.["zoom_level"] || "100");
}

export function useSetZoomLevel() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationKey: ["setZoomLevel"] as const,
        mutationFn: async (zoomLevel: number) => {
            await db.execute(
                "INSERT OR REPLACE INTO app_metadata (key, value) VALUES (?, ?)",
                ["zoom_level", zoomLevel.toString()],
            );
        },
        onSuccess: async () => {
            await queryClient.invalidateQueries({
                queryKey: appMetadataKeys.appMetadata(),
            });
        },
    });
}

export function useSelectedCollectionId(): string | undefined {
    const { data: appMetadata } = useAppMetadata();
    return appMetadata?.["selected_collection_id"] || undefined;
}

export function useSetSelectedCollectionId() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationKey: ["setSelectedCollectionId"] as const,
        mutationFn: async (collectionId: string | undefined) => {
            if (collectionId) {
                await db.execute(
                    "INSERT OR REPLACE INTO app_metadata (key, value) VALUES (?, ?)",
                    ["selected_collection_id", collectionId],
                );
            } else {
                await db.execute(
                    "DELETE FROM app_metadata WHERE key = 'selected_collection_id'",
                );
            }
        },
        onMutate: async (collectionId) => {
            // Optimistic update for instant UI feedback
            await queryClient.cancelQueries({
                queryKey: appMetadataKeys.appMetadata(),
            });
            const previous = queryClient.getQueryData<
                Record<string, string>
            >(appMetadataKeys.appMetadata());
            queryClient.setQueryData<Record<string, string>>(
                appMetadataKeys.appMetadata(),
                (old) => {
                    const updated = { ...old };
                    if (collectionId) {
                        updated["selected_collection_id"] = collectionId;
                    } else {
                        delete updated["selected_collection_id"];
                    }
                    return updated;
                },
            );
            return { previous };
        },
        onError: (_err, _variables, context) => {
            if (context?.previous) {
                queryClient.setQueryData(
                    appMetadataKeys.appMetadata(),
                    context.previous,
                );
            }
        },
        onSettled: async () => {
            await queryClient.invalidateQueries({
                queryKey: appMetadataKeys.appMetadata(),
            });
        },
    });
}

export type SidebarSortMode = "date" | "name" | "type";

export function useSidebarSortMode(): SidebarSortMode {
    const { data: appMetadata } = useAppMetadata();
    const value = appMetadata?.["sidebar_sort_mode"];
    if (value === "name" || value === "type") return value;
    return "date";
}

export function useSetSidebarSortMode() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationKey: ["setSidebarSortMode"] as const,
        mutationFn: async (mode: SidebarSortMode) => {
            await db.execute(
                "INSERT OR REPLACE INTO app_metadata (key, value) VALUES (?, ?)",
                ["sidebar_sort_mode", mode],
            );
        },
        onSuccess: async () => {
            await queryClient.invalidateQueries({
                queryKey: appMetadataKeys.appMetadata(),
            });
        },
    });
}

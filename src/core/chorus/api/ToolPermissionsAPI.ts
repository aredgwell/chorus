import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { db } from "../DB";
import { ToolPermission, ToolPermissionType } from "../Toolsets";

export const toolPermissionsKeys = {
    toolPermissions: () => ["tool_permissions"] as const,
    toolPermission: (toolsetName: string, toolName: string) =>
        [
            ...toolPermissionsKeys.toolPermissions(),
            toolsetName,
            toolName,
        ] as const,
};

export type ToolPermissionDBRow = {
    toolset_name: string;
    tool_name: string;
    permission_type: string;
    last_asked_at: string | null;
    last_response: string | null;
    created_at: string;
    updated_at: string;
};

function readToolPermission(row: ToolPermissionDBRow): ToolPermission {
    return {
        toolsetName: row.toolset_name,
        toolName: row.tool_name,
        permissionType: row.permission_type as ToolPermissionType,
        lastAskedAt: row.last_asked_at
            ? new Date(row.last_asked_at)
            : undefined,
        lastResponse: row.last_response as "allow" | "deny" | undefined,
    };
}

export async function fetchToolPermission(
    toolsetName: string,
    toolName: string,
): Promise<ToolPermission | undefined> {
    const rows = await db.select<ToolPermissionDBRow[]>(
        "SELECT * FROM tool_permissions WHERE toolset_name = ? AND tool_name = ?",
        [toolsetName, toolName],
    );

    return rows.length > 0 ? readToolPermission(rows[0]) : undefined;
}

export async function fetchAllToolPermissions(): Promise<ToolPermission[]> {
    const rows = await db.select<ToolPermissionDBRow[]>(
        "SELECT * FROM tool_permissions ORDER BY toolset_name, tool_name",
    );

    return rows.map(readToolPermission);
}

export function useToolPermission(toolsetName: string, toolName: string) {
    return useQuery({
        queryKey: toolPermissionsKeys.toolPermission(toolsetName, toolName),
        queryFn: () => fetchToolPermission(toolsetName, toolName),
    });
}

export function useAllToolPermissions() {
    return useQuery({
        queryKey: toolPermissionsKeys.toolPermissions(),
        queryFn: fetchAllToolPermissions,
    });
}

export function useUpsertToolPermission() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationKey: ["upsertToolPermission"] as const,
        mutationFn: async ({
            toolsetName,
            toolName,
            permissionType,
            lastResponse,
        }: {
            toolsetName: string;
            toolName: string;
            permissionType: ToolPermissionType;
            lastResponse?: "allow" | "deny";
        }) => {
            const now = new Date().toISOString();

            await db.execute(
                `INSERT OR REPLACE INTO tool_permissions 
                (toolset_name, tool_name, permission_type, last_asked_at, last_response, created_at, updated_at) 
                VALUES (?, ?, ?, ?, ?, 
                    COALESCE((SELECT created_at FROM tool_permissions WHERE toolset_name = ? AND tool_name = ?), ?),
                    ?)`,
                [
                    toolsetName,
                    toolName,
                    permissionType,
                    lastResponse ? now : null,
                    lastResponse || null,
                    toolsetName,
                    toolName,
                    now,
                    now,
                ],
            );
        },
        onSuccess: async (_, variables) => {
            // Invalidate both the specific permission and all permissions
            await queryClient.invalidateQueries({
                queryKey: toolPermissionsKeys.toolPermission(
                    variables.toolsetName,
                    variables.toolName,
                ),
            });
            await queryClient.invalidateQueries({
                queryKey: toolPermissionsKeys.toolPermissions(),
            });
        },
    });
}

export function useDeleteToolPermission() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationKey: ["deleteToolPermission"] as const,
        mutationFn: async ({
            toolsetName,
            toolName,
        }: {
            toolsetName: string;
            toolName: string;
        }) => {
            await db.execute(
                "DELETE FROM tool_permissions WHERE toolset_name = ? AND tool_name = ?",
                [toolsetName, toolName],
            );
        },
        onSuccess: async (_, variables) => {
            // Invalidate both the specific permission and all permissions
            await queryClient.invalidateQueries({
                queryKey: toolPermissionsKeys.toolPermission(
                    variables.toolsetName,
                    variables.toolName,
                ),
            });
            await queryClient.invalidateQueries({
                queryKey: toolPermissionsKeys.toolPermissions(),
            });
        },
    });
}

// Helper function to check if a tool execution should be allowed
export async function checkToolPermission(
    toolsetName: string,
    toolName: string,
    defaultPermission: ToolPermissionType = "ask",
): Promise<{
    shouldAsk: boolean;
    isAllowed: boolean;
    permission: ToolPermission | undefined;
}> {
    const permission = await fetchToolPermission(toolsetName, toolName);

    if (!permission) {
        // No saved permission, use default
        return {
            shouldAsk: defaultPermission === "ask",
            isAllowed: defaultPermission === "always_allow",
            permission: undefined,
        };
    }

    return {
        shouldAsk: permission.permissionType === "ask",
        isAllowed: permission.permissionType === "always_allow",
        permission,
    };
}

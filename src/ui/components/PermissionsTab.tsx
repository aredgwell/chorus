import * as AppMetadataAPI from "@core/chorus/api/AppMetadataAPI";
import * as ToolPermissionsAPI from "@core/chorus/api/ToolPermissionsAPI";
import { getToolsetIcon } from "@core/chorus/Toolsets";
import { ToolPermissionType } from "@core/chorus/Toolsets";
import { QuestionMarkCircledIcon } from "@radix-ui/react-icons";
import { Badge } from "@ui/components/ui/badge";
import { Button } from "@ui/components/ui/button";
import { Card, CardContent } from "@ui/components/ui/card";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@ui/components/ui/dropdown-menu";
import { Label } from "@ui/components/ui/label";
import { Separator } from "@ui/components/ui/separator";
import { Switch } from "@ui/components/ui/switch";
import { cn } from "@ui/lib/utils";
import { BanIcon, CheckIcon,DoorOpenIcon, Trash2 } from "lucide-react";
import React from "react";

export const PermissionsTab: React.FC = () => {
    const { data: permissions, isLoading } =
        ToolPermissionsAPI.useAllToolPermissions();
    const deletePermission = ToolPermissionsAPI.useDeleteToolPermission();
    const upsertPermission = ToolPermissionsAPI.useUpsertToolPermission();

    const { data: yoloMode } = AppMetadataAPI.useYoloMode();
    const setYoloMode = AppMetadataAPI.useSetYoloMode();

    const groupedPermissions = (() => {
        if (!permissions) return {};

        return permissions.reduce(
            (acc, perm) => {
                if (!acc[perm.toolsetName]) {
                    acc[perm.toolsetName] = [];
                }
                acc[perm.toolsetName].push(perm);
                return acc;
            },
            {} as Record<string, typeof permissions>,
        );
    })();

    const handleDelete = (toolsetName: string, toolName: string) => {
        deletePermission.mutate({ toolsetName, toolName });
    };

    const handleChangePermission = (
        toolsetName: string,
        toolName: string,
        newType: ToolPermissionType,
    ) => {
        upsertPermission.mutate({
            toolsetName,
            toolName,
            permissionType: newType,
        });
    };

    const getPermissionIcon = (type: ToolPermissionType) => {
        switch (type) {
            case "always_allow":
                return <CheckIcon className="w-4 h-4 text-muted-foreground" />;
            case "always_deny":
                return <BanIcon className="w-4 h-4 text-muted-foreground" />;
            case "ask":
                return (
                    <QuestionMarkCircledIcon className="w-4 h-4 text-muted-foreground" />
                );
        }
    };

    const getPermissionBadge = (type: ToolPermissionType) => {
        switch (type) {
            case "always_allow":
                return <Badge variant="outline">Always Allow</Badge>;
            case "always_deny":
                return <Badge variant="outline">Always Deny</Badge>;
            case "ask":
                return <Badge variant="outline">Ask Each Time</Badge>;
        }
    };

    if (isLoading) {
        return (
            <div className="text-muted-foreground">Loading permissions...</div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="space-y-4">
                <div className="space-y-2">
                    <h2 className="text-2xl font-semibold">Tool Permissions</h2>
                    <p className="text-muted-foreground">
                        Manage how AI models can use tools. Permissions are
                        checked before each tool execution.
                    </p>
                </div>

                <Card className="border-dashed">
                    <CardContent className="flex items-center justify-between p-4">
                        <div className="flex items-center gap-3">
                            <DoorOpenIcon className="w-5 h-5 text-special-foreground" />
                            <div>
                                <Label
                                    htmlFor="yolo-mode"
                                    className={cn(
                                        "text-base font-semibold cursor-pointer",
                                        yoloMode && "shimmer",
                                    )}
                                >
                                    YOLO Mode
                                </Label>
                                <p className="text-sm text-muted-foreground">
                                    Automatically accept all tool requests
                                </p>
                            </div>
                        </div>
                        <Switch
                            id="yolo-mode"
                            checked={yoloMode ?? false}
                            onCheckedChange={(checked) =>
                                setYoloMode.mutate(checked)
                            }
                        />
                    </CardContent>
                </Card>
            </div>

            {yoloMode && Object.keys(groupedPermissions).length > 0 && (
                <div className="mt-4 p-4 bg-muted rounded-lg flex items-center gap-2">
                    <p className="text-sm text-muted-foreground">
                        YOLO Mode is enabled. All tool permissions below are
                        bypassed.
                    </p>
                </div>
            )}

            {Object.keys(groupedPermissions).length === 0 ? (
                <Card>
                    <CardContent className="text-center py-8">
                        <p className="text-muted-foreground">
                            Tool permissions will appear here after you use
                            tools and save your preferences.
                        </p>
                    </CardContent>
                </Card>
            ) : (
                <div
                    className={cn(
                        "space-y-4",
                        yoloMode && "opacity-50 pointer-events-none",
                    )}
                >
                    {Object.entries(groupedPermissions).map(
                        ([toolsetName, toolsetPermissions]) => (
                            <Card key={toolsetName}>
                                <CardContent className="p-6">
                                    <div className="flex items-center gap-2 mb-4">
                                        {getToolsetIcon(toolsetName)}
                                        <h3 className="font-semibold text-lg capitalize">
                                            {toolsetName}
                                        </h3>
                                    </div>

                                    <div className="space-y-3">
                                        {toolsetPermissions.map((perm) => (
                                            <div
                                                key={`${perm.toolsetName}-${perm.toolName}`}
                                            >
                                                <div className="flex items-center justify-between">
                                                    <div className="flex-1">
                                                        <Label className="font-mono text-sm">
                                                            {perm.toolsetName}_
                                                            {perm.toolName}
                                                        </Label>
                                                        {perm.lastAskedAt && (
                                                            <p className="text-xs text-muted-foreground mt-1">
                                                                Last used:{" "}
                                                                {new Date(
                                                                    perm.lastAskedAt,
                                                                ).toLocaleDateString()}
                                                            </p>
                                                        )}
                                                    </div>

                                                    <div className="flex items-center gap-2">
                                                        <DropdownMenu>
                                                            <DropdownMenuTrigger
                                                                asChild
                                                                disabled={
                                                                    yoloMode
                                                                }
                                                            >
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    className="gap-2"
                                                                    disabled={
                                                                        yoloMode
                                                                    }
                                                                >
                                                                    {getPermissionIcon(
                                                                        perm.permissionType,
                                                                    )}
                                                                    {getPermissionBadge(
                                                                        perm.permissionType,
                                                                    )}
                                                                </Button>
                                                            </DropdownMenuTrigger>
                                                            <DropdownMenuContent align="end">
                                                                <DropdownMenuItem
                                                                    onClick={() =>
                                                                        handleChangePermission(
                                                                            perm.toolsetName,
                                                                            perm.toolName,
                                                                            "always_allow",
                                                                        )
                                                                    }
                                                                >
                                                                    <span className="mr-2">
                                                                        {getPermissionIcon(
                                                                            "always_allow",
                                                                        )}
                                                                    </span>
                                                                    Always Allow
                                                                </DropdownMenuItem>
                                                                <DropdownMenuItem
                                                                    onClick={() =>
                                                                        handleChangePermission(
                                                                            perm.toolsetName,
                                                                            perm.toolName,
                                                                            "ask",
                                                                        )
                                                                    }
                                                                >
                                                                    <span className="mr-2">
                                                                        {getPermissionIcon(
                                                                            "ask",
                                                                        )}
                                                                    </span>
                                                                    Ask Each
                                                                    Time
                                                                </DropdownMenuItem>
                                                                <DropdownMenuItem
                                                                    onClick={() =>
                                                                        handleChangePermission(
                                                                            perm.toolsetName,
                                                                            perm.toolName,
                                                                            "always_deny",
                                                                        )
                                                                    }
                                                                >
                                                                    <span className="mr-2">
                                                                        {getPermissionIcon(
                                                                            "always_deny",
                                                                        )}
                                                                    </span>
                                                                    Always Deny
                                                                </DropdownMenuItem>
                                                            </DropdownMenuContent>
                                                        </DropdownMenu>

                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() =>
                                                                handleDelete(
                                                                    perm.toolsetName,
                                                                    perm.toolName,
                                                                )
                                                            }
                                                            disabled={yoloMode}
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </Button>
                                                    </div>
                                                </div>
                                                <Separator className="mt-3" />
                                            </div>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>
                        ),
                    )}
                </div>
            )}
        </div>
    );
};

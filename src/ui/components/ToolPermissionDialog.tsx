import React, { useState, useEffect } from "react";
import {
    AlertDialog,
    AlertDialogContent,
    AlertDialogHeader,
    AlertDialogFooter,
    AlertDialogTitle,
    AlertDialogDescription,
    AlertDialogAction,
    AlertDialogCancel,
} from "@ui/components/ui/alert-dialog";
import {
    useToolPermissionStore,
    toolPermissionActions,
} from "@core/infra/ToolPermissionStore";
import { getToolsetIcon } from "@core/chorus/Toolsets";
import { Checkbox } from "@ui/components/ui/checkbox";
import { Label } from "@ui/components/ui/label";
import { BanIcon, CheckIcon, ShieldCheckIcon } from "lucide-react";
import { useShortcut } from "@ui/hooks/useShortcut";
import { useQueryClient } from "@tanstack/react-query";
import { toolPermissionsKeys } from "@core/chorus/api/ToolPermissionsAPI";
import Lowlight from "react-lowlight";

export const ToolPermissionDialog: React.FC = () => {
    const currentRequest = useToolPermissionStore(
        (state) => state.currentRequest,
    );
    const [savePreference, setSavePreference] = useState(false);
    const queryClient = useQueryClient();

    // Reset the checkbox to unchecked whenever a new request appears
    useEffect(() => {
        setSavePreference(false);
    }, [currentRequest]);

    const handleAllow = () => {
        if (!currentRequest) return;
        void toolPermissionActions.resolveCurrentRequest(
            "allow",
            savePreference,
            savePreference ? "always_allow" : undefined,
        );

        // Invalidate the queries to refresh the permissions list
        if (savePreference) {
            void queryClient.invalidateQueries({
                queryKey: toolPermissionsKeys.toolPermissions(),
            });
        }
    };

    const handleDeny = () => {
        if (!currentRequest) return;
        void toolPermissionActions.resolveCurrentRequest(
            "deny",
            savePreference,
            savePreference ? "always_deny" : undefined,
        );

        // Invalidate the queries to refresh the permissions list
        if (savePreference) {
            void queryClient.invalidateQueries({
                queryKey: toolPermissionsKeys.toolPermissions(),
            });
        }
    };

    // Only register shortcuts when there's an active request
    useShortcut(["enter"], handleAllow, {
        isGlobal: currentRequest !== null,
        enableOnChatFocus: false,
    });
    useShortcut(["escape"], handleDeny, {
        isGlobal: currentRequest !== null,
        enableOnChatFocus: false,
    });

    if (!currentRequest) {
        return null;
    }

    const formatArgs = (args: Record<string, unknown>) => {
        try {
            return JSON.stringify(args, null, 2);
        } catch {
            return "<unable to format arguments>";
        }
    };

    return (
        <AlertDialog open={true}>
            <AlertDialogContent className="max-w-lg max-h-[90vh] flex flex-col">
                <AlertDialogHeader className="shrink-0">
                    <AlertDialogTitle className="flex items-center gap-2">
                        <ShieldCheckIcon className="w-4 h-4" />
                        Tool Request
                    </AlertDialogTitle>
                </AlertDialogHeader>
                <AlertDialogDescription className="flex-1 overflow-y-auto min-h-0">
                    <div className="space-y-3">
                        <div>
                            <span className="font-medium">
                                {currentRequest.modelName}
                            </span>{" "}
                            wants to use:
                        </div>

                        <div className="bg-muted/50 rounded p-3 space-y-1">
                            <div className="flex items-center gap-2">
                                {getToolsetIcon(currentRequest.toolsetName)}
                                <span className="font-mono text-sm">
                                    {currentRequest.toolsetName}_
                                    {currentRequest.toolName}
                                </span>
                            </div>
                            {currentRequest.toolDescription && (
                                <p className="text-xs text-muted-foreground pl-5">
                                    {currentRequest.toolDescription}
                                </p>
                            )}
                        </div>

                        <div className="">
                            <p className="text-sm text-muted-foreground">
                                With parameters:
                            </p>
                            <div className="relative max-h-32 overflow-auto hljs-container rounded">
                                <div className="p-2 [&_pre]:m-0! [&_pre]:p-0! [&_pre]:bg-transparent! [&_pre]:overflow-visible! [&_pre_code]:whitespace-pre-wrap! [&_pre_code]:break-all!">
                                    <Lowlight
                                        language="json"
                                        value={formatArgs(currentRequest.args)}
                                        markers={[]}
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="space-y-3 pt-2">
                            <div className="flex items-center space-x-2">
                                <Checkbox
                                    id="save-preference"
                                    checked={savePreference}
                                    onCheckedChange={(checked) =>
                                        setSavePreference(!!checked)
                                    }
                                />
                                <Label
                                    htmlFor="save-preference"
                                    className="text-sm font-normal cursor-pointer"
                                >
                                    Remember my preference
                                </Label>
                            </div>
                        </div>
                    </div>
                </AlertDialogDescription>
                <AlertDialogFooter className="shrink-0 border-t pt-4">
                    <AlertDialogCancel
                        variant="outline"
                        className="text-muted-foreground"
                        onClick={() => void handleDeny()}
                    >
                        <BanIcon className="w-4 h-4" />
                        Deny{" "}
                        <span className="ml-2 text-muted-foreground">ESC</span>
                    </AlertDialogCancel>
                    <AlertDialogAction
                        variant="default"
                        onClick={() => void handleAllow()}
                    >
                        <CheckIcon className="w-4 h-4" />
                        Allow <span className="ml-2 text-background">↵</span>
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
};

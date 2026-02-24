import { LogsIcon, PlugIcon, PlusIcon } from "lucide-react";
import {
    Command,
    CommandDialog,
    CommandEmpty,
    CommandInput,
    CommandList,
} from "./ui/command";

import { Switch } from "@ui/components/ui/switch";
import { Button } from "./ui/button";
import RetroSpinner from "./ui/retro-spinner";
import { ArrowRightIcon, Loader2 } from "lucide-react";
import { getToolsetIcon } from "@core/chorus/Toolsets";
import { ToolsetConfig, Toolset } from "@core/chorus/Toolsets";
import { openUrl } from "@tauri-apps/plugin-opener";
import { DotFilledIcon } from "@radix-ui/react-icons";
import { CommandGroup, CommandItem } from "./ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { emit } from "@tauri-apps/api/event";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";
import { useShortcut } from "@ui/hooks/useShortcut";
import { dialogActions, useDialogStore } from "@core/infra/DialogStore";
import * as ToolsetsAPI from "@core/chorus/api/ToolsetsAPI";

export const TOOLS_BOX_DIALOG_ID = "tools-box";

function ToolsetRow({
    toolset,
    config,
}: {
    toolset: Toolset;
    config: ToolsetConfig | undefined;
}) {
    const updateMCPConfig = ToolsetsAPI.useUpdateToolsetsConfig();

    const isEnabled = config?.[toolset.name]?.["enabled"] === "true";

    const toggleToolset = () => {
        if (toolset.areRequiredParamsFilled(config)) {
            updateMCPConfig.mutate({
                toolsetName: toolset.name,
                parameterId: "enabled",
                value: isEnabled ? "false" : "true",
            });
        } else if (toolset.link) {
            void openUrl(toolset.link);
        }
    };

    return (
        <CommandItem
            className="flex items-center justify-between py-2 px-2"
            onSelect={toggleToolset}
        >
            <div className="flex items-center gap-4 flex-1">
                <div className="flex-1">
                    <div className="flex items-center gap-2">
                        {getToolsetIcon(toolset.name)}
                        <span className="font-medium">
                            {toolset.displayName}
                        </span>
                        {toolset.status.status === "stopped" ? (
                            <div className="flex items-center gap-1">
                                <DotFilledIcon className="w-3 h-3 text-gray-500" />
                            </div>
                        ) : toolset.status.status === "starting" ? (
                            <div className="flex items-center gap-1 text-gray-500 animate-pulse">
                                <Loader2 className="w-3 h-3 animate-spin" />
                                <span className="text-sm">Starting...</span>
                            </div>
                        ) : toolset.status.status === "running" ? (
                            <div className="flex items-center gap-1">
                                <DotFilledIcon className="w-3 h-3 text-green-500" />
                            </div>
                        ) : null}

                        {isEnabled && !toolset.isBuiltIn && toolset.logs && (
                            <Popover>
                                <PopoverTrigger
                                    asChild
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-5 w-5"
                                        aria-label="Show logs"
                                    >
                                        <LogsIcon className="w-3 h-3" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent
                                    className="w-96"
                                    onClick={(e) => e.stopPropagation()} // Prevent closing popover when clicking inside
                                >
                                    <div className="grid gap-4">
                                        <div className="space-y-2">
                                            <h4 className="font-medium leading-none">
                                                Server Logs
                                            </h4>
                                        </div>
                                        <div className="max-h-60 overflow-y-auto">
                                            <pre className="text-sm whitespace-pre-wrap break-all font-geist-mono">
                                                {toolset.logs || "No logs."}
                                            </pre>
                                        </div>
                                    </div>
                                </PopoverContent>
                            </Popover>
                        )}
                    </div>
                    <p className="text-muted-foreground">
                        {toolset.description}
                    </p>
                </div>
            </div>
            <div className="flex items-center gap-3 ml-2">
                {toolset.areRequiredParamsFilled(config) ? (
                    <Switch
                        checked={isEnabled}
                        onCheckedChange={(enabled) =>
                            updateMCPConfig.mutate({
                                toolsetName: toolset.name,
                                parameterId: "enabled",
                                value: enabled ? "true" : "false",
                            })
                        }
                        onClick={(e) => e.stopPropagation()}
                    />
                ) : toolset.link ? (
                    <Button
                        onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                            e.stopPropagation();
                            if (toolset.link) {
                                void openUrl(toolset.link);
                            }
                        }}
                        variant="ghost"
                        size={"sm"}
                    >
                        Set up <ArrowRightIcon className="w-3 h-3" />
                    </Button>
                ) : (
                    <>Set up not yet implemented</>
                )}
            </div>
        </CommandItem>
    );
}

function ToolsBoxContent() {
    const toolsetConfigs = ToolsetsAPI.useToolsetsConfig();
    const toolsets = ToolsetsAPI.useToolsets();

    if (toolsetConfigs.isError || toolsets.isError) {
        return (
            <div>
                Error loading integrations: {toolsetConfigs.error?.message}
                {toolsets.error?.message}
            </div>
        );
    }

    if (toolsetConfigs.isLoading || toolsets.isLoading) {
        return <RetroSpinner />;
    }

    return (
        <Command>
            <CommandInput placeholder="Search integrations..." autoFocus />
            <CommandList>
                <CommandEmpty>No integrations found.</CommandEmpty>
                <CommandGroup heading="Built-in">
                    {toolsets.data
                        ?.filter((toolset) => toolset.isBuiltIn)
                        .map((toolset) => (
                            <ToolsetRow
                                key={toolset.name}
                                toolset={toolset}
                                config={toolsetConfigs.data}
                            />
                        ))}
                </CommandGroup>
                <CommandGroup
                    heading={
                        <div className="flex items-center justify-between w-full">
                            <span>Custom</span>

                            <button
                                className="text-sm p-1 hover:bg-gray-100 rounded flex items-center gap-1 uppercase tracking-wider font-geist-mono"
                                onClick={(e) => {
                                    e.preventDefault();
                                    // Emit an event to open settings with integrations tab
                                    void emit("open_settings", {
                                        tab: "api-keys",
                                    });
                                }}
                            >
                                <PlusIcon className="w-3 h-3" />
                                <span>Add</span>
                            </button>
                        </div>
                    }
                >
                    {toolsets.data
                        ?.filter((toolset) => !toolset.isBuiltIn)
                        .map((toolset) => (
                            <ToolsetRow
                                key={toolset.name}
                                toolset={toolset}
                                config={toolsetConfigs.data}
                            />
                        ))}

                    <CommandItem
                        onSelect={() => {
                            // Emit an event to open settings with integrations tab
                            void emit("open_settings", {
                                tab: "api-keys",
                            });
                        }}
                    >
                        <div className="flex justify-between w-full items-center gap-1">
                            <div className="flex items-center gap-1">
                                <PlusIcon className="w-3 h-3 mr-1 text-muted-foreground" />
                                <span className="font-medium">
                                    Add integration
                                </span>
                            </div>
                            <ArrowRightIcon className="w-3 h-3 text-muted-foreground" />
                        </div>
                    </CommandItem>
                </CommandGroup>
            </CommandList>
        </Command>
    );
}

function ToolsBox() {
    const toolsets = ToolsetsAPI.useToolsets();
    const toolsBoxIsOpen = useDialogStore(
        (state) => state.activeDialogId === TOOLS_BOX_DIALOG_ID,
    );

    useShortcut(
        ["meta", "t"],
        () => {
            if (toolsBoxIsOpen) {
                dialogActions.closeDialog();
            } else {
                dialogActions.openDialog(TOOLS_BOX_DIALOG_ID);
            }
        },
        {
            isGlobal: true,
        },
    );

    const enabledToolsets =
        toolsets.data?.filter(
            (toolset) => toolset.status.status === "running",
        ) || [];

    return (
        <>
            <button
                className="inline-flex bg-muted items-center justify-center rounded-full h-7 pl-2 text-sm hover:bg-muted/80 px-3 py-1 ring-offset-background placeholder:text-muted-foreground focus:outline-hidden disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1 shrink-0"
                aria-label="Manage tools"
                onClick={() => dialogActions.openDialog(TOOLS_BOX_DIALOG_ID)}
            >
                <div className="flex items-center gap-0.5">
                    <PlugIcon className="w-3 h-3 text-muted-foreground mr-0.5" />
                    <div className="flex items-center">
                        {enabledToolsets.slice(0, 4).map((toolset, index) => (
                            <Tooltip key={toolset.name}>
                                <TooltipTrigger asChild>
                                    <div
                                        key={toolset.name}
                                        className={`w-5 h-5 rounded-full bg-background flex items-center justify-center -ml-1.5 first:ml-0 border border-border shadow-xs ${
                                            toolset.status.status !== "running"
                                                ? "opacity-50"
                                                : ""
                                        }`}
                                        style={{
                                            zIndex:
                                                enabledToolsets.length - index,
                                        }}
                                    >
                                        <div className="w-3 h-3">
                                            {getToolsetIcon(toolset.name)}
                                        </div>
                                    </div>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p>{toolset.displayName}</p>

                                    <div className="flex items-center gap-1">
                                        {toolset.status.status === "running" ? (
                                            <DotFilledIcon className="w-3 h-3 text-green-500" />
                                        ) : (
                                            <DotFilledIcon className="w-3 h-3 text-red-500" />
                                        )}
                                    </div>
                                </TooltipContent>
                            </Tooltip>
                        ))}
                    </div>
                    <span className="pl-0.5">Tools</span>
                    <span className="ml-1 text-muted-foreground font-light">
                        ⌘T
                    </span>
                </div>
            </button>

            <CommandDialog id={TOOLS_BOX_DIALOG_ID}>
                <ToolsBoxContent />
            </CommandDialog>
        </>
    );
}

export default ToolsBox;

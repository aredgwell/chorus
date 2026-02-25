import React from "react";
import { Button } from "./ui/button";
import {
    PictureInPicture2Icon,
    SquarePen,
    XIcon,
} from "lucide-react";
import { TooltipContent, Tooltip, TooltipTrigger } from "./ui/tooltip";
import { MouseTrackingEye, MouseTrackingEyeRef } from "./MouseTrackingEye";
import { QuickChatModelSelector } from "./QuickChatModelSelector";
import { useCallback } from "react";
import * as ModelsAPI from "@core/chorus/api/ModelsAPI";
import * as MessageAPI from "@core/chorus/api/MessageAPI";

function ModelSelectorWrapper() {
    const modelConfigsQuery = ModelsAPI.useModelConfigs();
    const updateSelectedModelConfigQuickChat =
        MessageAPI.useUpdateSelectedModelConfigQuickChat();

    const handleModelSelect = useCallback(
        (modelId: string) => {
            console.log("ModelSelector: selecting model", modelId);
            const modelConfig = modelConfigsQuery.data?.find(
                (m) => m.id === modelId,
            );
            if (modelConfig) {
                updateSelectedModelConfigQuickChat.mutate({
                    modelConfig,
                });
            }
        },
        [modelConfigsQuery, updateSelectedModelConfigQuickChat],
    );

    return <QuickChatModelSelector onModelSelect={handleModelSelect} />;
}

export function QuickChatHeaderBar({
    visionModeEnabled,
    eyeRef,
    onClose,
    onToggleVisionMode,
    onOpenInMainWindow,
    onNewAmbientChat,
}: {
    visionModeEnabled: boolean;
    eyeRef: React.RefObject<MouseTrackingEyeRef | null>;
    onClose: () => void;
    onToggleVisionMode: () => void;
    onOpenInMainWindow: () => void;
    onNewAmbientChat: () => void;
}) {
    return (
        <div
            className={`h-10 flex items-center justify-between px-2 rounded-t-xl`}
            data-tauri-drag-region
        >
            <Tooltip>
                <TooltipTrigger asChild>
                    <button
                        className={`p-1 rounded-full`}
                        onClick={onClose}
                        tabIndex={-1}
                    >
                        <XIcon className="w-3 h-3" />
                    </button>
                </TooltipTrigger>
                <TooltipContent>Close (ESC)</TooltipContent>
            </Tooltip>
            <div className="text-sm inline-flex ml-2 items-center gap-1">
                <ModelSelectorWrapper />
            </div>

            <div className="flex items-center gap-2 ml-auto text-sm font-[350]">
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button
                            className={`bg-transparent text-foreground px-3 rounded-full ${
                                visionModeEnabled
                                    ? "bg-accent-600 text-primary-foreground"
                                    : "hover:bg-muted-foreground/10"
                            }
                                transition-all duration-200`}
                            size="iconSm"
                            onClick={onToggleVisionMode}
                            tabIndex={-1}
                        >
                            <span
                                className={`hover:text-foreground/75 ${
                                    visionModeEnabled
                                        ? "text-foreground/80"
                                        : "text-foreground/75"
                                }`}
                            >
                                <span className="text-sm font-mono">
                                    ⌘I
                                </span>{" "}
                                {visionModeEnabled && (
                                    <span className="ml-1">
                                        Vision Mode Enabled
                                    </span>
                                )}
                            </span>
                            <MouseTrackingEye
                                ref={eyeRef}
                                canBlink={true}
                                isOpen={visionModeEnabled}
                            />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                        {visionModeEnabled ? (
                            <>Chorus can see your screen</>
                        ) : (
                            <>
                                Enable vision mode to show Chorus your
                                screen
                            </>
                        )}
                    </TooltipContent>
                </Tooltip>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button
                            className="bg-transparent text-foreground hover:bg-muted-foreground/10"
                            size="iconSm"
                            onClick={onOpenInMainWindow}
                            tabIndex={-1}
                        >
                            <span className="text-[10px] text-foreground/75">
                                ⌘O
                            </span>
                            <PictureInPicture2Icon className="w-3.5! h-3.5!" />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>Open in main window</TooltipContent>
                </Tooltip>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button
                            size="iconSm"
                            className="bg-transparent text-foreground hover:bg-muted-foreground/10"
                            onClick={onNewAmbientChat}
                            tabIndex={-1}
                        >
                            <span className="text-[10px] text-foreground/75">
                                ⌘N
                            </span>
                            <SquarePen className="w-3.5! h-3.5!" />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>New ambient chat</TooltipContent>
                </Tooltip>
            </div>
        </div>
    );
}

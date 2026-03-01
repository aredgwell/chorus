import { ModelConfig } from "@core/chorus/Models";
import { dialogActions } from "@core/infra/DialogStore";
import { BoxIcon } from "lucide-react";

import { ProviderLogo } from "./ui/provider-logo";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";

export function ManageModelsButtonCompare({
    selectedModelConfigs,
    dialogId,
    showShortcut = true,
}: {
    selectedModelConfigs?: ModelConfig[];
    dialogId: string;
    showShortcut?: boolean;
}) {
    return (
        <button
            className="inline-flex bg-muted items-center justify-center rounded-full h-7 pl-2 text-sm hover:bg-muted/80 px-3 py-1 ring-offset-background placeholder:text-muted-foreground focus:outline-hidden disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1 shrink-0"
            onClick={() => dialogActions.openDialog(dialogId)}
            aria-label="Add or manage models"
        >
            <div className="flex items-center gap-0.5">
                {/* Only show box icon when there are no models selected */}
                {selectedModelConfigs && selectedModelConfigs.length === 0 && (
                    <BoxIcon className="w-3 h-3 text-muted-foreground mr-0.5" />
                )}

                {selectedModelConfigs && selectedModelConfigs.length > 0 && (
                    <div className="flex items-center">
                        {selectedModelConfigs
                            .slice(0, 4)
                            .map((modelConfig, index) => (
                                <Tooltip key={modelConfig.id}>
                                    <TooltipTrigger asChild>
                                        <div
                                            className={`w-5 h-5 rounded-full bg-background flex items-center justify-center -ml-1.5 first:ml-0 border border-border shadow-xs`}
                                            style={{
                                                zIndex:
                                                    selectedModelConfigs.length -
                                                    index,
                                            }}
                                        >
                                            <div className="w-3 h-3">
                                                <ProviderLogo
                                                    modelId={
                                                        modelConfig.modelId
                                                    }
                                                    size="xs"
                                                />
                                            </div>
                                        </div>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        <p>{modelConfig.displayName}</p>
                                    </TooltipContent>
                                </Tooltip>
                            ))}
                    </div>
                )}

                {/* Show "Models" text when no models or multiple models, show model name when single model */}
                {selectedModelConfigs && selectedModelConfigs?.length === 1 ? (
                    <span className="pl-0.5">
                        {selectedModelConfigs[0].displayName}
                    </span>
                ) : selectedModelConfigs && selectedModelConfigs.length > 1 ? (
                    <span className="pl-0.5">
                        {selectedModelConfigs.length} Models
                    </span>
                ) : (
                    <span className="pl-0.5">Models</span>
                )}

                {showShortcut && (
                    <span className="ml-1 text-muted-foreground font-light">
                        ⌘J
                    </span>
                )}
            </div>
        </button>
    );
}

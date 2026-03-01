import { MODEL_HANDLE_MAP } from "@core/chorus/api/GroupChatAPI";
import AutoExpandingTextarea from "@ui/components/AutoExpandingTextarea";
import ToolsBox from "@ui/components/ToolsBox";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@ui/components/ui/popover";
import { ProviderLogo } from "@ui/components/ui/provider-logo";
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "@ui/components/ui/tooltip";
import { useShortcut } from "@ui/hooks/useShortcut";
import { ArrowUp } from "lucide-react";
import { useRef, useState } from "react";

// NOTE: useRef is used here for (1) textarea focus via Cmd+L and
// (2) caret position tracking for @mention insertion. Both are standard
// DOM interaction patterns that don't introduce hidden state.

interface ComposerProps {
    onSend: (text: string) => void;
    chatId: string;
    disabled?: boolean;
}

// Build a display list of mentionable handles for the autocomplete popup
type MentionItem = {
    handle: string;
    displayName: string;
    isPreset: boolean;
    presetMembers?: string;
    modelId?: string;
};

function buildMentionItems(): MentionItem[] {
    const presets: MentionItem[] = [];
    const individual: MentionItem[] = [];
    const seen = new Set<string>();

    for (const [handle, modelIdOrIds] of Object.entries(MODEL_HANDLE_MAP)) {
        if (Array.isArray(modelIdOrIds)) {
            // Preset group
            presets.push({
                handle,
                displayName: handle.charAt(0).toUpperCase() + handle.slice(1),
                isPreset: true,
                presetMembers: modelIdOrIds
                    .map((id) => {
                        const parts = id.split("::");
                        return parts[1] || id;
                    })
                    .join(", "),
            });
        } else {
            // Skip duplicate handles that resolve to the same model
            if (seen.has(modelIdOrIds)) continue;
            seen.add(modelIdOrIds);

            const parts = modelIdOrIds.split("::");
            const modelShortName = parts[1] || modelIdOrIds;
            individual.push({
                handle,
                displayName: modelShortName,
                isPreset: false,
                modelId: modelIdOrIds,
            });
        }
    }

    return [...presets, ...individual];
}

const MENTION_ITEMS = buildMentionItems();
const DEFAULT_MODEL_ID = "anthropic::claude-sonnet-4-latest";

// ---------------------------------------------------------------------------
// Parse @mentions from text to build token pills
// ---------------------------------------------------------------------------

type MentionedModel = {
    handle: string;
    displayName: string;
    modelId?: string;
    isPreset: boolean;
};

function parseMentionedModels(text: string): MentionedModel[] {
    const lowerText = text.toLowerCase();
    const result: MentionedModel[] = [];
    const seenModelIds = new Set<string>();

    for (const [handle, modelIdOrIds] of Object.entries(MODEL_HANDLE_MAP)) {
        if (!lowerText.includes(`@${handle}`)) continue;

        if (Array.isArray(modelIdOrIds)) {
            // Preset — add each model individually
            for (const id of modelIdOrIds) {
                if (seenModelIds.has(id)) continue;
                seenModelIds.add(id);
                const parts = id.split("::");
                result.push({
                    handle,
                    displayName: parts[1] || id,
                    modelId: id,
                    isPreset: true,
                });
            }
        } else {
            if (seenModelIds.has(modelIdOrIds)) continue;
            seenModelIds.add(modelIdOrIds);
            const parts = modelIdOrIds.split("::");
            result.push({
                handle,
                displayName: parts[1] || modelIdOrIds,
                modelId: modelIdOrIds,
                isPreset: false,
            });
        }
    }

    return result;
}

// ---------------------------------------------------------------------------
// Model token pill component
// ---------------------------------------------------------------------------

function ModelTokenPill({
    model,
    onRemove,
}: {
    model: MentionedModel;
    onRemove?: () => void;
}) {
    return (
        <span
            className="inline-flex bg-muted items-center justify-center rounded-full h-7 text-sm hover:bg-muted/80 px-3 py-1 shrink-0 gap-1.5"
            onClick={onRemove}
        >
            {model.modelId && (
                <ProviderLogo modelId={model.modelId} size="xs" />
            )}
            <span>{model.displayName}</span>
        </span>
    );
}

// ---------------------------------------------------------------------------
// Default model pill (shown when no @mentions)
// ---------------------------------------------------------------------------

function DefaultModelPill({ onClick }: { onClick: () => void }) {
    return (
        <button
            className="inline-flex bg-muted items-center justify-center rounded-full h-7 text-sm hover:bg-muted/80 px-3 py-1 shrink-0 gap-1.5"
            onClick={onClick}
            type="button"
        >
            <ProviderLogo modelId={DEFAULT_MODEL_ID} size="xs" />
            <span>Claude Sonnet 4</span>
            <span className="ml-0.5 text-muted-foreground font-light">⌘J</span>
        </button>
    );
}

// ---------------------------------------------------------------------------
// Composer
// ---------------------------------------------------------------------------

export default function Composer({ onSend, disabled }: ComposerProps) {
    const [input, setInput] = useState("");
    const [showMentionPicker, setShowMentionPicker] = useState(false);
    const [mentionFilter, setMentionFilter] = useState("");
    const [isFocused, setIsFocused] = useState(false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Cmd+L to focus
    useShortcut(["meta", "l"], () => {
        textareaRef.current?.focus();
    });

    // Cmd+J to trigger @mention picker
    useShortcut(["meta", "j"], () => {
        const textarea = textareaRef.current;
        if (!textarea) return;
        textarea.focus();

        // Insert @ at cursor position to trigger mention picker
        const cursorPos = textarea.selectionStart ?? input.length;
        const before = input.slice(0, cursorPos);
        const after = input.slice(cursorPos);

        // Only insert @ if not already at an @ position
        if (!before.endsWith("@")) {
            const newInput = before + "@" + after;
            setInput(newInput);
            setShowMentionPicker(true);
            setMentionFilter("");

            requestAnimationFrame(() => {
                const newPos = cursorPos + 1;
                textarea.setSelectionRange(newPos, newPos);
            });
        }
    });

    const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const value = e.target.value;
        setInput(value);

        // Detect @ for mention autocomplete
        const cursorPos = e.target.selectionStart;
        const textBeforeCursor = value.slice(0, cursorPos);
        const atMatch = textBeforeCursor.match(/@(\w*)$/);

        if (atMatch) {
            setShowMentionPicker(true);
            setMentionFilter(atMatch[1].toLowerCase());
        } else {
            setShowMentionPicker(false);
        }
    };

    const handleMentionSelect = (handle: string) => {
        const textarea = textareaRef.current;
        const cursorPos = textarea?.selectionStart ?? input.length;
        const textBeforeCursor = input.slice(0, cursorPos);
        const textAfterCursor = input.slice(cursorPos);
        const newTextBefore = textBeforeCursor.replace(/@\w*$/, `@${handle} `);
        setInput(newTextBefore + textAfterCursor);
        setShowMentionPicker(false);

        // Refocus the textarea
        requestAnimationFrame(() => {
            textarea?.focus();
            const newPos = newTextBefore.length;
            textarea?.setSelectionRange(newPos, newPos);
        });
    };

    const handleSubmit = () => {
        if (!input.trim() || disabled) return;
        onSend(input.trim());
        setInput("");
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSubmit();
        }
    };

    const filteredItems = MENTION_ITEMS.filter(
        (item) =>
            item.handle.includes(mentionFilter) ||
            item.displayName.toLowerCase().includes(mentionFilter),
    );

    const hasContent = input.trim().length > 0;

    // Parse @mentions from input text to show as token pills
    const mentionedModels = parseMentionedModels(input);
    const hasMentions = mentionedModels.length > 0;

    return (
        <div className="bg-background border-t @3xl:px-4 px-7 @3xl:mx-auto @3xl:border-l @3xl:border-r @3xl:border-t @3xl:max-w-3xl pt-1 @3xl:rounded-t-lg @3xl:shadow-lg @3xl:has-focus:shadow-muted-foreground/10">
            {/* Input form */}
            <Popover
                open={showMentionPicker && filteredItems.length > 0}
                onOpenChange={setShowMentionPicker}
            >
                <PopoverTrigger asChild>
                    <div className="flex flex-col w-full mx-auto relative">
                        <AutoExpandingTextarea
                            ref={textareaRef}
                            value={input}
                            onChange={handleInputChange}
                            onKeyDown={handleKeyDown}
                            placeholder="Ask me anything..."
                            className="ring-0 placeholder:text-muted-foreground/50 font-[350] focus:outline-hidden pt-2 px-1.5 select-text max-h-[60vh] overflow-y-auto my-2 rounded-none p-0!"
                            disabled={disabled}
                            autoFocus
                            onFocus={() => setIsFocused(true)}
                            onBlur={() => setIsFocused(false)}
                        />

                        {/* ⌘L to focus hint */}
                        {!isFocused && (
                            <div className="absolute top-1 -right-1 p-1 text-sm text-muted-foreground/50 font-[350] bg-background/90 backdrop-blur-[1px] rounded-full px-2 py-1">
                                ⌘L to focus
                            </div>
                        )}
                    </div>
                </PopoverTrigger>
                <PopoverContent
                    className="w-72 p-1"
                    side="top"
                    align="start"
                    onOpenAutoFocus={(e) => e.preventDefault()}
                >
                    <div className="max-h-64 overflow-y-auto">
                        {filteredItems.map((item) => (
                            <button
                                key={item.handle}
                                className="flex items-center gap-2 w-full px-2 py-1.5 text-sm rounded hover:bg-muted text-left"
                                onMouseDown={(e) => {
                                    e.preventDefault(); // Prevent textarea blur
                                    handleMentionSelect(item.handle);
                                }}
                            >
                                {item.isPreset ? (
                                    <span className="w-4 h-4 flex items-center justify-center text-xs font-medium text-muted-foreground">
                                        #
                                    </span>
                                ) : (
                                    <ProviderLogo
                                        modelId={
                                            typeof MODEL_HANDLE_MAP[
                                                item.handle
                                            ] === "string"
                                                ? (MODEL_HANDLE_MAP[
                                                      item.handle
                                                  ] as string)
                                                : undefined
                                        }
                                        size="xs"
                                    />
                                )}
                                <div className="flex flex-col">
                                    <span className="font-medium">
                                        @{item.handle}
                                    </span>
                                    {item.presetMembers && (
                                        <span className="text-xs text-muted-foreground">
                                            {item.presetMembers}
                                        </span>
                                    )}
                                </div>
                            </button>
                        ))}
                    </div>
                </PopoverContent>
            </Popover>

            {/* Action bar */}
            <div className="flex py-3 w-full">
                <div className="flex justify-between w-full mx-auto">
                    {/* Left side: model tokens + tools */}
                    <div className="flex items-center gap-2 h-7 overflow-x-auto -mx-1 no-scrollbar overflow-y-hidden relative">
                        {hasMentions ? (
                            mentionedModels.map((model) => (
                                <ModelTokenPill
                                    key={model.modelId ?? model.handle}
                                    model={model}
                                />
                            ))
                        ) : (
                            <DefaultModelPill
                                onClick={() => {
                                    const textarea = textareaRef.current;
                                    if (!textarea) return;
                                    textarea.focus();
                                    const cursorPos =
                                        textarea.selectionStart ?? input.length;
                                    const before = input.slice(0, cursorPos);
                                    const after = input.slice(cursorPos);
                                    if (!before.endsWith("@")) {
                                        const newInput = before + "@" + after;
                                        setInput(newInput);
                                        setShowMentionPicker(true);
                                        setMentionFilter("");
                                        requestAnimationFrame(() => {
                                            const newPos = cursorPos + 1;
                                            textarea.setSelectionRange(
                                                newPos,
                                                newPos,
                                            );
                                        });
                                    }
                                }}
                            />
                        )}
                        <ToolsBox />
                    </div>

                    {/* Right side: send button */}
                    <div className="flex items-center gap-2 shrink-0 h-7">
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <button
                                    className={`flex items-center rounded-full p-1 transition-all duration-300 ease-out ${
                                        hasContent && !disabled
                                            ? "bg-primary text-background hover:scale-110 hover:shadow-lg scale-100 opacity-100 shadow-md hover:shadow-primary/25 active:scale-105"
                                            : "bg-muted text-muted-foreground cursor-not-allowed scale-95 opacity-70"
                                    }`}
                                    onClick={handleSubmit}
                                    type="button"
                                    disabled={!hasContent || disabled}
                                >
                                    <ArrowUp
                                        className={`size-4 transition-transform duration-300 ${
                                            hasContent && !disabled
                                                ? "scale-100"
                                                : "scale-90"
                                        }`}
                                        strokeWidth={2.5}
                                    />
                                </button>
                            </TooltipTrigger>
                            <TooltipContent>Send message ↵</TooltipContent>
                        </Tooltip>
                    </div>
                </div>
            </div>
        </div>
    );
}

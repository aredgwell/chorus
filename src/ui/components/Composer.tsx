import { useState, useRef, useCallback } from "react";
import { ArrowUp } from "lucide-react";
import AutoExpandingTextarea from "@ui/components/AutoExpandingTextarea";
import { useShortcut } from "@ui/hooks/useShortcut";
import { ProviderLogo } from "@ui/components/ui/provider-logo";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@ui/components/ui/popover";
import { MODEL_HANDLE_MAP } from "@core/chorus/api/GroupChatAPI";


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
                displayName:
                    handle.charAt(0).toUpperCase() + handle.slice(1),
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
            });
        }
    }

    return [...presets, ...individual];
}

const MENTION_ITEMS = buildMentionItems();

export default function Composer({ onSend, disabled }: ComposerProps) {
    const [input, setInput] = useState("");
    const [showMentionPicker, setShowMentionPicker] = useState(false);
    const [mentionFilter, setMentionFilter] = useState("");
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Cmd+L to focus
    useShortcut(["meta", "l"], () => {
        textareaRef.current?.focus();
    });

    const handleInputChange = useCallback(
        (e: React.ChangeEvent<HTMLTextAreaElement>) => {
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
        },
        [],
    );

    const handleMentionSelect = useCallback(
        (handle: string) => {
            const textarea = textareaRef.current;
            const cursorPos = textarea?.selectionStart ?? input.length;
            const textBeforeCursor = input.slice(0, cursorPos);
            const textAfterCursor = input.slice(cursorPos);
            const newTextBefore = textBeforeCursor.replace(
                /@\w*$/,
                `@${handle} `,
            );
            setInput(newTextBefore + textAfterCursor);
            setShowMentionPicker(false);

            // Refocus the textarea
            requestAnimationFrame(() => {
                textarea?.focus();
                const newPos = newTextBefore.length;
                textarea?.setSelectionRange(newPos, newPos);
            });
        },
        [input],
    );

    const handleSubmit = useCallback(() => {
        if (!input.trim() || disabled) return;
        onSend(input.trim());
        setInput("");
    }, [input, disabled, onSend]);

    const handleKeyDown = useCallback(
        (e: React.KeyboardEvent) => {
            if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit();
            }
        },
        [handleSubmit],
    );

    const filteredItems = MENTION_ITEMS.filter(
        (item) =>
            item.handle.includes(mentionFilter) ||
            item.displayName.toLowerCase().includes(mentionFilter),
    );

    const hasContent = input.trim().length > 0;

    return (
        <div className="border-t px-4 py-3">
            <div className="flex items-end gap-2 max-w-3xl mx-auto">
                <Popover
                    open={showMentionPicker && filteredItems.length > 0}
                    onOpenChange={setShowMentionPicker}
                >
                    <PopoverTrigger asChild>
                        <div className="flex-1 relative">
                            <AutoExpandingTextarea
                                ref={textareaRef}
                                value={input}
                                onChange={handleInputChange}
                                onKeyDown={handleKeyDown}
                                placeholder="Type a message, @mention models, drag in files"
                                className="w-full border rounded-lg px-3 py-2 text-sm bg-background focus-visible:ring-1 focus-visible:ring-ring"
                                disabled={disabled}
                                autoFocus
                            />
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

                <button
                    className={`flex items-center justify-center rounded-full p-1.5 transition-all duration-200 shrink-0 ${
                        hasContent && !disabled
                            ? "bg-primary text-background hover:scale-110 shadow-md"
                            : "bg-muted text-muted-foreground cursor-not-allowed opacity-70"
                    }`}
                    onClick={handleSubmit}
                    disabled={!hasContent || disabled}
                    type="button"
                >
                    <ArrowUp className="size-4" />
                </button>
            </div>
        </div>
    );
}

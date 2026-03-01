import { useDialogStore } from "@core/infra/DialogStore";
import { useInputStore } from "@core/infra/InputStore";
import { useCallback,useEffect } from "react";

type ShortcutHandler = (event: KeyboardEvent) => void;

/**
 * Hook for mounting a keyboard shortcut
 * Keyboard shortcuts are scoped to the current component's lifecycle.
 * By default, if a dialog is open, the shortcut will be disabled.
 * You can override this by setting the `isGlobal` option to true.
 */
export function useShortcut(
    combo: string[],
    callback: () => void,
    options?: {
        // defaults to true
        // keeps the shortcut enabled when the main chat input is focused
        enableOnChatFocus?: boolean;
        // defaults to []
        // list of open dialog IDs this shortcut will be enabled on
        enableOnDialogIds?: string[] | null;
        // defaults to false
        // use to enable this shortcut globally, overriding any other options
        // "global" here means the scope the shortcut is declared in
        // if its parent component is torn down, the shortcut will be removed
        isGlobal?: boolean;
    },
) {
    const keys = combo.map((key) => key.toLowerCase());
    const isChatInputFocused = useInputStore((state) => state.focusedInputId);
    const activeDialogId = useDialogStore((state) => state.activeDialogId);
    const handler: ShortcutHandler = useCallback(
        (event) => {
            const enableOnChatFocus = options?.enableOnChatFocus ?? true;
            const enableOnDialogIds = options?.enableOnDialogIds ?? [];
            const isGlobal = options?.isGlobal ?? false;
            if (!isGlobal) {
                if (isChatInputFocused && !enableOnChatFocus) {
                    return;
                } else if (
                    activeDialogId &&
                    !enableOnDialogIds.includes(activeDialogId)
                ) {
                    return;
                }
            }
            // Check if the pressed key matches the last key in our combo
            const pressedKey = event.key.toLowerCase();
            if (pressedKey !== keys[keys.length - 1]) {
                return;
            }
            // Check if all modifier keys in our combo are pressed
            const comboMatches = keys.slice(0, -1).every((key) => {
                switch (key) {
                    case "control":
                        return event.ctrlKey;
                    case "shift":
                        return event.shiftKey;
                    case "alt":
                        return event.altKey;
                    case "meta":
                        return event.metaKey;
                    default:
                        return false;
                }
            });
            // Check if any extra modifier keys are pressed
            const hasExtraModifiers =
                (!keys.includes("control") && event.ctrlKey) ||
                (!keys.includes("shift") && event.shiftKey) ||
                (!keys.includes("alt") && event.altKey) ||
                (!keys.includes("meta") && event.metaKey);
            if (comboMatches && !hasExtraModifiers) {
                event.preventDefault();
                callback();
            }
        },
        [callback, keys, isChatInputFocused, activeDialogId, options],
    );
    useEffect(() => {
        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    }, [handler]);
}

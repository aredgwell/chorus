import { TrashIcon, XIcon } from "lucide-react";

import { PopoverContent } from "./popover";

/** Shared delete/cancel confirmation content for use inside a Radix Popover. */
export function DeleteConfirmContent({
    onConfirm,
    onCancel,
    align = "end",
}: {
    onConfirm: () => void;
    onCancel: () => void;
    align?: "start" | "center" | "end";
}) {
    return (
        <PopoverContent align={align} side="bottom" className="w-36 p-1">
            <button
                type="button"
                className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-destructive hover:bg-accent cursor-default"
                onClick={onConfirm}
            >
                <TrashIcon className="size-3.5" />
                <span className="flex-1 text-left">Delete</span>
            </button>
            <button
                type="button"
                className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-muted-foreground hover:bg-accent cursor-default"
                onClick={onCancel}
            >
                <XIcon className="size-3.5" />
                <span className="flex-1 text-left">Cancel</span>
            </button>
        </PopoverContent>
    );
}

import { useState, useRef, useEffect } from "react";
import { Input } from "./ui/input";
import { Pencil } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";

interface EditableTitleProps {
    title: string;
    onUpdate: (newTitle: string) => Promise<void>;
    className?: string;
    editClassName?: string;
    showEditIcon?: boolean;
    placeholder?: string;
    disabled?: boolean;
    clickToEdit?: boolean;
    isEditing?: boolean;
    onStartEdit?: () => void;
    onStopEdit?: () => void;
}

export function EditableTitle({
    title,
    onUpdate,
    className = "",
    editClassName = "",
    showEditIcon = true,
    placeholder = "Untitled",
    disabled = false,
    clickToEdit = true,
    isEditing: externalIsEditing,
    onStartEdit,
    onStopEdit,
}: EditableTitleProps) {
    const [internalIsEditing, setInternalIsEditing] = useState(false);
    const isEditing = externalIsEditing ?? internalIsEditing;
    const [newTitle, setNewTitle] = useState(title);
    const inputRef = useRef<HTMLInputElement>(null);

    const displayTitle = title || placeholder;

    const handleStartEdit = (e?: React.MouseEvent) => {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }
        if (disabled) return;

        if (onStartEdit) {
            onStartEdit();
        } else {
            setInternalIsEditing(true);
        }
    };

    const handleStopEdit = () => {
        if (onStopEdit) {
            onStopEdit();
        } else {
            setInternalIsEditing(false);
        }
    };

    const handleSubmitEdit = async (e?: React.FormEvent) => {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }

        if (!newTitle.trim() || newTitle.trim() === title) {
            handleStopEdit();
            return;
        }

        try {
            await onUpdate(newTitle.trim());
            handleStopEdit();
        } catch (error) {
            // Keep editing state on error
            console.error("Failed to update title:", error);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Escape") {
            e.preventDefault();
            e.stopPropagation();
            handleStopEdit();
        } else if (e.key === "Enter") {
            e.preventDefault();
            void handleSubmitEdit();
        }
    };

    // When isEditing changes to true, initialize the input
    useEffect(() => {
        if (isEditing) {
            setNewTitle(title || "");
            if (inputRef.current) {
                inputRef.current.focus();
                inputRef.current.select();
            }
        }
    }, [isEditing, title]);

    if (isEditing) {
        return (
            <form
                onSubmit={(e) => void handleSubmitEdit(e)}
                className="flex w-full"
            >
                <Input
                    ref={inputRef}
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    onBlur={() => void handleSubmitEdit()}
                    onKeyDown={handleKeyDown}
                    className={`ring-0 rounded-none ${editClassName}`}
                />
            </form>
        );
    }

    return (
        <div className={`flex items-center group/editable-title ${className}`}>
            <span
                className={`truncate ${clickToEdit ? "cursor-pointer" : ""}`}
                onClick={clickToEdit ? handleStartEdit : undefined}
            >
                {displayTitle}
            </span>
            {showEditIcon && !disabled && (
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Pencil
                            className="h-3 w-3 ml-2 opacity-0 group-hover/editable-title:opacity-100 transition-opacity text-muted-foreground hover:text-foreground cursor-pointer shrink-0"
                            onClick={() => void handleStartEdit()}
                        />
                    </TooltipTrigger>
                    <TooltipContent>Edit title</TooltipContent>
                </Tooltip>
            )}
        </div>
    );
}

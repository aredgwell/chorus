import {
    type ItemType,
    type Tag,
    TAG_COLOR_PALETTE,
    useAddTagToItem,
    useCreateTag,
    useItemTags,
    useRemoveTagFromItem,
    useTags,
    useUpdateTag,
} from "@core/chorus/api/TagAPI";
import { TagIcon, TrashIcon, XIcon } from "lucide-react";
import { useState } from "react";

import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";

interface TagInputProps {
    itemType: ItemType;
    itemId: string;
}

/** Compact tag chips with popover for adding tags */
export function TagInput({ itemType, itemId }: TagInputProps) {
    const [open, setOpen] = useState(false);
    const [input, setInput] = useState("");

    const allTagsQuery = useTags();
    const itemTagsQuery = useItemTags(itemType, itemId);
    const createTag = useCreateTag();
    const addTag = useAddTagToItem();
    const removeTag = useRemoveTagFromItem();
    const updateTag = useUpdateTag();

    const allTags = allTagsQuery.data ?? [];
    const itemTags = itemTagsQuery.data ?? [];
    const itemTagIds = new Set(itemTags.map((t) => t.id));

    // Filter suggestions: tags not already attached, matching input
    const suggestions = allTags.filter(
        (t) =>
            !itemTagIds.has(t.id) &&
            t.name.toLowerCase().includes(input.toLowerCase()),
    );

    const inputMatchesExisting = allTags.some(
        (t) => t.name.toLowerCase() === input.trim().toLowerCase(),
    );

    const handleAddExistingTag = (tag: Tag) => {
        void addTag.mutateAsync({ tagId: tag.id, itemType, itemId });
        setInput("");
    };

    const handleCreateAndAdd = async () => {
        const name = input.trim();
        if (!name) return;
        const tagId = await createTag.mutateAsync({ name });
        void addTag.mutateAsync({ tagId, itemType, itemId });
        setInput("");
    };

    const handleRemoveTag = (tagId: string) => {
        void removeTag.mutateAsync({ tagId, itemType, itemId });
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter") {
            e.preventDefault();
            const trimmed = input.trim();
            if (!trimmed) return;

            // If exact match exists, attach it
            const exact = allTags.find(
                (t) => t.name.toLowerCase() === trimmed.toLowerCase(),
            );
            if (exact) {
                handleAddExistingTag(exact);
            } else {
                void handleCreateAndAdd();
            }
        }
        if (e.key === "Escape") {
            setOpen(false);
        }
    };

    return (
        <div className="tag-input-container">
            {itemTags.map((tag) => (
                <span key={tag.id} className="tag-chip">
                    <Popover>
                        <PopoverTrigger asChild>
                            <button
                                type="button"
                                className="tag-chip-dot-btn"
                            >
                                <span
                                    className="tag-chip-dot"
                                    style={{
                                        backgroundColor:
                                            tag.color ??
                                            "hsl(var(--muted-foreground))",
                                    }}
                                />
                            </button>
                        </PopoverTrigger>
                        <PopoverContent
                            className="w-auto p-2"
                            align="start"
                        >
                            <div className="flex gap-1 flex-wrap max-w-[130px]">
                                {TAG_COLOR_PALETTE.map((color) => (
                                    <button
                                        key={color}
                                        type="button"
                                        className={`w-5 h-5 rounded-full border-2 transition-all ${
                                            tag.color === color
                                                ? "border-foreground scale-110"
                                                : "border-transparent hover:border-muted-foreground/50"
                                        }`}
                                        style={{
                                            backgroundColor: color,
                                        }}
                                        onClick={() => {
                                            void updateTag.mutateAsync({
                                                tagId: tag.id,
                                                color:
                                                    tag.color === color
                                                        ? null
                                                        : color,
                                            });
                                        }}
                                    />
                                ))}
                            </div>
                        </PopoverContent>
                    </Popover>
                    <span className="tag-chip-name">{tag.name}</span>
                    <button
                        type="button"
                        className="tag-chip-remove"
                        onClick={() => handleRemoveTag(tag.id)}
                    >
                        <XIcon size={10} />
                    </button>
                </span>
            ))}

            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <button type="button" className="tag-add-btn">
                        <TagIcon size={12} />
                    </button>
                </PopoverTrigger>
                <PopoverContent
                    align="start"
                    className="w-52 p-2"
                    onOpenAutoFocus={(e) => e.preventDefault()}
                >
                    <input
                        type="text"
                        className="tag-search-input"
                        placeholder="Add tag..."
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        autoFocus
                    />
                    <div className="tag-suggestions">
                        {/* Currently attached tags — with remove button */}
                        {itemTags.map((tag) => (
                            <div
                                key={tag.id}
                                className="tag-suggestion-item justify-between"
                            >
                                <span className="flex items-center gap-1.5">
                                    <span
                                        className="tag-chip-dot"
                                        style={{
                                            backgroundColor:
                                                tag.color ??
                                                "hsl(var(--muted-foreground))",
                                        }}
                                    />
                                    {tag.name}
                                </span>
                                <button
                                    type="button"
                                    className="text-muted-foreground hover:text-destructive transition-colors p-0.5"
                                    onClick={() => handleRemoveTag(tag.id)}
                                >
                                    <TrashIcon size={12} />
                                </button>
                            </div>
                        ))}
                        {itemTags.length > 0 && suggestions.length > 0 && (
                            <div className="border-t border-border my-1" />
                        )}
                        {/* Unattached tags to add */}
                        {suggestions.map((tag) => (
                            <button
                                key={tag.id}
                                type="button"
                                className="tag-suggestion-item"
                                onClick={() => handleAddExistingTag(tag)}
                            >
                                {tag.color && (
                                    <span
                                        className="tag-chip-dot"
                                        style={{
                                            backgroundColor: tag.color,
                                        }}
                                    />
                                )}
                                {tag.name}
                            </button>
                        ))}
                        {input.trim() && !inputMatchesExisting && (
                            <button
                                type="button"
                                className="tag-suggestion-item tag-suggestion-create"
                                onClick={() => void handleCreateAndAdd()}
                            >
                                Create &ldquo;{input.trim()}&rdquo;
                            </button>
                        )}
                        {!suggestions.length &&
                            !input.trim() &&
                            allTags.length === 0 && (
                                <div className="tag-suggestion-empty">
                                    Type to create your first tag
                                </div>
                            )}
                    </div>
                </PopoverContent>
            </Popover>
        </div>
    );
}

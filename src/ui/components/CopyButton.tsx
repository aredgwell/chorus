import { CheckIcon, CopyIcon } from "lucide-react";
import { forwardRef, useState } from "react";
import { toast } from "sonner";

const SimpleCopyButton = forwardRef<
    HTMLButtonElement,
    {
        text: string;
        size?: "sm" | "md";
        className?: string;
    }
>(({ text, size = "sm", className }, ref) => {
    const [isCopied, setIsCopied] = useState(false);

    const copyToClipboard = async (e: React.MouseEvent) => {
        e.stopPropagation();
        try {
            await navigator.clipboard.writeText(text);
            setIsCopied(true);
            setTimeout(() => setIsCopied(false), 2000);
        } catch (err) {
            console.error("Failed to copy text: ", err);
            toast.error("Failed to copy text", {
                description: "Please try again.",
            });
        }
    };

    const sizeClass = size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4";

    return (
        <button
            ref={ref}
            onClick={(e) => void copyToClipboard(e)}
            className={className}
        >
            {isCopied ? (
                <CheckIcon
                    className={`${sizeClass} text-green-500`}
                    strokeWidth={1.5}
                />
            ) : (
                <CopyIcon className={`${sizeClass}`} strokeWidth={1.5} />
            )}
        </button>
    );
});

SimpleCopyButton.displayName = "SimpleCopyButton";

export default SimpleCopyButton;

import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "@ui/components/ui/tooltip";
import { Check, LucideIcon } from "lucide-react";
import { useEffect, useState } from "react";

interface ConfirmButtonProps {
    // The regular icon to show (e.g., Trash2)
    Icon: LucideIcon;
    // Text to show in tooltip for initial state
    tooltipText?: string;
    // Text to show in tooltip for confirmation state
    confirmTooltipText: string;
    // Action to perform when confirmed
    onConfirm: (e: React.MouseEvent) => void;
    // Optional className for the icon
    className?: string;
    // Optional timeout for confirmation state (ms)
    timeout?: number;
    // Act immediately without confirmation
    disableConfirm?: boolean;
}

export function ConfirmButton({
    Icon,
    tooltipText,
    confirmTooltipText,
    onConfirm,
    className = "",
    timeout = 2000,
    disableConfirm = false,
}: ConfirmButtonProps) {
    const [showConfirm, setShowConfirm] = useState(false);

    useEffect(() => {
        let timer: NodeJS.Timeout;
        if (showConfirm) {
            timer = setTimeout(() => {
                setShowConfirm(false);
            }, timeout);
        }
        return () => clearTimeout(timer);
    }, [showConfirm, timeout]);

    const handleClick = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        if (showConfirm || disableConfirm) {
            onConfirm(e);
            setShowConfirm(false);
        } else {
            setShowConfirm(true);
        }
    };

    const button = showConfirm ? (
        <Check
            className={`cursor-pointer text-red-600 ${className}`}
            onClick={handleClick}
        />
    ) : (
        <Icon
            className={`cursor-pointer hover:text-foreground ${className}`}
            onClick={handleClick}
        />
    );

    return tooltipText ? (
        <Tooltip>
            <TooltipTrigger asChild>{button}</TooltipTrigger>
            <TooltipContent side="bottom">
                {showConfirm ? confirmTooltipText : tooltipText}
            </TooltipContent>
        </Tooltip>
    ) : (
        button
    );
}

import { cn } from "@ui/lib/utils";
import { useEffect,useState } from "react";

interface RetroSpinnerProps {
    speed?: number;
    className?: string;
}

export default function RetroSpinner({
    speed = 100,
    className,
}: RetroSpinnerProps = {}) {
    const [frame, setFrame] = useState(0);
    const frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

    useEffect(() => {
        const timer = setInterval(() => {
            setFrame((prev) => (prev + 1) % frames.length);
        }, speed);

        return () => clearInterval(timer);
    }, [frames.length, speed]);

    return (
        <span className={cn("whitespace-pre", className)}>{frames[frame]}</span>
    );
}

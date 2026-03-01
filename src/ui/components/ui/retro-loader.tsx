import { useEffect, useState } from "react";

interface RetroLoadingBarProps {
    width?: number;
    speed?: number;
    onComplete?: () => void;
}

export default function RetroLoadingBar({
    width = 50,
    speed = 1000,
    onComplete,
}: RetroLoadingBarProps = {}) {
    const [progress, setProgress] = useState(0);
    const [isComplete, setIsComplete] = useState(false);

    useEffect(() => {
        if (isComplete) {
            onComplete?.();
            return;
        }

        const interval = speed / width;
        const timer = setInterval(() => {
            setProgress((prevProgress) => {
                const newProgress = prevProgress + 1;
                if (newProgress >= width) {
                    setIsComplete(true);
                    clearInterval(timer);
                    return width;
                }
                return newProgress;
            });
        }, interval);

        return () => clearInterval(timer);
    }, [width, speed, isComplete, onComplete]);

    const getBar = () => {
        const filled = "█".repeat(progress);
        const empty = "░".repeat(width - progress);
        return `[${filled}${empty}]`;
    };

    return (
        <div className="font-mono rounded-lg">
            <pre className="whitespace-pre">{getBar()}</pre>
        </div>
    );
}

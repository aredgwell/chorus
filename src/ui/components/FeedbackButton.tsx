import { openUrl } from "@tauri-apps/plugin-opener";
import { ReactNode } from "react";

export default function FeedbackButton({
    className,
    children,
}: {
    children?: ReactNode;
    className?: string;
}) {
    const handleFeedbackClick = () => {
        void openUrl("https://github.com/meltylabs/chorus/issues/new");
    };

    return (
        <button onClick={handleFeedbackClick} className={className}>
            {children}
        </button>
    );
}

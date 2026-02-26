import { AppMode } from "@ui/context/AppModeContext";

const MODE_LABELS: Record<AppMode, string> = {
    chats: "Chats",
    editor: "Editor",
    graph: "Graph",
    synthesis: "Synthesis",
};

export function ModePlaceholder({ mode }: { mode: AppMode }) {
    return (
        <div className="flex items-center justify-center h-full text-muted-foreground">
            <p className="text-lg">{MODE_LABELS[mode]} — coming soon</p>
        </div>
    );
}

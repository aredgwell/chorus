import { useTheme } from "@ui/hooks/useTheme";
import Mermaid from "react-mermaid2";

export function MermaidPreview({ content }: { content: string }) {
    const { mode } = useTheme();

    return (
        <div className="bg-background overflow-x-auto">
            <Mermaid
                key={content}
                chart={content}
                config={{ theme: mode === "dark" ? "dark" : "default" }}
            />
        </div>
    );
}

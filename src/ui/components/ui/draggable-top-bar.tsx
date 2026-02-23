import { useSidebar } from "@ui/hooks/useSidebar";

interface DraggableTopBarProps {
    className?: string;
}

export function DraggableTopBar({ className }: DraggableTopBarProps) {
    const { open } = useSidebar();

    return (
        <div
            data-tauri-drag-region
            className={`h-7 w-full fixed top-0 left-0 bg-background/50 backdrop-blur-sm pt-1 hover:border-b hover:border-border hover:shadow-b flex items-center px-2
                // ${open ? "ml-64 pl-6" : "pl-9"}
                ${className ?? ""}`}
        ></div>
    );
}

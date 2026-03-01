import { SidebarTrigger } from "@ui/components/ui/sidebar";
import { useSidebar } from "@ui/hooks/useSidebar";
import { ReactNode } from "react";

interface HeaderBarProps {
    /** Actions for the right side (buttons, menus, etc.) */
    actions?: ReactNode;
}

export function HeaderBar({ actions }: HeaderBarProps) {
    const { open: isSidebarOpen } = useSidebar();

    return (
        <div
            data-tauri-drag-region
            className="h-[52px] z-10 shrink-0
                 items-center justify-between px-3 -mt-px flex bg-background
            hover:bg-background
            active:bg-background
            border-b
            active:border-b
            active:border-border!"
        >
            <div className="flex items-center gap-1">
                {!isSidebarOpen && (
                    <SidebarTrigger className="size-4! ml-2" />
                )}
            </div>

            {actions && (
                <div className="flex items-center gap-1">{actions}</div>
            )}
        </div>
    );
}

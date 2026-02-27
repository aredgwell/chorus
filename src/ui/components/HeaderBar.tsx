import { ReactNode } from "react";
import { SidebarTrigger } from "@ui/components/ui/sidebar";
import { useSidebar } from "@ui/hooks/useSidebar";

interface HeaderBarProps {
    /** Content for the center area (project name, chat title, etc.) */
    children: ReactNode;
    /** Actions for the right side (buttons, menus, etc.) */
    actions?: ReactNode;
    /** Use "fixed" for ProjectView, "absolute" for MultiChat */
    positioning?: "fixed" | "absolute";
}

export function HeaderBar({
    children,
    actions,
    positioning = "fixed",
}: HeaderBarProps) {
    const { open: isSidebarOpen } = useSidebar();

    return (
        <div
            data-tauri-drag-region
            className={`${positioning} top-0 left-0 ${isSidebarOpen ? (positioning === "fixed" ? "left-64" : "") : "pl-20"} right-0 h-[52px] z-10
                 items-center justify-between px-3 -mt-px flex bg-background
            hover:bg-background
            active:bg-background
            border-b
            active:border-b
            active:border-border!`}
        >
            <div className="flex items-center gap-1">
                {!isSidebarOpen && (
                    <SidebarTrigger className="size-4! ml-2" />
                )}

                {children}
            </div>

            {actions && (
                <div className="flex items-center gap-1">{actions}</div>
            )}
        </div>
    );
}

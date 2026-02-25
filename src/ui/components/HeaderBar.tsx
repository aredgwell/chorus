import { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeftIcon, ArrowRightIcon } from "lucide-react";
import { Button } from "./ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";
import { SidebarTrigger } from "@ui/components/ui/sidebar";
import { useSidebar } from "@ui/hooks/useSidebar";

interface HeaderBarProps {
    /** Content for the center area (project name, chat title, etc.) */
    children: ReactNode;
    /** Actions for the right side (buttons, menus, etc.) */
    actions?: ReactNode;
    /** Whether forward navigation is available */
    canGoForward?: boolean;
    /** Use "fixed" for ProjectView, "absolute" for MultiChat */
    positioning?: "fixed" | "absolute";
}

export function HeaderBar({
    children,
    actions,
    canGoForward = false,
    positioning = "fixed",
}: HeaderBarProps) {
    const { open: isSidebarOpen } = useSidebar();
    const navigate = useNavigate();

    const handleBackNavigation = () => {
        navigate(-1);
    };

    const handleForwardNavigation = () => {
        navigate(1);
    };

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
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button
                            variant="link"
                            size="iconSm"
                            onClick={handleBackNavigation}
                        >
                            <ArrowLeftIcon
                                strokeWidth={1.5}
                                className="size-3.5! ml-2"
                            />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">
                        Back{" "}
                        <kbd>
                            <span>⌘</span>[
                        </kbd>
                    </TooltipContent>
                </Tooltip>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button
                            variant="link"
                            size="iconSm"
                            onClick={handleForwardNavigation}
                            disabled={!canGoForward}
                            className={
                                !canGoForward ? "text-helper" : undefined
                            }
                        >
                            <ArrowRightIcon
                                strokeWidth={1.5}
                                className="size-3.5!"
                            />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">
                        Forward{" "}
                        <kbd>
                            <span>⌘</span>]
                        </kbd>
                    </TooltipContent>
                </Tooltip>

                {children}
            </div>

            {actions && (
                <div className="flex items-center gap-1">{actions}</div>
            )}
        </div>
    );
}

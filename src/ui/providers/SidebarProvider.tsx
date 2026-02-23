import React from "react";
import { TooltipProvider } from "@radix-ui/react-tooltip";
import { cn } from "@ui/lib/utils";
import { useIsMobile } from "@ui/components/hooks/use-mobile";
import { useShortcut } from "@ui/hooks/useShortcut";
import { SidebarContext, SidebarContexts } from "@ui/context/SidebarContext";

export const SIDEBAR_COOKIE_NAME = "sidebar:state";
export const SIDEBAR_COOKIE_MAX_AGE = 60 * 60 * 24 * 7;
export const SIDEBAR_WIDTH = "16rem";
export const SIDEBAR_WIDTH_MOBILE = "18rem";
export const SIDEBAR_WIDTH_ICON = "3rem";

export const SidebarProvider = React.forwardRef<
    HTMLDivElement,
    React.ComponentProps<"div"> & {
        defaultOpen?: boolean;
        open?: boolean;
        onOpenChange?: (open: boolean) => void;
    }
>(
    (
        {
            defaultOpen = true,
            open: openProp,
            onOpenChange: setOpenProp,
            className,
            style,
            children,
            ...props
        },
        ref,
    ) => {
        const isMobile = useIsMobile();
        const [openMobile, setOpenMobile] = React.useState(false);

        // This is the internal state of the sidebar.
        // We use openProp and setOpenProp for control from outside the component.
        const [_open, _setOpen] = React.useState(defaultOpen);
        const open = openProp ?? _open;
        const setOpen = React.useCallback(
            (value: boolean | ((value: boolean) => boolean)) => {
                if (setOpenProp) {
                    return setOpenProp?.(
                        typeof value === "function" ? value(open) : value,
                    );
                }

                _setOpen(value);

                // This sets the cookie to keep the sidebar state.
                document.cookie = `${SIDEBAR_COOKIE_NAME}=${open}; path=/; max-age=${SIDEBAR_COOKIE_MAX_AGE}`;
            },
            [setOpenProp, open],
        );

        // Helper to toggle the sidebar.
        const toggleSidebar = React.useCallback(() => {
            return isMobile
                ? setOpenMobile((open) => !open)
                : setOpen((open) => !open);
        }, [isMobile, setOpen, setOpenMobile]);

        // Adds a keyboard shortcut to toggle the sidebar.
        useShortcut(["meta", "b"], toggleSidebar);

        // We add a state so that we can do data-state="expanded" or "collapsed".
        // This makes it easier to style the sidebar with Tailwind classes.
        const state = open ? "expanded" : "collapsed";

        const contextValue = React.useMemo<SidebarContexts>(
            () => ({
                state,
                open,
                setOpen,
                isMobile,
                openMobile,
                setOpenMobile,
                toggleSidebar,
            }),
            [
                state,
                open,
                setOpen,
                isMobile,
                openMobile,
                setOpenMobile,
                toggleSidebar,
            ],
        );

        return (
            <SidebarContext.Provider value={contextValue}>
                <TooltipProvider delayDuration={0}>
                    <div
                        style={
                            {
                                "--sidebar-width": SIDEBAR_WIDTH,
                                "--sidebar-width-icon": SIDEBAR_WIDTH_ICON,
                                ...style,
                            } as React.CSSProperties
                        }
                        className={cn(
                            "group/sidebar-wrapper flex min-h-svh w-full has-data-[variant=inset]:bg-sidebar",
                            className,
                        )}
                        ref={ref}
                        {...props}
                    >
                        {children}
                    </div>
                </TooltipProvider>
            </SidebarContext.Provider>
        );
    },
);
SidebarProvider.displayName = "SidebarProvider";

/**
 * Written by Gemini
 * https://app.chorus.sh/chats/read-only/71d2abed-1434-4c76-b34f-9c97f8010296
 */

import { useCallback,useEffect, useRef, useState } from "react";

const SCROLLBAR_THICKNESS_PX = 7; // matches styling in App.css
const MARGIN_OF_ERROR_PX = 6;

const useElementScrollbarVisibility = (
    scrollStopDelay = 150, // ms to wait after last scroll event to consider scrolling stopped
    visibilityPersistenceDelay = 550, // ms to wait before hiding scrollbar after all conditions are false
) => {
    const elementRef = useRef<HTMLDivElement | null>(null);

    const [isScrolling, setIsScrolling] = useState(false);
    const [isHoveringScrollbar, setIsHoveringScrollbar] = useState(false);
    const [isScrollbarThumbActive, setIsScrollbarThumbActive] = useState(false); // User is holding the scrollbar thumb

    const [shouldShowScrollbar, setShouldShowScrollbar] = useState(false);

    const scrollStopTimerRef = useRef<NodeJS.Timeout | null>(null);
    const visibilityPersistenceTimerRef = useRef<NodeJS.Timeout | null>(null);

    // Helper to check if mouse is over the scrollbar area (assuming horizontal at bottom)
    const isMouseOverRealScrollbarArea = useCallback(
        (
            e: MouseEvent,
            element: HTMLDivElement,
            { allowErrorMargin }: { allowErrorMargin?: boolean },
        ): boolean => {
            if (!element) return false;
            const rect = element.getBoundingClientRect();
            // Check if mouse is within the horizontal bounds of the element
            const isHorizontallyInsideElement =
                e.clientX >= rect.left && e.clientX <= rect.right;
            // Check if mouse is within the vertical bounds of the scrollbar track
            const errorMarginOrZero = allowErrorMargin ? MARGIN_OF_ERROR_PX : 0;
            const isVerticallyOnScrollbar =
                e.clientY >=
                    rect.bottom - SCROLLBAR_THICKNESS_PX - errorMarginOrZero &&
                e.clientY <= rect.bottom + errorMarginOrZero;
            return isHorizontallyInsideElement && isVerticallyOnScrollbar;
        },
        [],
    );

    // --- Condition 1: Detect Scrolling ---
    useEffect(() => {
        const element = elementRef.current;
        if (!element) return;

        const handleScroll = () => {
            setIsScrolling(true);
            if (scrollStopTimerRef.current) {
                clearTimeout(scrollStopTimerRef.current);
            }
            scrollStopTimerRef.current = setTimeout(() => {
                setIsScrolling(false);
            }, scrollStopDelay);
        };

        element.addEventListener("scroll", handleScroll, { passive: true });
        return () => {
            element.removeEventListener("scroll", handleScroll);
            if (scrollStopTimerRef.current) {
                clearTimeout(scrollStopTimerRef.current);
            }
        };
    }, [scrollStopDelay]); // elementRef.current is implicitly a dependency for effect re-run if it changes

    // --- Conditions 2 & 3: Detect Hovering Scrollbar & Active Scrollbar Thumb ---
    useEffect(() => {
        const element = elementRef.current;
        if (!element) return;

        const handleGlobalMouseMove = (e: MouseEvent) => {
            setIsHoveringScrollbar(
                isMouseOverRealScrollbarArea(e, element, {
                    allowErrorMargin: true,
                }),
            );
        };

        const handleMouseDownOnElement = (e: MouseEvent) => {
            if (
                isMouseOverRealScrollbarArea(e, element, {
                    allowErrorMargin: false,
                })
            ) {
                setIsScrollbarThumbActive(true);
                // Add global mouseup listener to catch release anywhere
                document.addEventListener("mouseup", handleGlobalMouseUp, {
                    once: true,
                });
            }
        };

        const handleGlobalMouseUp = () => {
            setIsScrollbarThumbActive(false);
        };

        document.addEventListener("mousemove", handleGlobalMouseMove, {
            passive: true,
        });
        element.addEventListener("mousedown", handleMouseDownOnElement, {
            passive: true,
        }); // passive:true is fine for mousedown if not preventing default

        return () => {
            document.removeEventListener("mousemove", handleGlobalMouseMove);
            element.removeEventListener("mousedown", handleMouseDownOnElement);
            document.removeEventListener("mouseup", handleGlobalMouseUp); // Clean up global listener
        };
    }, [isMouseOverRealScrollbarArea]); // Re-bind if the helper function identity changes (it won't due to useCallback with empty deps)

    // --- Master Logic: Determine scrollbar visibility based on all conditions ---
    useEffect(() => {
        const anyConditionActive =
            isScrolling || isHoveringScrollbar || isScrollbarThumbActive;

        if (anyConditionActive) {
            setShouldShowScrollbar(true);
            // If any condition is active, cancel any pending hide timeout
            if (visibilityPersistenceTimerRef.current) {
                clearTimeout(visibilityPersistenceTimerRef.current);
                visibilityPersistenceTimerRef.current = null;
            }
        } else {
            // NO conditions are active.
            // If the scrollbar is currently shown, schedule it to hide after the persistence delay.
            if (shouldShowScrollbar) {
                // Only if it was already visible
                if (!visibilityPersistenceTimerRef.current) {
                    // Avoid setting multiple hide timeouts
                    visibilityPersistenceTimerRef.current = setTimeout(() => {
                        setShouldShowScrollbar(false);
                        visibilityPersistenceTimerRef.current = null;
                    }, visibilityPersistenceDelay);
                }
            }
        }

        // Cleanup main visibility timer on unmount or if dependencies change
        return () => {
            if (visibilityPersistenceTimerRef.current) {
                clearTimeout(visibilityPersistenceTimerRef.current);
            }
        };
    }, [
        isScrolling,
        isHoveringScrollbar,
        isScrollbarThumbActive,
        shouldShowScrollbar,
        visibilityPersistenceDelay,
    ]);

    return {
        elementRef,
        shouldShowScrollbar,
        // For debugging or more complex CSS, you can expose these:
        isScrolling,
        isHoveringScrollbar,
        isScrollbarThumbActive,
    };
};

export default useElementScrollbarVisibility;

import { memo, useEffect, useRef, useState } from "react";

const DEFAULT_HEIGHT = 200;
const ROOT_MARGIN = "200px 0px";

/**
 * Wraps a message set and uses IntersectionObserver to unmount it
 * when scrolled far out of the viewport. A placeholder div with
 * the last-measured height is shown instead, preventing layout shift.
 *
 * The last 1-2 message sets (the active ones) are never wrapped in
 * this component — they're always rendered directly.
 */
export const VirtualizedMessageSet = memo(function VirtualizedMessageSet({
    children,
}: {
    children: React.ReactNode;
}) {
    const containerRef = useRef<HTMLDivElement>(null);
    const measuredHeight = useRef<number>(DEFAULT_HEIGHT);
    const [isVisible, setIsVisible] = useState(true);

    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;

        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setIsVisible(true);
                } else {
                    // Measure before hiding so placeholder is accurate
                    measuredHeight.current =
                        el.getBoundingClientRect().height || measuredHeight.current;
                    setIsVisible(false);
                }
            },
            { rootMargin: ROOT_MARGIN },
        );

        observer.observe(el);
        return () => observer.disconnect();
    }, []);

    if (!isVisible) {
        return (
            <div
                ref={containerRef}
                style={{ height: measuredHeight.current }}
            />
        );
    }

    return <div ref={containerRef}>{children}</div>;
});

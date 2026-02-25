import { memo, useEffect, useRef, useState } from "react";

const DEFAULT_HEIGHT = 200;
const ROOT_MARGIN = "100px 0px";

// Module-level height cache: persists measured heights across unmount/remount
// cycles so returning to a previously-viewed message set doesn't flash at the
// default height before measuring.
const heightCache = new Map<string, number>();

/**
 * Wraps a message set and uses IntersectionObserver to unmount it
 * when scrolled far out of the viewport. A placeholder div with
 * the last-measured height is shown instead, preventing layout shift.
 *
 * When visible, applies `content-visibility: auto` so the browser can
 * skip layout/paint for off-screen portions — a softer first tier of
 * optimization before the hard unmount at 100px out of viewport.
 *
 * The last 1-2 message sets (the active ones) are never wrapped in
 * this component — they're always rendered directly.
 */
export const VirtualizedMessageSet = memo(function VirtualizedMessageSet({
    children,
    messageSetId,
}: {
    children: React.ReactNode;
    messageSetId: string;
}) {
    const containerRef = useRef<HTMLDivElement>(null);
    const measuredHeight = useRef<number>(
        heightCache.get(messageSetId) ?? DEFAULT_HEIGHT,
    );
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
                    const height = el.getBoundingClientRect().height;
                    if (height > 0) {
                        measuredHeight.current = height;
                        heightCache.set(messageSetId, height);
                    }
                    setIsVisible(false);
                }
            },
            { rootMargin: ROOT_MARGIN },
        );

        observer.observe(el);
        return () => observer.disconnect();
    }, [messageSetId]);

    if (!isVisible) {
        return (
            <div
                ref={containerRef}
                style={{ height: measuredHeight.current }}
            />
        );
    }

    return (
        <div
            ref={containerRef}
            style={{
                contentVisibility: "auto",
                containIntrinsicSize: `auto ${measuredHeight.current}px`,
            }}
        >
            {children}
        </div>
    );
});

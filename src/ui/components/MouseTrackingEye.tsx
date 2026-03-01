import { forwardRef, useEffect, useImperativeHandle, useState } from "react";

export interface MouseTrackingEyeRef {
    blink: () => void;
}

export const MouseTrackingEye = forwardRef<
    MouseTrackingEyeRef,
    {
        isOpen?: boolean;
        canBlink?: boolean;
    }
>(({ isOpen = true, canBlink = false }, ref) => {
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [isBlinking, setIsBlinking] = useState(false);

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            // Get the center of the viewport
            const centerX = window.innerWidth / 2;
            const centerY = window.innerHeight / 2;

            // Calculate angle between center and mouse
            const dx = e.clientX - centerX;
            const dy = e.clientY - centerY;

            // Limit the movement to make it more subtle
            const maxOffset = 1.5;
            const x = Math.min(maxOffset, Math.max(-maxOffset, dx / 150));
            const y = Math.min(maxOffset, Math.max(-maxOffset, dy / 150));

            setPosition({ x, y });
        };

        window.addEventListener("mousemove", handleMouseMove);
        return () => window.removeEventListener("mousemove", handleMouseMove);
    }, []);

    const doBlink = () => {
        if (!isOpen || !canBlink) return;

        // First blink
        setIsBlinking(true);
        setTimeout(() => {
            setIsBlinking(false);
            // Second blink after 150ms
            setTimeout(() => {
                setIsBlinking(true);
                setTimeout(() => setIsBlinking(false), 150);
            }, 150);
        }, 150);
    };

    useImperativeHandle(ref, () => ({
        blink: doBlink,
    }));

    const shouldBeOpen = isOpen && !isBlinking;

    return (
        <div className="flex items-center gap-1">
            <div className="w-3.5 h-3.5 relative">
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth="2"
                    stroke="currentColor"
                    className="w-full h-full"
                >
                    {/* Base eye shape (always visible) */}
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z"
                        className={`transition-transform duration-150`}
                    />

                    {/* Animated eyelid */}
                    <path
                        d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z"
                        className={`transition-transform duration-150 origin-center ${
                            shouldBeOpen ? "scale-y-0" : "scale-y-100"
                        }`}
                    />

                    {/* Pupil and highlight (only visible when open) */}
                    <circle
                        cx={12 + position.x}
                        cy={12 + position.y}
                        r="2.5"
                        className={`transition-all duration-150 ease-out ${
                            shouldBeOpen
                                ? "scale-100 opacity-100"
                                : "scale-0 opacity-0"
                        }`}
                        style={{ transformOrigin: "center" }}
                    />
                    <circle
                        cx={11 + position.x}
                        cy={11 + position.y}
                        r="0.8"
                        className={`transition-all duration-150 ease-out ${
                            shouldBeOpen
                                ? "scale-100 opacity-100"
                                : "scale-0 opacity-0"
                        }`}
                        fill="currentColor"
                        style={{ transformOrigin: "center" }}
                    />
                </svg>
            </div>
        </div>
    );
});

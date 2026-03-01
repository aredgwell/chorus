import { Textarea } from "@ui/components/ui/textarea";
import { cn } from "@ui/lib/utils";
import React, { forwardRef, useCallback } from "react";

interface AutoExpandingTextareaProps
    extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
    value: string;
    onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
    autoFocus?: boolean;
}

const AutoExpandingTextarea = forwardRef<
    HTMLTextAreaElement,
    AutoExpandingTextareaProps
>(({ value, onChange, className, autoFocus, ...props }, ref) => {
    const adjustHeight = useCallback((element: HTMLTextAreaElement | null) => {
        if (element) {
            const scrollTop = window.scrollY;

            element.style.height = "auto";
            element.style.height = `${element.scrollHeight}px`;

            // Restore scroll position once state changes
            window.scrollTo(0, scrollTop);
        }
    }, []);

    return (
        <Textarea
            rows={1}
            ref={(node) => {
                adjustHeight(node);
                if (typeof ref === "function") {
                    ref(node);
                } else if (ref) {
                    ref.current = node;
                }
            }}
            value={value}
            onChange={(e) => {
                onChange(e);
                adjustHeight(e.target);
            }}
            autoFocus={autoFocus}
            className={cn("resize-none overflow-hidden min-h-0 p-0", className)}
            {...props}
        />
    );
});

export default AutoExpandingTextarea;

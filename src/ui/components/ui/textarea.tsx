import * as React from "react";

import { cn } from "../../lib/utils";

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
    ({ className, ...props }, ref) => {
        return (
            <textarea
                spellCheck={false}
                className={cn(
                    "flex min-h-[60px] rounded-sm bg-background px-3 py-2 placeholder:text-muted-foreground outline-hidden ring-1 ring-border focus:ring-accent-500 focus:outline-hidden disabled:cursor-not-allowed disabled:opacity-50",
                    className,
                )}
                ref={ref}
                {...props}
            />
        );
    },
);
Textarea.displayName = "Textarea";

export { Textarea };

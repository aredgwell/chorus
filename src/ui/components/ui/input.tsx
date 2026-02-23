import * as React from "react";

import { cn } from "../../lib/utils";

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

const Input = React.forwardRef<HTMLInputElement, InputProps>(
    ({ className, type, ...props }, ref) => {
        return (
            <input
                type={type}
                className={cn(
                    "flex h-8 rounded w-full text-sm bg-background px-3 py-2 outline-hidden ring-1 ring-border focus:ring-special focus:outline-hidden disabled:cursor-not-allowed disabled:opacity-50 placeholder:text-muted-foreground",
                    className,
                )}
                ref={ref}
                {...props}
            />
        );
    },
);
Input.displayName = "Input";

export { Input };

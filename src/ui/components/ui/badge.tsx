import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@ui/lib/utils";

const badgeVariants = cva(
    "inline-flex items-center rounded-full px-2 py-0.5 text-xs transition-colors focus:outline-hidden focus:ring-2 focus:ring-ring focus:ring-offset-2 font-geist-mono tracking-wider uppercase border border-border",
    {
        variants: {
            variant: {
                default:
                    "border-transparent bg-foreground text-background shadow-sm",
                secondary:
                    "border-transparent bg-secondary text-secondary-foreground ",
                destructive:
                    "border-transparent bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/80",
                outline: "border hover:bg-muted-foreground/10",
                highlight:
                    "bg-highlight text-highlight-foreground  border border-highlight-foreground/25!",
            },
        },
        defaultVariants: {
            variant: "default",
        },
    },
);

export interface BadgeProps
    extends React.HTMLAttributes<HTMLDivElement>,
        VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
    return (
        <div className={cn(badgeVariants({ variant }), className)} {...props} />
    );
}

export { Badge };

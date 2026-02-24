import { cva } from "class-variance-authority";

export const buttonVariants = cva(
    "inline-flex px-2 items-center justify-center gap-2 whitespace-nowrap rounded-lg ring-offset-background transition-colors focus-visible:outline-hidden focus-visible:ring-none disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-3 [&_svg]:shrink-0",
    {
        variants: {
            variant: {
                default: "bg-foreground text-background hover:bg-foreground/90",
                destructive:
                    "bg-background text-destructive hover:bg-destructive/10",
                outline:
                    "border border-input bg-background hover:bg-muted hover:text-accent-foreground",
                secondary:
                    "bg-secondary text-secondary-foreground hover:bg-secondary/80",
                ghost: "hover:bg-muted hover:text-accent-foreground text-foreground/80",
                link: "text-foreground/70 hover:text-foreground!",
            },
            size: {
                default: "h-10 px-4 py-2 text-base",
                xs: "h-8 px-3 py-1.5 text-sm",
                sm: "h-9 px-3 text-sm",
                lg: "h-11 px-8",
                icon: "h-10 w-10 [&_svg]:shrink-0 text-base",
                iconSm: "h-7 [&_svg]:shrink-0 [&_svg]:w-3 px-1.5 text-sm bg-background hover:text-accent-foreground",
            },
        },
        defaultVariants: {
            variant: "default",
            size: "default",
        },
    },
);

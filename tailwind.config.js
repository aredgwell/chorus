/** @type {import('tailwindcss').Config} */
import { colorPalette } from "./src/ui/themes/index.ts";
import tailwindcssAnimate from "tailwindcss-animate";
import tailwindcssTypography from "@tailwindcss/typography";
import tailwindcssContainerQueries from "@tailwindcss/container-queries";

export default {
    darkMode: ["class"],
    content: [
        "./index.html",
        "./src/**/*.{ts,tsx,jsx}",
        "!./src/**/node_modules/**",
    ],
    theme: {
        container: {
            center: true,
            padding: "2rem",
            screens: {
                "2xl": "1400px",
            },
        },
        extend: {
            containers: {
                "8xl": "88rem",
                "9xl": "96rem",
                "10xl": "104rem",
            },
            fontSize: {
                xs: ["10px", "12px"],
                sm: ["12px", "16px"],
                base: ["14px", "20px"],
                lg: ["16px", "24px"],
            },
            fontWeight: {
                light: "250",
                default: "400",
                medium: "450",
                semibold: "500",
            },
            letterSpacing: {
                normal: "0.14px",
                wide: "0.24px",
                wider: "0.6px",
                widest: "1.44px",
            },
            colors: {
                border: "hsl(var(--border))",
                input: "hsl(var(--input))",
                ring: "hsl(var(--ring))",
                background: "hsl(var(--background))",
                foreground: "hsl(var(--foreground))",
                "message-background": "hsl(var(--message-background))",
                "border-accent": "hsl(var(--border-accent))",
                "disabled-foreground": "hsl(var(--disabled-foreground))",
                "button-background": "hsl(var(--button-background))",
                "button-foreground": "hsl(var(--button-foreground))",
                "foreground-accent": "hsl(var(--foreground-accent))",
                highlight: "hsl(var(--highlight))",
                "highlight-foreground": "hsl(var(--highlight-foreground))",
                overlay: "hsl(60 71% 7% / 4%)",
                helper: "hsl(var(--helper))",
                "input-border": "hsl(var(--input-border))",
                primary: {
                    DEFAULT: "hsl(var(--primary))",
                    foreground: "hsl(var(--primary-foreground))",
                },
                badge: {
                    DEFAULT: "hsl(var(--badge-background))",
                    foreground: "hsl(var(--badge-foreground))",
                },
                secondary: {
                    DEFAULT: "hsl(var(--secondary))",
                    foreground: "hsl(var(--secondary-foreground))",
                },
                destructive: {
                    DEFAULT: "hsl(var(--destructive))",
                    foreground: "hsl(var(--destructive-foreground))",
                },
                muted: {
                    DEFAULT: "hsl(var(--muted))",
                    foreground: "hsl(var(--muted-foreground))",
                },
                accent: {
                    DEFAULT: "hsl(var(--accent))",
                    foreground: "hsl(var(--accent-foreground))",
                },
                popover: {
                    DEFAULT: "hsl(var(--popover))",
                    foreground: "hsl(var(--popover-foreground))",
                },
                "kbd-primary": {
                    DEFAULT: "hsl(var(--kbd-primary))",
                    foreground: "hsl(var(--kbd-primary-foreground))",
                },
                card: {
                    DEFAULT: "hsl(var(--card))",
                    foreground: "hsl(var(--card-foreground))",
                },
                sidebar: {
                    DEFAULT: "hsl(var(--sidebar-background))",
                    foreground: "hsl(var(--sidebar-foreground))",
                    primary: "hsl(var(--sidebar-primary))",
                    "primary-foreground":
                        "hsl(var(--sidebar-primary-foreground))",
                    accent: "hsl(var(--sidebar-accent))",
                    "accent-foreground":
                        "hsl(var(--sidebar-accent-foreground))",
                    border: "hsl(var(--sidebar-border))",
                    ring: "hsl(var(--sidebar-ring))",
                    secondary: "hsl(var(--sidebar-secondary))",
                    "muted-foreground": "hsl(var(--sidebar-muted-foreground))",
                },
                // no longer used as of 2025-06-05?
                warm: {
                    25: "hsl(32, 49%, 95%)",
                    50: "hsl(32, 59%, 93%)",
                    100: "hsl(30, 50%, 90%)",
                    200: "hsla(30, 51%, 85%)",
                    300: "hsl(29, 52%, 80%)",
                    400: "hsl(30, 51%, 72%)",
                    500: "hsl(30, 47%, 63%)",
                    600: "hsla(30, 34%, 53%, 1)",
                    700: "hsla(30, 29%, 43%, 1)",
                    800: "hsla(29, 30%, 32%, 1)",
                    900: "hsla(31, 30%, 21%, 1)",
                    950: "hsla(30, 30%, 9%, 1)",
                },
                gray: Object.fromEntries(
                    Object.entries(colorPalette.gray).map(([key, value]) => [
                        key,
                        `hsl(${value})`,
                    ]),
                ),
                accent: Object.fromEntries(
                    Object.entries(colorPalette.accent).map(([key, value]) => [
                        key,
                        `hsl(${value})`,
                    ]),
                ),
                transparent: Object.fromEntries(
                    Object.entries(colorPalette.transparent).map(
                        ([key, value]) => [key, `hsl(${value})`],
                    ),
                ),
                special: `hsl(${colorPalette.special})`,
                "one-dark-background": "rgb(40, 44, 52)",
                "one-light-background": "rgb(250, 250, 250)",
            },
            boxShadow: {
                diffuse: "0 8px 30px rgb(0 0 0 / 5%)",
            },
            borderRadius: {
                lg: `var(--radius)`,
                md: `calc(var(--radius) - 2px)`,
                sm: "calc(var(--radius) - 4px)",
            },
            keyframes: {
                "accordion-down": {
                    from: { height: "0" },
                    to: { height: "var(--radix-accordion-content-height)" },
                },
                "accordion-up": {
                    from: { height: "var(--radix-accordion-content-height)" },
                    to: { height: "0" },
                },
                "spin-counter": {
                    "0%": { transform: "rotate(0deg)" },
                    "100%": { transform: "rotate(-360deg)" },
                },
            },
            animation: {
                "accordion-down": "accordion-down 0.2s ease-out",
                "accordion-up": "accordion-up 0.2s ease-out",
                "spin-counter": "spin-counter 1s linear infinite",
            },
            typography: (theme) => ({
                DEFAULT: {
                    css: {
                        "line-height": theme("lineHeight.snug"),
                        "max-width": "none",
                        color: "hsl(var(--foreground))",
                        p: {
                            color: "hsl(var(--foreground))",
                        },
                        h1: {
                            color: "hsl(var(--foreground))",
                            "font-size": theme("fontSize.lg"),
                            "font-weight": "500",
                            "margin-top": "1rem",
                        },
                        h2: {
                            color: "hsl(var(--foreground))",
                            "font-size": theme("fontSize.md"),
                            "font-weight": "500",
                            "margin-top": "0.75rem",
                        },
                        h3: {
                            color: "hsl(var(--foreground))",
                            "font-size": theme("fontSize.md"),
                            "margin-top": "0.5rem",
                        },
                        h4: {
                            color: "hsl(var(--foreground))",
                            "font-size": theme("fontSize.sm"),
                            "margin-top": "0.5rem",
                        },
                        strong: {
                            color: "hsl(var(--foreground))",
                        },
                        ul: {
                            color: "hsl(var(--foreground))",
                        },
                        ol: {
                            color: "hsl(var(--foreground))",
                        },
                        a: {
                            color: "hsl(var(--foreground))",
                            "text-decoration": "none",
                            "&:hover": {
                                color: "hsl(var(--foreground))",
                                "text-decoration": "underline",
                            },
                        },
                        img: {
                            "max-width": "16rem",
                            "border-radius": "0.25rem",
                        },
                        pre: {
                            border: "1px solid hsl(var(--border))",
                            "border-radius": theme("borderRadius.md"),
                            padding: "0px",
                            "overflow-x": "auto",
                            "max-width": "100%",
                        },
                        code: {
                            "border-radius": theme("borderRadius.md"),
                            color: "hsl(var(--foreground))",
                            "background-color": "transparent",
                            padding: "0.2em 0.4em",
                            "font-size": "85%",
                            "font-weight": "400",
                            "&::before": {
                                content: '""',
                            },
                            "&::after": {
                                content: '""',
                            },
                        },
                        "code::before": {
                            content: '""',
                        },
                        "code::after": {
                            content: '""',
                        },
                        "pre code": {
                            "background-color": "transparent",
                            "border-radius": "0",
                            padding: "0",
                            color: "inherit",
                            "font-size": "inherit",
                            "font-weight": "inherit",
                        },
                        th: {
                            "background-color": "hsl(var(--muted))",
                            color: "hsl(var(--muted-foreground))",
                        },
                    },
                },
            }),
            fontFamily: {
                sans: ["var(--font-sans)"],
                mono: ["var(--font-mono)"],
                heading: ["var(--font-heading)"],
                inter: ["Inter", "sans-serif"],
                "monaspace-neon": ["Monaspace Neon", "monospace"],
                "monaspace-xenon": ["Monaspace Xenon", "monospace"],
                "jetbrains-mono": ["JetBrains Mono", "monospace"],
                "fira-code": ["Fira Code", "monospace"],
                "monaspace-argon": ["Monaspace Argon", "monospace"],
                "monaspace-krypton": ["Monaspace Krypton", "monospace"],
                "monaspace-radon": ["Monaspace Radon", "monospace"],
                geist: ["Geist", "sans-serif"],
                "geist-mono": ["Geist Mono", "monospace"],
            },
            maxWidth: {
                prose: "70ch",
            },
        },
    },
    plugins: [
        tailwindcssAnimate,
        tailwindcssTypography,
        tailwindcssContainerQueries,
    ],
};

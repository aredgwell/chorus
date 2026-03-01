import { SettingsManager } from "@core/utilities/Settings";
import { invoke } from "@tauri-apps/api/core";
import { ThemeContext } from "@ui/context/ThemeContext";
import { type ThemeMode, type ThemeName, themes } from "@ui/themes";
import { useEffect, useState } from "react";

export function ThemeProvider({
    children,
    defaultMode = "system",
    defaultThemeName = "default",
    storageKey = "melty-theme",
    ...props
}: {
    children: React.ReactNode;
    defaultMode?: ThemeMode;
    defaultThemeName?: ThemeName;
    storageKey?: string;
}) {
    // Load initial mode from settings or use system as default
    const [mode, setMode] = useState<ThemeMode>(() => {
        const savedMode = localStorage.getItem(
            `${storageKey}-mode`,
        ) as ThemeMode;
        return savedMode || defaultMode;
    });

    const [themeName, setThemeName] = useState<ThemeName>(
        () =>
            (localStorage.getItem(`${storageKey}-name`) as ThemeName) ||
            defaultThemeName,
    );

    const [sansFont, setSansFont] = useState("Inter");
    const [monoFont, setMonoFont] = useState("Fira Code");

    // Load fonts on mount
    useEffect(() => {
        SettingsManager.getInstance()
            .get()
            .then((settings) => {
                if (settings.sansFont) setSansFont(settings.sansFont);
                if (settings.monoFont) setMonoFont(settings.monoFont);
            })
            .catch((e) => {
                console.error("Error loading fonts:", e);
            });
    }, []);

    useEffect(() => {
        const root = window.document.documentElement;
        const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

        const updateTheme = async () => {
            const systemPreference = mediaQuery.matches ? "dark" : "light";
            const effectiveMode = mode === "system" ? systemPreference : mode;

            root.classList.remove("light", "dark");
            root.classList.add(effectiveMode);

            // Get current theme colors
            const theme = themes.find((t) => t.name === themeName)!;
            const colors =
                effectiveMode === "dark"
                    ? theme.colors.dark
                    : theme.colors.light;

            // Apply theme variables
            Object.entries(colors).forEach(([key, value]) => {
                root.style.setProperty(`--${key}`, value);
            });

            // Sync theme with quick chat window
            try {
                await invoke("update_panel_theme", {
                    isDarkMode: effectiveMode === "dark",
                });
            } catch (e) {
                // Ignore errors when quick chat window doesn't exist
                console.debug("Failed to update quick chat theme:", e);
            }
        };

        // Initial theme setup
        void updateTheme();

        // Listen for system theme changes
        const handleChange = () => {
            console.log(
                "[Theme] System theme changed:",
                mediaQuery.matches ? "dark" : "light",
            );
            if (mode === "system") {
                void updateTheme();
            }
        };

        mediaQuery.addEventListener("change", handleChange);

        root.style.setProperty(
            "--font-sans",
            `"${sansFont}", system-ui, sans-serif`,
        );
        root.style.setProperty("--font-mono", `"${monoFont}", monospace`);

        // Cleanup listener
        return () => mediaQuery.removeEventListener("change", handleChange);
    }, [mode, themeName, sansFont, monoFont]);

    const value = {
        mode,
        setMode: (mode: ThemeMode) => {
            console.log("[Theme] Setting mode:", mode);
            localStorage.setItem(`${storageKey}-mode`, mode);
            setMode(mode);
        },
        themeName,
        setThemeName: (name: ThemeName) => {
            localStorage.setItem(`${storageKey}-name`, name);
            setThemeName(name);
        },
        themes,
        sansFont,
        setSansFont: (font: string) => {
            setSansFont(font);
        },
        monoFont,
        setMonoFont: (font: string) => {
            setMonoFont(font);
        },
    };

    return (
        <ThemeContext.Provider {...props} value={value}>
            {children}
        </ThemeContext.Provider>
    );
}

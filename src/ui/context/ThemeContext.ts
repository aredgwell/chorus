import { ThemeMode, ThemeName } from "@ui/themes";
import { themes } from "@ui/themes";
import { createContext } from "react";

type ThemeProviderState = {
    mode: ThemeMode;
    setMode: (mode: ThemeMode) => void;
    themeName: ThemeName;
    setThemeName: (theme: ThemeName) => void;
    themes: typeof themes;
    sansFont: string;
    setSansFont: (font: string) => void;
    monoFont: string;
    setMonoFont: (font: string) => void;
};

const initialState: ThemeProviderState = {
    mode: "system",
    setMode: () => null,
    themeName: "default",
    setThemeName: () => null,
    themes: themes,
    sansFont: "Geist",
    setSansFont: () => null,
    monoFont: "Fira Code",
    setMonoFont: () => null,
};

export const ThemeContext = createContext<ThemeProviderState>(initialState);

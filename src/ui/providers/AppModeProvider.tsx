import { useState, useCallback } from "react";
import { AppModeContext, AppMode } from "@ui/context/AppModeContext";

export function AppModeProvider({ children }: { children: React.ReactNode }) {
    const [mode, setModeState] = useState<AppMode>("chats");

    const setMode = useCallback((newMode: AppMode) => {
        setModeState(newMode);
    }, []);

    return (
        <AppModeContext.Provider value={{ mode, setMode }}>
            {children}
        </AppModeContext.Provider>
    );
}

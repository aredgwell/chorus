import { AppModeContext } from "@ui/context/AppModeContext";
import React from "react";

export function useAppMode() {
    const context = React.useContext(AppModeContext);
    if (!context) {
        throw new Error("useAppMode must be used within an AppModeProvider.");
    }

    return context;
}

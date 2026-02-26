import React from "react";

export type AppMode = "chats" | "editor" | "graph" | "synthesis";

export type AppModeContextType = {
    mode: AppMode;
    setMode: (mode: AppMode) => void;
};

export const AppModeContext = React.createContext<AppModeContextType | null>(
    null,
);

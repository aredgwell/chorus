import * as AppMetadataAPI from "@core/chorus/api/AppMetadataAPI";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { AppContext } from "@ui/context/AppContext";
import React, { useEffect,useState } from "react";

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({
    children,
}) => {
    const [isQuickChatWindow, setIsQuickChatWindow] = useState(true);
    const [zoomLevel, setZoomLevelState] = useState(100);

    const savedZoomLevel = AppMetadataAPI.useZoomLevel();
    const setZoomLevelMutation = AppMetadataAPI.useSetZoomLevel();

    useEffect(() => {
        const checkWindowType = () => {
            const window = getCurrentWindow();
            console.log("window label:", window.label);
            setIsQuickChatWindow(window.label === "quick-chat");
        };
        void checkWindowType();
    }, []);

    useEffect(() => {
        if (savedZoomLevel !== undefined) {
            setZoomLevelState(savedZoomLevel);
            if (!isQuickChatWindow) {
                document.body.style.zoom = `${savedZoomLevel}%`;
            }
        }
    }, [savedZoomLevel, isQuickChatWindow]);

    const setZoomLevel = (level: number) => {
        setZoomLevelState(level);
        if (!isQuickChatWindow) {
            document.body.style.zoom = `${level}%`;
        }
        setZoomLevelMutation.mutate(level);
    };

    // Prevent backspace from navigating back unless in an input or contentEditable element
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Backspace") {
                const target = event.target as HTMLElement;
                const isInput =
                    target.tagName === "INPUT" ||
                    target.tagName === "TEXTAREA" ||
                    target.isContentEditable;

                if (!isInput) {
                    event.preventDefault();
                }
            }
        };

        window.addEventListener("keydown", handleKeyDown);

        return () => {
            window.removeEventListener("keydown", handleKeyDown);
        };
    }, []);

    return (
        <AppContext.Provider
            value={{
                isQuickChatWindow,
                zoomLevel,
                setZoomLevel,
            }}
        >
            {children}
        </AppContext.Provider>
    );
};

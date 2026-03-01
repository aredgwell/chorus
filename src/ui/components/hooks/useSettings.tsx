import { catchAsyncErrors } from "@core/chorus/utilities";
import { Settings, SettingsManager } from "@core/utilities/Settings";
import { useEffect, useState } from "react";

const settingsManager = SettingsManager.getInstance();

export function useSettings() {
    const [settings, setSettings] = useState<Settings>();

    useEffect(() => {
        const loadSettings = async () => {
            const newSettings = await settingsManager.get();
            setSettings(newSettings);
        };

        // Load initial settings
        void loadSettings();

        // Set up an interval to check for settings changes
        const interval = setInterval(catchAsyncErrors(loadSettings), 1000);

        return () => clearInterval(interval);
    }, []);

    return settings;
}

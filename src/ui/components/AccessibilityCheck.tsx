import { invoke } from "@tauri-apps/api/core";
import { Button } from "@ui/components/ui/button";
import { Loader2 } from "lucide-react";
import { BadgeCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { checkScreenRecordingPermission } from "tauri-plugin-macos-permissions-api";

interface AccessibilityStatus {
    screen_recording?: boolean;
    error?: string;
}

export function AccessibilitySettings() {
    const [settings, setSettings] = useState<AccessibilityStatus>({
        screen_recording: false,
    });
    const [loading, setLoading] = useState(true);

    const checkSettings = async () => {
        try {
            const screenRecordingStatus =
                await checkScreenRecordingPermission();
            setSettings({
                screen_recording: screenRecordingStatus,
            });
        } catch (error) {
            console.error("Failed to check accessibility settings:", error);
            setSettings({ error: String(error) });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        void checkSettings();
    }, []);

    const openSettings = async () => {
        try {
            await invoke("open_screen_recording_settings");
        } catch (error) {
            console.error("Failed to open settings:", error);
        }
    };

    return (
        <div
            id="accessibility-settings"
            className="flex items-center justify-between"
        >
            <div className="space-y-0.5">
                <label className="font-semibold">Permissions</label>
                {loading ? (
                    <>
                        <div className="inline-flex items-center gap-2">
                            <Loader2 className="h-4 w-4 animate-spin" />{" "}
                            Checking permissions...
                        </div>
                    </>
                ) : settings.error ? (
                    <div className="text-destructive">{settings.error}</div>
                ) : (
                    <>
                        <div className="pt-2 space-y-2">
                            <div className="flex items-center gap-2">
                                {settings.screen_recording ? (
                                    <BadgeCheck className="h-4 w-4 text-green-500" />
                                ) : (
                                    <div className="h-4 w-4 rounded-full border border-destructive" />
                                )}
                                Screen Recording
                            </div>
                        </div>
                        {!settings.screen_recording && (
                            <div className="pt-2">
                                <Button
                                    variant="secondary"
                                    size="sm"
                                    onClick={() => void openSettings()}
                                    className="mr-2"
                                >
                                    Open Settings
                                </Button>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}

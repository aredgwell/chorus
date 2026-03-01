import { relaunch } from "@tauri-apps/plugin-process";
import { AccessibilitySettings } from "@ui/components/AccessibilityCheck";
import ShortcutRecorder from "@ui/components/ShortcutRecorder";
import { Button } from "@ui/components/ui/button";
import { Separator } from "@ui/components/ui/separator";
import { Switch } from "@ui/components/ui/switch";
import { toast } from "sonner";

interface QuickChatTabProps {
    quickChatEnabled: boolean;
    quickChatShortcut: string;
    onQuickChatEnabledChange: (enabled: boolean) => void;
    onQuickChatShortcutChange: (shortcut: string) => void;
    onDefaultShortcutClick: () => void;
}

export default function QuickChatTab({
    quickChatEnabled,
    quickChatShortcut,
    onQuickChatEnabledChange,
    onQuickChatShortcutChange,
    onDefaultShortcutClick,
}: QuickChatTabProps) {
    return (
        <div className="space-y-6 max-w-2xl">
            <div>
                <h2 className="text-2xl font-semibold mb-2">Ambient Chat</h2>
            </div>
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                        <label className="font-semibold">Ambient Chat</label>
                        <p className="text-sm text-muted-foreground">
                            Start an ambient chat with{" "}
                            <span className="font-mono">
                                {typeof quickChatShortcut === "string"
                                    ? quickChatShortcut
                                    : "Alt+Space"}
                            </span>
                        </p>
                    </div>
                    <Switch
                        checked={quickChatEnabled}
                        onCheckedChange={(enabled) =>
                            void onQuickChatEnabledChange(enabled)
                        }
                    />
                </div>

                <div className="space-y-2">
                    <label className="font-semibold">Keyboard Shortcut</label>
                    <p className="text-sm text-muted-foreground">
                        Enter the shortcut you want to use to start an ambient
                        chat.
                    </p>
                    <ShortcutRecorder
                        value={quickChatShortcut}
                        onChange={(shortcut) =>
                            void onQuickChatShortcutChange(shortcut)
                        }
                    />
                    <div className="flex justify-end gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => void onDefaultShortcutClick()}
                        >
                            Set to default
                        </Button>
                        <Button
                            variant="default"
                            size="sm"
                            onClick={() => {
                                if (!quickChatShortcut.trim()) {
                                    toast.error("Invalid shortcut", {
                                        description: "Shortcut cannot be empty",
                                    });
                                    return;
                                }
                                void relaunch().catch(console.error);
                            }}
                        >
                            Save and restart
                        </Button>
                    </div>
                </div>

                <Separator />

                <div className="space-y-4">
                    <AccessibilitySettings />
                </div>
            </div>
        </div>
    );
}

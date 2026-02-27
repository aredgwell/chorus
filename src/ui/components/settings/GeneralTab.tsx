import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@ui/components/ui/select";
import { Separator } from "@ui/components/ui/separator";
import { Switch } from "@ui/components/ui/switch";

const FONT_OPTIONS = {
    sans: [
        { label: "Geist", value: "Geist" },
        { label: "Inter", value: "Inter" },
        { label: "Fira Code", value: "Fira Code" },
        { label: "Monaspace Neon", value: "Monaspace Neon" },
        { label: "Monaspace Xenon", value: "Monaspace Xenon" },
    ],
} as const;

interface GeneralTabProps {
    mode: string;
    sansFont: string;
    autoConvertLongText: boolean;
    autoScrapeUrls: boolean;
    cautiousEnter: boolean;
    showCost: boolean;
    onThemeChange: (value: string) => void;
    onSansFontChange: (value: string) => void;
    onAutoConvertLongTextChange: (enabled: boolean) => void;
    onAutoScrapeUrlsChange: (enabled: boolean) => void;
    onCautiousEnterChange: (enabled: boolean) => void;
    onShowCostChange: (enabled: boolean) => void;
}

export default function GeneralTab({
    mode,
    sansFont,
    autoConvertLongText,
    autoScrapeUrls,
    cautiousEnter,
    showCost,
    onThemeChange,
    onSansFontChange,
    onAutoConvertLongTextChange,
    onAutoScrapeUrlsChange,
    onCautiousEnterChange,
    onShowCostChange,
}: GeneralTabProps) {
    const getCurrentThemeValue = () => {
        return `default-${mode}`;
    };

    return (
        <div className="space-y-6 max-w-2xl">
            <div>
                <h2 className="text-2xl font-semibold mb-2">General</h2>
            </div>
            <div className="space-y-4">
                <div>
                    <label
                        htmlFor="theme-selector"
                        className="block  font-semibold mb-2"
                    >
                        Theme
                    </label>
                    <Select
                        onValueChange={(value) => void onThemeChange(value)}
                        value={getCurrentThemeValue()}
                    >
                        <SelectTrigger id="theme-selector" className="w-full">
                            <SelectValue placeholder="Select theme" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="default-system">
                                System
                            </SelectItem>
                            <Separator />
                            <SelectItem value="default-light">Light</SelectItem>
                            <SelectItem value="default-dark">Dark</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                <div>
                    <label
                        htmlFor="sans-font"
                        className="block font-semibold mb-2"
                    >
                        Sans Font
                    </label>
                    <Select
                        onValueChange={(value) => void onSansFontChange(value)}
                        value={sansFont}
                    >
                        <SelectTrigger id="sans-font" className="w-full">
                            <SelectValue placeholder="Select sans font" />
                        </SelectTrigger>
                        <SelectContent>
                            {FONT_OPTIONS.sans.map((font) => (
                                <SelectItem
                                    key={font.value}
                                    value={font.value}
                                    onFocus={() =>
                                        void onSansFontChange(font.value)
                                    }
                                >
                                    <span
                                        className={`font-${font.value
                                            .toLowerCase()
                                            .replace(/\s+/g, "-")}`}
                                    >
                                        {font.label}
                                    </span>
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <div className="flex items-center justify-between pt-6">
                    <div className="space-y-0.5">
                        <div className="font-semibold ">
                            Auto-convert long text
                        </div>
                        <div className=" ">
                            Automatically convert pasted text longer than 5000
                            characters to a file attachment
                        </div>
                    </div>
                    <Switch
                        checked={autoConvertLongText}
                        onCheckedChange={(enabled) =>
                            void onAutoConvertLongTextChange(enabled)
                        }
                    />
                </div>

                <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                        <div className="font-semibold ">Auto-scrape URLs</div>
                        <div className=" ">
                            Automatically scrape and attach content from URLs in
                            your messages
                        </div>
                    </div>
                    <Switch
                        checked={autoScrapeUrls}
                        onCheckedChange={(enabled) =>
                            void onAutoScrapeUrlsChange(enabled)
                        }
                    />
                </div>

                <div className="flex items-center justify-between pt-2">
                    <div className="space-y-0.5">
                        <div className="font-semibold ">
                            Cautious Enter key
                        </div>
                        <div className=" ">
                            Use Cmd+Enter to send messages instead of Enter
                        </div>
                    </div>
                    <Switch
                        checked={cautiousEnter}
                        onCheckedChange={(enabled) =>
                            void onCautiousEnterChange(enabled)
                        }
                    />
                </div>

                <div className="flex items-center justify-between pt-2">
                    <div className="space-y-0.5">
                        <div className="font-semibold ">Show message cost</div>
                        <div className=" ">
                            Display cost estimates alongside messages and in the
                            sidebar
                        </div>
                    </div>
                    <Switch
                        checked={showCost}
                        onCheckedChange={(enabled) =>
                            void onShowCostChange(enabled)
                        }
                    />
                </div>
            </div>

            <div className="flex justify-end mt-4 mb-2"></div>
        </div>
    );
}

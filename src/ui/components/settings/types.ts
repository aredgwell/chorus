import { LucideIcon } from "lucide-react";

export type SettingsTabId =
    | "general"
    | "import"
    | "system-prompt"
    | "api-keys"
    | "quick-chat"
    | "permissions"
    | "base-url"
    | "usage"
    | "docs";

export interface TabConfig {
    label: string;
    icon: LucideIcon;
}

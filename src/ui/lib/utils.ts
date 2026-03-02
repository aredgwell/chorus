import { Chat } from "@core/chorus/api/ChatAPI";
import {
    isPermissionGranted,
    requestPermission,
    sendNotification,
} from "@tauri-apps/plugin-notification";
import { type ClassValue, clsx } from "clsx";
import { toast } from "sonner";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

export function formatQuickChatShortcut(shortcut: string | undefined) {
    return shortcut ? formatShortcut(shortcut) : "⌥Space";
}

export function formatShortcut(shortcut: string | undefined): string {
    if (!shortcut) return "Alt+Space";

    if (typeof shortcut === "string") {
        return shortcut
            .replace("Alt", "⌥")
            .replace(/Command|Cmd/g, "⌘")
            .replace("Shift", "⇧")
            .replace(/\+/g, "");
    }

    return "Alt+Space";
}

/**
 * Formats a date string into a UTC date object
 * Sqlite stores dates without the 'Z', so even though dates are stored in UTC,
 * we need to add it to the date string to get the correct date object that
 * can then be parsed back into the user's local time.
 */
export function convertDate(d: string): Date {
    return new Date(d + "Z");
}

/**
 * Formats a date object into a displayable string
 */
export function displayDate(d: Date): string {
    return d.toLocaleString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        timeZoneName: "short",
    });
}

/**
 * Formats a date as a compact relative string for list items.
 * e.g. "2m ago", "3h ago", "Yesterday", "Mar 2", "Dec 15, 2024"
 */
export function compactDate(d: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60_000);
    const diffHr = Math.floor(diffMs / 3_600_000);
    const diffDays = Math.floor(diffMs / 86_400_000);

    if (diffMin < 1) return "Just now";
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHr < 24) return `${diffHr}h ago`;
    if (diffDays === 1) return "Yesterday";

    const sameYear = d.getFullYear() === now.getFullYear();
    return d.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        ...(sameYear ? {} : { year: "numeric" }),
    });
}

export function projectDisplayName(name: string) {
    if (!name) return "Untitled collection";
    return name;
}

/**
 * Gets the project ID for a new chat.
 */
export function getNewChatProjectId(
    currentProjectId: string | undefined,
    currentChat: Chat | undefined,
): string {
    // If we're on a project view page, create new chat in that project
    if (
        currentProjectId &&
        currentProjectId !== "default" &&
        currentProjectId !== "quick-chat"
    ) {
        return currentProjectId;
    }
    // If we're in a chat within a project, create new chat in same project
    else if (
        currentChat?.projectId &&
        currentChat.projectId !== "default" &&
        currentChat.projectId !== "quick-chat"
    ) {
        return currentChat.projectId;
    } else {
        return "default";
    }
}

export function handleInputPasteWithAttachments(
    e: React.ClipboardEvent<HTMLTextAreaElement>,
    attachmentsData?: Array<{ path: string; isLoading: boolean }>,
    settings?: {
        autoScrapeUrls?: boolean;
        autoConvertLongText?: boolean;
    },
): {
    attachUrl?: string[];
    filePaste?: File[];
} {
    const items = Array.from(e.clipboardData.items);
    const text = e.clipboardData.getData("text/plain");

    // Handle images
    const imageItems = items.filter((item) => item.type.startsWith("image/"));
    if (imageItems.length > 0) {
        e.preventDefault();
        const files = imageItems
            .map((item) => item.getAsFile())
            .filter((file): file is File => file !== null);
        return {
            filePaste: files,
        };
    }

    // Handle long text
    if (
        settings?.autoConvertLongText &&
        text &&
        (text.split("\n").length > 90 || text.length > 5000)
    ) {
        e.preventDefault();
        return {
            filePaste: [
                new File([text], "pasted_text.txt", { type: "text/plain" }),
            ],
        };
    } else {
        // Handle URLs
        const stableUrlRegex =
            /(?:https?:\/\/[^\s]+|[^\s]+\.com(?:\/[^\s]*)*)\b/g; // urls (starting with http or https, or ending with .com) with whitespace or end of string after
        // Email regex to filter out email addresses
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        const stableUrls = Array.from(
            text.matchAll(stableUrlRegex),
            (m) => m[0],
        ).filter((url) => !emailRegex.test(url));

        // Only scrape URLs if the setting is enabled and there aren't too many URLs
        if (settings?.autoScrapeUrls !== false && stableUrls.length > 0) {
            // Skip auto-scraping if there are more than 3 URLs to prevent rate limiting
            if (stableUrls.length > 3) {
                toast.error("Too many URLs detected", {
                    description: `Found > 3 URLs in pasted text, skipping link scraping.`,
                });
                return {};
            }

            if (!attachmentsData) {
                return {};
            }

            const attachUrls = [];

            for (const url of stableUrls) {
                if (attachmentsData.find((a) => a.path === url)) {
                    continue;
                }

                attachUrls.push(url);
            }

            return {
                attachUrl: attachUrls,
            };
        } else {
            return {};
        }
    }
}

/**
 * Sends a notification with custom title and body.
 * Handles permission requests and notification sending via Tauri.
 */
export async function sendTauriNotification(
    title: string,
    body: string,
): Promise<boolean> {
    try {
        // Do you have permission to send a notification?
        let permissionGranted = await isPermissionGranted();

        // If not we need to request it
        if (!permissionGranted) {
            const permission = await requestPermission();
            permissionGranted = permission === "granted";
        }

        // Once permission has been granted we can send the notification
        if (permissionGranted) {
            sendNotification({ title, body });
            return true;
        } else {
            console.error("Notification permission not granted");
            return false;
        }
    } catch (error) {
        console.error("Failed to send notification:", error);
        return false;
    }
}

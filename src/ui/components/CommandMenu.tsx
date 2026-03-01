import { Chat } from "@core/chorus/api/ChatAPI";
import * as ChatAPI from "@core/chorus/api/ChatAPI";
import * as ModelsAPI from "@core/chorus/api/ModelsAPI";
import * as ProjectAPI from "@core/chorus/api/ProjectAPI";
import * as SearchAPI from "@core/chorus/api/SearchAPI";
import { dialogActions } from "@core/infra/DialogStore";
import { useQuery } from "@tanstack/react-query";
import { invoke } from "@tauri-apps/api/core";
import {
    convertDate,
    displayDate,
    formatQuickChatShortcut,
} from "@ui/lib/utils";
import debounce from "lodash/debounce";
import {
    ArrowLeft,
    ArrowRight,
    Folder,
    FolderPlusIcon,
    MessageCircle,
    Plus,
    ScanTextIcon,
    SearchIcon,
    Settings,
    SparklesIcon,
} from "lucide-react";
import { ReactNode,useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { useSettings } from "./hooks/useSettings";
import { SETTINGS_DIALOG_ID } from "./Settings";
import {
    Command,
    CommandDialog,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
    CommandShortcut,
} from "./ui/command";
import { DialogTitle } from "./ui/dialog";

export const COMMAND_MENU_DIALOG_ID = "command-menu";

const SEARCH_CONTEXT_LENGTH = 100;

export function CommandMenu() {
    const settings = useSettings();
    const chatsQuery = useQuery(ChatAPI.chatQueries.list());
    const chats = (chatsQuery.data ?? []).filter(
        (chat: Chat) => !chat.isNewChat,
    );
    const navigate = useNavigate();
    const [inputValue, setInputValue] = useState("");
    const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
    const [selectedValue, setSelectedValue] = useState<string>("");

    // Get model configs to map model IDs to display names
    const { data: modelConfigs } = ModelsAPI.useModelConfigs();

    const { data: searchResults = [], isLoading } =
        SearchAPI.useSearchMessages(debouncedSearchTerm);
    const { data: semanticResults = [] } =
        SearchAPI.useSemanticSearch(debouncedSearchTerm);

    const createProject = ProjectAPI.useCreateProject();

    // Deduplicate semantic results against keyword results
    const keywordChatIds = new Set(searchResults.map((r) => r.chat_id));
    const filteredSemanticResults = semanticResults.filter(
        (r) => !keywordChatIds.has(r.chatId),
    );

    const ACTIONS = [
        {
            id: "new-chat",
            label: "New chat",
            icon: Plus,
            shortcut: "⌘N",
            action: () => navigate("/"),
        },
        {
            id: "ambient-chat",
            label: "Ambient chat",
            icon: ScanTextIcon,
            shortcut: formatQuickChatShortcut(
                settings?.quickChat?.shortcut,
            ),
            action: () => {
                void invoke("show");
            },
        },
        {
            id: "new-project",
            label: "New collection",
            icon: FolderPlusIcon,
            shortcut: "⌘⇧N",
            action: () => {
                createProject.mutate();
            },
        },
        {
            id: "search",
            label: "Search all conversations",
            icon: SearchIcon,
            shortcut: "⌘⇧F",
            action: () => {
                navigate("/search");
            },
        },
        {
            id: "settings",
            label: "Settings",
            icon: Settings,
            shortcut: "⌘,",
            keepOpen: true,
            action: () => {
                dialogActions.openDialog(SETTINGS_DIALOG_ID);
            },
        },
        {
            id: "forward",
            label: "Forward",
            icon: ArrowRight,
            shortcut: "⌘]",
            action: () => {
                navigate(1);
            },
        },
        {
            id: "back",
            label: "Back",
            icon: ArrowLeft,
            shortcut: "⌘[",
            action: () => {
                navigate(-1);
            },
        },
    ];

    const debouncedSearch = useMemo(
        () =>
            debounce((value: string) => {
                setDebouncedSearchTerm(value);
            }, 500), // Increased delay to prevent updates during navigation
        [],
    );

    const handleSearchInput = (value: string) => {
        setInputValue(value);
        void debouncedSearch(value);
    };

    const handleValueChange = (value: string) => {
        setSelectedValue(value);
    };

    const getTruncatedContext = (text: string) => {
        if (!debouncedSearchTerm)
            return text.slice(0, SEARCH_CONTEXT_LENGTH);

        const index = text
            .toLowerCase()
            .indexOf(debouncedSearchTerm.toLowerCase());
        if (index === -1) return text.slice(0, SEARCH_CONTEXT_LENGTH);

        const start = Math.max(0, index - SEARCH_CONTEXT_LENGTH / 2);
        const end = Math.min(
            text.length,
            index + debouncedSearchTerm.length + SEARCH_CONTEXT_LENGTH / 2,
        );

        return (
            (start > 0 ? "..." : "") +
            text.slice(start, end) +
            (end < text.length ? "..." : "")
        );
    };

    const highlightText = (text: string) => {
        if (!debouncedSearchTerm.trim()) return text;

        try {
            // Create a safe regex pattern by treating the search term as a literal string
            const regex = new RegExp(
                escapeStringRegexp(debouncedSearchTerm),
                "gi",
            );
            const parts = text.split(regex);

            // Find all matches to preserve their original case
            const matches = text.match(regex) || [];

            // Combine parts and matches
            const result: ReactNode[] = [];
            parts.forEach((part, i) => {
                result.push(part);
                if (i < matches.length) {
                    result.push(
                        <span
                            key={i}
                            className="bg-yellow-200/50 dark:bg-yellow-500/50"
                        >
                            {matches[i]}
                        </span>,
                    );
                }
            });

            return result;
        } catch (e) {
            // Fallback to simple text display if regex fails
            console.error("Highlight failed:", e);
            return text;
        }
    };

    // Helper function to escape regex special characters
    function escapeStringRegexp(str: string) {
        // Escape characters with special meaning in regex
        return str.replace(/[|\\{}()[\]^$+*?.]/g, "\\$&");
    }

    // Helper to filter actions and chats based on search
    const { filteredActions, filteredChats } = (() => {
        const searchLower = inputValue.toLowerCase();
        const filteredActions = ACTIONS.filter((item) =>
            item.label.toLowerCase().includes(searchLower),
        );

        // Make sure to only show chats that exist (i.e., not deleted) and are not untitled when searching
        const activeChats = chats.filter(
            (chat) =>
                chat &&
                chat.id &&
                chat.title &&
                !(searchLower && chat.title === "Untitled Chat"),
        );

        const filteredChats = activeChats.filter((chat) => {
            // Filter based on title or id if title is not available
            const searchText = (chat.title || chat.id || "").toLowerCase();

            return (
                searchText.includes(searchLower) &&
                chat.title !== "Untitled Chat"
            );
        });

        return { filteredActions, filteredChats };
    })();

    function triggerAction(item: (typeof ACTIONS)[number]) {
        item.action();
        // Some actions should not force close the dialog
        // since they require navigating to another dialog instead
        if (!item.keepOpen) {
            dialogActions.closeDialog();
        }
    }

    const getDisplayName = (modelId: string): string => {
        if (modelId === "user") {
            return "You";
        }
        const config = modelConfigs?.find((c) => c.modelId === modelId);
        return config?.displayName || modelId;
    };

    return (
        <CommandDialog id={COMMAND_MENU_DIALOG_ID}>
            <DialogTitle className="sr-only">Melty</DialogTitle>
            <Command
                shouldFilter={false}
                loop
                value={selectedValue}
                onValueChange={handleValueChange}
            >
                <CommandInput
                    value={inputValue}
                    placeholder="Search messages, commands, and chats..."
                    onValueChange={handleSearchInput}
                />
                <CommandList>
                    <CommandEmpty>No results found</CommandEmpty>
                    {/* Show filtered commands/chats AND search results */}
                    {inputValue.trim() && (
                        <>
                            {/* Commands and Chats filtered manually */}
                            {filteredActions.length > 0 && (
                                <CommandGroup heading="Actions">
                                    {filteredActions.map((item) => (
                                        <CommandItem
                                            key={item.id}
                                            value={`action-${item.id}`}
                                            onSelect={() => {
                                                triggerAction(item);
                                            }}
                                        >
                                            <item.icon className="mr-2 h-4 w-4" />
                                            {item.label}
                                            <CommandShortcut>
                                                {item.shortcut}
                                            </CommandShortcut>
                                        </CommandItem>
                                    ))}
                                </CommandGroup>
                            )}
                            {filteredChats.length > 0 && (
                                <CommandGroup heading="Chats">
                                    {filteredChats.map((chat) => (
                                        <CommandItem
                                            key={chat.id}
                                            value={`chat-${chat.id}`}
                                            onSelect={() => {
                                                navigate(
                                                    `/chat/${encodeURIComponent(
                                                        chat.id,
                                                    )}`,
                                                );
                                                dialogActions.closeDialog();
                                            }}
                                        >
                                            <Folder className="mr-2 h-8 w-4" />
                                            {chat.title}
                                        </CommandItem>
                                    ))}
                                </CommandGroup>
                            )}

                            {/* Message search results */}
                            {searchResults.length > 0 && (
                                <CommandGroup
                                    heading={`Messages (${searchResults.length} results${isLoading ? "..." : ""})`}
                                >
                                    {searchResults.map((result) => (
                                        <CommandItem
                                            key={result.id}
                                            value={`message-${result.id}`}
                                            onSelect={() => {
                                                // If this is a reply, navigate to the parent chat with the chat id used as the replyId query param
                                                if (
                                                    result.parent_chat_id &&
                                                    result.reply_to_id
                                                ) {
                                                    navigate(
                                                        `/chat/${encodeURIComponent(result.parent_chat_id)}?replyId=${result.chat_id}`,
                                                    );
                                                } else {
                                                    navigate(
                                                        `/chat/${encodeURIComponent(result.chat_id)}`,
                                                    );
                                                }
                                                dialogActions.closeDialog();
                                            }}
                                        >
                                            <MessageCircle className="mr-2 h-4 w-4" />
                                            <div className="flex flex-col flex-1 overflow-hidden">
                                                {result.title && (
                                                    <div className="font-medium">
                                                        {highlightText(
                                                            result.title,
                                                        )}
                                                    </div>
                                                )}
                                                <div className="text-sm text-muted-foreground truncate">
                                                    <span className="font-medium text-sm mr-1">
                                                        {getDisplayName(
                                                            result.model,
                                                        )}
                                                        :
                                                    </span>
                                                    {highlightText(
                                                        getTruncatedContext(
                                                            result.text,
                                                        ),
                                                    )}
                                                </div>
                                                <div className="text-sm flex justify-between text-muted-foreground">
                                                    <span>
                                                        {displayDate(
                                                            convertDate(
                                                                result.created_at,
                                                            ),
                                                        )}
                                                    </span>
                                                </div>
                                            </div>
                                        </CommandItem>
                                    ))}
                                </CommandGroup>
                            )}

                            {/* Semantic search results */}
                            {filteredSemanticResults.length > 0 && (
                                <CommandGroup heading="Similar">
                                    {filteredSemanticResults.map(
                                        (result) => (
                                            <CommandItem
                                                key={result.chatId}
                                                value={`semantic-${result.chatId}`}
                                                onSelect={() => {
                                                    navigate(
                                                        `/chat/${encodeURIComponent(result.chatId)}`,
                                                    );
                                                    dialogActions.closeDialog();
                                                }}
                                            >
                                                <SparklesIcon className="mr-2 h-4 w-4 text-muted-foreground" />
                                                <div className="flex flex-col flex-1 overflow-hidden">
                                                    <div className="font-medium truncate">
                                                        {result.title ??
                                                            "Untitled Chat"}
                                                    </div>
                                                    {result.updatedAt && (
                                                        <div className="text-xs text-muted-foreground">
                                                            {displayDate(
                                                                convertDate(
                                                                    result.updatedAt,
                                                                ),
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </CommandItem>
                                        ),
                                    )}
                                </CommandGroup>
                            )}
                        </>
                    )}

                    {/* Show default view when no search input */}
                    {!inputValue.trim() && (
                        <>
                            <CommandGroup heading="Actions">
                                {ACTIONS.map((action) => (
                                    <CommandItem
                                        key={action.id}
                                        value={`action-${action.id}`}
                                        onSelect={() => {
                                            triggerAction(action);
                                        }}
                                    >
                                        <action.icon className="mr-2 h-4 w-4" />
                                        {action.label}
                                        <CommandShortcut>
                                            {action.shortcut}
                                        </CommandShortcut>
                                    </CommandItem>
                                ))}
                            </CommandGroup>
                        </>
                    )}
                </CommandList>
            </Command>
        </CommandDialog>
    );
}

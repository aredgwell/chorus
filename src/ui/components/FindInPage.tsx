import { useShortcut } from "@ui/hooks/useShortcut";
import {
    ChevronDownIcon,
    ChevronUpIcon,
    SearchIcon,
    XIcon,
} from "lucide-react";
import { useCallback, useEffect, useRef,useState } from "react";

import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function FindInPage({ dependencies = [] }: { dependencies?: any[] }) {
    const [isVisible, setIsVisible] = useState(false);
    const [searchText, setSearchText] = useState("");
    const [searchResults, setSearchResults] = useState<number>(0);
    const [currentResult, setCurrentResult] = useState<number>(0);
    const containerRef = useRef<HTMLDivElement>(null);

    // Unique ID for the search container
    const SEARCH_CONTAINER_ID = "chorus-search-container";

    // Class name for highlighted elements
    const HIGHLIGHT_CLASS = "chorus-search-highlight";
    const ACTIVE_HIGHLIGHT_CLASS = "chorus-search-highlight-active";

    // Clear all highlights from the document
    const clearHighlights = useCallback(() => {
        const highlights = document.querySelectorAll(`.${HIGHLIGHT_CLASS}`);
        highlights.forEach((highlight) => {
            const parent = highlight.parentNode;
            if (parent) {
                // Replace the highlight span with its text content
                parent.replaceChild(
                    document.createTextNode(highlight.textContent || ""),
                    highlight,
                );
                // Normalize to combine adjacent text nodes
                parent.normalize();
            }
        });
    }, [HIGHLIGHT_CLASS]);

    // Navigate to a specific result
    const navigateToResult = useCallback(
        (index: number) => {
            const highlights = document.querySelectorAll(`.${HIGHLIGHT_CLASS}`);

            // Remove active class from all highlights
            highlights.forEach((el) => {
                el.classList.remove(ACTIVE_HIGHLIGHT_CLASS);
            });

            // Set active class on current highlight
            if (highlights[index]) {
                highlights[index].classList.add(ACTIVE_HIGHLIGHT_CLASS);
                highlights[index].scrollIntoView({
                    behavior: "smooth",
                    block: "center",
                });
                setCurrentResult(index);
            }
        },
        [HIGHLIGHT_CLASS, ACTIVE_HIGHLIGHT_CLASS],
    );

    // Move to next/previous result
    const nextResult = useCallback(() => {
        if (searchResults > 0) {
            const next = (currentResult + 1) % searchResults;
            navigateToResult(next);
        }
    }, [searchResults, currentResult, navigateToResult]);

    const prevResult = useCallback(() => {
        if (searchResults > 0) {
            const prev = (currentResult - 1 + searchResults) % searchResults;
            navigateToResult(prev);
        }
    }, [searchResults, currentResult, navigateToResult]);

    useShortcut(["meta", "f"], () => {
        setIsVisible(true);
    });

    useShortcut(["escape"], () => {
        if (isVisible) {
            setIsVisible(false);
            clearHighlights();
        }
    });

    useShortcut(["meta", "g"], () => {
        if (isVisible && searchResults > 0) {
            nextResult();
        }
    });

    useShortcut(["meta", "shift", "g"], () => {
        if (isVisible && searchResults > 0) {
            prevResult();
        }
    });

    // Focus input when visible
    useEffect(() => {
        if (isVisible) {
            const input = document.getElementById("find-in-page-input");
            if (input) {
                input.focus();
            }
            // Reapply search when dialog reopens and there's existing search text
            if (searchText) {
                // Use a timeout to ensure the DOM is ready before searching
                setTimeout(() => {
                    if (searchText) {
                        performSearch();
                    }
                }, 0);
            }
        } else {
            clearHighlights();
        }
        // Don't include performSearch in dependencies to avoid circular dependency
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isVisible, searchText, clearHighlights]);

    // Clean up highlights when component unmounts
    useEffect(() => {
        return () => {
            clearHighlights();
        };
    }, [clearHighlights]);

    // Check if an element is part of the search UI
    const isPartOfSearchUI = (element: Node): boolean => {
        if (element.nodeType !== Node.ELEMENT_NODE) {
            return element.parentElement
                ? isPartOfSearchUI(element.parentElement)
                : false;
        }

        // First check using ref for more reliable exclusion
        if (containerRef.current && containerRef.current.contains(element)) {
            return true;
        }

        const el = element as Element;

        // Check if this element or any parent has our search container ID
        if (el.closest(`#${SEARCH_CONTAINER_ID}`)) {
            return true;
        }

        // Exclude common UI elements
        if (el.closest(".no-print")) {
            return true;
        }

        // Skip buttons, icons, and other UI elements
        const excludeClasses = ["button", "icon", "tooltip", "menu", "popover"];
        for (const cls of excludeClasses) {
            if (
                el.className &&
                typeof el.className === "string" &&
                el.className.includes(cls)
            ) {
                return true;
            }
        }

        return false;
    };

    // Check if a node should be searched (only include message content)
    const shouldSearchNode = (node: Node): boolean => {
        if (
            node.nodeType !== Node.ELEMENT_NODE &&
            node.nodeType !== Node.TEXT_NODE
        ) {
            return false;
        }

        // Skip if part of search UI
        if (isPartOfSearchUI(node)) {
            return false;
        }

        const el =
            node.nodeType === Node.ELEMENT_NODE
                ? (node as Element)
                : node.parentElement;
        if (!el) return false;

        // Find the closest message container
        const messageContainer = el.closest('[id^="message-"]');

        // If not in a message container, don't search
        if (!messageContainer) {
            return false;
        }

        // Skip UI elements within messages
        if (el.closest(".no-print")) {
            return false;
        }

        // Skip buttons and controls
        const excludedSelectors = [
            "button",
            '[role="button"]',
            ".copy-button",
            ".hover\\:text-foreground",
            ".group-hover",
        ];

        for (const selector of excludedSelectors) {
            if (el.closest(selector)) {
                return false;
            }
        }

        return true;
    };

    // Perform search with debouncing
    const performSearch = useCallback(() => {
        // Clear previous highlights
        clearHighlights();

        if (!searchText) return;

        // Make sure search container exists
        const searchContainer = document.getElementById(SEARCH_CONTAINER_ID);
        if (!searchContainer && !containerRef.current) {
            console.warn(
                "Search container not found, can't filter UI elements",
            );
        }

        // Get all text nodes in the document
        const textNodes: Node[] = [];
        const walker = document.createTreeWalker(
            document.body,
            NodeFilter.SHOW_TEXT,
            {
                acceptNode: (node) => {
                    // Skip empty text nodes and whitespace-only nodes
                    if (!node.textContent || node.textContent.trim() === "") {
                        return NodeFilter.FILTER_REJECT;
                    }

                    // Skip script and style elements
                    const parent = node.parentElement;
                    if (
                        parent?.tagName === "SCRIPT" ||
                        parent?.tagName === "STYLE" ||
                        // Skip if this node is part of our search UI (using multiple checks)
                        isPartOfSearchUI(node) ||
                        // Double-check: Skip any nodes inside search container
                        (containerRef.current &&
                            containerRef.current.contains(node)) ||
                        // Only include nodes that should be searched
                        !shouldSearchNode(node) ||
                        // Skip if the node doesn't contain our search text
                        !node.textContent
                            ?.toLowerCase()
                            .includes(searchText.toLowerCase())
                    ) {
                        return NodeFilter.FILTER_REJECT;
                    }

                    // Special case: Include code blocks but only if they contain the search text
                    const isInCodeElement =
                        parent?.tagName === "CODE" ||
                        parent?.closest("pre") ||
                        parent?.closest("code");

                    if (isInCodeElement) {
                        const codeText = node.textContent;
                        return codeText
                            .toLowerCase()
                            .includes(searchText.toLowerCase())
                            ? NodeFilter.FILTER_ACCEPT
                            : NodeFilter.FILTER_REJECT;
                    }

                    return NodeFilter.FILTER_ACCEPT;
                },
            } as NodeFilter,
        );

        let node;
        while ((node = walker.nextNode())) {
            textNodes.push(node);
        }

        // Create a style for our highlights if it doesn't exist
        if (!document.getElementById("chorus-search-highlight-style")) {
            const style = document.createElement("style");
            style.id = "chorus-search-highlight-style";
            style.innerHTML = `
                .${HIGHLIGHT_CLASS} {
                    background-color: rgba(255, 255, 0, 0.3);
                    border-radius: 2px;
                    padding: 0 2px;
                    margin: 0 -2px;
                    box-decoration-break: clone;
                    -webkit-box-decoration-break: clone;
                }
                .${ACTIVE_HIGHLIGHT_CLASS} {
                    background-color: rgba(255, 150, 0, 0.5);
                    position: relative;
                    z-index: 1;
                }
                
                /* Dark theme adjustments */
                @media (prefers-color-scheme: dark) {
                    .${HIGHLIGHT_CLASS} {
                        background-color: rgba(255, 255, 0, 0.2);
                        border-bottom: 1px solid rgba(255, 255, 0, 0.5);
                    }
                    .${ACTIVE_HIGHLIGHT_CLASS} {
                        background-color: rgba(255, 150, 0, 0.3);
                        border-bottom: 1px solid rgba(255, 150, 0, 0.7);
                    }
                }
            `;
            document.head.appendChild(style);
        }

        // Highlight matched text in nodes
        let highlightCount = 0;
        const regex = new RegExp(
            searchText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
            "gi",
        );

        textNodes.forEach((textNode) => {
            // Final safety check - don't highlight inside our search UI
            if (isPartOfSearchUI(textNode)) return;

            const text = textNode.textContent || "";
            const fragments = text.split(regex);

            if (fragments.length <= 1) return; // No matches

            const parent = textNode.parentNode;
            if (!parent) return;

            // Create a document fragment to hold the highlighted text
            const frag = document.createDocumentFragment();

            let i = 0;
            text.replace(regex, (match, _offset) => {
                // Add text before match
                const beforeText = fragments[i++];
                if (beforeText) {
                    frag.appendChild(document.createTextNode(beforeText));
                }

                // Create highlight element
                const highlightSpan = document.createElement("span");
                highlightSpan.textContent = match;
                highlightSpan.className = HIGHLIGHT_CLASS;
                highlightSpan.dataset.resultIndex = String(highlightCount++);
                frag.appendChild(highlightSpan);

                return match; // This return value is ignored
            });

            // Add the final text fragment (after the last match)
            if (i < fragments.length) {
                frag.appendChild(document.createTextNode(fragments[i]));
            }

            // Replace the original text node with our highlighted version
            parent.replaceChild(frag, textNode);
        });

        setSearchResults(highlightCount);

        // Navigate to the first result if any found
        if (highlightCount > 0) {
            setCurrentResult(0);
            navigateToResult(0);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchText]);

    // Apply search when text changes
    useEffect(() => {
        if (searchText) {
            const debounceTimer = setTimeout(() => {
                performSearch();
            }, 250); // 250ms debounce
            return () => clearTimeout(debounceTimer);
        } else {
            clearHighlights();
            setSearchResults(0);
        }
    }, [searchText, performSearch, clearHighlights]);

    // Re-apply highlights when dependencies change
    useEffect(() => {
        if (isVisible && searchText) {
            performSearch();
        }
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, react-hooks/exhaustive-deps
    }, [...dependencies]);

    // Handle keyboard events for navigation
    const handleInputKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter") {
            e.preventDefault();
            if (e.shiftKey) {
                prevResult();
            } else {
                nextResult();
            }
        }
    };

    if (!isVisible) return null;

    return (
        <div
            ref={containerRef}
            id={SEARCH_CONTAINER_ID}
            className="fixed top-6 left-1/2 -translate-x-1/2 z-50 flex items-center bg-background border rounded-lg shadow-md p-2 w-96"
        >
            <div className="flex items-center flex-1">
                <SearchIcon className="h-4 w-4 text-muted-foreground mr-2 ml-1" />
                <Input
                    id="find-in-page-input"
                    type="text"
                    value={searchText}
                    onChange={(e) => {
                        setSearchText(e.target.value);
                    }}
                    onKeyDown={handleInputKeyDown}
                    placeholder="Find in chat..."
                    className="text-sm border-0 focus:ring-0 focus:outline-hidden h-7 flex-1"
                    spellCheck={false}
                    autoFocus
                />
            </div>
            {searchResults > 0 && (
                <span className="text-sm text-muted-foreground mx-2 select-none">
                    {currentResult + 1}/{searchResults}
                </span>
            )}
            <div className="flex gap-1">
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={prevResult}
                            disabled={searchResults === 0}
                        >
                            <ChevronUpIcon className="w-4 h-4" />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">
                        Previous{" "}
                        <kbd className="ml-1">
                            <span className="text-[14px]! mb-1">⇧</span>
                            <span>↵</span>
                        </kbd>
                    </TooltipContent>
                </Tooltip>

                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={nextResult}
                            disabled={searchResults === 0}
                        >
                            <ChevronDownIcon className="w-4 h-4" />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">
                        Next{" "}
                        <kbd className="ml-1">
                            <span>↵</span>
                        </kbd>
                    </TooltipContent>
                </Tooltip>

                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => {
                                setIsVisible(false);
                                clearHighlights();
                            }}
                        >
                            <XIcon className="w-4 h-4" />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">
                        Close <kbd className="ml-1">ESC</kbd>
                    </TooltipContent>
                </Tooltip>
            </div>
        </div>
    );
}

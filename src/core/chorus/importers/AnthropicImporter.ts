/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-explicit-any */
import * as DB from "@core/chorus/DB";
import { UserToolCall, UserToolResult } from "@core/chorus/Toolsets";
import { v4 as uuidv4 } from "uuid";

import {
    createChat,
    createMessageSet,
    createProject,
    ProcessedMessagePart,
    restoreChatUpdatedAt,
} from "./util";

/**
 * This file imports conversations from Anthropic conversation exports.
 * You can always view an example format file in /resources/claude_conversations.json.
 *
 * One important thing to be aware of is that we cannot import attachments from Anthropic, since they
 * only return us a file name.
 *
 * For tools and artifacts we simply render the raw JSON returned, since mapping their toolsets to display
 * prettily in our UI is not straightforward.
 *
 * We try to infer types based on what we've seen from Anthropic conversation data, but there are some places
 * we purposely leave "any" when our tendency is to simply JSON encode the data and display that in the UI
 * (since we want to be sensitive to not have to break when these types change under the hood). - Omid
 */

export const ANTHROPIC_IMPORT_PREFIX = "anthropic_import";

interface AnthropicConversation {
    uuid: string;
    name: string;
    created_at: string;
    updated_at: string;
    chat_messages: AnthropicMessage[];
}

interface AnthropicMessage {
    uuid: string;
    text: string;
    content: AnthropicContentItem[];
    sender: "human" | "assistant";
    created_at: string;
    updated_at: string;
}

interface AnthropicContentItem {
    type: "text" | "tool_use" | "tool_result"; // these are the only types we know how to parse, so manually enumerating them
    text?: string;
    name?: string;
    input?: any;
    content?: any; // any sub content, only used for tools, which we JSON parse to display as a block in the UI
}

export class AnthropicImporter {
    private db: typeof DB.db;

    constructor() {
        this.db = DB.db;
    }

    /**
     * Imports conversations from Anthropic export format
     * @param jsonData The parsed JSON data from Anthropic export
     * @param onProgress Optional callback to report progress
     * @returns Number of conversations imported
     */
    async importConversations(
        jsonData: any,
        onProgress?: (current: number, total: number) => void,
    ): Promise<{ imported: number; failed: number }> {
        if (import.meta.env.DEV) console.time("importConversations");
        let failedCount = 0;
        let importedCount = 0;

        // Validate the data structure
        if (!Array.isArray(jsonData)) {
            throw new Error(
                "Invalid Anthropic export format: expected an array of conversations",
            );
        }

        // First, ensure the "Anthropic imports" project exists
        const projectId = await createProject("Anthropic imports", this.db);

        const totalConversations = jsonData.length;

        // Report initial progress
        if (onProgress) {
            onProgress(0, totalConversations);
        }

        // Process each conversation
        for (let i = 0; i < totalConversations; i++) {
            const conversation = jsonData[i] as AnthropicConversation;
            try {
                await this.importSingleConversation(conversation, projectId);
                importedCount++;
            } catch (error) {
                console.error(
                    `Failed to import conversation "${conversation.name}":`,
                    error,
                );
                failedCount++;
            }

            // Report progress after each conversation
            if (onProgress) {
                onProgress(i + 1, totalConversations);
            }
        }

        if (import.meta.env.DEV) console.timeEnd("importConversations");
        return { imported: importedCount, failed: failedCount };
    }

    /**
     * Imports a single conversation
     */
    private async importSingleConversation(
        conversation: AnthropicConversation,
        projectId: string,
    ): Promise<void> {
        if (import.meta.env.DEV)
            console.log(`Importing conversation: ${conversation.name}`);

        const chatId = await createChat(
            conversation.name,
            conversation.created_at,
            conversation.updated_at,
            projectId,
            this.db,
        );

        // Process each message pair (user message + assistant response)
        let messageSetLevel = 0;
        let i = 0;

        while (i < conversation.chat_messages.length) {
            const humanMessage = conversation.chat_messages[i];

            // Skip if not a human message
            if (humanMessage.sender !== "human") {
                i++;
                continue;
            }

            // Look for the corresponding assistant message
            const assistantMessage = conversation.chat_messages[i + 1];
            const importedMessageSet = {
                chat_id: chatId,
                level: messageSetLevel,
            };

            if (assistantMessage && assistantMessage.sender === "assistant") {
                const assistantMessageFormatted = this.extractTextFromContent(
                    assistantMessage?.content,
                );
                const messageParts = this.processContentToMessageParts(
                    assistantMessage.content,
                );

                // We have a complete pair
                await createMessageSet(
                    importedMessageSet,
                    this.extractTextFromContent(humanMessage.content),
                    assistantMessageFormatted,
                    messageParts,
                    this.db,
                );
                i += 2; // Move past both messages
            } else {
                // Only human message, no response
                await createMessageSet(
                    importedMessageSet,
                    this.extractTextFromContent(humanMessage.content),
                    null,
                    null,
                    this.db,
                );
                i += 1;
            }

            messageSetLevel++;
        }

        // reset updated_at since chat table trigger will override it
        await restoreChatUpdatedAt(chatId, conversation.updated_at, this.db);
    }

    private prettyXMLTagName(tagName: string): string {
        if (tagName.toLowerCase() === "antartifact") {
            return "Artifact";
        } else if (tagName.toLowerCase() === "antml:function_calls") {
            return "Function Calls";
        } else {
            return tagName;
        }
    }

    /**
     * Parses XML tags from text content and creates separate parts for each
     */
    private parseXMLTags(
        text: string,
    ): Array<{ type: "text" | "xml"; content: string; tagName?: string }> {
        const parts: Array<{
            type: "text" | "xml";
            content: string;
            tagName?: string;
        }> = [];

        // More specific regex patterns for known Anthropic XML tags
        const tagPatterns = [
            "antthinking",
            "antThinking", // at some point Anthropic stopped capitalizing this tag
            "antartifact",
            "antArtifact",
            "antml:thinking",
            "antml:function_calls",
            "antml:artifact",
        ];

        let remainingText = text;

        while (remainingText.length > 0) {
            let foundMatch = false;
            let earliestMatch: {
                index: number;
                length: number;
                tagName: string;
                content: string;
            } | null = null;

            // Find the earliest occurring tag
            for (const tagName of tagPatterns) {
                // Look for opening tag
                const openTag = `<${tagName}`;
                const openIndex = remainingText.indexOf(openTag);

                if (openIndex !== -1) {
                    // Find the closing tag
                    const closeTag = `</${tagName}>`;
                    const closeIndex = remainingText.indexOf(
                        closeTag,
                        openIndex,
                    );

                    if (closeIndex !== -1) {
                        const fullMatch = remainingText.substring(
                            openIndex,
                            closeIndex + closeTag.length,
                        );

                        if (!earliestMatch || openIndex < earliestMatch.index) {
                            earliestMatch = {
                                index: openIndex,
                                length: fullMatch.length,
                                tagName: tagName.toLowerCase(),
                                content: fullMatch,
                            };
                        }
                    }
                }
            }

            if (earliestMatch) {
                // Add any text before the XML tag
                if (earliestMatch.index > 0) {
                    const textContent = remainingText
                        .substring(0, earliestMatch.index)
                        .trim();
                    if (textContent) {
                        parts.push({ type: "text", content: textContent });
                    }
                }

                // Add the XML tag
                parts.push({
                    type: "xml",
                    content: earliestMatch.content,
                    tagName: earliestMatch.tagName,
                });

                // Move past this match
                remainingText = remainingText.substring(
                    earliestMatch.index + earliestMatch.length,
                );
                foundMatch = true;
            }

            if (!foundMatch) {
                // No more XML tags found, add remaining text
                if (remainingText.trim()) {
                    parts.push({ type: "text", content: remainingText.trim() });
                }
                break;
            }
        }

        // If no parts were created, return the original text
        if (parts.length === 0) {
            parts.push({ type: "text", content: text });
        }

        return parts;
    }

    /**
     * Processes Anthropic content array into message parts with tool calls/results
     * Following Chorus's pattern where:
     * - Assistant messages have content + optional toolCalls
     * - Tool results are in separate parts with only toolResults
     * - XML tags are converted to tool calls
     *
     * Note: Anthropic exports don't include IDs linking tool calls to results,
     * so we generate IDs and match them based on order
     */
    private processContentToMessageParts(
        content: AnthropicContentItem[],
    ): ProcessedMessagePart[] {
        const parts: ProcessedMessagePart[] = [];

        // First pass: collect tool calls and assign IDs
        const toolCallIds: Map<number, string> = new Map();

        for (let i = 0; i < content.length; i++) {
            if (content[i].type === "tool_use") {
                toolCallIds.set(i, uuidv4());
            }
        }

        // Second pass: build message parts
        let currentTextAndCalls: ProcessedMessagePart = {
            content: "",
            tool_calls: [],
            tool_results: [],
        };
        let currentToolCallIndex = 0;

        for (let i = 0; i < content.length; i++) {
            const item = content[i];

            if (item.type === "text" && item.text) {
                // Parse XML tags from the text
                const xmlParts = this.parseXMLTags(item.text);

                for (const xmlPart of xmlParts) {
                    if (xmlPart.type === "text") {
                        // If we have pending tool calls, finalize that part first
                        if (currentTextAndCalls.tool_calls.length > 0) {
                            parts.push(currentTextAndCalls);
                            currentTextAndCalls = {
                                content: "",
                                tool_calls: [],
                                tool_results: [],
                            };
                        }
                        currentTextAndCalls.content = xmlPart.content;
                    } else if (xmlPart.type === "xml") {
                        // Handle thinking tags specially - convert them to the format the UI expects
                        if (
                            xmlPart.tagName?.toLowerCase() === "antthinking" ||
                            xmlPart.tagName?.toLowerCase() === "antml:thinking"
                        ) {
                            // First, finalize any pending text part
                            if (
                                currentTextAndCalls.content ||
                                currentTextAndCalls.tool_calls.length > 0
                            ) {
                                parts.push(currentTextAndCalls);
                                currentTextAndCalls = {
                                    content: "",
                                    tool_calls: [],
                                    tool_results: [],
                                };
                            }

                            // Extract just the content inside the XML tags
                            const openTagEnd = xmlPart.content.indexOf(">");
                            const closeTagStart =
                                xmlPart.content.lastIndexOf("</");

                            let innerContent = xmlPart.content;
                            if (
                                openTagEnd !== -1 &&
                                closeTagStart !== -1 &&
                                closeTagStart > openTagEnd
                            ) {
                                innerContent = xmlPart.content
                                    .substring(openTagEnd + 1, closeTagStart)
                                    .trim();
                            }

                            // Add the thinking block as a text part with <think> tags
                            // Always mark imported thinking blocks as complete by wrapping in a closing tag
                            // This <think> tag will be parsed by the UI rendering code to display a thinking block
                            parts.push({
                                content: `<think>${innerContent}</think>`,
                                tool_calls: [],
                                tool_results: [],
                            });
                        } else {
                            // For other XML tags, handle as tool calls as before
                            // First, finalize any pending text part
                            if (
                                currentTextAndCalls.content ||
                                currentTextAndCalls.tool_calls.length > 0
                            ) {
                                parts.push(currentTextAndCalls);
                                currentTextAndCalls = {
                                    content: "",
                                    tool_calls: [],
                                    tool_results: [],
                                };
                            }

                            // Create tool call for XML tag
                            const toolCallId = uuidv4();
                            const toolCall: UserToolCall = {
                                id: toolCallId,
                                namespacedToolName: this.prettyXMLTagName(
                                    xmlPart.tagName ?? "Anthropic XML Tag",
                                ),
                                args: {},
                                toolMetadata: {
                                    description: `XML ${xmlPart.tagName} tag from Anthropic`,
                                },
                            };

                            // Extract just the content inside the XML tags
                            // Find the end of the opening tag
                            const openTagEnd = xmlPart.content.indexOf(">");
                            // Find the start of the closing tag
                            const closeTagStart =
                                xmlPart.content.lastIndexOf("</");

                            let innerContent = xmlPart.content;
                            if (
                                openTagEnd !== -1 &&
                                closeTagStart !== -1 &&
                                closeTagStart > openTagEnd
                            ) {
                                innerContent = xmlPart.content
                                    .substring(openTagEnd + 1, closeTagStart)
                                    .trim();
                            }

                            // Create tool result with just the inner content
                            const toolResult: UserToolResult = {
                                id: toolCallId,
                                content: innerContent,
                            };

                            // Add as separate parts
                            parts.push({
                                content: "",
                                tool_calls: [toolCall],
                                tool_results: [],
                            });

                            parts.push({
                                content: "",
                                tool_calls: [],
                                tool_results: [toolResult],
                            });
                        }
                    }
                }
            } else if (item.type === "tool_use") {
                const toolCallId = toolCallIds.get(i)!;
                const toolCall: UserToolCall = {
                    id: toolCallId,
                    namespacedToolName: `${ANTHROPIC_IMPORT_PREFIX}_${item.name || "unknown"}`,
                    args: {},
                    toolMetadata: {
                        description: `Imported tool call from Anthropic`,
                    },
                };
                currentTextAndCalls.tool_calls.push(toolCall);
            } else if (item.type === "tool_result") {
                // First, finalize any pending text/calls part
                if (
                    currentTextAndCalls.content ||
                    currentTextAndCalls.tool_calls.length > 0
                ) {
                    parts.push(currentTextAndCalls);
                    currentTextAndCalls = {
                        content: "",
                        tool_calls: [],
                        tool_results: [],
                    };
                }

                // Find the corresponding tool call ID by matching order
                let toolCallId = uuidv4(); // default if we can't match
                let toolCallCount = 0;
                for (let j = 0; j < i; j++) {
                    if (content[j].type === "tool_use") {
                        if (toolCallCount === currentToolCallIndex) {
                            toolCallId = toolCallIds.get(j)!;
                            break;
                        }
                        toolCallCount++;
                    }
                }
                currentToolCallIndex++;

                // Create a separate part for tool results
                const toolResult: UserToolResult = {
                    id: toolCallId,
                    content: JSON.stringify(
                        {
                            type: "tool_result",
                            content: item.content,
                        },
                        null,
                        2,
                    ),
                };
                parts.push({
                    content: "",
                    tool_calls: [],
                    tool_results: [toolResult],
                });
            }
        }

        // Don't forget the last part if it has content or tool calls
        if (
            currentTextAndCalls.content ||
            currentTextAndCalls.tool_calls.length > 0
        ) {
            parts.push(currentTextAndCalls);
        }

        // If no parts were created, create a single part with the full text
        if (parts.length === 0) {
            parts.push({
                content: this.extractTextFromContent(content),
                tool_calls: [],
                tool_results: [],
            });
        }

        return parts;
    }

    /**
     * Extracts plain text from Anthropic content array
     * Used for the main message text display
     * Now also removes XML tags for cleaner display (which are parsed in processContentToMessageParts)
     */
    private extractTextFromContent(content: AnthropicContentItem[]): string {
        const textParts: string[] = [];

        for (const item of content) {
            if (item.type === "text" && item.text) {
                const xmlParts = this.parseXMLTags(item.text);

                for (const xmlPart of xmlParts) {
                    // XML types will be parsed in processContentToMessageParts
                    if (xmlPart.type === "text") {
                        if (xmlPart.content.trim()) {
                            textParts.push(xmlPart.content.trim());
                        }
                    }
                    // Other XML tags are omitted from the display text
                }
            } else if (item.type === "tool_use") {
                // For display purposes, show a placeholder
                textParts.push(`[Tool used: ${item.name || "unknown"}]`);
            } else if (item.type === "tool_result") {
                // For display purposes, show a simplified result
                textParts.push("[Tool result received]");
            }
        }

        return textParts.join("\n\n").trim() || "No content";
    }
}

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
import { formatSQLiteDateTime } from "./util";

/**
 * This file imports conversations from OpenAI conversation exports.
 * You can always view an example format file in /resources/openai_conversations.json.
 *
 * One important thing to be aware of is that we cannot import attachments from OpenAI, since they
 * only return us a file name.
 *
 * For tools and artifacts we simply render the raw JSON returned, since mapping their toolsets to display
 * prettily in our UI is not straightforward.
 *
 * We try to infer types based on what we've seen from OpenAI conversation data, but there are some places
 * we purposely leave "any" when our tendency is to simply JSON encode the data and display that in the UI
 * (since we want to be sensitive to not have to break when these types change under the hood).
 *
 * Content format: OpenAI doesn't intermix their tool calls / reasoning / etc. within the response text itself.
 * They're all separate parts of the response, so we can't intermix tool calls within our messages like we can
 * with Anthropic data.
 *
 * Another note is that OpenAIs format is a little weird. They show many sub-models talking to each other,
 * which makes parsing out the useful tool call information rather difficult. They also use different
 * schemas across different tool types, so it's difficult to easily capture that logic.
 *
 * Thus, we simply try to encapsulate each of those as tool calls and just render the raw JSON in Chorus' UI,
 * but maybe this will prove to be too noisy? - Omid
 */

export const OPENAI_IMPORT_PREFIX = "openai_import";

interface OpenAIMessage {
    id: string;
    author: {
        role: "system" | "user" | "assistant" | "tool";
        name?: string | null;
        metadata?: any;
    };
    create_time: number | null;
    update_time?: number | null;
    content: {
        content_type:
            | "text"
            | "code"
            | "execution_output"
            | "multimodal_text"
            | "thoughts"
            | "reasoning_recap";
        parts?: string[];
        text?: string;
        language?: string;
        result?: string;
        thoughts?: string[];
        content?: string;
        [key: string]: any;
    };
    status: string;
    metadata?: any;
    recipient?: string;
    [key: string]: any;
}

/**
 * OpenAI conversations have many nodes that are connected to each other via a "mapping" key
 * which contains each part of the conversation with a "parent" and "children" key.
 */
interface OpenAINode {
    id: string;
    message: OpenAIMessage | null;
    parent: string | null;
    children: string[];
}

interface OpenAIConversation {
    title: string;
    create_time: number;
    update_time: number;
    mapping: Record<string, OpenAINode>;
    [key: string]: any;
}

export class OpenAIImporter {
    private db: typeof DB.db;

    constructor() {
        this.db = DB.db;
    }

    /**
     * Imports conversations from OpenAI export format
     * @param jsonData The parsed JSON data from OpenAI export
     * @param onProgress Optional callback to report progress
     * @returns Number of conversations imported
     */
    async importConversations(
        jsonData: any,
        onProgress?: (current: number, total: number) => void,
    ): Promise<{ imported: number; failed: number }> {
        if (import.meta.env.DEV) console.time("importConversations");
        let importedCount = 0;
        let failedCount = 0;

        // Validate the data structure
        if (!Array.isArray(jsonData)) {
            throw new Error(
                "Invalid OpenAI export format: expected an array of conversations",
            );
        }

        // First, ensure the "OpenAI imports" project exists
        const projectId = await createProject("OpenAI imports", this.db);

        const totalConversations = jsonData.length;

        // Report initial progress
        if (onProgress) {
            onProgress(0, totalConversations);
        }

        // Process each conversation
        for (let i = 0; i < totalConversations; i++) {
            const conversation = jsonData[i] as OpenAIConversation;
            try {
                await this.importSingleConversation(conversation, projectId);
                importedCount++;
            } catch (error) {
                console.error(
                    `Failed to import conversation "${conversation.title}":`,
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
        conversation: OpenAIConversation,
        projectId: string,
    ): Promise<void> {
        if (import.meta.env.DEV) console.log(`Importing conversation: ${conversation.title}`);

        // Create a new chat using conversation-level timestamps
        // Format dates as SQLite datetime format: "YYYY-MM-DD HH:MM:SS"
        const createdDate = new Date(conversation.create_time * 1000);
        const updatedDate = new Date(conversation.update_time * 1000);

        const chatCreatedAt = formatSQLiteDateTime(createdDate);
        const chatUpdatedAt = formatSQLiteDateTime(updatedDate);

        const chatId = await createChat(
            conversation.title,
            chatCreatedAt,
            chatUpdatedAt,
            projectId,
            this.db,
        );

        // Extract the conversation flow from the mapping
        const messages = this.extractMessagesFromMapping(conversation.mapping);

        // Process each message pair (user message + assistant/tool response)
        let messageSetLevel = 0;
        let i = 0;

        while (i < messages.length) {
            const userMessage = messages[i];

            // Skip if not a user message
            if (userMessage.author.role !== "user") {
                i++;
                continue;
            }

            // Look for the corresponding assistant/tool message(s)
            const responseMessages: OpenAIMessage[] = [];
            let j = i + 1;
            while (
                j < messages.length &&
                (messages[j].author.role === "assistant" ||
                    messages[j].author.role === "tool")
            ) {
                responseMessages.push(messages[j]);
                j++;
            }

            const userText = this.extractTextFromMessage(userMessage);
            const { text: aiText, parts } =
                this.processResponseMessages(responseMessages);

            if (responseMessages.length > 0) {
                // We have user message + responses
                await createMessageSet(
                    { chat_id: chatId, level: messageSetLevel },
                    userText,
                    aiText,
                    parts,
                    this.db,
                );
                i = j; // Move past all processed messages
            } else {
                // Only user message, no response
                await createMessageSet(
                    { chat_id: chatId, level: messageSetLevel },
                    userText,
                    null,
                    null,
                    this.db,
                );
                i += 1;
            }

            messageSetLevel++;
        }

        if (import.meta.env.DEV) console.log(
            `Imported ${messageSetLevel} message sets for "${conversation.title}"`,
        );

        // Restore the original updated_at timestamp since chat table trigger will override it
        await restoreChatUpdatedAt(
            chatId,
            formatSQLiteDateTime(updatedDate),
            this.db,
        );
    }

    /**
     * Extracts messages in chronological order from OpenAI's mapping structure
     */
    private extractMessagesFromMapping(
        mapping: Record<string, OpenAINode>,
    ): OpenAIMessage[] {
        const messages: OpenAIMessage[] = [];

        // Find the root node and traverse the tree
        const rootNode = Object.values(mapping).find(
            (node) => node.parent === null,
        );
        if (!rootNode) return messages;

        // BFS to get messages in order
        const queue: string[] = rootNode.children || [];
        const visited = new Set<string>();

        while (queue.length > 0) {
            const nodeId = queue.shift()!;
            if (visited.has(nodeId)) continue;
            visited.add(nodeId);

            const node = mapping[nodeId];
            if (!node) continue;

            // Add the message if it exists and is not system
            if (node.message && node.message.author.role !== "system") {
                messages.push(node.message);
            }

            // Add children to queue
            if (node.children) {
                queue.push(...node.children);
            }
        }

        return messages;
    }

    /**
     * Processes response messages to extract text and tool usage
     * OpenAI clumps both tool calls and tool results into a single tool JSON object,
     * so we'll need to split them out into separate parts in this function.
     */
    private processResponseMessages(messages: OpenAIMessage[]): {
        text: string;
        parts: ProcessedMessagePart[];
    } {
        // build up text parts to display at the end after all tool calls are processed
        const textParts: string[] = [];
        const parts: ProcessedMessagePart[] = [];

        for (let i = 0; i < messages.length; i++) {
            const message = messages[i];

            // Handle tool messages or messages not meant for "all" recipients
            if (
                message.author.role === "tool" ||
                (message.recipient && message.recipient !== "all")
            ) {
                const toolCallId = uuidv4();

                // Create a tool call for these messages
                const toolCall: UserToolCall = {
                    id: toolCallId,
                    namespacedToolName: `${OPENAI_IMPORT_PREFIX}_${message.author.role}_message`,
                    args: {},
                    toolMetadata: {
                        description: `${message.author.role} message${message.recipient ? ` to ${message.recipient}` : ""}`,
                    },
                };

                // Always JSON encode the whole response since it could have other useful data to display
                // not just in text output content
                const resultContent = JSON.stringify(message, null, 2);

                const toolResult: UserToolResult = {
                    id: toolCallId,
                    content: resultContent,
                };

                // Create tool call part
                parts.push({
                    content: "",
                    tool_calls: [toolCall],
                    tool_results: [],
                });

                // Create tool result part immediately after
                parts.push({
                    content: "",
                    tool_calls: [],
                    tool_results: [toolResult],
                });
                continue;
            }

            // Handle thoughts and reasoning
            if (message.content.content_type === "thoughts") {
                const thoughts = message.content.thoughts;
                if (
                    thoughts &&
                    Array.isArray(thoughts) &&
                    thoughts.length > 0
                ) {
                    const toolCallId = uuidv4();

                    const toolCall: UserToolCall = {
                        id: toolCallId,
                        namespacedToolName: `${OPENAI_IMPORT_PREFIX}_thoughts`,
                        args: {},
                        toolMetadata: {
                            description: "OpenAI thoughts and reasoning",
                        },
                    };

                    const toolResult: UserToolResult = {
                        id: toolCallId,
                        content: thoughts.join("\n\n"),
                    };

                    // Create tool call part
                    parts.push({
                        content: "",
                        tool_calls: [toolCall],
                        tool_results: [],
                    });

                    // Create tool result part immediately after
                    parts.push({
                        content: "",
                        tool_calls: [],
                        tool_results: [toolResult],
                    });
                }
                continue;
            }

            // Handle reasoning recap
            if (message.content.content_type === "reasoning_recap") {
                const content = message.content.content;
                if (
                    content &&
                    content !== "" &&
                    content !== "Thought for 0 seconds"
                ) {
                    const toolCallId = uuidv4();

                    const toolCall: UserToolCall = {
                        id: toolCallId,
                        namespacedToolName: `${OPENAI_IMPORT_PREFIX}_reasoning_recap`,
                        args: {},
                        toolMetadata: {
                            description: "OpenAI reasoning summary",
                        },
                    };

                    const toolResult: UserToolResult = {
                        id: toolCallId,
                        content: content,
                    };

                    // Create tool call part
                    parts.push({
                        content: "",
                        tool_calls: [toolCall],
                        tool_results: [],
                    });

                    // Create tool result part immediately after
                    parts.push({
                        content: "",
                        tool_calls: [],
                        tool_results: [toolResult],
                    });
                }
                continue;
            }

            if (message.content.content_type === "text") {
                const text = this.extractTextFromMessage(message);
                if (text) {
                    // Only add to textParts if this is an assistant message for "all"
                    if (
                        message.author.role === "assistant" &&
                        (!message.recipient || message.recipient === "all")
                    ) {
                        textParts.push(text);
                    }

                    // Create a new part for each text message to maintain ordering
                    parts.push({
                        content: text,
                        tool_calls: [],
                        tool_results: [],
                    });
                }
            } else if (message.content.content_type === "code") {
                const codeText = message.content.text || "";
                const language = message.content.language || "unknown";

                // Skip the first code block if it's just echoing the user's query
                // This typically appears as search("user's question")
                if (
                    i <= 1 &&
                    codeText.startsWith("search(") &&
                    codeText.includes(")")
                ) {
                    continue;
                }

                const toolCallId = uuidv4();

                const toolCall: UserToolCall = {
                    id: toolCallId,
                    namespacedToolName: `${OPENAI_IMPORT_PREFIX}_code_interpreter`,
                    args: {
                        language: language,
                    },
                    toolMetadata: {
                        description: `Imported code execution from OpenAI`,
                    },
                };

                const toolResult: UserToolResult = {
                    id: toolCallId,
                    content: codeText,
                };

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

        // If no parts were created but we have text, create a single part
        if (parts.length === 0 && textParts.length > 0) {
            parts.push({
                content: textParts.join("\n\n"),
                tool_calls: [],
                tool_results: [],
            });
        }

        return {
            text: textParts.join("\n\n").trim() || "No content",
            parts,
        };
    }

    /**
     * Cleans up Unicode characters that don't render well
     */
    private cleanUnicodeText(text: string): string {
        if (!text) return text;

        // Replace common problematic Unicode characters
        text = text
            .replace(/[\u2018\u2019]/g, "'") // Smart single quotes
            .replace(/[\u201C\u201D]/g, '"') // Smart double quotes
            .replace(/\u2013/g, "-") // En dash
            .replace(/\u2014/g, "--") // Em dash
            .replace(/\u2026/g, "...") // Ellipsis
            .replace(/\u00A0/g, " ") // Non-breaking space
            .replace(/\u200B/g, "") // Zero-width space
            .replace(/\u00AD/g, "") // Soft hyphen
            .replace(/[\u2028\u2029]/g, "\n"); // Line and paragraph separators

        // Remove OpenAI-specific escape sequences
        text = text
            .replace(/\ue200cite\ue202[^\ue201]*\ue201/g, "") // Citation references
            .replace(/\ue200[^\ue201]*\ue201/g, "") // Other OpenAI specific markers
            .replace(/\ue202/g, "") // Remaining separators
            .replace(/\u202f/g, " "); // Narrow no-break space

        return text;
    }

    /**
     * Extracts text from an OpenAI message
     */
    private extractTextFromMessage(message: OpenAIMessage): string {
        let text = "";

        if (message.content.parts && message.content.parts.length > 0) {
            text = message.content.parts.join("\n").trim();
        } else if (message.content.text) {
            text = message.content.text.trim();
        }

        // Clean up Unicode characters
        return this.cleanUnicodeText(text);
    }
}

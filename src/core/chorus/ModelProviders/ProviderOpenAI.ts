import { O3_DEEP_RESEARCH_SYSTEM_PROMPT } from "@core/chorus/prompts/prompts";
import { getUserToolNamespacedName,UserToolCall } from "@core/chorus/Toolsets";
import { canProceedWithProvider } from "@core/utilities/ProxyUtils";
import OpenAI from "openai";

import {
    attachmentMissingFlag,
    encodeTextAttachment,
    encodeWebpageAttachment,
    LLMMessage,
    LLMMessageAssistant,
    LLMMessageUser,
    ModelFlags,
    readImageAttachment,
    readPdfAttachment,
    StreamResponseParams,
} from "../Models";
import { IProvider } from "./IProvider";

/**
 * Checks whether a JSON Schema is compatible with OpenAI's strict mode.
 * Strict mode requires every object level to have:
 *   (A) all properties listed in `required`, and
 *   (B) `additionalProperties` set to false.
 */
function isStrictModeCompatible(
    schema: Record<string, unknown> | undefined,
): boolean {
    if (schema === undefined) return false;

    if (schema.type === "object") {
        const properties = schema.properties as
            | Record<string, Record<string, unknown>>
            | undefined;
        const required = schema.required as string[] | undefined;

        if (schema.additionalProperties !== false) return false;

        if (properties) {
            const propertyNames = Object.keys(properties);
            if (
                !required ||
                propertyNames.length !== required.length ||
                !propertyNames.every((name) => required.includes(name))
            ) {
                return false;
            }

            for (const prop of Object.values(properties)) {
                if (!isStrictModeCompatible(prop)) return false;
            }
        }
    }

    // Check array item schemas
    if (schema.type === "array" && schema.items) {
        if (
            !isStrictModeCompatible(
                schema.items as Record<string, unknown>,
            )
        ) {
            return false;
        }
    }

    // Check anyOf/oneOf/allOf variants
    for (const key of ["anyOf", "oneOf", "allOf"] as const) {
        const variants = schema[key] as
            | Record<string, unknown>[]
            | undefined;
        if (variants) {
            for (const variant of variants) {
                if (!isStrictModeCompatible(variant)) return false;
            }
        }
    }

    return true;
}

/** Map of extra system prompt keys (stored in model_flags) to their prompt text */
const EXTRA_SYSTEM_PROMPTS: Record<string, string> = {
    o3_deep_research: O3_DEEP_RESEARCH_SYSTEM_PROMPT,
};

export class ProviderOpenAI implements IProvider {
    async streamResponse({
        modelConfig,
        llmConversation,
        apiKeys,
        onChunk,
        onComplete,
        additionalHeaders,
        tools,
        customBaseUrl,
    }: StreamResponseParams) {
        const modelId = modelConfig.modelId.split("::")[1];

        const imageSupport =
            modelConfig.supportedAttachmentTypes?.includes("image") ?? false;

        const { canProceed, reason } = canProceedWithProvider(
            "openai",
            apiKeys,
        );

        if (!canProceed) {
            throw new Error(
                reason || "Please add your OpenAI API key in Settings.",
            );
        }

        // Process the conversation with a dedicated converter
        let messages = await convertConversationToOpenAI(
            llmConversation,
            imageSupport,
        );

        // Read model capabilities from database-driven config
        const isReasoningModel = modelConfig.isReasoningModel;
        const flags: ModelFlags = modelConfig.modelFlags ?? {};
        const excludeToolsets = flags.exclude_toolsets ?? [];
        const builtinTools = flags.openai_builtin_tools ?? [];
        const reasoningMode = flags.reasoning_mode;
        const extraSystemPromptKey = flags.extra_system_prompt_key;

        // Add system message if needed
        if (isReasoningModel || modelConfig.systemPrompt) {
            let systemContent = "";

            // Always add formatting message for reasoning models
            if (isReasoningModel) {
                systemContent = "Markdown formatting re-enabled.";
            }

            // Add extra system prompt if specified via model_flags
            if (extraSystemPromptKey && EXTRA_SYSTEM_PROMPTS[extraSystemPromptKey]) {
                if (systemContent) {
                    systemContent += "\n" + EXTRA_SYSTEM_PROMPTS[extraSystemPromptKey];
                } else {
                    systemContent = EXTRA_SYSTEM_PROMPTS[extraSystemPromptKey];
                }
            }

            // Append system prompt if provided
            if (modelConfig.systemPrompt) {
                if (systemContent) {
                    systemContent += `\n ${modelConfig.systemPrompt}`;
                } else {
                    systemContent = modelConfig.systemPrompt;
                }
            }

            messages = [
                { role: "developer", content: systemContent },
                ...messages,
            ];
        }

        // Convert tools to OpenAI format, filtering out excluded toolsets
        const filteredTools =
            excludeToolsets.length > 0
                ? tools?.filter((tool) => !excludeToolsets.includes(tool.toolsetName))
                : tools;

        const openaiTools: Array<OpenAI.Responses.FunctionTool> | undefined =
            filteredTools?.map((tool) => ({
                type: "function",
                name: getUserToolNamespacedName(tool), // name goes at this level for OpenAI
                description: tool.description,
                parameters: tool.inputSchema,
                strict: isStrictModeCompatible(tool.inputSchema),
            }));

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const createParams: any = {
            model: modelId,
            input: messages,
            tools: openaiTools || [],
            tool_choice:
                tools && tools.length > 0
                    ? ("auto" as const)
                    : ("none" as const),
            stream: true as const,
            ...(isReasoningModel && {
                reasoning: {
                    effort: modelConfig.reasoningEffort || "medium",
                },
            }),
        };

        // Handle model_flags: builtin tools and reasoning mode overrides
        if (builtinTools.length > 0) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            createParams.tools = [
                ...builtinTools.map((toolType) => {
                    if (toolType === "code_interpreter") {
                        return {
                            type: toolType,
                            container: { type: "auto", file_ids: [] },
                        };
                    }
                    return { type: toolType };
                }),
                ...(openaiTools || []),
            ];
            // When using builtin tools, force tool_choice to "auto"
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            createParams.tool_choice = "auto";
        }

        if (reasoningMode === "summary_auto") {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            createParams.reasoning = { summary: "auto" };
        }

        const client = new OpenAI({
            apiKey: apiKeys.openai,
            baseURL: customBaseUrl,
            dangerouslyAllowBrowser: true,
            defaultHeaders: {
                ...(additionalHeaders ?? {}),
                "Content-Type": "application/json",
            },
        });

        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        const stream = await client.responses.create(createParams);

        /**
         * OpenAI response streaming event types
         */
        type OpenAIStreamEvent =
            | {
                  // Text delta event
                  type: "response.output_text.delta";
                  delta: string;
              }
            | {
                  // Tool call started event
                  type: "response.output_item.added";
                  item: {
                      type: "function_call";
                      id: string;
                      call_id: string;
                      name: string;
                      arguments: string;
                  };
              }
            | {
                  // Tool call arguments being streamed
                  type: "response.function_call_arguments.delta";
                  item_id: string;
                  delta: string;
              }
            | {
                  // Tool call arguments completed
                  type: "response.function_call_arguments.done";
                  item_id: string;
                  arguments: string;
              }
            | {
                  // Tool call fully completed
                  type: "response.output_item.done";
                  item: {
                      type: "function_call";
                      id: string;
                      call_id: string;
                      name: string;
                      arguments: string;
                  };
              }
            | {
                  // Response completed with annotations
                  type: "response.done";
                  output?: Array<{
                      content?: Array<{
                          text?: string;
                          annotations?: Array<{
                              title: string;
                              url: string;
                              start_index: number;
                              end_index: number;
                          }>;
                      }>;
                  }>;
              };

        // Track tool calls in the streamed response
        const toolCalls: UserToolCall[] = [];
        const accumulatedToolCalls: Record<
            string,
            {
                id: string;
                call_id: string;
                name: string;
                arguments: string;
            }
        > = {};

        // Process the streaming response
        for await (const event of stream as unknown as AsyncIterable<OpenAIStreamEvent>) {
            // Handle text streaming
            if (event.type === "response.output_text.delta") {
                onChunk(event.delta);
            }
            // TOOL CALL HANDLING - OpenAI streams tool calls in multiple events:
            // 1. Tool call initialization
            else if (
                event.type === "response.output_item.added" &&
                event.item.type === "function_call"
            ) {
                // Initialize the tool call structure when first encountered
                accumulatedToolCalls[event.item.id] = {
                    id: event.item.id,
                    call_id: event.item.call_id,
                    name: event.item.name,
                    arguments: event.item.arguments || "",
                };
            }
            // 2. Tool call arguments streaming (may come in multiple chunks)
            else if (event.type === "response.function_call_arguments.delta") {
                // Accumulate argument JSON as it streams in
                if (accumulatedToolCalls[event.item_id]) {
                    accumulatedToolCalls[event.item_id].arguments +=
                        event.delta;
                }
            }
            // 3. Tool call arguments complete (contains full arguments)
            else if (event.type === "response.function_call_arguments.done") {
                // Use the complete arguments
                if (accumulatedToolCalls[event.item_id]) {
                    accumulatedToolCalls[event.item_id].arguments =
                        event.arguments;
                }
            }
            // 4. Tool call fully complete
            else if (
                event.type === "response.output_item.done" &&
                event.item.type === "function_call"
            ) {
                // Convert completed tool call to our internal ToolCall format
                const namespacedToolName = event.item.name;
                const calledTool = tools?.find(
                    (t) => getUserToolNamespacedName(t) === namespacedToolName,
                );

                // Add to our collection of tool calls
                toolCalls.push({
                    id: event.item.call_id,
                    namespacedToolName,
                    args: JSON.parse(event.item.arguments),
                    toolMetadata: {
                        description: calledTool?.description,
                        inputSchema: calledTool?.inputSchema,
                    },
                });
            }
            // 5. Handle response.done event for citations
            else if (event.type === "response.done" && event.output) {
                // Process citations from o3-deep-research
                for (const output of event.output) {
                    if (output.content) {
                        for (const content of output.content) {
                            if (
                                content.annotations &&
                                content.annotations.length > 0
                            ) {
                                // Format citations as plain text
                                let citationText = "\n\n---\n**Citations:**\n";

                                for (const citation of content.annotations) {
                                    citationText += `\n- **${citation.title}**\n`;
                                    citationText += `  URL: ${citation.url}\n`;

                                    // Extract the cited text if we have the full text
                                    if (content.text) {
                                        const citedText =
                                            content.text.substring(
                                                citation.start_index,
                                                citation.end_index,
                                            );
                                        citationText += `  Cited text: "${citedText}"\n`;
                                    }
                                }

                                // Send the citations as a text chunk
                                onChunk(citationText);
                            }
                        }
                    }
                }
            }
        }

        await onComplete(
            undefined,
            toolCalls.length > 0 ? toolCalls : undefined,
        );
    }
}

/**
 * Processes a single message with attachments, converting to the OpenAI format.
 * This simpler function just handles basic user/assistant messages with attachments,
 * and doesn't try to handle the complexity of tool calls or tool results.
 *
 * @param message - The LLM message to format
 * @param imageSupport - Whether the model supports image attachments
 * @returns A properly formatted message for the OpenAI Responses API
 */
async function formatBasicMessage(
    message: LLMMessageUser | LLMMessageAssistant,
    imageSupport: boolean,
): Promise<OpenAI.Responses.ResponseInputItem> {
    if (message.role === "user") {
        return formamtUserMessageWithAttachments(message, imageSupport);
    } else {
        return {
            role: message.role,
            content: message.content,
        };
    }
}

async function formamtUserMessageWithAttachments(
    message: LLMMessageUser,
    imageSupport: boolean,
): Promise<OpenAI.Responses.ResponseInputItem> {
    // Handle regular user and assistant messages with attachments
    let attachmentTexts = "";
    const attachmentBlocks: OpenAI.Responses.ResponseInputContent[] = [];

    const attachments = message.role === "user" ? message.attachments : [];

    for (const attachment of attachments) {
        switch (attachment.type) {
            case "text": {
                attachmentTexts += await encodeTextAttachment(attachment);
                break;
            }
            case "webpage": {
                attachmentTexts += await encodeWebpageAttachment(attachment);
                break;
            }
            case "image": {
                if (!imageSupport) {
                    attachmentTexts += attachmentMissingFlag(attachment);
                } else {
                    const fileExt =
                        attachment.path.split(".").pop()?.toLowerCase() || "";
                    const mimeType = fileExt === "jpg" ? "jpeg" : fileExt;
                    attachmentBlocks.push({
                        type: "input_image",
                        image_url: `data:image/${mimeType};base64,${await readImageAttachment(attachment)}`,
                        detail: "auto",
                    });
                }
                break;
            }
            case "pdf": {
                try {
                    const base64Pdf = await readPdfAttachment(attachment);
                    attachmentBlocks.push({
                        type: "input_file",
                        filename: attachment.path,
                        file_data: `data:application/pdf;base64,${base64Pdf}`,
                    });
                } catch (error) {
                    console.error("Failed to read PDF:", error);
                    console.error("PDF path was:", attachment.path);
                }
                break;
            }
            default: {
                const exhaustiveCheck: never = attachment.type;
                console.warn(
                    `[ProviderOpenAI] Unhandled attachment type: ${exhaustiveCheck as string}. This case should be handled.`,
                );
            }
        }
    }

    return {
        role: message.role,
        content: [
            ...attachmentBlocks,
            { type: "input_text", text: attachmentTexts + message.content },
        ],
    };
}

/**
 * Converts the entire conversation to the OpenAI format, handling tool calls and results
 * properly according to OpenAI's Responses API format.
 *
 * This maintains proper sequencing of:
 * 1. Assistant sends message
 * 2. Assistant makes tool calls
 * 3. Tool results are returned
 *
 * For more details on OpenAI's tool call format, see:
 * https://platform.openai.com/docs/guides/function-calling
 */
async function convertConversationToOpenAI(
    messages: LLMMessage[],
    imageSupport: boolean,
): Promise<OpenAI.Responses.ResponseInputItem[]> {
    const openaiMessages: OpenAI.Responses.ResponseInputItem[] = [];

    for (const message of messages) {
        if (message.role === "tool_results") {
            // Handle tool results - convert each result to a separate function_call_output message
            for (const result of message.toolResults) {
                openaiMessages.push({
                    type: "function_call_output" as const,
                    call_id: result.id,
                    output: result.content,
                });
            }
        } else if (message.role === "assistant" && message.toolCalls?.length) {
            // First add the assistant message with content
            openaiMessages.push({
                role: "assistant",
                content: message.content || "",
            });

            // Then add each tool call as a separate message in OpenAI format
            for (const toolCall of message.toolCalls) {
                openaiMessages.push({
                    type: "function_call" as const,
                    call_id: toolCall.id,
                    name: toolCall.namespacedToolName,
                    arguments: JSON.stringify(toolCall.args),
                });
            }
        } else {
            // For standard user/assistant messages, just add them with attachments
            openaiMessages.push(
                await formatBasicMessage(message, imageSupport),
            );
        }
    }

    return openaiMessages;
}

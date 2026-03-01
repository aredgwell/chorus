import OpenAICompletionsAPIUtils from "@core/chorus/OpenAICompletionsAPIUtils";
import { canProceedWithProvider } from "@core/utilities/ProxyUtils";
import JSON5 from "json5";
import _ from "lodash";
import OpenAI from "openai";

import { StreamResponseParams } from "../Models";
import { IProvider } from "./IProvider";

interface ProviderError {
    message: string;
    error?: {
        message?: string;
        metadata?: { raw?: string };
    };
    metadata?: { raw?: string };
}

function isProviderError(error: unknown): error is ProviderError {
    return (
        typeof error === "object" &&
        error !== null &&
        "message" in error &&
        ("error" in error || "metadata" in error) &&
        error.message === "Provider returned error"
    );
}

export class ProviderGrok implements IProvider {
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
        const modelName = modelConfig.modelId.split("::")[1];

        const { canProceed, reason } = canProceedWithProvider("grok", apiKeys);

        if (!canProceed) {
            throw new Error(
                reason || "Please add your xAI API key in Settings.",
            );
        }

        const baseURL = customBaseUrl || "https://api.x.ai/v1";

        const client = new OpenAI({
            baseURL,
            apiKey: apiKeys.grok,
            defaultHeaders: {
                ...(additionalHeaders ?? {}),
            },
            dangerouslyAllowBrowser: true,
        });

        const hasFunctionSupport =
            modelConfig.supportsToolUse && tools && tools.length > 0;

        let messages: OpenAI.ChatCompletionMessageParam[] =
            await OpenAICompletionsAPIUtils.convertConversation(
                llmConversation,
                {
                    imageSupport: true,
                    functionSupport: !!hasFunctionSupport,
                },
            );

        if (modelConfig.systemPrompt) {
            messages = [
                {
                    role: "system",
                    content: modelConfig.systemPrompt,
                },
                ...messages,
            ];
        }

        const streamParams: OpenAI.ChatCompletionCreateParamsStreaming & {
            include_reasoning: boolean;
        } = {
            model: modelName,
            messages,
            stream: true,
            include_reasoning: true,
        };

        // Add tools definitions if model supports them
        if (hasFunctionSupport) {
            streamParams.tools =
                OpenAICompletionsAPIUtils.convertToolDefinitions(tools);
            streamParams.tool_choice = "auto";
        }

        const chunks: OpenAI.ChatCompletionChunk[] = [];

        try {
            const stream = await client.chat.completions.create(streamParams);

            for await (const chunk of stream) {
                chunks.push(chunk);
                if (chunk.choices[0]?.delta?.content) {
                    onChunk(chunk.choices[0].delta.content);
                }
            }
        } catch (error: unknown) {
            console.error("Raw error:", error);
            console.error(JSON.stringify(error, null, 2));

            if (
                isProviderError(error) &&
                error.message === "Provider returned error"
            ) {
                const errorDetails: ProviderError = JSON5.parse(
                    error.error?.metadata?.raw || error.metadata?.raw || "{}",
                );
                throw Object.assign(
                    new Error(
                        `Provider returned error: ${errorDetails.error?.message || error.message}`,
                    ),
                    { cause: error },
                );
            }
            throw error;
        }

        // Extract usage data from the last chunk
        const lastChunk = chunks[chunks.length - 1];
        let usageData:
            | {
                  prompt_tokens?: number;
                  completion_tokens?: number;
                  total_tokens?: number;
              }
            | undefined;

        if (lastChunk?.usage) {
            usageData = {
                prompt_tokens: lastChunk.usage.prompt_tokens,
                completion_tokens: lastChunk.usage.completion_tokens,
                total_tokens: lastChunk.usage.total_tokens,
            };
        }

        const toolCalls = OpenAICompletionsAPIUtils.convertToolCalls(
            chunks,
            tools ?? [],
        );

        await onComplete(
            undefined,
            toolCalls.length > 0 ? toolCalls : undefined,
            usageData,
        );
    }
}

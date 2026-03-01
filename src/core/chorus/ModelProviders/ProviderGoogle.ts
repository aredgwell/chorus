import OpenAICompletionsAPIUtils from "@core/chorus/OpenAICompletionsAPIUtils";
import { canProceedWithProvider } from "@core/utilities/ProxyUtils";
import JSON5 from "json5";
import _ from "lodash";
import OpenAI from "openai";

import { StreamResponseParams } from "../Models";
import { IProvider, ModelDisabled } from "./IProvider";

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

// uses OpenAI provider to format the messages
export class ProviderGoogle implements IProvider {
    async streamResponse({
        llmConversation,
        modelConfig,
        onChunk,
        onComplete,
        apiKeys,
        additionalHeaders,
        tools,
        onError,
        customBaseUrl,
    }: StreamResponseParams): Promise<ModelDisabled | void> {
        const modelName = modelConfig.modelId.split("::")[1];
        // Use the API model name from the database if set, otherwise use the model ID suffix
        const googleModelName = modelConfig.apiModelName ?? modelName;

        const { canProceed, reason } = canProceedWithProvider(
            "google",
            apiKeys,
        );

        if (!canProceed) {
            throw new Error(
                reason || "Please add your Google AI API key in Settings.",
            );
        }

        // Google AI uses the generativelanguage.googleapis.com endpoint with OpenAI compatibility
        const baseURL =
            customBaseUrl ||
            "https://generativelanguage.googleapis.com/v1beta/openai";

        // unset headers that are not supported by the Google API
        // https://discuss.ai.google.dev/t/gemini-api-cors-error-with-openai-compatability/58619/16
        const headers = {
            ...(additionalHeaders ?? {}),
            "x-stainless-arch": null,
            "x-stainless-lang": null,
            "x-stainless-os": null,
            "x-stainless-package-version": null,
            "x-stainless-retry-count": null,
            "x-stainless-runtime": null,
            "x-stainless-runtime-version": null,
            "x-stainless-timeout": null,
        };
        const client = new OpenAI({
            baseURL,
            apiKey: apiKeys.google,
            defaultHeaders: headers,
            dangerouslyAllowBrowser: true,
        });

        let messages: OpenAI.ChatCompletionMessageParam[] =
            await OpenAICompletionsAPIUtils.convertConversation(
                llmConversation,
                {
                    imageSupport: true,
                    functionSupport: true,
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

        const streamParams: OpenAI.ChatCompletionCreateParamsStreaming = {
            model: googleModelName,
            messages: messages,
            stream: true,
        };

        // Add tools definitions
        if (tools && tools.length > 0) {
            streamParams.tools =
                OpenAICompletionsAPIUtils.convertToolDefinitions(tools);
            streamParams.tool_choice = "auto";
        }

        const chunks = [];

        try {
            const stream = await client.chat.completions.create(streamParams);

            for await (const chunk of stream) {
                chunks.push(chunk);
                if (chunk.choices[0]?.delta?.content) {
                    onChunk(chunk.choices[0].delta.content);
                }
            }
        } catch (error: unknown) {
            console.error(
                "Raw error from ProviderGoogle:",
                error,
                modelName,
                messages,
            );
            console.error(JSON.stringify(error, null, 2));

            if (
                isProviderError(error) &&
                error.message === "Provider returned error"
            ) {
                const errorDetails: ProviderError = JSON5.parse(
                    error.error?.metadata?.raw || error.metadata?.raw || "{}",
                );
                const errorMessage = `Provider returned error: ${errorDetails.error?.message || error.message}`;
                if (onError) {
                    onError(errorMessage);
                } else {
                    throw Object.assign(new Error(errorMessage), { cause: error });
                }
            } else {
                if (onError) {
                    onError(getErrorMessage(error));
                } else {
                    throw error;
                }
            }
            return undefined;
        }

        const toolCalls = OpenAICompletionsAPIUtils.convertToolCalls(
            chunks,
            tools ?? [],
        );

        await onComplete(
            undefined,
            toolCalls.length > 0 ? toolCalls : undefined,
        );
    }
}

function getErrorMessage(error: unknown): string {
    if (typeof error === "object" && error !== null && "message" in error) {
        return (error as { message: string }).message;
    } else if (typeof error === "string") {
        return error;
    } else {
        return "Unknown error";
    }
}

import OpenAICompletionsAPIUtils from "@core/chorus/OpenAICompletionsAPIUtils";
import { SettingsManager } from "@core/utilities/Settings";
import OpenAI from "openai";

import { StreamResponseParams } from "../Models";
import { IProvider } from "./IProvider";

export class ProviderCustomOpenAI implements IProvider {
    async streamResponse({
        modelConfig,
        llmConversation,
        apiKeys,
        tools,
        onChunk,
        onComplete,
    }: StreamResponseParams): Promise<void> {
        const settings = await SettingsManager.getInstance().get();
        const baseURL =
            settings.customOpenAIBaseUrl || "http://localhost:8080/v1";

        const apiKey = apiKeys["custom-openai"] || "not-needed";

        const client = new OpenAI({
            baseURL,
            apiKey,
            dangerouslyAllowBrowser: true,
        });

        const hasFunctionSupport =
            modelConfig.supportsToolUse && tools && tools.length > 0;

        let messages: OpenAI.ChatCompletionMessageParam[] =
            await OpenAICompletionsAPIUtils.convertConversation(
                llmConversation,
                {
                    imageSupport: false,
                    functionSupport: !!hasFunctionSupport,
                },
            );

        if (modelConfig.systemPrompt) {
            messages = [
                { role: "system", content: modelConfig.systemPrompt },
                ...messages,
            ];
        }

        const streamParams: OpenAI.ChatCompletionCreateParamsStreaming = {
            model: modelConfig.apiModelName ?? modelConfig.modelId.split("::")[1],
            messages,
            stream: true,
            ...(hasFunctionSupport && {
                tools: OpenAICompletionsAPIUtils.convertToolDefinitions(tools),
            }),
        };

        const stream = await client.chat.completions.create(streamParams);

        const toolCallChunks: OpenAI.ChatCompletionChunk[] = [];

        for await (const chunk of stream) {
            if (chunk.choices[0]?.delta?.content) {
                onChunk(chunk.choices[0].delta.content);
            }
            // Collect chunks with tool call deltas
            if (chunk.choices[0]?.delta?.tool_calls) {
                toolCallChunks.push(chunk);
            }
        }

        const toolCalls =
            toolCallChunks.length > 0 && tools
                ? OpenAICompletionsAPIUtils.convertToolCalls(
                      toolCallChunks,
                      tools,
                  )
                : undefined;

        await onComplete(
            undefined,
            toolCalls && toolCalls.length > 0 ? toolCalls : undefined,
        );
    }
}

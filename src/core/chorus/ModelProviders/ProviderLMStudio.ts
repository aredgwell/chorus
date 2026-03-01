import { SettingsManager } from "@core/utilities/Settings";
import OpenAI from "openai";

import { llmMessageToString, StreamResponseParams } from "../Models";
import { IProvider } from "./IProvider";

export class ProviderLMStudio implements IProvider {
    async streamResponse({
        llmConversation,
        modelConfig,
        onChunk,
        onComplete,
    }: StreamResponseParams): Promise<void> {
        const settings = await SettingsManager.getInstance().get();
        const baseURL = settings.lmStudioBaseUrl || "http://localhost:1234/v1";

        const client = new OpenAI({
            baseURL,
            apiKey: "not-needed", // LM Studio doesn't require an API key
            dangerouslyAllowBrowser: true,
        });

        const messages = llmConversation.map((msg) => ({
            role: msg.role === "tool_results" ? "user" : msg.role,
            content: llmMessageToString(msg),
        }));

        const stream = await client.chat.completions.create({
            model: modelConfig.modelId.split("::")[1],
            messages,
            stream: true,
        });

        for await (const chunk of stream) {
            if (chunk.choices[0]?.delta?.content) {
                onChunk(chunk.choices[0].delta.content);
            }
        }

        await onComplete();
    }
}

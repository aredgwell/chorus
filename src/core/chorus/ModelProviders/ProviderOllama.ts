import {
    LLMMessage,
    llmMessageToString,
    readTextAttachment,
    readWebpageAttachment,
    StreamResponseParams,
} from "../Models";
import { ollamaClient } from "../OllamaClient";
import { IProvider } from "./IProvider";

interface FormattedOllamaMessage {
    role: "user" | "assistant";
    content: string;
    images?: string[];
}

export class ProviderOllama implements IProvider {
    async streamResponse({
        llmConversation,
        modelConfig,
        onChunk,
        onComplete,
    }: StreamResponseParams): Promise<void> {
        const messages = await Promise.all(
            llmConversation.map(formatMessageWithAttachments),
        );

        for await (const chunk of ollamaClient.streamChat(
            modelConfig.modelId.split("::")[1],
            messages,
        )) {
            onChunk(chunk);
        }

        await onComplete();
    }
}

async function formatMessageWithAttachments(
    message: LLMMessage,
): Promise<FormattedOllamaMessage> {
    if (message.role === "tool_results") {
        return {
            role: "user",
            content: llmMessageToString(message), // will encode tool results as XML
        };
    }

    if (message.role === "assistant") {
        return {
            role: "assistant",
            content: message.content,
        };
    }

    const content = message.content;
    const messageData: FormattedOllamaMessage = {
        role: message.role,
        content: content,
    };

    // Check for image attachments first and throw error if found
    const imageAttachments = message.attachments.filter(
        (a) => a.type === "image",
    );
    if (imageAttachments.length) {
        throw new Error(
            "Image attachments are not currently supported for Ollama models",
        );
    }

    // Handle text and webpage attachments by appending their content
    const textAndWebAttachments = message.attachments.filter(
        (a) => a.type === "text" || a.type === "webpage",
    );

    if (textAndWebAttachments.length) {
        const attachmentContents = await Promise.all(
            textAndWebAttachments.map(async (attachment) => {
                let content = "";
                if (attachment.type === "text") {
                    content = await readTextAttachment(attachment);
                } else if (attachment.type === "webpage") {
                    content = await readWebpageAttachment(attachment);
                }
                return `\n\n[${attachment.originalName}]:\n${content}`;
            }),
        );
        messageData.content += attachmentContents.join("\n");
    }

    return messageData;
}

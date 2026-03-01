import { convertFileSrc } from "@tauri-apps/api/core";
import { appDataDir,join } from "@tauri-apps/api/path";
import { mkdir,writeFile } from "@tauri-apps/plugin-fs";
import { fetch } from "@tauri-apps/plugin-http";

import { ApiKeys } from "./Models";

type ImageGenerationResult = {
    content: string;
    error?: string;
};

type OpenAIErrorResponse = {
    error?: {
        message?: string;
    };
};

type OpenAIImageResponse = {
    data?: Array<{
        b64_json?: string;
    }>;
};

const GENERATED_IMAGES_SUBDIR = "generated_images";

export class MediaTools {
    static async generateImage(
        prompt: string,
        apiKeys: ApiKeys,
    ): Promise<ImageGenerationResult> {
        if (!apiKeys.openai) {
            throw new Error(
                "Please add your OpenAI API key in Settings to generate images.",
            );
        }

        const response = await fetch(
            "https://api.openai.com/v1/images/generations",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${apiKeys.openai}`,
                },
                body: JSON.stringify({
                    prompt: prompt,
                    n: 1,
                    model: "gpt-image-1",
                }),
            },
        );

        if (!response.ok) {
            const errorData = (await response.json()) as OpenAIErrorResponse;
            throw new Error(
                `OpenAI API error: ${errorData.error?.message || response.statusText}`,
            );
        }

        const data = (await response.json()) as OpenAIImageResponse;

        if (data.data && data.data.length > 0 && data.data[0].b64_json) {
            const b64Data = data.data[0].b64_json;

            const filePath = await this.writeBase64ImageToDisk(prompt, b64Data);

            return {
                content: filePath,
            };
        } else {
            throw new Error("Image data not found in OpenAI API response");
        }
    }

    private static async writeBase64ImageToDisk(
        prompt: string,
        b64Data: string,
    ): Promise<string> {
        const byteString = atob(b64Data);
        const byteArray = new Uint8Array(byteString.length);
        for (let i = 0; i < byteString.length; i++) {
            byteArray[i] = byteString.charCodeAt(i);
        }

        const appCoreDir = await appDataDir();
        const imagesDir = await join(appCoreDir, GENERATED_IMAGES_SUBDIR);
        await mkdir(imagesDir, { recursive: true });

        // Get timestamp and format it
        const timestamp = Date.now().toString().slice(-5);

        // Slugify the prompt and limit its length to ensure we stay under Mac's 255 char limit
        // We'll reserve 3 chars for timestamp and 5 for extension
        const maxPromptLength = 200;
        const slugifiedPrompt = this.slugify(prompt);
        const truncatedPrompt = slugifiedPrompt.slice(0, maxPromptLength);

        const fileName = `${truncatedPrompt}-${timestamp}.webp`;
        const persistentFilePath = await join(imagesDir, fileName);

        await writeFile(persistentFilePath, byteArray);

        // Convert the file path to a URL that can be used in the web view
        const webViewPath = convertFileSrc(persistentFilePath);

        return webViewPath;
    }

    private static slugify(prompt: string): string {
        return prompt
            .toLowerCase()
            .replace(/[^a-z0-9]/g, "-")
            .replace(/-+/g, "-");
    }
}

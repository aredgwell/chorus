import { Toolset as Toolset } from "@core/chorus/Toolsets";

import { getApiKeys } from "../api/AppMetadataAPI";
import { MediaTools } from "../MediaTools";

export class ToolsetMedia extends Toolset {
    constructor() {
        super(
            "images",
            "Image Generator",
            {},
            "Generate images. Powered by OpenAI.",
            "",
        );

        this.addCustomTool(
            "generate",
            {
                type: "object",
                properties: {
                    prompt: {
                        type: "string",
                        description:
                            "Text prompt describing the image to generate. Returns a file path or image url to the image.",
                    },
                },
                required: ["prompt"],
                additionalProperties: false,
            },
            async (args) => {
                const { prompt } = args;

                const apiKeys = await getApiKeys();
                if (!apiKeys) {
                    throw new Error("API keys are not available.");
                }
                const result = await MediaTools.generateImage(
                    prompt as string,
                    apiKeys,
                );

                return result.content;
            },
            "Generates an image from a text prompt and returns the URL of the generated image. Does not directly display the image to the user. After you generate an image, you’ll want to use markdown syntax to render the image so that the user can see it.",
        );
    }
}

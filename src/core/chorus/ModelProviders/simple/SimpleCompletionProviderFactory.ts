import { canProceedWithProvider } from "@core/utilities/ProxyUtils";

import { ApiKeys } from "../../Models";
import { ISimpleCompletionProvider } from "./ISimpleCompletionProvider";
import { SimpleCompletionProviderAnthropic } from "./SimpleCompletionProviderAnthropic";
import { SimpleCompletionProviderGoogle } from "./SimpleCompletionProviderGoogle";
import { SimpleCompletionProviderOpenAI } from "./SimpleCompletionProviderOpenAI";
import { SimpleCompletionProviderOpenRouter } from "./SimpleCompletionProviderOpenRouter";

type ProviderConfig = {
    name: string;
    key: keyof ApiKeys;
    create: (apiKey: string) => ISimpleCompletionProvider;
};

const PROVIDER_PRECEDENCE: ProviderConfig[] = [
    {
        name: "anthropic",
        key: "anthropic",
        create: (key) => new SimpleCompletionProviderAnthropic(key),
    },
    {
        name: "openai",
        key: "openai",
        create: (key) => new SimpleCompletionProviderOpenAI(key),
    },
    {
        name: "google",
        key: "google",
        create: (key) => new SimpleCompletionProviderGoogle(key),
    },
    {
        name: "openrouter",
        key: "openrouter",
        create: (key) => new SimpleCompletionProviderOpenRouter(key),
    },
];

/**
 * Factory function that selects and returns an appropriate simple completion provider
 * based on available API keys. Follows explicit precedence order.
 *
 * @param apiKeys The API keys object from settings
 * @returns An ISimpleCompletionProvider instance
 * @throws Error if no suitable provider is configured
 */
export function getSimpleCompletionProvider(
    apiKeys: ApiKeys,
): ISimpleCompletionProvider {
    const reasons: string[] = [];

    for (const provider of PROVIDER_PRECEDENCE) {
        const check = canProceedWithProvider(provider.name, apiKeys);
        const apiKey = apiKeys[provider.key];

        if (check.canProceed && apiKey) {
            return provider.create(apiKey);
        }

        if (!check.canProceed && check.reason) {
            reasons.push(check.reason);
        }
    }

    throw new Error(
        `Please add an Anthropic, OpenAI, Google, or OpenRouter API key in Settings to generate chat titles. ${reasons.join(" ")}`,
    );
}

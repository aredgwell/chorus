import { SettingsManager } from "@core/utilities/Settings";

import {
    SimpleCompletionMode,
    SimpleCompletionParams,
} from "./ModelProviders/simple/ISimpleCompletionProvider";
import { getSimpleCompletionProvider } from "./ModelProviders/simple/SimpleCompletionProviderFactory";

const MAX_RETRIES = 1;

/**
 * Makes a simple LLM call using the first available provider.
 * Used primarily for generating chat titles and suggestions.
 * Retries once on transient errors (connection failures, timeouts).
 */
export async function simpleLLM(
    prompt: string,
    params: SimpleCompletionParams,
): Promise<string> {
    const settingsManager = SettingsManager.getInstance();
    const settings = await settingsManager.get();
    const apiKeys = settings.apiKeys || {};

    // Default to title generation mode if no model specified
    const paramsWithMode: SimpleCompletionParams = {
        ...params,
        model: params.model ?? SimpleCompletionMode.TITLE_GENERATION,
    };

    const provider = getSimpleCompletionProvider(apiKeys);

    let lastError: unknown;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        try {
            return await provider.complete(prompt, paramsWithMode);
        } catch (error: unknown) {
            lastError = error;
            const isRetryable =
                error instanceof Error &&
                /connection|timeout|network|ECONNRESET|fetch failed/i.test(
                    error.message,
                );
            if (attempt < MAX_RETRIES && isRetryable) {
                console.warn(
                    `simpleLLM attempt ${attempt + 1} failed (${error instanceof Error ? error.message : String(error)}), retrying...`,
                );
                continue;
            }
        }
    }
    throw lastError;
}

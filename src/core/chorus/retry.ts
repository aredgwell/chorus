import { classifyError, ProviderError } from "./errors";
import { ProviderName } from "./Models";

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;
const MAX_DELAY_MS = 30_000;

interface RetryOptions {
    provider: ProviderName;
    maxRetries?: number;
}

/**
 * Wrap an async operation with exponential backoff retry for transient errors.
 *
 * Only retries errors classified as retryable (rate_limit, server, network).
 * Non-retryable errors (auth, context_limit) are thrown immediately.
 */
export async function withRetry<T>(
    fn: () => Promise<T>,
    options: RetryOptions,
): Promise<T> {
    const maxRetries = options.maxRetries ?? MAX_RETRIES;
    let lastError: ProviderError | undefined;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await fn();
        } catch (error: unknown) {
            const classified = classifyError(error, options.provider);
            lastError = classified;

            if (!classified.retryable || attempt === maxRetries) {
                throw error;
            }

            const delay = computeDelay(attempt, classified.retryAfterMs);
            console.warn(
                `[retry] ${classified.type} error from ${options.provider}, ` +
                    `attempt ${attempt + 1}/${maxRetries}, retrying in ${delay}ms: ${classified.message}`,
            );
            await sleep(delay);
        }
    }

    // Unreachable, but TypeScript needs this
    throw lastError ?? new Error("Retry exhausted"); // eslint-disable-line @typescript-eslint/only-throw-error
}

/**
 * Exponential backoff with jitter, respecting server-provided retry-after.
 */
function computeDelay(attempt: number, retryAfterMs?: number): number {
    if (retryAfterMs !== undefined && retryAfterMs > 0) {
        return Math.min(retryAfterMs, MAX_DELAY_MS);
    }
    const exponential = BASE_DELAY_MS * Math.pow(2, attempt);
    const jitter = Math.random() * BASE_DELAY_MS;
    return Math.min(exponential + jitter, MAX_DELAY_MS);
}

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

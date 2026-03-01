import { ProviderName } from "./Models";

export type ProviderErrorType =
    | "rate_limit"
    | "context_limit"
    | "auth"
    | "network"
    | "server"
    | "unknown";

export interface ProviderError {
    type: ProviderErrorType;
    message: string;
    provider: ProviderName;
    retryable: boolean;
    retryAfterMs?: number;
}

// Provider-specific context limit error substrings (lowercase)
const CONTEXT_LIMIT_PATTERNS: Record<ProviderName, string> = {
    anthropic: "prompt is too long",
    openai: "context window",
    google: "token count",
    grok: "maximum prompt length",
    openrouter: "context length",
    meta: "context window",
    lmstudio: "context window",
    perplexity: "context window",
    ollama: "context window",
    "custom-openai": "context window",
};

/**
 * Classify a raw error into a structured ProviderError.
 *
 * Inspects the error message and HTTP status (when available) to
 * determine the error type and whether it's safe to retry.
 */
export function classifyError(
    error: unknown,
    provider: ProviderName,
): ProviderError {
    const message = extractMessage(error);
    const status = extractStatus(error);
    const lower = message.toLowerCase();

    // Rate limit (429)
    if (
        status === 429 ||
        lower.includes("rate limit") ||
        lower.includes("too many requests")
    ) {
        const retryAfterMs = extractRetryAfter(error);
        return {
            type: "rate_limit",
            message,
            provider,
            retryable: true,
            retryAfterMs,
        };
    }

    // Context limit
    const contextPattern = CONTEXT_LIMIT_PATTERNS[provider];
    if (contextPattern && lower.includes(contextPattern)) {
        return {
            type: "context_limit",
            message,
            provider,
            retryable: false,
        };
    }

    // Authentication (401, 403)
    if (
        status === 401 ||
        status === 403 ||
        lower.includes("unauthorized") ||
        lower.includes("invalid api key") ||
        lower.includes("authentication")
    ) {
        return {
            type: "auth",
            message,
            provider,
            retryable: false,
        };
    }

    // Server errors (500, 502, 503, 529)
    if (
        (status !== undefined && status >= 500) ||
        lower.includes("internal server error") ||
        lower.includes("overloaded")
    ) {
        return {
            type: "server",
            message,
            provider,
            retryable: true,
            retryAfterMs: status === 503 ? 5000 : undefined,
        };
    }

    // Network errors
    if (
        lower.includes("network") ||
        lower.includes("econnrefused") ||
        lower.includes("econnreset") ||
        lower.includes("etimedout") ||
        lower.includes("fetch failed")
    ) {
        return {
            type: "network",
            message,
            provider,
            retryable: true,
        };
    }

    return {
        type: "unknown",
        message,
        provider,
        retryable: false,
    };
}

/**
 * Detect whether an error message indicates a context limit error.
 * This is a convenience wrapper around classifyError for backward compatibility.
 */
export function detectContextLimitError(
    errorMessage: string,
    provider: ProviderName,
): boolean {
    if (!errorMessage) return false;
    const lower = errorMessage.toLowerCase();
    const pattern = CONTEXT_LIMIT_PATTERNS[provider];
    return pattern !== undefined && lower.includes(pattern);
}

function extractMessage(error: unknown): string {
    if (typeof error === "object" && error !== null && "message" in error) {
        return (error as { message: string }).message;
    }
    if (typeof error === "string") {
        return error;
    }
    return "Unknown error";
}

function extractStatus(error: unknown): number | undefined {
    if (typeof error !== "object" || error === null) return undefined;
    const e = error as Record<string, unknown>;
    if (typeof e.status === "number") return e.status;
    if (typeof e.statusCode === "number") return e.statusCode;
    if (typeof e.code === "number") return e.code;
    return undefined;
}

function extractRetryAfter(error: unknown): number | undefined {
    if (typeof error !== "object" || error === null) return undefined;
    const e = error as Record<string, unknown>;

    // Anthropic SDK exposes headers.get("retry-after")
    if (typeof e.headers === "object" && e.headers !== null) {
        const headers = e.headers as Record<string, unknown>;
        const retryAfter = headers["retry-after"];
        if (typeof retryAfter === "string") {
            const seconds = parseFloat(retryAfter);
            if (!isNaN(seconds)) return seconds * 1000;
        }
    }

    return undefined;
}

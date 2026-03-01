import { describe, expect,it } from "vitest";

import { classifyError, detectContextLimitError } from "./errors";
import type { ProviderName } from "./Models";

describe("classifyError", () => {
    const provider: ProviderName = "anthropic";

    it("classifies 429 status as rate_limit", () => {
        const err = { message: "Too many requests", status: 429 };
        const result = classifyError(err, provider);
        expect(result.type).toBe("rate_limit");
        expect(result.retryable).toBe(true);
        expect(result.provider).toBe(provider);
    });

    it("classifies rate limit by message when no status", () => {
        const err = { message: "Rate limit exceeded" };
        const result = classifyError(err, provider);
        expect(result.type).toBe("rate_limit");
        expect(result.retryable).toBe(true);
    });

    it("classifies 'too many requests' message as rate_limit", () => {
        const err = { message: "Too Many Requests" };
        const result = classifyError(err, provider);
        expect(result.type).toBe("rate_limit");
    });

    it("extracts retry-after header", () => {
        const err = {
            message: "Rate limit",
            status: 429,
            headers: { "retry-after": "5" },
        };
        const result = classifyError(err, provider);
        expect(result.type).toBe("rate_limit");
        expect(result.retryAfterMs).toBe(5000);
    });

    it("classifies anthropic context limit error", () => {
        const err = { message: "Prompt is too long for this model" };
        const result = classifyError(err, "anthropic");
        expect(result.type).toBe("context_limit");
        expect(result.retryable).toBe(false);
    });

    it("classifies openai context limit error", () => {
        const err = { message: "Exceeded context window limit" };
        const result = classifyError(err, "openai");
        expect(result.type).toBe("context_limit");
        expect(result.retryable).toBe(false);
    });

    it("classifies google context limit error", () => {
        const err = { message: "Token count exceeded" };
        const result = classifyError(err, "google");
        expect(result.type).toBe("context_limit");
    });

    it("classifies grok context limit error", () => {
        const err = { message: "Maximum prompt length exceeded" };
        const result = classifyError(err, "grok");
        expect(result.type).toBe("context_limit");
    });

    it("classifies 401 as auth error", () => {
        const err = { message: "Unauthorized", status: 401 };
        const result = classifyError(err, provider);
        expect(result.type).toBe("auth");
        expect(result.retryable).toBe(false);
    });

    it("classifies 403 as auth error", () => {
        const err = { message: "Forbidden", status: 403 };
        const result = classifyError(err, provider);
        expect(result.type).toBe("auth");
        expect(result.retryable).toBe(false);
    });

    it("classifies 'invalid api key' message as auth", () => {
        const err = { message: "Invalid API key provided" };
        const result = classifyError(err, provider);
        expect(result.type).toBe("auth");
    });

    it("classifies 500 as server error", () => {
        const err = { message: "Internal server error", status: 500 };
        const result = classifyError(err, provider);
        expect(result.type).toBe("server");
        expect(result.retryable).toBe(true);
    });

    it("classifies 503 as server error with retryAfterMs", () => {
        const err = { message: "Service unavailable", status: 503 };
        const result = classifyError(err, provider);
        expect(result.type).toBe("server");
        expect(result.retryable).toBe(true);
        expect(result.retryAfterMs).toBe(5000);
    });

    it("classifies 'overloaded' message as server error", () => {
        const err = { message: "API is overloaded" };
        const result = classifyError(err, provider);
        expect(result.type).toBe("server");
        expect(result.retryable).toBe(true);
    });

    it("classifies network errors", () => {
        const cases = [
            "Network error",
            "ECONNREFUSED",
            "ECONNRESET",
            "ETIMEDOUT",
            "fetch failed",
        ];
        for (const msg of cases) {
            const result = classifyError({ message: msg }, provider);
            expect(result.type).toBe("network");
            expect(result.retryable).toBe(true);
        }
    });

    it("classifies unknown errors as non-retryable", () => {
        const err = { message: "Something weird happened" };
        const result = classifyError(err, provider);
        expect(result.type).toBe("unknown");
        expect(result.retryable).toBe(false);
    });

    it("handles string errors", () => {
        const result = classifyError("Rate limit exceeded", provider);
        expect(result.type).toBe("rate_limit");
        expect(result.message).toBe("Rate limit exceeded");
    });

    it("handles non-object non-string errors", () => {
        const result = classifyError(42, provider);
        expect(result.type).toBe("unknown");
        expect(result.message).toBe("Unknown error");
    });

    it("handles null error", () => {
        const result = classifyError(null, provider);
        expect(result.type).toBe("unknown");
        expect(result.message).toBe("Unknown error");
    });

    it("extracts status from statusCode field", () => {
        const err = { message: "Unauthorized", statusCode: 401 };
        const result = classifyError(err, provider);
        expect(result.type).toBe("auth");
    });

    it("extracts status from code field", () => {
        const err = { message: "Bad gateway", code: 502 };
        const result = classifyError(err, provider);
        expect(result.type).toBe("server");
    });
});

describe("detectContextLimitError", () => {
    it("returns true for matching provider pattern", () => {
        expect(
            detectContextLimitError("prompt is too long", "anthropic"),
        ).toBe(true);
        expect(
            detectContextLimitError("context window exceeded", "openai"),
        ).toBe(true);
        expect(
            detectContextLimitError("token count exceeded", "google"),
        ).toBe(true);
    });

    it("returns false for non-matching message", () => {
        expect(detectContextLimitError("rate limit exceeded", "anthropic")).toBe(
            false,
        );
    });

    it("returns false for empty string", () => {
        expect(detectContextLimitError("", "anthropic")).toBe(false);
    });

    it("is case-insensitive", () => {
        expect(
            detectContextLimitError("PROMPT IS TOO LONG", "anthropic"),
        ).toBe(true);
    });
});

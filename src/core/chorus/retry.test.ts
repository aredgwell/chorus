import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { withRetry } from "./retry";

beforeEach(() => {
    // Replace setTimeout with immediate execution to avoid real delays
    vi.spyOn(globalThis, "setTimeout").mockImplementation(
        (fn: TimerHandler) => {
            if (typeof fn === "function") fn();
            return 0 as unknown as ReturnType<typeof setTimeout>;
        },
    );
    // Suppress console.warn from retry logging
    vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe("withRetry", () => {
    it("returns result on first success", async () => {
        const fn = vi.fn().mockResolvedValue("ok");
        const result = await withRetry(fn, { provider: "anthropic" });
        expect(result).toBe("ok");
        expect(fn).toHaveBeenCalledTimes(1);
    });

    it("retries on retryable error then succeeds", async () => {
        const fn = vi
            .fn()
            .mockRejectedValueOnce({ message: "Rate limit", status: 429 })
            .mockResolvedValue("ok");

        const result = await withRetry(fn, {
            provider: "anthropic",
            maxRetries: 1,
        });
        expect(result).toBe("ok");
        expect(fn).toHaveBeenCalledTimes(2);
    });

    it("throws immediately on non-retryable error", async () => {
        const authError = { message: "Invalid API key", status: 401 };
        const fn = vi.fn().mockRejectedValue(authError);

        await expect(
            withRetry(fn, { provider: "anthropic" }),
        ).rejects.toEqual(authError);
        expect(fn).toHaveBeenCalledTimes(1);
    });

    it("throws after max retries exhausted", async () => {
        const serverError = {
            message: "Internal server error",
            status: 500,
        };
        const fn = vi.fn().mockRejectedValue(serverError);

        await expect(
            withRetry(fn, { provider: "anthropic", maxRetries: 0 }),
        ).rejects.toEqual(serverError);
        expect(fn).toHaveBeenCalledTimes(1);
    });

    it("retries up to maxRetries times before throwing", async () => {
        const serverError = {
            message: "Internal server error",
            status: 500,
        };
        const fn = vi.fn().mockRejectedValue(serverError);

        await expect(
            withRetry(fn, { provider: "anthropic", maxRetries: 2 }),
        ).rejects.toEqual(serverError);
        // 1 initial + 2 retries = 3 calls
        expect(fn).toHaveBeenCalledTimes(3);
    });

    it("respects custom maxRetries on success", async () => {
        const fn = vi
            .fn()
            .mockRejectedValueOnce({ message: "Network error" })
            .mockResolvedValue("ok");

        const result = await withRetry(fn, {
            provider: "anthropic",
            maxRetries: 1,
        });
        expect(result).toBe("ok");
        expect(fn).toHaveBeenCalledTimes(2);
    });

    it("does not retry context limit errors", async () => {
        const contextError = {
            message: "Prompt is too long for this model",
        };
        const fn = vi.fn().mockRejectedValue(contextError);

        await expect(
            withRetry(fn, { provider: "anthropic" }),
        ).rejects.toEqual(contextError);
        expect(fn).toHaveBeenCalledTimes(1);
    });

    it("does not retry auth errors", async () => {
        const authError = { message: "Unauthorized", status: 401 };
        const fn = vi.fn().mockRejectedValue(authError);

        await expect(
            withRetry(fn, { provider: "openai" }),
        ).rejects.toEqual(authError);
        expect(fn).toHaveBeenCalledTimes(1);
    });
});

import { describe, it, expect } from "vitest";
import {
    getProviderName,
    getProviderLabel,
    llmMessageToString,
    detectContextLimitError,
} from "./Models";
import type { LLMMessage } from "./Models";

describe("getProviderName", () => {
    it("extracts provider from model id with ::", () => {
        expect(getProviderName("anthropic::claude-3-opus")).toBe("anthropic");
        expect(getProviderName("openai::gpt-4o")).toBe("openai");
        expect(getProviderName("openrouter::meta-llama/llama-4-scout")).toBe(
            "openrouter",
        );
    });

    it("extracts provider when no :: separator (legacy format)", () => {
        // split("::")[0] returns the whole string when no :: exists
        expect(getProviderName("anthropic")).toBe("anthropic");
    });

    it("throws on empty string", () => {
        expect(() => getProviderName("")).toThrow(
            "couldn't get provider name for empty modelId",
        );
    });
});

describe("getProviderLabel", () => {
    it("returns org name for openrouter models", () => {
        expect(getProviderLabel("openrouter::meta-llama/llama-4-scout")).toBe(
            "meta-llama",
        );
        expect(getProviderLabel("openrouter::google/gemini-pro")).toBe(
            "google",
        );
    });

    it("falls back to provider name for non-openrouter models", () => {
        expect(getProviderLabel("anthropic::claude-3-opus")).toBe("anthropic");
        expect(getProviderLabel("openai::gpt-4o")).toBe("openai");
    });

    it("falls back to provider name for openrouter model with no slash", () => {
        expect(getProviderLabel("openrouter::somemodel")).toBe("somemodel");
    });
});

describe("llmMessageToString", () => {
    it("returns content for user messages", () => {
        const msg: LLMMessage = {
            role: "user",
            content: "Hello world",
            attachments: [],
        };
        expect(llmMessageToString(msg)).toBe("Hello world");
    });

    it("returns content for assistant messages", () => {
        const msg: LLMMessage = {
            role: "assistant",
            content: "I can help with that",
            toolCalls: [],
        };
        expect(llmMessageToString(msg)).toBe("I can help with that");
    });

    it("returns XML-wrapped tool results", () => {
        const msg: LLMMessage = {
            role: "tool_results",
            toolResults: [
                { id: "1", content: "result1" },
                { id: "2", content: "result2" },
            ],
        };
        expect(llmMessageToString(msg)).toBe(
            "<tool_result>result1</tool_result>\n<tool_result>result2</tool_result>",
        );
    });

    it("returns empty string for empty tool results", () => {
        const msg: LLMMessage = {
            role: "tool_results",
            toolResults: [],
        };
        expect(llmMessageToString(msg)).toBe("");
    });
});

describe("detectContextLimitError", () => {
    it("detects anthropic context limit with full model id", () => {
        expect(
            detectContextLimitError(
                "prompt is too long",
                "anthropic::claude-3-opus",
            ),
        ).toBe(true);
    });

    it("detects openai context limit", () => {
        expect(
            detectContextLimitError(
                "context window exceeded",
                "openai::gpt-4o",
            ),
        ).toBe(true);
    });

    it("returns false for non-context errors", () => {
        expect(
            detectContextLimitError(
                "rate limit exceeded",
                "anthropic::claude-3-opus",
            ),
        ).toBe(false);
    });
});

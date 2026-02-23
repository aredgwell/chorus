import { describe, it, expect, vi, afterEach } from "vitest";
import {
    createAIMessage,
    createUserMessage,
    isBlockType,
    getBlockTypeDisplayName,
    blockIsEmpty,
    llmConversation,
    llmConversationForSynthesis,
} from "./ChatState";
import type {
    MessageSetDetail,
    Message,
    MessagePart,
    BlockType,
} from "./ChatState";

afterEach(() => {
    vi.restoreAllMocks();
});

// --------------- helpers ---------------

function makeMessage(overrides: Partial<Message> = {}): Message {
    return {
        id: "msg-1",
        chatId: "chat-1",
        messageSetId: "ms-1",
        blockType: "chat",
        text: "Hello",
        model: "test-model",
        selected: true,
        attachments: undefined,
        isReview: false,
        state: "idle",
        streamingToken: undefined,
        errorMessage: undefined,
        reviewState: undefined,
        level: undefined,
        parts: [],
        replyChatId: undefined,
        branchedFromId: undefined,
        ...overrides,
    };
}

function makePart(overrides: Partial<MessagePart> = {}): MessagePart {
    return {
        chatId: "chat-1",
        messageId: "msg-1",
        level: 0,
        content: "Part content",
        ...overrides,
    };
}

function makeMessageSet(
    overrides: Partial<MessageSetDetail> = {},
): MessageSetDetail {
    return {
        id: "ms-1",
        chatId: "chat-1",
        type: "user",
        level: 0,
        selectedBlockType: "user",
        createdAt: "2025-01-01T00:00:00Z",
        userBlock: { type: "user", message: undefined },
        chatBlock: { type: "chat", message: undefined, reviews: [] },
        compareBlock: { type: "compare", messages: [], synthesis: undefined },
        brainstormBlock: { type: "brainstorm", ideaMessages: [] },
        toolsBlock: { type: "tools", chatMessages: [] },
        ...overrides,
    };
}

// --------------- createAIMessage ---------------

describe("createAIMessage", () => {
    it("creates an AI message with streaming state", () => {
        const msg = createAIMessage({
            chatId: "c1",
            messageSetId: "ms1",
            blockType: "chat",
            model: "claude",
        });
        expect(msg.chatId).toBe("c1");
        expect(msg.model).toBe("claude");
        expect(msg.state).toBe("streaming");
        expect(msg.text).toBe("");
        expect(msg.selected).toBe(false);
        expect(msg.isReview).toBe(false);
    });

    it("respects optional overrides", () => {
        const msg = createAIMessage({
            chatId: "c1",
            messageSetId: "ms1",
            blockType: "compare",
            model: "gpt-4",
            selected: true,
            isReview: true,
            level: 3,
        });
        expect(msg.selected).toBe(true);
        expect(msg.isReview).toBe(true);
        expect(msg.level).toBe(3);
        expect(msg.blockType).toBe("compare");
    });
});

// --------------- createUserMessage ---------------

describe("createUserMessage", () => {
    it("creates a user message in idle state", () => {
        const msg = createUserMessage({
            chatId: "c1",
            messageSetId: "ms1",
            text: "Hi there",
        });
        expect(msg.model).toBe("user");
        expect(msg.text).toBe("Hi there");
        expect(msg.state).toBe("idle");
        expect(msg.selected).toBe(true);
        expect(msg.blockType).toBe("user");
    });
});

// --------------- isBlockType ---------------

describe("isBlockType", () => {
    it("returns true for selectable block types", () => {
        expect(isBlockType("tools")).toBe(true);
        expect(isBlockType("chat")).toBe(true);
        expect(isBlockType("compare")).toBe(true);
    });

    it("returns false for non-selectable types", () => {
        expect(isBlockType("user")).toBe(false);
        expect(isBlockType("brainstorm")).toBe(false);
        expect(isBlockType("invalid")).toBe(false);
    });
});

// --------------- getBlockTypeDisplayName ---------------

describe("getBlockTypeDisplayName", () => {
    it("maps block types to display names", () => {
        expect(getBlockTypeDisplayName("tools")).toBe("Default");
        expect(getBlockTypeDisplayName("chat")).toBe("Reviews");
        expect(getBlockTypeDisplayName("compare")).toBe("Compare");
        expect(getBlockTypeDisplayName("brainstorm")).toBe("Brainstorm");
    });

    it("returns the type itself for user", () => {
        expect(getBlockTypeDisplayName("user")).toBe("user");
    });
});

// --------------- blockIsEmpty ---------------

describe("blockIsEmpty", () => {
    it("returns true for empty chat block", () => {
        const ms = makeMessageSet({ selectedBlockType: "chat" });
        expect(blockIsEmpty(ms, "chat")).toBe(true);
    });

    it("returns false for chat block with a message", () => {
        const ms = makeMessageSet({
            chatBlock: {
                type: "chat",
                message: makeMessage(),
                reviews: [],
            },
        });
        expect(blockIsEmpty(ms, "chat")).toBe(false);
    });

    it("returns false for chat block with reviews only", () => {
        const ms = makeMessageSet({
            chatBlock: {
                type: "chat",
                message: undefined,
                reviews: [makeMessage({ isReview: true })],
            },
        });
        expect(blockIsEmpty(ms, "chat")).toBe(false);
    });

    it("returns true for empty compare block", () => {
        const ms = makeMessageSet();
        expect(blockIsEmpty(ms, "compare")).toBe(true);
    });

    it("returns false for compare block with messages", () => {
        const ms = makeMessageSet({
            compareBlock: {
                type: "compare",
                messages: [makeMessage()],
                synthesis: undefined,
            },
        });
        expect(blockIsEmpty(ms, "compare")).toBe(false);
    });

    it("returns true for empty tools block", () => {
        const ms = makeMessageSet();
        expect(blockIsEmpty(ms, "tools")).toBe(true);
    });

    it("returns false for tools block with messages", () => {
        const ms = makeMessageSet({
            toolsBlock: {
                type: "tools",
                chatMessages: [makeMessage()],
            },
        });
        expect(blockIsEmpty(ms, "tools")).toBe(false);
    });

    it("returns true for empty brainstorm block", () => {
        const ms = makeMessageSet();
        expect(blockIsEmpty(ms, "brainstorm")).toBe(true);
    });

    it("returns false for brainstorm block with ideas", () => {
        const ms = makeMessageSet({
            brainstormBlock: {
                type: "brainstorm",
                ideaMessages: [makeMessage()],
            },
        });
        expect(blockIsEmpty(ms, "brainstorm")).toBe(false);
    });

    it("throws for user block type", () => {
        const ms = makeMessageSet();
        expect(() => blockIsEmpty(ms, "user")).toThrow(
            "Unexpected block type",
        );
    });
});

// --------------- llmConversation ---------------

describe("llmConversation", () => {
    it("returns empty array for empty input", () => {
        expect(llmConversation([])).toEqual([]);
    });

    it("encodes a user block", () => {
        const ms = makeMessageSet({
            selectedBlockType: "user",
            userBlock: {
                type: "user",
                message: makeMessage({
                    model: "user",
                    text: "What is 2+2?",
                    attachments: [],
                }),
            },
        });
        const result = llmConversation([ms]);
        expect(result).toHaveLength(1);
        expect(result[0].role).toBe("user");
        expect(result[0].content).toBe("What is 2+2?");
    });

    it("encodes a user block with undefined message as empty content", () => {
        const ms = makeMessageSet({
            selectedBlockType: "user",
            userBlock: { type: "user", message: undefined },
        });
        const result = llmConversation([ms]);
        expect(result).toHaveLength(1);
        expect(result[0].content).toBe("");
    });

    it("encodes a chat block with message", () => {
        const ms = makeMessageSet({
            selectedBlockType: "chat",
            chatBlock: {
                type: "chat",
                message: makeMessage({ text: "AI response", model: "claude" }),
                reviews: [],
            },
        });
        const result = llmConversation([ms]);
        expect(result).toHaveLength(1);
        expect(result[0].role).toBe("assistant");
        expect(result[0].content).toBe("AI response");
    });

    it("encodes a chat block with applied review revision", () => {
        const ms = makeMessageSet({
            selectedBlockType: "chat",
            chatBlock: {
                type: "chat",
                message: makeMessage({ text: "Original" }),
                reviews: [
                    makeMessage({
                        isReview: true,
                        reviewState: "applied",
                        text: "<decision>REVISE</decision><explanation>Fix</explanation><revision>Revised content</revision>",
                    }),
                ],
            },
        });
        const result = llmConversation([ms]);
        expect(result).toHaveLength(1);
        expect(result[0].content).toBe("Revised content");
    });

    it("encodes an empty chat block as empty array", () => {
        const ms = makeMessageSet({
            selectedBlockType: "chat",
            chatBlock: {
                type: "chat",
                message: undefined,
                reviews: [],
            },
        });
        const result = llmConversation([ms]);
        expect(result).toEqual([]);
    });

    it("encodes a compare block with selected synthesis", () => {
        const ms = makeMessageSet({
            selectedBlockType: "compare",
            compareBlock: {
                type: "compare",
                messages: [makeMessage({ text: "Response A" })],
                synthesis: makeMessage({
                    text: "Synthesized response",
                    selected: true,
                }),
            },
        });
        const result = llmConversation([ms]);
        expect(result).toHaveLength(1);
        expect(result[0].content).toBe("Synthesized response");
    });

    it("encodes a compare block with single selected message", () => {
        const ms = makeMessageSet({
            selectedBlockType: "compare",
            compareBlock: {
                type: "compare",
                messages: [
                    makeMessage({
                        text: "Selected",
                        selected: true,
                        id: "m1",
                    }),
                    makeMessage({
                        text: "Not selected",
                        selected: false,
                        id: "m2",
                    }),
                ],
                synthesis: undefined,
            },
        });
        const result = llmConversation([ms]);
        expect(result).toHaveLength(1);
        expect(result[0].content).toBe("Selected");
    });

    it("encodes a brainstorm block", () => {
        const ms = makeMessageSet({
            selectedBlockType: "brainstorm",
            brainstormBlock: {
                type: "brainstorm",
                ideaMessages: [
                    makeMessage({ text: "Idea 1" }),
                    makeMessage({ text: "Idea 2" }),
                ],
            },
        });
        const result = llmConversation([ms]);
        expect(result).toHaveLength(1);
        expect(result[0].content).toContain("<idea>Idea 1</idea>");
        expect(result[0].content).toContain("<idea>Idea 2</idea>");
    });

    it("encodes a tools block with selected message parts", () => {
        const ms = makeMessageSet({
            selectedBlockType: "tools",
            toolsBlock: {
                type: "tools",
                chatMessages: [
                    makeMessage({
                        selected: true,
                        parts: [
                            makePart({
                                content: "Here is my response",
                            }),
                        ],
                    }),
                ],
            },
        });
        const result = llmConversation([ms]);
        expect(result).toHaveLength(1);
        expect(result[0].role).toBe("assistant");
        expect(result[0].content).toBe("Here is my response");
    });

    it("encodes a tools block with tool results", () => {
        const ms = makeMessageSet({
            selectedBlockType: "tools",
            toolsBlock: {
                type: "tools",
                chatMessages: [
                    makeMessage({
                        selected: true,
                        parts: [
                            makePart({
                                content: "Let me check",
                                toolCalls: [
                                    {
                                        id: "tc1",
                                        namespacedToolName: "files_read",
                                        args: { path: "/test" },
                                    },
                                ],
                            }),
                            makePart({
                                content: "",
                                toolResults: [
                                    {
                                        id: "tc1",
                                        content: "file content here",
                                    },
                                ],
                            }),
                        ],
                    }),
                ],
            },
        });
        const result = llmConversation([ms]);
        expect(result).toHaveLength(2);
        expect(result[0].role).toBe("assistant");
        expect(result[1].role).toBe("tool_results");
    });

    it("filters ephemeral attachments from non-last user messages", () => {
        const userMsg1 = makeMessageSet({
            id: "ms-1",
            selectedBlockType: "user",
            userBlock: {
                type: "user",
                message: makeMessage({
                    model: "user",
                    text: "First message",
                    attachments: [
                        {
                            id: "a1",
                            type: "image",
                            name: "screenshot.png",
                            content: "data",
                            ephemeral: true,
                            chatId: "chat-1",
                            messageSetId: "ms-1",
                        },
                        {
                            id: "a2",
                            type: "text",
                            name: "file.txt",
                            content: "data",
                            ephemeral: false,
                            chatId: "chat-1",
                            messageSetId: "ms-1",
                        },
                    ],
                }),
            },
        });
        const aiMsg = makeMessageSet({
            id: "ms-2",
            type: "ai",
            selectedBlockType: "chat",
            chatBlock: {
                type: "chat",
                message: makeMessage({ text: "Response" }),
                reviews: [],
            },
        });
        const userMsg2 = makeMessageSet({
            id: "ms-3",
            selectedBlockType: "user",
            userBlock: {
                type: "user",
                message: makeMessage({
                    model: "user",
                    text: "Second message",
                    attachments: [
                        {
                            id: "a3",
                            type: "image",
                            name: "new-screenshot.png",
                            content: "data",
                            ephemeral: true,
                            chatId: "chat-1",
                            messageSetId: "ms-3",
                        },
                    ],
                }),
            },
        });

        const result = llmConversation([userMsg1, aiMsg, userMsg2]);

        // First user message: ephemeral attachment filtered out
        expect(result[0].role).toBe("user");
        if (result[0].role === "user") {
            expect(result[0].attachments).toHaveLength(1);
            expect(result[0].attachments[0].ephemeral).toBe(false);
        }

        // Last user message: ephemeral attachment kept
        expect(result[2].role).toBe("user");
        if (result[2].role === "user") {
            expect(result[2].attachments).toHaveLength(1);
            expect(result[2].attachments[0].ephemeral).toBe(true);
        }
    });

    it("handles multiple message sets in sequence", () => {
        const sets: MessageSetDetail[] = [
            makeMessageSet({
                id: "ms-1",
                selectedBlockType: "user",
                userBlock: {
                    type: "user",
                    message: makeMessage({
                        model: "user",
                        text: "Question",
                        attachments: [],
                    }),
                },
            }),
            makeMessageSet({
                id: "ms-2",
                type: "ai",
                selectedBlockType: "chat",
                chatBlock: {
                    type: "chat",
                    message: makeMessage({ text: "Answer" }),
                    reviews: [],
                },
            }),
        ];
        const result = llmConversation(sets);
        expect(result).toHaveLength(2);
        expect(result[0].role).toBe("user");
        expect(result[1].role).toBe("assistant");
    });
});

// --------------- llmConversationForSynthesis ---------------

describe("llmConversationForSynthesis", () => {
    it("appends synthesis interjection from final compare block", () => {
        const sets: MessageSetDetail[] = [
            makeMessageSet({
                id: "ms-1",
                selectedBlockType: "user",
                userBlock: {
                    type: "user",
                    message: makeMessage({
                        model: "user",
                        text: "Compare these",
                        attachments: [],
                    }),
                },
            }),
            makeMessageSet({
                id: "ms-2",
                type: "ai",
                selectedBlockType: "compare",
                compareBlock: {
                    type: "compare",
                    messages: [
                        makeMessage({
                            text: "Perspective A",
                            model: "claude",
                        }),
                        makeMessage({
                            text: "Perspective B",
                            model: "gpt-4",
                        }),
                    ],
                    synthesis: undefined,
                },
            }),
        ];
        const result = llmConversationForSynthesis(sets);

        // Should have the user message + synthesis interjection
        expect(result.length).toBeGreaterThanOrEqual(2);

        // Last message should contain perspectives
        const last = result[result.length - 1];
        expect(last.role).toBe("user");
        expect(last.content).toContain("Perspective A");
        expect(last.content).toContain("Perspective B");
        expect(last.content).toContain("claude");
        expect(last.content).toContain("gpt-4");
    });
});

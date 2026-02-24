import { describe, it, expect } from "vitest";
import { parseIdeaMessage } from "./brainstorm";

describe("parseIdeaMessage", () => {
    it("parses a single idea without advantage", () => {
        const result = parseIdeaMessage("<idea>Build a todo app</idea>");
        expect(result).toHaveLength(1);
        expect(result[0].idea).toBe("Build a todo app");
        expect(result[0].advantage).toBeUndefined();
    });

    it("parses a single idea with advantage", () => {
        const result = parseIdeaMessage(
            "<idea>Build a todo app<advantage>Simple to implement</advantage></idea>",
        );
        expect(result).toHaveLength(1);
        expect(result[0].idea).toBe("Build a todo app");
        expect(result[0].advantage).toBe("Simple to implement");
    });

    it("parses multiple ideas", () => {
        const text = `
            <idea>First idea</idea>
            <idea>Second idea<advantage>It's better</advantage></idea>
            <idea>Third idea</idea>
        `;
        const result = parseIdeaMessage(text);
        expect(result).toHaveLength(3);
        expect(result[0].idea).toBe("First idea");
        expect(result[0].advantage).toBeUndefined();
        expect(result[1].idea).toBe("Second idea");
        expect(result[1].advantage).toBe("It's better");
        expect(result[2].idea).toBe("Third idea");
    });

    it("returns empty array when no ideas found", () => {
        const result = parseIdeaMessage("No ideas here");
        expect(result).toEqual([]);
    });

    it("returns empty array for empty string", () => {
        const result = parseIdeaMessage("");
        expect(result).toEqual([]);
    });

    it("handles multiline idea content", () => {
        const result = parseIdeaMessage(
            "<idea>Line one\nLine two\nLine three</idea>",
        );
        expect(result).toHaveLength(1);
        expect(result[0].idea).toContain("Line one");
        expect(result[0].idea).toContain("Line three");
    });

    it("handles multiline advantage content", () => {
        const result = parseIdeaMessage(
            "<idea>My idea<advantage>Reason one\nReason two</advantage></idea>",
        );
        expect(result).toHaveLength(1);
        expect(result[0].advantage).toBe("Reason one\nReason two");
    });

    it("strips the advantage tag from the idea text", () => {
        const result = parseIdeaMessage(
            "<idea>Before advantage<advantage>The advantage</advantage> after advantage</idea>",
        );
        expect(result).toHaveLength(1);
        expect(result[0].idea).not.toContain("<advantage>");
        expect(result[0].idea).not.toContain("The advantage");
        expect(result[0].idea).toContain("Before advantage");
        expect(result[0].idea).toContain("after advantage");
    });
});

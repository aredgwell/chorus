import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { parseReview } from "./reviews";

beforeEach(() => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe("parseReview", () => {
    it("parses a complete review with all fields", () => {
        const text =
            "<decision>REVISE</decision>" +
            "<explanation>Needs work</explanation>" +
            "<revision>Here is the revision</revision>";
        const result = parseReview(text, true);
        expect(result.decision).toBe("REVISE");
        expect(result.explanation).toBe("Needs work");
        expect(result.revision).toBe("Here is the revision");
    });

    it("parses an AGREE decision with no revision", () => {
        const text =
            "<decision>AGREE</decision>" +
            "<explanation>Looks good</explanation>";
        const result = parseReview(text, true);
        expect(result.decision).toBe("AGREE");
        expect(result.explanation).toBe("Looks good");
        expect(result.revision).toBeUndefined();
    });

    it("returns undefined fields when tags are missing", () => {
        const result = parseReview("No tags here", true);
        expect(result.decision).toBeUndefined();
        expect(result.explanation).toBeUndefined();
        expect(result.revision).toBeUndefined();
    });

    it("handles multiline content inside tags", () => {
        const text =
            "<decision>REVISE</decision>" +
            "<explanation>Line 1\nLine 2</explanation>" +
            "<revision>Rev line 1\nRev line 2</revision>";
        const result = parseReview(text, true);
        expect(result.explanation).toBe("Line 1\nLine 2");
        expect(result.revision).toBe("Rev line 1\nRev line 2");
    });

    it("extracts revision to end of text when closing tag is missing and isComplete", () => {
        const text =
            "<decision>REVISE</decision>" +
            "<explanation>Fix it</explanation>" +
            "<revision>Started the revision but no end tag";
        const result = parseReview(text, true);
        expect(result.revision).toBe(
            "Started the revision but no end tag",
        );
    });

    it("does not extract unclosed revision when isComplete is false", () => {
        const text =
            "<decision>REVISE</decision>" +
            "<explanation>Fix it</explanation>" +
            "<revision>Started but still streaming";
        const result = parseReview(text, false);
        expect(result.revision).toBeUndefined();
    });

    it("warns about missing revision for non-AGREE decisions when isComplete", () => {
        const text =
            "<decision>REVISE</decision>" +
            "<explanation>Needs changes</explanation>";
        parseReview(text, true);
        expect(console.warn).toHaveBeenCalledWith(
            expect.stringContaining("Hopeless revision"),
        );
    });

    it("does not warn about missing revision for AGREE decisions", () => {
        const text =
            "<decision>AGREE</decision>" +
            "<explanation>All good</explanation>";
        parseReview(text, true);
        expect(console.warn).not.toHaveBeenCalled();
    });

    it("handles empty string", () => {
        const result = parseReview("", true);
        expect(result.decision).toBeUndefined();
        expect(result.explanation).toBeUndefined();
        expect(result.revision).toBeUndefined();
    });

    it("handles partial tags (only decision)", () => {
        const result = parseReview("<decision>AGREE</decision>", false);
        expect(result.decision).toBe("AGREE");
        expect(result.explanation).toBeUndefined();
        expect(result.revision).toBeUndefined();
    });
});

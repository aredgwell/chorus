import { describe, expect, it } from "vitest";

import type { UserTool } from "./Toolsets";
import {
    getEnvFromJSON,
    getUserToolNamespacedName,
    parseUserToolNamespacedName,
    TOOL_CALL_INTERRUPTED_MESSAGE,
} from "./Toolsets";

describe("getUserToolNamespacedName", () => {
    it("joins toolsetName and displayNameSuffix with underscore", () => {
        const tool: UserTool = {
            toolsetName: "files",
            displayNameSuffix: "read",
            inputSchema: {},
        };
        expect(getUserToolNamespacedName(tool)).toBe("files_read");
    });

    it("handles multi-word names", () => {
        const tool: UserTool = {
            toolsetName: "my-toolset",
            displayNameSuffix: "do-something",
            inputSchema: {},
        };
        expect(getUserToolNamespacedName(tool)).toBe("my-toolset_do-something");
    });
});

describe("parseUserToolNamespacedName", () => {
    it("splits on first underscore", () => {
        const result = parseUserToolNamespacedName("files_read");
        expect(result.toolsetName).toBe("files");
        expect(result.displayNameSuffix).toBe("read");
    });

    it("handles names with multiple underscores", () => {
        const result = parseUserToolNamespacedName("my_tool_with_underscores");
        expect(result.toolsetName).toBe("my");
        expect(result.displayNameSuffix).toBe("tool_with_underscores");
    });

    it("roundtrips with getUserToolNamespacedName", () => {
        const tool: UserTool = {
            toolsetName: "github",
            displayNameSuffix: "create_issue",
            inputSchema: {},
        };
        const name = getUserToolNamespacedName(tool);
        const parsed = parseUserToolNamespacedName(name);
        expect(parsed.toolsetName).toBe("github");
        expect(parsed.displayNameSuffix).toBe("create_issue");
    });
});

describe("getEnvFromJSON", () => {
    it("parses valid JSON object with string values", () => {
        const result = getEnvFromJSON('{"KEY": "value", "FOO": "bar"}');
        expect(result).toEqual({ KEY: "value", FOO: "bar" });
    });

    it("returns empty object for undefined input", () => {
        const result = getEnvFromJSON(undefined);
        expect(result).toEqual({});
    });

    it("returns empty object for empty JSON object", () => {
        const result = getEnvFromJSON("{}");
        expect(result).toEqual({});
    });

    it("returns error for non-object JSON", () => {
        const result = getEnvFromJSON('"just a string"');
        expect(result).toEqual({
            _type: "error",
            error: "Env must be an object",
        });
    });

    it("returns error for null JSON", () => {
        const result = getEnvFromJSON("null");
        expect(result).toEqual({
            _type: "error",
            error: "Env must be not be null",
        });
    });

    it("returns error for non-string values", () => {
        const result = getEnvFromJSON('{"KEY": 123}');
        expect(result).toEqual({
            _type: "error",
            error: "All values must be strings",
        });
    });

    it("returns error for invalid JSON", () => {
        const result = getEnvFromJSON("not valid json");
        expect(result).toHaveProperty("_type", "error");
    });

    it("returns error for array JSON (non-string values)", () => {
        const result = getEnvFromJSON("[1, 2, 3]");
        // Arrays pass typeof === "object" check, but entries have non-string values
        expect(result).toEqual({
            _type: "error",
            error: "All values must be strings",
        });
    });
});

describe("TOOL_CALL_INTERRUPTED_MESSAGE", () => {
    it("is a non-empty string constant", () => {
        expect(typeof TOOL_CALL_INTERRUPTED_MESSAGE).toBe("string");
        expect(TOOL_CALL_INTERRUPTED_MESSAGE.length).toBeGreaterThan(0);
    });
});

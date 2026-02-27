import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { UpdateQueue } from "./UpdateQueue";

// Mock uuid to return deterministic keys
vi.mock("uuid", () => ({
    v4: vi.fn(() => "test-key-" + Math.random().toString(36).slice(2, 8)),
}));

beforeEach(() => {
    // Make setTimeout resolve immediately so processStream loops don't stall
    vi.spyOn(globalThis, "setTimeout").mockImplementation(
        (fn: TimerHandler) => {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call
            if (typeof fn === "function") fn();
            return 0 as unknown as ReturnType<typeof setTimeout>;
        },
    );
    vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
    vi.restoreAllMocks();
});

// Access the singleton by resetting it between tests
function freshQueue(): UpdateQueue {
    // Force a fresh instance by clearing the private static field
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
    (UpdateQueue as any).instance = undefined;
    return UpdateQueue.getInstance();
}

describe("UpdateQueue", () => {
    describe("getInstance", () => {
        it("returns the same instance on repeated calls", () => {
            const q = freshQueue();
            expect(UpdateQueue.getInstance()).toBe(q);
        });
    });

    describe("startUpdateStream", () => {
        it("returns a unique stream key", () => {
            const q = freshQueue();
            const key1 = q.startUpdateStream();
            const key2 = q.startUpdateStream();
            expect(key1).toBeTruthy();
            expect(key2).toBeTruthy();
            expect(key1).not.toBe(key2);
        });
    });

    describe("addUpdate", () => {
        it("executes an update that is added to an active stream", async () => {
            const q = freshQueue();
            const key = q.startUpdateStream();

            const fn = vi.fn().mockResolvedValue(undefined);
            q.addUpdate(key, 0, fn);

            // Give the processing loop a tick to run
            await Promise.resolve();
            await Promise.resolve();

            expect(fn).toHaveBeenCalledTimes(1);
            q.closeUpdateStream(key);
        });

        it("ignores updates for unknown stream keys", () => {
            const q = freshQueue();
            // Should not throw
            q.addUpdate("nonexistent", 5, vi.fn().mockResolvedValue(undefined));
        });

        it("replaces lower-priority pending update with higher-priority one", async () => {
            const q = freshQueue();
            const key = q.startUpdateStream();

            const lowPriority = vi.fn().mockResolvedValue(undefined);
            const highPriority = vi.fn().mockResolvedValue(undefined);

            // Add low then high before the loop processes either
            q.addUpdate(key, 1, lowPriority);
            q.addUpdate(key, 5, highPriority);

            await Promise.resolve();
            await Promise.resolve();

            // High priority should run; low should not (it was replaced)
            expect(highPriority).toHaveBeenCalledTimes(1);
            expect(lowPriority).not.toHaveBeenCalled();
            q.closeUpdateStream(key);
        });

        it("does not replace higher-priority pending update with lower-priority one", async () => {
            const q = freshQueue();
            const key = q.startUpdateStream();

            const highPriority = vi.fn().mockResolvedValue(undefined);
            const lowPriority = vi.fn().mockResolvedValue(undefined);

            q.addUpdate(key, 10, highPriority);
            q.addUpdate(key, 1, lowPriority);

            await Promise.resolve();
            await Promise.resolve();

            expect(highPriority).toHaveBeenCalledTimes(1);
            expect(lowPriority).not.toHaveBeenCalled();
            q.closeUpdateStream(key);
        });
    });

    describe("closeUpdateStream", () => {
        it("stops processing after close", async () => {
            const q = freshQueue();
            const key = q.startUpdateStream();
            q.closeUpdateStream(key);

            const fn = vi.fn().mockResolvedValue(undefined);
            q.addUpdate(key, 0, fn);

            await Promise.resolve();
            await Promise.resolve();

            expect(fn).not.toHaveBeenCalled();
        });

        it("is a no-op for unknown keys", () => {
            const q = freshQueue();
            // Should not throw
            q.closeUpdateStream("nonexistent");
        });
    });

    describe("processStream error handling", () => {
        it("logs and continues when an update throws", async () => {
            const q = freshQueue();
            const key = q.startUpdateStream();

            const failing = vi
                .fn()
                .mockRejectedValue(new Error("update failed"));
            q.addUpdate(key, 0, failing);

            await Promise.resolve();
            await Promise.resolve();

            expect(failing).toHaveBeenCalled();
            expect(console.error).toHaveBeenCalledWith(
                "Error processing update",
                expect.any(Error),
            );

            // Stream should still be alive — we can add another update
            const succeeding = vi.fn().mockResolvedValue(undefined);
            q.addUpdate(key, 1, succeeding);
            await Promise.resolve();
            await Promise.resolve();

            expect(succeeding).toHaveBeenCalledTimes(1);
            q.closeUpdateStream(key);
        });
    });

    describe("watermark behavior", () => {
        it("advances the watermark to the highest priority seen", async () => {
            const q = freshQueue();
            const key = q.startUpdateStream();

            // First update at priority 10 — runs and sets watermark to 10
            const first = vi.fn().mockResolvedValue(undefined);
            q.addUpdate(key, 10, first);
            await Promise.resolve();
            await Promise.resolve();
            expect(first).toHaveBeenCalledTimes(1);

            // Now add an update at priority 5 — below watermark, should NOT run
            const belowWatermark = vi.fn().mockResolvedValue(undefined);
            q.addUpdate(key, 5, belowWatermark);
            await Promise.resolve();
            await Promise.resolve();
            expect(belowWatermark).not.toHaveBeenCalled();

            // Update at priority 10 (equal to watermark) — should run
            const atWatermark = vi.fn().mockResolvedValue(undefined);
            q.addUpdate(key, 10, atWatermark);
            await Promise.resolve();
            await Promise.resolve();
            expect(atWatermark).toHaveBeenCalledTimes(1);

            q.closeUpdateStream(key);
        });
    });
});

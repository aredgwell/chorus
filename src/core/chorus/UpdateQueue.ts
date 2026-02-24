import { v4 as uuidv4 } from "uuid";

interface StreamData {
    active: boolean;
    watermark: number;
    pendingUpdate: QueuedUpdate | null;
}

interface QueuedUpdate<T = unknown> {
    priority: number;
    update: () => Promise<T>;
}

const IDLE_SLEEP_MS = 50;

/**
 * Manages streaming update queues with per-stream parallelism.
 *
 * Each stream gets its own independent processing loop, so multiple
 * models streaming simultaneously don't block each other. Within a
 * single stream, updates are processed serially with priority-based
 * deduplication (only the highest-priority pending update runs).
 */
export class UpdateQueue {
    private static instance: UpdateQueue;
    private streams: Map<string, StreamData> = new Map();

    private constructor() {}

    public static getInstance(): UpdateQueue {
        if (!UpdateQueue.instance) {
            UpdateQueue.instance = new UpdateQueue();
        }
        return UpdateQueue.instance;
    }

    /**
     * Start a new update stream with its own independent processing loop.
     * @returns A unique key for the stream
     */
    public startUpdateStream(): string {
        const key = uuidv4();
        this.streams.set(key, {
            active: true,
            watermark: 0,
            pendingUpdate: null,
        });
        void this.processStream(key);
        return key;
    }

    /**
     * Add an update to the queue, replacing any existing update for this key
     * with lower priority.
     * @param key Identifier for the stream
     * @param priority Higher number = higher priority
     * @param update Function to execute
     */
    public addUpdate<T = void>(
        key: string,
        priority: number,
        update: () => Promise<T>,
    ): void {
        const stream = this.streams.get(key);
        if (!stream || !stream.active) return;

        stream.watermark = Math.max(stream.watermark, priority);

        if (!stream.pendingUpdate || priority > stream.pendingUpdate.priority) {
            stream.pendingUpdate = { priority, update };
        }
    }

    /**
     * Close an update stream. Its processing loop will exit on the next iteration.
     * @param key The stream key to close
     */
    public closeUpdateStream(key: string): void {
        const stream = this.streams.get(key);
        if (!stream) return;
        stream.active = false;
    }

    /**
     * Independent processing loop for a single stream.
     * Runs until the stream is marked inactive and has no pending work.
     */
    private async processStream(key: string): Promise<void> {
        // eslint-disable-next-line no-constant-condition
        while (true) {
            const stream = this.streams.get(key);
            if (!stream) return;

            // If stream is closed and no pending work, clean up and exit
            if (!stream.active) {
                stream.pendingUpdate = null;
                this.streams.delete(key);
                return;
            }

            // Process pending update if it meets the watermark
            if (
                stream.pendingUpdate &&
                stream.pendingUpdate.priority >= stream.watermark
            ) {
                const update = stream.pendingUpdate;
                stream.pendingUpdate = null;
                try {
                    await update.update();
                } catch (e) {
                    console.error("Error processing update", e);
                }
            } else {
                // Nothing to process — yield to avoid tight loop
                await new Promise((resolve) =>
                    setTimeout(resolve, IDLE_SLEEP_MS),
                );
            }
        }
    }
}

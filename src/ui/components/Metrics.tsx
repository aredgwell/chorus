import { encodingForModel } from "js-tiktoken";
import { useEffect,useState } from "react";

// Initialize the tokenizer - using gpt-4 encoding as a default since it's commonly used
const tokenizer = encodingForModel("gpt-4o");

export function Metrics({
    text,
    startTime,
    isStreaming,
}: {
    text: string;
    startTime: Date;
    isStreaming: boolean;
}) {
    const [timeToFirstToken, setTimeToFirstToken] = useState<number>();
    const [tokensPerSecond, setTokensPerSecond] = useState<number>();
    const [currentTime, setCurrentTime] = useState<number>(0);

    // Calculate metrics whenever text changes or streaming state changes
    useEffect(() => {
        const now = new Date();
        const tokens = tokenizer.encode(text).length;

        // Calculate time to first token if we haven't yet
        if (timeToFirstToken === undefined && tokens > 0) {
            const time = now.getTime() - startTime.getTime();
            setTimeToFirstToken(time);
            setCurrentTime(time);
        }

        // Calculate tokens per second only when streaming ends
        if (!isStreaming && tokens > 0) {
            const totalTime = now.getTime() - startTime.getTime();
            setTokensPerSecond(tokens / totalTime);
        }
    }, [text, startTime, timeToFirstToken, isStreaming]);

    // Update the current time while waiting for first token
    useEffect(() => {
        if (timeToFirstToken === undefined && isStreaming) {
            const interval = setInterval(() => {
                const now = new Date();
                setCurrentTime(now.getTime() - startTime.getTime());
            }, 100); // Update every 100ms for smoother animation

            return () => clearInterval(interval);
        }
    }, [timeToFirstToken, startTime, isStreaming]);

    if (!isStreaming && !timeToFirstToken) return null;

    return (
        <div className="absolute  bottom-1 right-2 text-[10px] text-gray-500 font-mono tracking-wider uppercase tabular-nums">
            <>
                {!isStreaming && tokensPerSecond !== undefined && (
                    <span title="Tokens per second" className="mr-2">
                        {(tokensPerSecond * 1000).toFixed(1)} tokens/sec
                    </span>
                )}
                <span title="Time to first token">
                    {((timeToFirstToken ?? currentTime) / 1000).toFixed(2)}
                    <span className="lowercase">s</span>
                </span>
            </>
        </div>
    );
}

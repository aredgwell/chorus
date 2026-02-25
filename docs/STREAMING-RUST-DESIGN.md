# Rust Streaming Design

## Current Architecture

```
JS Provider.streamResponse(params)
  → HTTP SSE via SDK (Anthropic, OpenAI, etc.)
  → onChunk(text) → TanStack Query cache update (Immer produce)
  → UpdateQueue → batched DB writes (50ms coalescing, priority dedup)
  → onComplete(finalMsg, toolCalls, usage) → final DB writes + cost
  → onError(msg) → classifyError() → PostHog
```

### Providers

9 providers, all implementing `IProvider.streamResponse()`:

| Provider | SDK | Transport | Tool Calls |
|---|---|---|---|
| Anthropic | `@anthropic-ai/sdk` | `client.messages.stream()` + `.on("text")` events | Extracted from `stream.finalMessage()` at end |
| OpenAI | `openai` | Responses API, `stream: true`, async iterable | Streamed incrementally via `function_call_arguments.delta` |
| Google | `openai` | Chat Completions via OpenAI compat endpoint | Accumulated from chunks, parsed at end |
| OpenRouter | `openai` | Chat Completions, `openrouter.ai/api/v1` | Same as Google, plus `generation_id` for cost |
| Perplexity | `openai` | Chat Completions, `api.perplexity.ai` | No tools; appends citations |
| Grok | `openai` | Chat Completions, `api.x.ai/v1` | No tools |
| Ollama | Custom | `ollamaClient.streamChat()` async generator | No tools |
| LM Studio | `openai` | Chat Completions, `localhost:1234/v1` | No tools |
| Custom OpenAI | `openai` | Chat Completions, configurable URL | Optional |

**Key observation:** 7 of 9 providers use the OpenAI Chat Completions API format. Only Anthropic and Ollama are different.

### UpdateQueue

One processing loop **per stream** (UUID key), so concurrent streams (compare mode) don't serialize.

- `addUpdate(key, priority, fn)` replaces pending update if priority is strictly higher
- 50ms idle sleep prevents hot spin
- Each chunk: cache updated immediately (React Query `setQueryData`), DB write deferred via queue
- `closeUpdateStream(key)` called from both `onComplete` and `onError`

### Tauri Events (Current)

Events are used for **UI coordination only** — menu actions, navigation, settings changes. No streaming data flows through Tauri events today. The streaming hot path is entirely within the JS process.

### Compare Mode

`Promise.all` over N `streamToolsMessage.mutateAsync()` calls. Each gets its own `streamingToken` and `UpdateQueue` stream key. Independent DB write loops.

### Tool Call Agentic Loop

`useStreamToolsMessage` runs `while (level < MAX_AI_TURNS = 40)`:
1. Create `message_part`, stream response
2. If tool calls returned → execute in parallel, store results, increment level, loop
3. If no tool calls → break
4. Clear `streaming_token`, set `state = 'idle'`

---

## Proposed Architecture

```
JS invoke("stream_response", { chatId, messageId, modelConfig, ... })
  → Rust: reqwest HTTP streaming to provider
  → Parse SSE chunks (provider-specific)
  → Batch chunks (50ms window)
  → Emit Tauri events: stream-chunk, stream-complete, stream-error
  → Write final state to DB directly (no IPC)

JS listen("stream-chunk") → setQueryData(produce(...))
JS listen("stream-complete") → invalidateQueries, PostHog
JS listen("stream-error") → classify, display
```

### Key Design Decisions

1. **Raw HTTP/SSE parsing** instead of reimplementing SDK wrappers. All providers speak HTTP; the SDKs just wrap fetch + SSE parsing. Rust can do this directly with `reqwest` (already in `Cargo.toml`) and `eventsource-stream`.

2. **Tauri events for chunk delivery.** Already used for settings/menus/navigation. Each stream gets a unique event channel keyed by `messageId`:
   - `stream-chunk:{messageId}` — `{ text: string, accumulated: string }`
   - `stream-complete:{messageId}` — `{ toolCalls?: [...], usage?: {...} }`
   - `stream-error:{messageId}` — `{ message: string }`

3. **DB writes stay in Rust.** Final message content, tool calls, usage/cost data written directly to SQLite via existing `rusqlite` + WAL pattern. Eliminates the JS → Rust → SQLite IPC hop for the final write.

4. **Chunk coalescing in Rust.** A `tokio::time::interval(50ms)` batches accumulated text before emitting events, mirroring UpdateQueue's 50ms coalescing.

5. **Cost/error classification stays in JS.** Pricing data is already in TanStack cache, error patterns are provider-specific with i18n concerns. Rust emits raw errors; JS classifies.

6. **Backwards-compatible.** JS `IProvider` remains for un-ported providers. A `use_rust_streaming` flag in model config controls which path is used. Migration is per-provider.

7. **Per-stream Tokio tasks** for compare mode concurrency. Each `invoke("stream_response", ...)` spawns one `tokio::task::spawn`. N concurrent compare streams = N independent tasks.

### Rust-Side Structure

```rust
// command.rs (new)

#[tauri::command]
pub async fn stream_response(
    app_handle: AppHandle,
    chat_id: String,
    message_id: String,
    streaming_token: String,
    provider: String,        // "anthropic", "openai", etc.
    api_key: String,
    model_name: String,
    messages: serde_json::Value,  // serialized LLMMessage[]
    tools: Option<serde_json::Value>,
    base_url: Option<String>,
    headers: Option<HashMap<String, String>>,
) -> Result<(), String> {
    let db_path = db_path(&app_handle)?;

    tokio::task::spawn(async move {
        let result = match provider.as_str() {
            "anthropic" => stream_anthropic(...).await,
            "openai" | "google" | "openrouter" | "grok" | "perplexity" | "custom"
                => stream_openai_compat(...).await,
            _ => Err("Unsupported provider".into()),
        };

        match result {
            Ok(completion) => {
                write_final_to_db(&db_path, &message_id, &streaming_token, &completion)?;
                app_handle.emit(&format!("stream-complete:{}", message_id), completion)?;
            }
            Err(e) => {
                app_handle.emit(&format!("stream-error:{}", message_id), e)?;
            }
        }
    });

    Ok(())  // returns immediately; streaming is async
}
```

### SSE Parsing

Two parser implementations:

1. **`stream_openai_compat`** — Handles Chat Completions SSE format (`data: {"choices":[{"delta":{"content":"..."}}]}`). Covers 7 providers. Tool call accumulation from delta chunks.

2. **`stream_anthropic`** — Handles Anthropic's SSE events (`content_block_delta`, `message_delta`, `message_stop`). Tool calls extracted from `content_block_stop` events with `type: "tool_use"`.

Both use `reqwest::Response::bytes_stream()` piped through an SSE parser (e.g., `eventsource-stream` crate or manual `data:` line parsing).

### Tool Call Handling

The biggest complexity. Two approaches:

**Option A: Hybrid (recommended for v1).** Rust handles streaming only. When tool calls are detected:
1. Rust emits `stream-complete:{messageId}` with `toolCalls`
2. JS receives tool calls, executes them via `ToolsetsManager` (MCP, etc.)
3. JS invokes Rust again for the next streaming turn

This keeps tool execution in JS where the MCP infrastructure lives. The agentic loop runs in JS but each streaming turn uses Rust.

**Option B: Full Rust loop.** Rust manages the agentic loop, calling back to JS for tool execution via request/response events. More complex, more latency per tool call, but fully offloads the streaming orchestration.

### JS-Side Changes

```typescript
// MessageAPI.ts — new streaming path

async function streamViaRust(params: {
    chatId: string;
    messageId: string;
    streamingToken: string;
    modelConfig: ModelConfig;
}) {
    const { messageId } = params;

    // Set up listeners before invoking
    const chunkUnlisten = listen<{ text: string; accumulated: string }>(
        `stream-chunk:${messageId}`,
        (event) => {
            // Update React Query cache
            updateMessagePartInCache(event.payload.accumulated, params.streamingToken);
        },
    );

    const completePromise = new Promise((resolve) => {
        listen(`stream-complete:${messageId}`, (event) => resolve(event.payload));
    });

    const errorPromise = new Promise((_, reject) => {
        listen(`stream-error:${messageId}`, (event) => reject(new Error(event.payload.message)));
    });

    // Fire streaming (returns immediately)
    await invoke("stream_response", { ... });

    // Wait for completion or error
    const result = await Promise.race([completePromise, errorPromise]);

    // Cleanup listeners
    (await chunkUnlisten)();

    return result;
}
```

---

## Risks

1. **Provider API format changes break Rust parser.** JS SDK updates absorb format changes automatically; a Rust SSE parser must be maintained manually. Mitigated by: covering 7/9 providers with one parser (OpenAI Chat Completions format).

2. **Tauri event overhead.** If event delivery latency exceeds the 50ms coalescing window, UI updates could feel slower. Mitigated by: measuring event latency in the POC; falling back to JS streaming if unacceptable.

3. **Tool call parsing complexity.** OpenAI Responses API streams tool calls incrementally (delta arguments). Anthropic sends them in blocks. Each format needs careful state machine parsing. Mitigated by: starting with Anthropic (simpler tool call format).

4. **API key handling.** Keys must be passed from JS to Rust per-stream. They should not be logged or stored in Rust state beyond the request lifetime.

5. **Ollama special case.** Ollama uses a non-SSE streaming format (NDJSON). Needs its own parser or can remain JS-only.

---

## POC Scope

Validate the approach with a minimal implementation:

1. **Anthropic-only** — simplest SSE format, no incremental tool calls
2. **Text streaming only** — no tool call handling in v1 POC
3. **Behind feature flag** — `rust_streaming` in model_flags JSON column
4. **Measure:** Event delivery latency, DB write timing, memory usage during long streams

### POC Deliverables

- `stream_anthropic()` function in `command.rs`
- SSE parser for Anthropic's event format
- JS `listen()` integration in `useStreamMessagePart`
- Benchmark comparing JS vs Rust streaming latency for a 4K token response

### POC Non-Goals

- OpenAI/Google/other providers
- Tool call handling
- Compare mode
- UpdateQueue replacement (use direct DB writes per-chunk initially)

---

## Implementation Phases

1. **POC** (1–2 weeks): Anthropic text-only streaming, measure perf
2. **OpenAI compat parser** (1 week): Cover 7 additional providers with one parser
3. **Tool calls** (1–2 weeks): Hybrid approach — Rust streams, JS executes tools
4. **Compare mode** (3 days): N concurrent Tokio tasks
5. **Migration** (ongoing): Flip feature flags per-provider, remove JS streaming code once stable

---

## Dependencies

- `reqwest` 0.12 — already in Cargo.toml, unused
- `eventsource-stream` or `async-sse` — SSE parsing (new dependency, ~50KB)
- `serde_json` — already used
- `tauri::Emitter` — already used for menu events

No new JS dependencies needed.

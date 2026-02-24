# Application Feature Improvements (TODO)

## Performance Improvements

### UI rendering

- **Message virtualization**: Long conversations render all messages in the DOM. Use `react-window` or `@tanstack/react-virtual` to only render visible messages. Biggest single UI perf win for long chats.
- ~~**Memoize MessageMarkdown**~~: Done — React Compiler handles this automatically now.
- ~~**Chunk batching**~~: Done — implemented 50ms debounce in MessageAPI.ts streaming.
- ~~**Vite code splitting**~~: Done — manual chunks for markdown, PDF, math, and UI vendor libs.
- **Component decomposition**: `MultiChat.tsx` (2,848 lines) and `Settings.tsx` (2,012 lines) are large single files. Extract sub-components.

### Database

- ~~**Missing indexes**~~: Done — added indexes on `messages(chat_id, state)` and `message_parts(message_id)` in migration 144.
- **Batch IPC for multi-step operations**: Operations like `duplicateMessageSet` make 5+ sequential IPC calls. A single Rust command that runs the whole transaction server-side would be faster.
- **Chat list re-sorting**: `useCacheUpdateChat` re-sorts the entire chat list on every update. Guard to only sort when sort key changes.

### Rust offloading candidates

- **Streaming assembly**: Move HTTP streaming into Rust; push batched token updates to frontend via Tauri events. Eliminates per-chunk IPC and lets Rust handle backpressure. Large effort but architecturally better.
- **Markdown pre-processing**: For very long messages, parse markdown in Rust (via `pulldown-cmark`) and send structured AST to frontend. Avoids re-parsing on every React render.
- **Batch DB operations**: Wrap multi-step DB mutations (duplicate chat, duplicate message set) in Rust commands that execute as a single SQLite transaction.

---

## React Patterns

### useOptimistic for Chat State
- ~~Delete chat~~: Done — optimistic removal from cache with rollback on error.
- ~~Rename chat~~: Done — optimistic title update in cache.
- Remaining candidates: sending messages (show user message before DB write), toggling pins
- Pattern uses TanStack Query `onMutate/onError/onSettled` with Immer `produce`

### ~~React Compiler~~
Done — `babel-plugin-react-compiler` enabled globally in `vite.config.ts`. Automatic memoization active.
- Follow-up: audit and remove manual `useMemo`/`useCallback` that the compiler now handles

---

## Integrations

### ~~Linear~~
Done — `src/core/chorus/toolsets/linear.ts` with 5 tools: `search_issues`, `get_issue`, `create_issue`, `update_issue`, `list_teams`. Uses Linear GraphQL API. Auth via manual API key in toolset config.
- Follow-up: Add OAuth flow via deep link (`chorus://linear`) — requires backend endpoint on `app.chorus.sh`

### Google Drive / Docs
- Add as a new toolset in `src/core/chorus/toolsets/gdrive.ts`
- Capabilities: search files, read document content, list recent documents
- Auth: OAuth 2.0 via deep link (`chorus://google_integration`)
- Use case: attach Google Docs as chat context (like project attachments but cloud-hosted)
- Document content would be fetched at chat time, not stored locally — keeps DB small
- Consider read-only initially; write support (create/edit docs from AI output) as a follow-up

---

## Semantic Search (sqlite-vec)

### Overview
Add vector similarity search to find related conversations, even when keyword search wouldn't match. Uses `sqlite-vec`, a SQLite extension that adds KNN vector search directly to the existing database — no separate process or data store.

### Implementation
1. **Load extension**: Add `sqlite-vec` as a native SQLite extension, loaded on the Rust side via `rusqlite` (or via Tauri SQL plugin's extension loading if supported)
2. **Schema**: Create a virtual table for embeddings:
   ```sql
   CREATE VIRTUAL TABLE chat_embeddings USING vec0(
       chat_id TEXT PRIMARY KEY,
       embedding FLOAT[1536]
   );
   ```
3. **Generate embeddings**: Use OpenAI's `text-embedding-3-small` API (or a local model via Ollama) to embed chat summaries. Trigger on chat summary generation (already exists in `ProjectAPI.ts`)
4. **Query**: KNN search via SQL:
   ```sql
   SELECT chat_id, distance FROM chat_embeddings
   WHERE embedding MATCH ?
   ORDER BY distance LIMIT 10;
   ```
5. **UI**: Add "Find similar conversations" to chat context menu and command menu

### Considerations
- Embedding generation costs: ~$0.02 per 1M tokens with `text-embedding-3-small` — negligible for chat summaries
- sqlite-vec is pure C, no dependencies — builds easily with `rusqlite`'s bundled SQLite or as a loadable extension
- Start with chat summaries only (small, already generated); expand to full message content later if needed
- If Ollama is configured, offer local embedding generation as a zero-cost alternative
- Synergy with FTS5: use FTS5 for keyword search and sqlite-vec for semantic search, combine results

---

## ~~Conversation Search~~
Done — FTS5 search was already implemented. Enhancements added:
- Full-page search view at `/search` (`SearchView.tsx`)
- Sidebar filter input in `AppSidebar.tsx`
- `Cmd+Shift+F` global shortcut for search
- "Search all conversations" action in command menu

## Export/Import
- ~~Export chats as markdown, JSON~~: Done — `ExportService.ts` with `exportChatAsMarkdown` and `exportChatAsJSON`. Export dropdown in MultiChat header.
- Import conversations from other tools — still TODO

## ~~Keyboard-First Navigation~~
Done — added shortcuts:
- `Cmd+W` close current chat
- `Cmd+Shift+F` global search
- `Cmd+F` in-chat search (was already implemented via `FindInPage.tsx`)
- `Cmd+B` toggle sidebar (was already implemented via `SidebarProvider`)
- Remaining ideas: `Cmd+1..9` switch to nth chat, vim-style keybindings for power users

## ~~Token/Cost Dashboard~~
Done — `CostDashboard.tsx` in Settings > Usage tab. Shows:
- Summary cards (all-time, 7-day, 30-day costs)
- Cost breakdown by model, project, and day
- Uses aggregate SQL queries in `CostAPI.ts`

## Local Model Management
- Ollama and LM Studio providers exist but have no model management UI
- Add UI for pulling/removing Ollama models
- Show model download progress, disk usage

## Conversation Branching UX
- `message_sets` already support branching in the data model
- Improve the UI for navigating, comparing, and managing branches
- Consider a tree/graph visualization of conversation branches

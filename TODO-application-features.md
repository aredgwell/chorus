# Application Feature Improvements (TODO)

## Performance Improvements

### UI rendering

- ~~**Message virtualization**~~: Done — improved existing IntersectionObserver approach in `VirtualizedMessageSet.tsx`. Added `content-visibility: auto` CSS for browser-level layout/paint skipping, persistent height cache across remounts (eliminates layout jumps), and reduced rootMargin from 200px to 100px.
- ~~**Memoize MessageMarkdown**~~: Done — React Compiler handles this automatically now.
- ~~**Chunk batching**~~: Done — implemented 50ms debounce in MessageAPI.ts streaming.
- ~~**Vite code splitting**~~: Done — manual chunks for markdown, PDF, math, and UI vendor libs.
- ~~**Component decomposition**~~: Done — `MultiChat.tsx` decomposed from 2,925 to ~960 lines. Extracted `ChatMessageViews.tsx` (message rendering), `ShareChatDialog.tsx`, `QuickChatHeaderBar.tsx`, `ChatHeaderActions.tsx`. `Settings.tsx` was already at 624 lines (tabs extracted to `settings/` subdirectory).

### Database

- ~~**Missing indexes**~~: Done — added indexes on `messages(chat_id, state)` and `message_parts(message_id)` in migration 144.
- ~~**Batch IPC for multi-step operations**~~: Done — 7 Rust commands wrap multi-step DB operations in single SQLite transactions: `create_message_set_pair`, `edit_message`, `convert_draft_attachments`, `restart_message`, `delete_attachment_from_project`, `increment_conductor_turn`, `delete_custom_toolset`. Extracted `db_path()` helper to reduce boilerplate.
- ~~**Chat list re-sorting**~~: Done — added `sortChanged` option to `useCacheUpdateChat`. Call sites that don't update `updatedAt` (rename, project context summary) skip the sort.

### Rust offloading candidates

- **Streaming assembly**: Move HTTP streaming into Rust; push batched token updates to frontend via Tauri events. Eliminates per-chunk IPC and lets Rust handle backpressure. Large effort but architecturally better.
- **Markdown pre-processing**: For very long messages, parse markdown in Rust (via `pulldown-cmark`) and send structured AST to frontend. Avoids re-parsing on every React render.
- ~~**Batch DB operations**~~: Done — all multi-step mutations now wrapped in Rust commands (see Database section above). Remaining candidates for Rust offloading: `duplicate_chat`, `duplicate_message_set` (currently JS-only, but rarely called).

---

## React Patterns

### useOptimistic for Chat State
- ~~Delete chat~~: Done — optimistic removal from cache with rollback on error.
- ~~Rename chat~~: Done — optimistic title update in cache.
- ~~Remaining candidates~~: Sending messages already has optimistic update (`useOptimisticInsertUserMessage`). `Chat.pinned` is deprecated with no UI — skip.
- Pattern uses TanStack Query `onMutate/onError/onSettled` with Immer `produce`

### ~~React Compiler~~
Done — `babel-plugin-react-compiler` enabled globally in `vite.config.ts`. Automatic memoization active.
- ~~Follow-up: audit and remove manual `useMemo`/`useCallback`~~: Done — removed ~45 redundant wrappers across 18 files. Kept debounced functions, DOM-mutating callbacks, and useEffect-dependent handlers.

---

## Integrations

### ~~Linear~~
Done — `src/core/chorus/toolsets/linear.ts` with 5 tools: `search_issues`, `get_issue`, `create_issue`, `update_issue`, `list_teams`. Uses Linear GraphQL API. Auth via manual API key in toolset config.

---

## ~~Semantic Search (sqlite-vec)~~
Done — full pipeline from embedding generation to UI:
- **Rust**: `sqlite-vec` 0.1.6 loaded as auto-extension; `ensure_vec_table`, `upsert_chat_embedding`, `find_similar_chats` commands in `command.rs`
- **Embeddings**: `EmbeddingService.ts` generates via OpenAI `text-embedding-3-small`. `EmbeddingQueue` deduplicates and limits concurrency. Embeddings generated automatically on title creation (first user message) and on summary generation.
- **UI — Related Chats**: Sparkle icon in chat header opens a popover with up to 3 similar conversations (via `useRelatedChats` hook)
- **UI — Similar Chats Dialog**: `SimilarChatsDialog.tsx` for full KNN search from sidebar
- **UI — Command Menu**: "Similar" group shows semantic results alongside FTS5 keyword matches (via `useSemanticSearch` hook), deduplicated by chatId

---

## ~~Conversation Search~~
Done — FTS5 search was already implemented. Enhancements added:
- Full-page search view at `/search` (`SearchView.tsx`)
- Sidebar filter input in `AppSidebar.tsx`
- `Cmd+Shift+F` global shortcut for search
- "Search all conversations" action in command menu

## Export/Import
- ~~Export chats as markdown, JSON~~: Done — `ExportService.ts` with `exportChatAsMarkdown` and `exportChatAsJSON`. Export dropdown in MultiChat header.
- ~~Import conversations from other tools~~: Done — `OpenAIImporter.ts` and `AnthropicImporter.ts` in `src/core/chorus/importers/`. UI in Settings > "Import Chat History" via `ImportChatDialog.tsx`.

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


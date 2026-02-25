# Semantic Search + Notes UX Design

## Core Insight

Semantic search and note-taking serve the same user need: **finding and building on past knowledge.** Design them as a unified "knowledge layer" rather than separate features.

---

## Current State

### Semantic Search Infrastructure

**Already built:**
- `sqlite-vec` virtual table (`chat_embeddings`) with 1536-dimension vectors
- Rust commands: `ensure_vec_table`, `upsert_chat_embedding`, `find_similar_chats`
- `EmbeddingService.ts`: generates embeddings via OpenAI `text-embedding-3-small`, truncates to 8K chars
- `SimilarChatsDialog.tsx`: KNN search UI triggered from sidebar sparkle icon
- Embeddings generated fire-and-forget after chat summary creation

**Missing:**
- Automatic embedding generation (only happens when user manually summarizes)
- Combined keyword + semantic search
- Ambient "Related Chats" display (currently dialog-only)
- Cross-project discovery
- No local embedding option (requires OpenAI key)

### FTS5 Search Infrastructure

**Already built:**
- `messages_fts` virtual table (migration 140) with Porter stemmer + unicode61 tokenizer
- 4 sync triggers (insert user msg, update user msg, insert message_parts, delete)
- `SearchAPI.ts`: `useSearchMessages` and `useFullSearchMessages`
- `CommandMenu.tsx`: debounced search → FTS5 results with highlight
- `/search` route: dedicated full-page search view
- `Cmd+Shift+F` global shortcut

**Missing:**
- Semantic results in CommandMenu/SearchView (only FTS5 keyword today)
- Cross-content-type search (chats only, no notes)

### Summary Pipeline

- `useSummarizeChat()` in MessageAPI.ts
- Two modes: `"user"` (formatted report) and `"out_of_context"` (verbatim transcript)
- Summary stored in `chats.summary` column (migration 80)
- Embedding generated fire-and-forget after summary DB write
- Triggered manually (header button) or automatically on context limit

---

## Semantic Search Improvements

### 1. Automatic Embedding Generation

Currently embeddings only exist for manually-summarized chats. Extend to:

**On title generation:** After `simpleLLM` generates a title, embed the first few messages (lightweight, fast).

**On summary generation:** Already done — just ensure it's reliable (currently fire-and-forget with `.catch(console.error)`).

**Background queue:** Deduplicate by chatId, max 3 concurrent embedding requests to avoid rate limits.

```typescript
class EmbeddingQueue {
    private pending = new Map<string, string>();  // chatId → text
    private running = 0;
    private readonly MAX_CONCURRENT = 3;

    enqueue(chatId: string, text: string): void {
        this.pending.set(chatId, text);  // latest text wins
        this.drain();
    }

    private async drain(): Promise<void> {
        while (this.running < this.MAX_CONCURRENT && this.pending.size > 0) {
            const [chatId, text] = this.pending.entries().next().value;
            this.pending.delete(chatId);
            this.running++;
            generateAndStoreEmbedding(chatId, text)
                .catch(console.error)
                .finally(() => { this.running--; this.drain(); });
        }
    }
}
```

### 2. Combined Search

Merge FTS5 keyword and sqlite-vec semantic results in a single search flow:

```
User types query
  → FTS5 keyword search (existing)
  → Embed query text → KNN search (new)
  → Merge results, deduplicate by chatId
  → Rank: exact keyword matches first, then semantic, break ties by recency
```

**Where:** CommandMenu and SearchView. Add a "Semantic" results group below the existing "Messages" group, or interleave with a visual indicator (e.g., sparkle icon for semantic matches).

### 3. Ambient "Related Chats"

Instead of requiring users to click a sparkle icon:

- Show 2–3 related chat titles in the chat header (subtle, non-intrusive)
- Only if the current chat has an embedding
- Click navigates to the related chat
- Debounce: compute once when entering a chat, cache for the session

### 4. Cross-Project Discovery

`find_similar_chats` already JOINs to `chats` and returns `projectId`. The UI just needs to surface the project name alongside each result.

### 5. Local Embedding Option

If Ollama is configured with `nomic-embed-text` (or similar), use it instead of OpenAI:

```typescript
async function getLocalEmbedding(text: string): Promise<number[]> {
    const response = await fetch("http://localhost:11434/api/embeddings", {
        method: "POST",
        body: JSON.stringify({ model: "nomic-embed-text", prompt: text }),
    });
    return (await response.json()).embedding;
}
```

**Consideration:** `nomic-embed-text` outputs 768 dimensions vs OpenAI's 1536. Would need a separate `chat_embeddings_768` table or a configurable dimension. Defer to v2.

---

## Note-Taking

### Schema

New tables (next sequential migration after 143):

```sql
CREATE TABLE note_folders (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    parent_id TEXT,              -- self-referential for nesting
    project_id TEXT,             -- optional: notes can belong to a project
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE notes (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL DEFAULT '',
    content TEXT NOT NULL DEFAULT '',
    folder_id TEXT,              -- optional folder
    project_id TEXT,             -- optional project (independent of folder)
    is_pinned INTEGER NOT NULL DEFAULT 0,
    source_chat_id TEXT,         -- if created from "Save as Note"
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE tags (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE
);

CREATE TABLE note_tags (
    note_id TEXT NOT NULL,
    tag_id TEXT NOT NULL,
    PRIMARY KEY (note_id, tag_id)
);

-- FTS5 for note search
CREATE VIRTUAL TABLE notes_fts USING fts5(
    note_id UNINDEXED,
    title,
    content,
    tokenize='porter unicode61'
);

-- Sync triggers (insert, update, delete)
CREATE TRIGGER notes_fts_insert AFTER INSERT ON notes BEGIN
    INSERT INTO notes_fts(note_id, title, content) VALUES (new.id, new.title, new.content);
END;

CREATE TRIGGER notes_fts_update AFTER UPDATE OF title, content ON notes BEGIN
    DELETE FROM notes_fts WHERE note_id = old.id;
    INSERT INTO notes_fts(note_id, title, content) VALUES (new.id, new.title, new.content);
END;

CREATE TRIGGER notes_fts_delete AFTER DELETE ON notes BEGIN
    DELETE FROM notes_fts WHERE note_id = old.id;
END;
```

No foreign keys (per project style). The `source_chat_id` enables bidirectional chat↔note links.

### Editor: Tiptap

**Why Tiptap:** WYSIWYG Notion-like editing, rich extension ecosystem (tables, code blocks, task lists, mentions), ~150KB lazy-loaded. The app already has a full markdown rendering pipeline (`MessageMarkdown` with remark/rehype) — Tiptap can output markdown that reuses this pipeline for preview.

**Lazy loading:** `React.lazy(() => import('./NoteEditor'))` — only loaded when user navigates to `/notes/:noteId`.

**Extensions (MVP):**
- `StarterKit` (headings, lists, code blocks, bold/italic)
- `Placeholder` ("Start writing...")
- `Markdown` (import/export)
- `CodeBlockLowlight` (reuse existing `react-lowlight` setup)

**Extensions (post-MVP):**
- `TaskList` / `TaskItem`
- `Table`
- `Mention` (link to chats or other notes)
- `MermaidBlock` (custom extension, reuse existing Mermaid renderer)

### Routes

```
/notes              → Notes list view (all notes, filterable)
/notes/:noteId      → Note editor view
/notes/new          → Create new note (redirect to /notes/:newId after creation)
```

Added to `App.tsx` router config.

### Sidebar

Add a "Notes" section between Projects and the date-grouped chat list:

```
── Start New Chat ──
── Filter input ──
── Projects ──
    └── Project A (collapsible)
        └── Chat 1, Chat 2
── Notes ──              ← NEW
    └── Pinned notes
    └── Recent notes (3–5)
    └── "All Notes" link
── Today ──
    └── Chat 3, Chat 4
── Yesterday ──
    └── Chat 5
```

Keyboard shortcut: `Cmd+Shift+N` → create new note.

### API Layer

New file: `src/core/chorus/api/NotesAPI.ts`

```typescript
// Query keys
export const noteKeys = {
    all: () => ["notes"] as const,
    list: () => [...noteKeys.all(), "list"] as const,
    detail: (noteId: string) => [...noteKeys.all(), "detail", noteId] as const,
    folders: () => [...noteKeys.all(), "folders"] as const,
    tags: () => [...noteKeys.all(), "tags"] as const,
    search: (query: string) => [...noteKeys.all(), "search", query] as const,
};

// Queries
export function useNotes() { ... }         // all notes, sorted by updated_at
export function useNote(noteId: string) { ... }  // single note detail
export function useNoteFolders() { ... }
export function useNoteTags() { ... }
export function useSearchNotes(query: string) { ... }  // FTS5

// Mutations
export function useCreateNote() { ... }
export function useUpdateNote() { ... }    // debounced auto-save
export function useDeleteNote() { ... }
export function useMoveNote() { ... }      // change folder
export function useTogglePin() { ... }
export function useCreateNoteFromChat() { ... }  // "Save as Note"
```

---

## Integration Points

### 1. Note Embeddings

Same pipeline as chat embeddings. On note save (debounced), embed `title + content` and store in `chat_embeddings` with a `note:` prefixed ID (reuse the same vec0 table):

```typescript
await invoke("upsert_chat_embedding", {
    chatId: `note:${noteId}`,  // prefix distinguishes notes from chats
    embedding,
});
```

`find_similar_chats` query updated to handle both prefixes and return `type: "chat" | "note"`.

### 2. "Save as Note" from Chat

One-click to save an AI response as a note:

- Context menu on any message → "Save as Note"
- Creates note with `source_chat_id` set
- Note title = first line of content (or "Note from {chatTitle}")
- Bidirectional: note shows "From: {chatTitle}" link; chat could show "Note created" indicator

### 3. Notes as Project Context

Notes in a project folder are automatically included as context (like project attachments):

- `useProjectContext()` query expanded to include notes from the project
- Notes rendered as markdown in the system prompt (same format as attachment context)
- Project note count shown in project header

### 4. Unified Search

CommandMenu shows both chats and notes:

```
── Actions ──
── Chats ──
    Chat: "How to set up React Router" (keyword match)
── Notes ──                         ← NEW
    Note: "React Router patterns" (keyword match)
── Similar ──                       ← NEW (semantic)
    Chat: "SPA navigation approaches" (semantic match)
    Note: "Frontend routing notes" (semantic match)
```

`useSearchMessages` query extended with a UNION against `notes_fts`.

### 5. "Ask About This Note"

Send note content as context to any model:

- Button in note editor → opens a new chat with note content as a markdown attachment
- Reuses existing draft attachment infrastructure

---

## Implementation Phases

### Phase 1: MVP (Notes CRUD)

- Schema migration (notes, note_folders, tags, note_tags, notes_fts)
- `NotesAPI.ts` with basic CRUD
- Tiptap editor component (lazy-loaded)
- Routes: `/notes`, `/notes/:noteId`, `/notes/new`
- Sidebar "Notes" section (pinned + recent)
- `Cmd+Shift+N` shortcut
- FTS5 search for notes

### Phase 2: Chat Integration

- "Save as Note" context menu on messages
- Bidirectional links (note → chat, chat → note indicator)
- Notes as project context
- Notes in CommandMenu search results

### Phase 3: Semantic Unification

- Note embeddings (same pipeline as chats)
- Unified semantic search (chats + notes)
- Ambient "Related" panels in both chat and note views
- Automatic embedding generation on title creation

### Phase 4: Polish

- Tags UI (tag picker, filter by tag)
- Folder management (drag-and-drop, nesting)
- Import/export (markdown files)
- "Ask About This Note" button

---

## Open Questions

1. **Editor choice:** Tiptap (WYSIWYG) vs CodeMirror (plain markdown)? Tiptap is more approachable for non-developers but adds ~150KB. CodeMirror is faster and more developer-oriented.

2. **Embedding dimension compatibility:** If we later support local models (768-dim), do we need a separate table or can we pad/truncate?

3. **Note sync:** Should notes eventually sync across devices (via the Elixir backend), or stay local-only like chats?

4. **MCP integration:** Should notes be exposed as MCP resources for LLM tool use? This would let models read/write notes during tool-use conversations.

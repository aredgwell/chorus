# Note-Taking Extension (TODO)

## Overview

Extend the app's note-taking support with a rich WYSIWYG editor, tags, smart collections, and chat-note integration. Notes and chats coexist within "collections" (projects), with an "ungrouped" collection for items not assigned to a project.

## What's Already Done

-   **Schema**: `notes` table (migration 149) with id, title, content, project_id, timestamps
-   **FTS5**: `notes_fts` virtual table (migration 153) with auto-sync triggers
-   **API layer**: Full CRUD in `NoteAPI.ts` — create, update, rename, delete, set project, embedding integration
-   **Routing**: `/note/:noteId` in `ContentPane.tsx`
-   **Editor**: `NoteEditor.tsx` — currently a plain `<textarea>` (to be replaced)
-   **Search**: FTS5 keyword and semantic (embedding) search both cover notes
-   **Sidebar**: Notes appear in project collections alongside chats, with drag-and-drop
-   **Tiptap installed**: v3.20.0 with extensions for code blocks (lowlight), images, links, tables, task lists, typography, and `tiptap-markdown` for serialization

## Decisions Made

-   **Editor**: Tiptap (WYSIWYG, Notion-style). Dependencies already in `package.json`.
-   **Rendering strategy**: Tiptap renders everything in the editor (including custom NodeViews for Mermaid, KaTeX, SVG). `MessageMarkdown.tsx` used for read-only contexts (search results, chat-note link previews, embeds).
-   **Organization**: Notes live in collections (projects), not in a separate folder hierarchy. No `note_folders` table needed.
-   **Tags**: Add to both notes and chats. Enables smart collections (saved tag-based queries).

## Schema Changes Needed

-   `tags(id TEXT PK, name TEXT UNIQUE, color TEXT, created_at, updated_at)`
-   `note_tags(note_id TEXT, tag_id TEXT, PK(note_id, tag_id))`
-   `chat_tags(chat_id TEXT, tag_id TEXT, PK(chat_id, tag_id))`
-   `smart_collections(id TEXT PK, name TEXT, query TEXT, icon TEXT, created_at, updated_at)` — saved tag queries
-   `tags_fts` — FTS5 on tag names (optional, useful if tag count grows large)

## Remaining Work

### Phase 1: Rich Editor

1. Replace `<textarea>` in `NoteEditor.tsx` with Tiptap editor
    - Configure StarterKit + installed extensions (tables, task lists, images, links, typography)
    - Wire up `tiptap-markdown` for markdown <-> ProseMirror round-tripping
    - Debounced save on content change (matching current 500ms pattern)
    - Toolbar or slash-command menu for formatting (bold, italic, headings, lists, code, etc.)
2. Custom Tiptap NodeViews:
    - **KaTeX**: Edit LaTeX source in a code input, render math output inline/block
    - **Mermaid**: Edit diagram source in a code input, render diagram below
    - **SVG**: Render raw SVG inline (lower priority)
3. Styling: match the app's existing look (Tailwind, shadcn/ui tokens)

### Phase 2: Tags & Smart Collections

4. Add migrations for `tags`, `note_tags`, `chat_tags`, `smart_collections`
5. Build `TagAPI.ts` — CRUD for tags, attach/detach from notes and chats
6. Tag UI:
    - Tag input component (autocomplete, create-on-the-fly)
    - Tag display chips on notes and chats
    - Tag management in Settings or sidebar
7. Smart collections:
    - UI to create a smart collection from selected tags
    - Sidebar section showing smart collections
    - Query execution: union of notes + chats matching tag filter

### Phase 3: Chat-Note Integration

8. **Auto-summarize chat into note**: After chat completion or on-demand, generate a summary note linked to the chat. Leverage existing summary infrastructure.
9. **Bidirectional chat-note links**:
    - "This note was derived from chat X" / "Chat X produced note Y"
    - Schema: `note_chat_links(note_id, chat_id, link_type, created_at)`
    - UI: link chips in note header and chat header that navigate between them
10. **"Ask about this note"**: Button in note editor that opens a new chat with note content as system context.

### Post-MVP

-   **AI-assisted tagging**: Auto-suggest tags when saving a note or completing a chat
-   **MCP resources**: Expose notes as MCP resources for LLM tool use
-   **Keyboard shortcuts**: `Cmd+N` new note, `Cmd+Shift+N` new note in current collection

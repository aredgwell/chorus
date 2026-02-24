# Note-Taking Extension (TODO)

## Overview
Extend the app to support markdown notes with Mermaid diagrams, tags, and folders. The existing architecture (markdown rendering pipeline, SQLite + migrations, project/folder concepts, Mermaid renderer) makes this highly feasible.

## Schema Design
- `note_folders(id, name, parent_id, sort_order, created_at, updated_at)` -- self-referential for nesting
- `notes(id, title, content, folder_id, is_pinned, created_at, updated_at)` -- markdown content
- `tags(id, name)` + `note_tags(note_id, tag_id)` -- many-to-many tagging
- `notes_fts` -- SQLite FTS5 virtual table on title + content for full-text search

## Editor Decision
Choose one of:
1. **Tiptap** (ProseMirror-based) -- Notion-like WYSIWYG, rich extension ecosystem, ~150KB
2. **CodeMirror 6** -- Plain-text markdown with syntax highlighting, fast, developer-oriented (Obsidian-style)
3. **Milkdown** -- Lighter-weight markdown WYSIWYG, smaller community

## Implementation Steps
1. Add migrations for notes, note_folders, tags, note_tags, notes_fts tables
2. Build DB query layer (`src/core/chorus/db/notes.ts`) and API hooks (`src/core/chorus/api/NotesAPI.ts`)
3. Integrate chosen editor component
4. Add routes: `/notes`, `/notes/:noteId`
5. Add notes section to AppSidebar (folders tree, recent notes)
6. Reuse existing `MessageMarkdown.tsx` pipeline for Mermaid/KaTeX/code rendering in preview
7. Implement tag CRUD + tag filtering UI
8. Add FTS5 search across notes

## Integration Opportunities (Post-MVP)
- **"Ask about this note"**: Send note content as LLM context
- **Auto-summarize chats into notes**: Leverage existing summary infrastructure
- **Bidirectional chat-note links**: "This note was derived from chat X"
- **AI-assisted tagging**: Auto-suggest tags via lightweight model
- **MCP resources**: Expose notes as MCP resources for LLM tool use

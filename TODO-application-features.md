# Application Feature Improvements (TODO)

## Conversation Search
- Add full-text search across all chats using SQLite FTS5
- Create a search UI (could integrate with existing CommandMenu or a dedicated search view)

## Export/Import
- Export chats as markdown, JSON, or shareable formats
- Import conversations from other tools

## Keyboard-First Navigation
- Expand the existing `cmdk` command menu
- Consider vim-style keybindings for power users
- More keyboard shortcuts for common actions (next/prev chat, focus input, etc.)

## Token/Cost Dashboard
- Cost tracking data already exists in the DB
- Build an aggregate view: cost per model, per day/week/month, per project
- Surface in Settings or a dedicated dashboard route

## Local Model Management
- Ollama and LM Studio providers exist but have no model management UI
- Add UI for pulling/removing Ollama models
- Show model download progress, disk usage

## Conversation Branching UX
- `message_sets` already support branching in the data model
- Improve the UI for navigating, comparing, and managing branches
- Consider a tree/graph visualization of conversation branches

# Technical Debt (TODO)

Codebase cleanup items discovered from inline `TODO` comments. Grouped by area.

---

## ~~Legacy Code Removal (TODO-GC)~~

Done — cleaned up stale TODO-GC markers. The GC (Group Chat) system runs in parallel with legacy MultiChat.

- **`useGenerateChatTitle`** — still uses `getUserMessageSets` for the legacy path. Comment updated to explain it will be removed when legacy MultiChat is fully deprecated (GroupChat has `useGenerateGCChatTitle()`).
- **`useAddModelToCompareConfigs`**, **`useUpdateSelectedModelConfigsCompare`**, **`useUpdateSelectedModelConfigQuickChat`**, **`useGetSelectedModelConfigs`** — these use `app_metadata`, not `getUserMessageSets`. Shared between both paths. TODO-GC markers removed.

---

## ~~Model `isEnabled` Flag~~

Done — `isEnabled` was already partially handled: `ManageModelsBox.tsx` disables picker items, `QuickChatModelSelector.tsx` filters them out. Added `isEnabled` filtering to `NewPrompt.tsx` base model picker. Removed TODO comments from `Models.ts`.

---

## ~~Legacy `ToolConfig` Interface~~

Done — removed the unused `ToolConfig` interface from `Models.ts`. No code referenced it.

---

## ~~Custom Toolset Default Permissions~~

Done — `ToolsetsManager` now stores custom toolset configs and reads `defaultPermission` from the database instead of hardcoding `"ask"`.

---

## ~~Deep Link Listener Safety~~

Done — replaced empty dependency array + ESLint suppression with a module-level `deepLinkChecked` flag. The effect now properly lists `handleDeepLink` as a dependency while ensuring single execution.

---

## ~~Scroll Position Persistence~~

Done — module-level `scrollPositionCache` Map in `MultiChat.tsx` saves scroll position when leaving a chat and restores it when returning. New chats (with no saved position) still scroll to bottom.

---

## ~~Reply Count Query Optimization~~

Done — the full message sets fetch is intentional: the same query is reused when rendering the reply thread, so React Query caches it. Replaced TODO with an explanatory comment.

---

## ~~Shared Header Bar Component~~

Done — extracted shared `HeaderBar` component (`src/ui/components/HeaderBar.tsx`) with props for `children`, `actions`, `canGoForward`, and `positioning`. Updated `ProjectView.tsx` and `MultiChat.tsx` to use it, removing duplicated header bar code.

---

## UI Polish

### ~~Tabs Color Token~~
Done — replaced hardcoded `bg-gray-100 dark:bg-gray-900` with `bg-muted text-muted-foreground`.

### ~~LMStudio Logo~~
Done — added `public/lmstudio.svg` (atom-style icon) and replaced generic `BoxIcon` placeholder.

### ~~Markdown Indented Code Blocks~~
Done — the `preBlocks` extraction was already implemented correctly. Removed stale TODO comment.

### ~~`sentAttachmentTypes` Unused Prop~~
Done — removed unused prop from `ChatInput.tsx`, its `useMemo` computation in `MultiChat.tsx`, and call sites in `MultiChat.tsx` and `ReplyChat.tsx`.

---

## ~~Toolset Roadmap Notes~~

Done — removed stale `// # todo: - coder toolset?` comments from `terminal.ts` and `coder.ts`. The coder toolset is fully implemented (commented out in `ToolsetsManager.ts` but ready to enable).

---

## Group Chat Compatibility

**Location**: `ProjectAPI.ts` — `useRegenerateProjectContextSummary` (line ~376)

`// todo-gc: we'll need to update this to work with group chats` — real debt item. The function needs updating when legacy MultiChat is deprecated in favor of GroupChat. No immediate action needed.

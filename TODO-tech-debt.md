# Technical Debt (TODO)

Codebase cleanup items discovered from inline `TODO` comments. Grouped by area.

---

## Legacy Code Removal (TODO-GC)

Several functions in `MessageAPI.ts` are tagged `TODO-GC` — they rely on the old `getUserMessageSets` pattern and should be updated or removed after the "GC migration" (likely a migration to group chats / new message set architecture).

| Function | File | Line | Notes |
|---|---|---|---|
| `useGenerateChatTitle` | `MessageAPI.ts` | 3086 | Relies on `getUserMessageSets`. The title generation logic itself is fine but the message set access pattern needs updating. |
| `useAddModelToCompareConfigs` | `MessageAPI.ts` | 3157 | Manages compare mode model selection. Stores selected config IDs in `app_metadata`. |
| `useUpdateSelectedModelConfigsCompare` | `MessageAPI.ts` | 3216 | Updates compare mode model list. Already has optimistic updates. |
| `useUpdateSelectedModelConfigQuickChat` | `MessageAPI.ts` | 3260 | Updates quick chat model config. |
| `useGetSelectedModelConfigs` | `MessageAPI.ts` | 3290 | Dispatches to quick chat vs compare mode model configs. |
| `useRegenerateProjectContextSummary` | `ProjectAPI.ts` | 381 | Needs update to work with group chats. Also has a sub-TODO about whether to include tool messages in the conversation text (line 405). |

### Action required
Determine the scope of the "GC migration". If it's a refactor of how message sets work, these functions need to be rewritten to use the new pattern. If GC is already done, these can be cleaned up to remove the TODO markers.

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

## Reply Count Query Optimization

**Location**: `MultiChat.tsx:1099`

```typescript
// TODO: we _could_ make this more efficient by just fetching the count
```

The `ReplyBubble` component fetches full message sets just to count replies. A dedicated `SELECT COUNT(*)` query would be more efficient, but the data is reused when rendering replies. Low priority — only matters if reply counts are displayed frequently without expanding.

---

## Shared Header Bar Component

**Location**: `ProjectView.tsx:163`

```typescript
{/* header bar — todo: componentize because it's also used in multichat */}
```

The fixed header bar with drag region, navigation buttons, and title is duplicated between `ProjectView.tsx` and `MultiChat.tsx`. Extract into a shared `HeaderBar` component.

---

## UI Polish

### ~~Tabs Color Token~~
Done — replaced hardcoded `bg-gray-100 dark:bg-gray-900` with `bg-muted text-muted-foreground`.

### LMStudio Logo
**Location**: `provider-logo.tsx:55`
```typescript
// TODO: Add LMStudio logo
```
Currently uses a generic `BoxIcon` placeholder. Need to find or create an LMStudio logo asset.

### ~~Markdown Indented Code Blocks~~
Done — the `preBlocks` extraction was already implemented correctly. Removed stale TODO comment.

### ~~`sentAttachmentTypes` Unused Prop~~
Done — removed unused prop from `ChatInput.tsx`, its `useMemo` computation in `MultiChat.tsx`, and call sites in `MultiChat.tsx` and `ReplyChat.tsx`.

---

## Toolset Roadmap Notes

**Location**: `terminal.ts:49`, `coder.ts:49`

Both files have `// # todo:` comments suggesting potential future toolsets. These are aspirational notes, not bugs. The coder toolset file exists but is commented out in `ToolsetsManager.ts`.

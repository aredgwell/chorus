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

## Custom Toolset Default Permissions

**Location**: `ToolsetsManager.ts:172`

```typescript
// TODO: Fetch from database when custom toolset configs include defaultPermission
return "ask";
```

Custom MCP toolsets always default to "ask" permission. The `CustomToolsetConfig` type already has a `defaultPermission?: ToolPermissionType` field but it's never read. Implementation: read the value from the `custom_toolsets` table and pass it through.

---

## Deep Link Listener Safety

**Location**: `App.tsx:370`

```typescript
// TODO figure out a safe solution for this (we want it to run only on app load)
// eslint-disable-next-line react-hooks/exhaustive-deps
```

The deep link check runs inside a `useEffect` with an empty dependency array, but the `handleDeepLink` callback references state that could be stale. The ESLint suppression is a workaround.

### Options
1. Move `handleDeepLink` to a `useRef` so the effect doesn't need it as a dependency
2. Use a module-level flag (`let deepLinkChecked = false`) to ensure single execution
3. Move the initial deep link check to the Rust side (check and forward on app init)

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

## ~~Shared Header Bar Component~~

Done — extracted shared `HeaderBar` component (`src/ui/components/HeaderBar.tsx`) with props for `children`, `actions`, `canGoForward`, and `positioning`. Updated `ProjectView.tsx` and `MultiChat.tsx` to use it, removing duplicated header bar code.

---

## UI Polish

### Tabs Color Token
**Location**: `tabs.tsx:15`
```typescript
// TODO: Is there an actual color we can use in place of gray alternates here?
```
The `TabsList` uses hardcoded `bg-gray-100 dark:bg-gray-900`. Should use a design token from the theme (e.g., `bg-muted`).

### LMStudio Logo
**Location**: `provider-logo.tsx:55`
```typescript
// TODO: Add LMStudio logo
```
Currently uses a generic `BoxIcon` placeholder. Need to find or create an LMStudio logo asset.

### Markdown Indented Code Blocks
**Location**: `MessageMarkdown.tsx:171`
```typescript
// TODO: there's an exception for code blocks only, but it should
// also do an exception for indented blocks (4 spaces or 1 tab)
```
The `safeEncodeMarkdown` function correctly preserves fenced code blocks (`` ``` ``) but doesn't handle indented code blocks (4 spaces / 1 tab prefix), which remark also renders as `<pre><code>`. HTML inside these blocks gets incorrectly encoded.

### `sentAttachmentTypes` Unused Prop
**Location**: `ChatInput.tsx:85`
```typescript
sentAttachmentTypes: AttachmentType[]; // todo: should we bring this back for something?
```
This prop is passed through but appears unused. Either remove it or document what it was intended for.

---

## Toolset Roadmap Notes

**Location**: `terminal.ts:49`, `coder.ts:49`

Both files have `// # todo:` comments suggesting potential future toolsets. These are aspirational notes, not bugs. The coder toolset file exists but is commented out in `ToolsetsManager.ts`.

# Dependency Upgrades (Breaking Changes)

All safe patch/minor updates were applied in the codebase improvements PR. This file tracks remaining dependencies with **major version bumps** that may require code changes.

## Node Dependencies

### High Priority (actively used, likely safe)

- [ ] **`@hello-pangea/dnd`** 17 -> 18 -- Adds React 19 support. Likely safe but API surface may differ. Used in sidebar drag-and-drop.
- [ ] **`tailwind-merge`** 2 -> 3 -- Used in `cn()` utility. May need config changes for Tailwind v4 compatibility.
- [ ] **`lucide-react`** 0.453 -> 0.575 -- Icon library, minor version but large jump. Check for renamed/removed icons.

### Medium Priority (provider SDKs)

> **Note**: Provider SDKs are now decoupled from model registration. The database-driven model registry means upgrading an SDK no longer requires updating model allowlists — providers read capabilities from the DB.

- [x] **`@anthropic-ai/sdk`** 0.33 -> 0.78 -- Done. Updated in codebase improvements PR. Streaming API compatible.
- [ ] **`@google/generative-ai`** 0.21 -> 0.24 -- **Likely removable**: Not imported by any source file. ProviderGoogle uses the OpenAI SDK against Google's OpenAI-compatible endpoint.
- [ ] **`@mendable/firecrawl-js`** 1 -> 4 -- Major version jump. Used for web scraping in tools. Check API compatibility.
- [ ] **`@octokit/rest`** 21 -> 22 -- GitHub API client. Used in tools.
- [x] **`openai`** 6.10 -> 6.22 -- Done. Updated in codebase improvements PR.

### Lower Priority (utility libraries)

- [ ] **`uuid`** 9 -> 13 -- Multiple major versions behind. May have API changes.
- [ ] **`simple-icons`** 13 -> 16 -- Icon data, likely just new/renamed icons.
- [ ] **`react-window`** 1 -> 2 -- Virtualized list. Used for model lists. API may differ significantly.
- [ ] **`react-syntax-highlighter`** 15 -> 16 -- Code highlighting. Check for breaking changes.

### Compiler & Framework

- [ ] **`typescript`** 5.8 -> 5.9 -- 11% faster type checking, expandable type hovers, `import defer` for lazy module evaluation. Minor breaking changes: stricter generic constraint inference, `moduleResolution: 'node'` deprecation warning, DOM type updates. Run `tsc --noEmit` first, expect ~30min of fixes.
- [ ] **`babel-plugin-react-compiler`** -- React Compiler v1.0. Automatic memoization — eliminates need for manual `useMemo`/`useCallback`. Add as Babel plugin via Vite config. Opt-in per file with `'use memo'` directive, or enable globally. Test with streaming-heavy components first (`MultiChat`, `MessageMarkdown`).

### Dev Dependencies

- [ ] **`@eslint/js`** 9 -> 10 -- ESLint config changes likely needed.
- [ ] **`eslint-plugin-react-refresh`** 0.4 -> 0.5 -- May need config updates.
- [ ] **`vite`** 6 -> 7 -- Just upgraded to v6, defer to a future cycle.
- [ ] **`string-width`** 4 -> 8 -- ESM-only in v5+. May break CommonJS consumers.
- [ ] **`strip-ansi`** 6 -> 7 -- ESM-only in v7. Same concern as string-width.

## Rust Dependencies

### Safe to bump (update version constraint in Cargo.toml)

- [ ] **`tauri`** 2.5.1 -> 2.10.x -- Should be compatible within v2.
- [ ] **`tauri-build`** 2.0.0 -> 2.5.x
- [ ] **`tauri-plugin-store`** 2.1.0 -> 2.4.x -- Fixes version mismatch with npm package.
- [ ] **All other `tauri-plugin-*`** crates -- Bump to match npm plugin versions.
- [ ] **`tauri-plugin-devtools`** 2.0.0 -> 2.0.1 -- Patch only.
- [ ] **`screenshots`** 0.8.5 -> 0.8.10 -- Patch only.

### Breaking (major or 0.x minor bumps)

- [ ] **`thiserror`** 1.x -> 2.x -- Major version. Derive macro syntax changed. Update `CommandError` in `command.rs`.
- [ ] **`base64`** 0.21 -> 0.22 -- API changed from `encode()`/`decode()` to `Engine` trait.
- [ ] **`image`** 0.24 -> 0.25 -- Buffer types and error handling changed.
- [x] **`window-vibrancy`** 0.5 -> 0.6 -- Done. Pinned to 0.6 to match tauri's internal dependency and avoid duplicate ObjC class registrations that cause startup crash.
- [ ] **`rusqlite`** 0.32 -> 0.38 -- Multiple minor versions. Check for API changes.

## Suggested PR Groupings

1. **TypeScript 5.9 + React Compiler** -- Compiler upgrades together. Run `tsc --noEmit`, fix any new errors, add React Compiler Babel plugin, test streaming perf.
2. **Tauri Rust ecosystem** -- All `tauri*` crates together (Cargo.toml version bumps)
3. **Node provider SDKs** -- `@google/generative-ai` (remove), `@mendable/firecrawl-js`, `@octokit/rest`
4. **Node UI libraries** -- `@hello-pangea/dnd`, `tailwind-merge`, `react-window`
5. **Rust utility crates** -- `thiserror`, `base64`, `image`, `rusqlite`
6. **Dev tooling** -- `@eslint/js`, `vite`

# Dependency Upgrades (Breaking Changes)

All safe patch/minor updates were applied in the codebase improvements PR. This file tracks remaining dependencies with **major version bumps** that may require code changes.

## Node Dependencies

### High Priority (actively used, likely safe)

- [ ] **`@hello-pangea/dnd`** 17 -> 18 -- Adds React 19 support. Likely safe but API surface may differ. Used in sidebar drag-and-drop.
- [ ] **`tailwind-merge`** 2 -> 3 -- Used in `cn()` utility. May need config changes for Tailwind v4 compatibility.
- [ ] **`lucide-react`** 0.453 -> 0.575 -- Icon library, minor version but large jump. Check for renamed/removed icons.

### Medium Priority (provider SDKs with breaking API changes)

- [ ] **`@anthropic-ai/sdk`** 0.33 -> 0.78 -- Large jump. Check streaming API changes, type renames. Used in `ProviderAnthropic.ts`.
- [ ] **`@google/generative-ai`** 0.21 -> 0.24 -- Check for API changes. Used in `ProviderGoogle.ts`.
- [ ] **`@mendable/firecrawl-js`** 1 -> 4 -- Major version jump. Used for web scraping in tools. Check API compatibility.
- [ ] **`@octokit/rest`** 21 -> 22 -- GitHub API client. Used in tools.
- [ ] **`openai`** 6.10 -> 6.22 -- Minor within v6, but large jump. Check streaming changes. Used in `ProviderOpenAI.ts`.

### Lower Priority (utility libraries)

- [ ] **`uuid`** 9 -> 13 -- Multiple major versions behind. May have API changes.
- [ ] **`simple-icons`** 13 -> 16 -- Icon data, likely just new/renamed icons.
- [ ] **`react-window`** 1 -> 2 -- Virtualized list. Used for model lists. API may differ significantly.
- [ ] **`react-syntax-highlighter`** 15 -> 16 -- Code highlighting. Check for breaking changes.

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

1. **Tauri Rust ecosystem** -- All `tauri*` crates together (Cargo.toml version bumps)
2. **Node provider SDKs** -- `@anthropic-ai/sdk`, `openai`, `@google/generative-ai`
3. **Node UI libraries** -- `@hello-pangea/dnd`, `tailwind-merge`, `react-window`
4. **Rust utility crates** -- `thiserror`, `base64`, `image`, `rusqlite`
5. **Dev tooling** -- `@eslint/js`, `vite`

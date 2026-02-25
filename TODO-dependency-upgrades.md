# Dependency Upgrades (Breaking Changes)

All safe patch/minor updates were applied in the codebase improvements PR. This file tracks remaining dependencies with **major version bumps** that may require code changes.

## Node Dependencies

### High Priority (actively used, likely safe)

- [x] **`@hello-pangea/dnd`** 17 -> 18 -- Done. Adds React 19 support. API unchanged.
- [x] **`tailwind-merge`** 2 -> 3 -- Done. API unchanged for `twMerge` usage.
- [x] **`lucide-react`** 0.453 -> 0.575 -- Done. All 40+ icons still present.

### Medium Priority (provider SDKs)

> **Note**: Provider SDKs are now decoupled from model registration. The database-driven model registry means upgrading an SDK no longer requires updating model allowlists — providers read capabilities from the DB.

- [x] **`@anthropic-ai/sdk`** 0.33 -> 0.78 -- Done. Updated in codebase improvements PR. Streaming API compatible.
- [x] **`@google/generative-ai`** -- Done. **Removed** — not imported by any source file. ProviderGoogle uses the OpenAI SDK.
- [x] **`@mendable/firecrawl-js`** 1 -> 4 -- Done. `scrapeUrl()` renamed to `scrape()`, returns `Document` directly.
- [x] **`@octokit/rest`** -- Done. **Removed** — not imported by any source file.
- [x] **`openai`** 6.10 -> 6.22 -- Done. Updated in codebase improvements PR.

### Lower Priority (utility libraries)

- [x] **`uuid`** 9 -> 13 -- Done. Ships own types, removed `@types/uuid`.
- [x] **`simple-icons`** 13 -> 16 -- Done. `siCss3` renamed to `siCss`.
- [x] **`react-window`** -- Done. **Removed** — not imported by any source file.
- [x] **`react-syntax-highlighter`** -- Done. **Removed** — replaced by `react-lowlight`.

### Compiler & Framework

- [x] **`typescript`** 5.8 -> 5.9 -- Done. Upgraded, `tsc --noEmit` passes clean.
- [x] **`babel-plugin-react-compiler`** -- Done. Enabled globally in `vite.config.ts`. Automatic memoization active.

### Dev Dependencies

- [x] **`@eslint/js`** 9 -> 10 -- Done. Flat config compatible.
- [x] **`eslint-plugin-react-refresh`** 0.4 -> 0.5 -- Done.
- [x] **`vite`** 6 -> 7 -- Done. All plugins already support vite 7. No config changes needed; `vite.config.ts` uses only stable APIs. Updated engines to `>=22.12.0` per vite 7 requirement.
- [x] **`string-width`** 4 -> 8 -- Done. **Removed** — not imported by any source file. Was a phantom devDependency for hoisting; transitive CJS consumers resolve their own pinned copies via pnpm.
- [x] **`strip-ansi`** 6 -> 7 -- Done. **Removed** — same reason as string-width.

## Rust Dependencies

### Safe to bump (update version constraint in Cargo.toml)

- [x] **`tauri`** 2.5.1 -> 2.10.x -- Done. Already at ^2.10.
- [x] **`tauri-plugin-store`** 2.1.0 -> 2.4.x -- Done. Already at 2.4.
- [x] **All other `tauri-plugin-*`** crates -- Done via `cargo update`.

### Breaking (major or 0.x minor bumps)

- [x] **`thiserror`** 1.x -> 2.x -- Done. Derive syntax compatible, no code changes needed.
- [x] **`base64`** 0.21 -> 0.22 -- Done. Code already used Engine-based API; no code changes needed.
- [x] **`image`** 0.24 -> 0.25 -- Done. Updated `image::io::Reader` import to `image::ImageReader`.
- [x] **`window-vibrancy`** 0.5 -> 0.6 -- Done. Pinned to 0.6 to match tauri's internal dependency.
- [ ] **`rusqlite`** 0.32 -> latest -- Blocked: `libsqlite3-sys` link conflict with `tauri-plugin-sql`. `sqlx-sqlite` 0.8.6 (via `tauri-plugin-sql` 2.3.2) pins `libsqlite3-sys ^0.30.1`, while `rusqlite` 0.38 needs `^0.36.0`. `sqlx` 0.9 is still alpha. Upgrade when `tauri-plugin-sql` adopts `sqlx` 0.9 stable.

## Remaining Work

- [ ] `rusqlite` 0.32 -> latest (Rust, blocked by tauri-plugin-sql / sqlx 0.9 alpha)

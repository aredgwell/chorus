# Chorus Development Agent Guide

## Project Structure

- **UI:** React components in `src/ui/components/`
- **Core:** Business logic in `src/core/chorus/`
- **Tauri:** Rust backend in `src-tauri/src/`

See component-specific guides:

- [`src/AGENTS.md`](src/AGENTS.md) — TypeScript/React frontend (lint, format, test)
- [`src-tauri/AGENTS.md`](src-tauri/AGENTS.md) — Rust/Tauri backend (lint, format, test)

## Development Workflow

After every change, run the relevant checks for the component you modified:

1. **Frontend changes (`src/`):** `pnpm validate` (runs tsc, lint, format, tests)
2. **Backend changes (`src-tauri/`):** `cd src-tauri && cargo fmt --check && cargo clippy -- -D warnings && cargo test`
3. **Quick fix:** `pnpm validate:fix` auto-fixes lint and format issues

## Commands

- **Dev:** `pnpm vite:dev` (Vite), `pnpm tauri:dev` (Tauri dev)
- **Build:** `pnpm build` (TypeScript check + Vite production build)
- **Validate:** `pnpm validate` (tsc + lint + format + test), `pnpm validate:fix` (auto-fix)
- **Coverage:** `pnpm test -- --run --coverage`
- **QA/Prod:** `pnpm tauri:qa`, `pnpm tauri:prod`

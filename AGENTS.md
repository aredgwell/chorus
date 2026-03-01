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

1. **Frontend changes (`src/`):** `pnpm tsc --noEmit && pnpm lint && pnpm test`
2. **Backend changes (`src-tauri/`):** `cd src-tauri && cargo fmt --check && cargo clippy && cargo test`
3. **Both:** `pnpm validate` runs lint + format checks for the frontend

## Commands

- **Dev:** `pnpm vite:dev` (Vite), `pnpm tauri:dev` (Tauri dev)
- **Build:** `pnpm build` (TypeScript check + Vite production build)
- **Validate:** `pnpm validate` (lint + format check), `pnpm validate:fix` (auto-fix)
- **QA/Prod:** `pnpm tauri:qa`, `pnpm tauri:prod`

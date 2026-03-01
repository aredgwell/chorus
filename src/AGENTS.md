# Frontend Agent Guide (src/)

## Verification Checklist

After every change, run these commands in order. All must pass before committing.

```bash
pnpm tsc --noEmit          # 1. Type check (strict mode, no emit)
pnpm lint                  # 2. ESLint (or `pnpm lint:fix` to auto-fix)
pnpm format:check          # 3. Prettier (or `pnpm format` to auto-fix)
pnpm test -- --run         # 4. Vitest unit tests
```

Shortcut: `pnpm validate` runs all four steps. Use `pnpm validate:fix` to auto-fix lint and format.

Coverage: `pnpm test -- --run --coverage` generates an HTML report in `coverage/`.

## Code Style

-   **TypeScript:** Strict typing, ES2020 target. Avoid `as` type assertions.
-   **Paths:** Use `@ui/*`, `@core/*`, `@/*` aliases — never relative imports across boundaries.
-   **Naming:** PascalCase components, camelCase hooks with `use` prefix, `I`-prefixed interfaces.
-   **Formatting:** 4-space indentation, Prettier (config in `.prettierrc`).
-   **Imports:** Auto-sorted by `eslint-plugin-simple-import-sort`. Run `pnpm lint:fix` to reorder.
-   **Promises:** All promises must be handled (`@typescript-eslint/no-floating-promises` is an error).
-   **Unused vars:** Prefix with `_` to suppress (`@typescript-eslint/no-unused-vars`).
-   **Nulls:** Prefer `undefined` over `null`. Convert DB nulls: `row.field ?? undefined`.

## ESLint

Config: `eslint.config.mjs`

Key enforced rules:

-   `react-hooks/rules-of-hooks` (error)
-   `react-hooks/exhaustive-deps` (error)
-   `@typescript-eslint/no-floating-promises` (error)
-   `@typescript-eslint/no-unused-vars` (error, `_` prefix ignored)
-   `@typescript-eslint/no-misused-promises` (warn)
-   `simple-import-sort/imports` (warn, auto-fixable)
-   `@tanstack/query/exhaustive-deps` (error) — query keys must include all dependencies
-   `@tanstack/query/no-void-query-fn` (error) — queryFn must return a value

## Testing

Framework: Vitest (`vitest.config.ts`)

```bash
pnpm test                  # Run all tests (watch mode)
pnpm test -- --run         # Run once (no watch)
pnpm test -- --run --coverage  # Run with coverage report
```

Test files live next to source: `src/core/chorus/*.test.ts`

Pattern: `*.test.ts` / `*.test.tsx`

## Lint-Staged (Pre-commit)

Config: `.lintstagedrc.json`

Husky pre-commit hooks automatically run:

-   `*.{js,jsx,ts,tsx}` — ESLint fix + Prettier
-   `*.{json,md,html,css}` — Prettier
-   `src-tauri/src/migrations.rs` — regenerate `SQL_SCHEMA.md`

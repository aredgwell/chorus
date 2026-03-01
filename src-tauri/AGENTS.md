# Backend Agent Guide (src-tauri/)

## Verification Checklist

After every change, run these commands from the `src-tauri/` directory. All must pass before committing.

```bash
cargo fmt --check          # 1. Format check (default rustfmt settings)
cargo clippy               # 2. Lint (all default clippy warnings)
cargo test                 # 3. Run tests
cargo build                # 4. Verify compilation
```

To auto-fix formatting: `cargo fmt`

## Code Style

- **Edition:** Rust 2021
- **Formatting:** Default `rustfmt` settings (no `rustfmt.toml` — uses Rust defaults)
- **Linting:** Default `cargo clippy` rules, plus `unexpected_cfgs` warn for `cargo-clippy` feature
- **No foreign keys** in SQLite schema (project convention)

## Migrations

Migration files live in `src-tauri/src/migrations.rs`.

Rules:
- New migrations must use the **next sequential version number**
- **Never modify a previous migration** — only append new ones
- After adding a migration, run `pnpm generate-schema` from the project root to update `SQL_SCHEMA.md`
- Lint-staged automatically runs schema generation when `migrations.rs` is staged

## Testing

Uses built-in Rust test framework. Tests are in-module using `#[cfg(test)]`.

```bash
cargo test                 # Run all tests
cargo test -- --nocapture  # Run with stdout visible
```

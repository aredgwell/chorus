#!/bin/bash

# Full validation: type check, lint, format, and test.
# Usage: ./validate.sh [--fix]

set -e

FIX_FLAG=""
if [[ "$1" == "--fix" ]]; then
    FIX_FLAG="--fix"
    echo "Running validation with auto-fix enabled..."
else
    echo "Running validation checks..."
fi

# 1. TypeScript type check
echo ""
echo "=== TypeScript check ==="
pnpm tsc --noEmit

# 2. Lint
if [[ -n "$FIX_FLAG" ]]; then
    echo ""
    echo "=== ESLint (auto-fix) ==="
    pnpm run lint:fix
else
    echo ""
    echo "=== ESLint ==="
    pnpm run lint
fi

# 3. Format
if [[ -n "$FIX_FLAG" ]]; then
    echo ""
    echo "=== Prettier (auto-fix) ==="
    pnpm run format
else
    echo ""
    echo "=== Prettier ==="
    pnpm run format:check
fi

# 4. Tests
echo ""
echo "=== Tests ==="
pnpm test -- --run

echo ""
echo "Validation complete!"

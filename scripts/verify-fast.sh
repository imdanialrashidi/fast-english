#!/usr/bin/env bash
# scripts/verify-fast.sh
# Everyday development gate: typecheck + Biome + Vitest.
# Does NOT run PocketBase, Android, deployment, restore drills or
# the Playwright suite. Fails on the first real failure.
set -Eeuo pipefail

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

run() {
  printf '\n=== %s ===\n' "$*"
  "$@"
}

# 1. Strict typecheck across both surfaces and Vite configs.
run npx tsc --noEmit

# 2. Biome lint/format check (no auto-fix).
run npx biome check .

# 3. Unit / contract tests (Vitest).
run npx vitest run --passWithNoTests

printf '\nAll fast verification checks passed.\n'

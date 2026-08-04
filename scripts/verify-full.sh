#!/usr/bin/env bash
# scripts/verify-full.sh
# Complete release-level gate (delegates to scripts/verify.sh):
#   1. scripts/project-verify.sh — typecheck, Biome, Vitest, all real
#      Backend Smoke suites, deterministic builds, topology, PWA output,
#      Android version/signing checks, deploy token-redaction proofs.
#   2. Full Playwright suite (all browser tests, incl. @critical).
set -Eeuo pipefail

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

run() {
  printf '\n=== %s ===\n' "$*"
  "$@"
}

# 1. Backend + operations gate (covers verify:fast + smokes + builds + PWA + Android + deploy).
run bash scripts/project-verify.sh

# 2. Full Playwright suite (critical + visual + responsive coverage).
run npx playwright test

printf '\nAll full verification checks passed.\n'

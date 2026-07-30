#!/usr/bin/env bash
# Fast English Podcast — project-specific verification gate.
# Called by scripts/verify.sh. Run from the repository root.
#
# Does not install or modify dependencies. Does not auto-format.
# Fails on the first real failure. Preserves readable command output.
#
# Steps:
#   1. Strict typecheck
#   2. Biome lint/format check (no auto-fix)
#   3. Unit / contract tests (Vitest)
#   4. Auth smoke (real PB; P0-S3 contract)
#   5. Payment smoke (real PB; P1-S1 23/23 contract)
#   6. Payment-preview smoke (real PB; P1-S1D 12/12 contract)
#   7. Placement smoke (Phase 2)
#   8. Placement-levels smoke (Phase 2)
#   9. Operator smoke (Phase 2)
#  10. Multi-tab race smoke (Phase 2 closure; atomic answer save proof)
#  11. Snapshot capacity smoke (Phase 2 closure; max-content proof)
#  12. Build both surfaces deterministically
#  13. Topology output verification
#
# Playwright E2E is run separately via `pnpm test:e2e` so that
# review-time runs of `scripts/verify.sh` stay fast and offline.
# The E2E suite is documented in the final P1-S1D report.
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

# 3. Test command (passWithNoTests is acceptable for topology-only slices).
run npx vitest run --passWithNoTests

# 4. Auth smoke against disposable PB.
run bash scripts/smoke-auth.sh node scripts/smoke-auth.mjs

# 5. Payment smoke against disposable PB (23/23).
run bash scripts/smoke-payment.sh node scripts/smoke-payment.mjs

# 6. Payment-preview smoke against disposable PB (12/12).
run bash scripts/smoke-payment.sh node scripts/smoke-payment-preview.mjs

# 7. Placement smoke (Phase 2; 40+ assertions).
run bash scripts/smoke-placement.sh node scripts/smoke-placement.mjs

# 8. Placement-levels smoke (Phase 2; level selection + dashboard).
run bash scripts/smoke-placement.sh node scripts/smoke-placement-levels.mjs

# 9. Operator smoke (Phase 2; operator approval + management).
run bash scripts/smoke-payment.sh node scripts/smoke-operator.mjs

# 10. Multi-tab race smoke (Phase 2 closure; atomic answer save proof).
run bash scripts/smoke-placement.sh node scripts/smoke-placement-race.mjs

# 11. Snapshot capacity smoke (Phase 2 closure; max-content proof).
run bash scripts/smoke-placement.sh node scripts/smoke-placement-capacity.mjs

# 12. Build both surfaces deterministically.
run npx vite build --config vite.app.config.ts
run npx vite build --config vite.landing.config.ts

# 13. Topology output verification.
printf '\n=== topology verification ===\n'

test -f dist-landing/index.html || { echo 'missing dist-landing/index.html' >&2; exit 1; }
test -f dist-app/index.html || { echo 'missing dist-app/index.html' >&2; exit 1; }

# Outputs must be distinct files.
if [[ dist-landing/index.html -ef dist-app/index.html ]]; then
  echo 'dist-landing/index.html and dist-app/index.html must be distinct files' >&2
  exit 1
fi

# Required markers.
grep -q 'app-surface' dist-app/index.html || {
  echo 'app-surface marker missing in dist-app/index.html' >&2
  exit 1
}
grep -q 'landing-surface' dist-landing/index.html || {
  echo 'landing-surface marker missing in dist-landing/index.html' >&2
  exit 1
}

# No cross-leakage of the other surface's marker into a built output.
if grep -rq 'landing-surface' dist-app/; then
  echo 'landing-surface marker leaked into dist-app bundle' >&2
  exit 1
fi
if grep -rq 'app-surface' dist-landing/; then
  echo 'app-surface marker leaked into dist-landing bundle' >&2
  exit 1
fi

printf '\nAll project verification checks passed.\n'

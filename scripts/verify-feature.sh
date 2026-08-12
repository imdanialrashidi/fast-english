#!/usr/bin/env bash
# scripts/verify-feature.sh [smoke-group] [surface]
# Completing-a-feature-slice gate:
#   1. verify:fast (typecheck + Biome + Vitest)
#   2. affected real Backend Smoke suites (pnpm smoke:* scripts)
#   3. critical Playwright project (the @critical canonical journeys)
#   4. affected build
#
# Examples:
#   pnpm verify:feature            # all smokes + critical E2E + app build
#   pnpm verify:feature payment    # payment-family smokes + critical E2E + app build
#   pnpm verify:feature placement landing
set -Eeuo pipefail

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

SMOKE_GROUP="${1:-all}"
SURFACE="${2:-app}"

run() {
  printf '\n=== %s ===\n' "$*"
  "$@"
}

test -x server/pocketbase || {
  echo 'server/pocketbase missing — run scripts/setup-pocketbase.sh first' >&2
  exit 1
}

# 1. verify:fast
run bash scripts/verify-fast.sh

# 2. Real Backend Smoke suites. Groups map to the documented pnpm
#    smoke:* scripts so the mapping lives in one place (package.json).
case "$SMOKE_GROUP" in
  auth)      SMOKES="smoke:auth" ;;
  payment)   SMOKES="smoke:payment smoke:payment-preview smoke:operator" ;;
  placement) SMOKES="smoke:placement smoke:placement-levels smoke:placement-race smoke:placement-capacity" ;;
  lessons)   SMOKES="smoke:lessons smoke:episode" ;;
  progress)  SMOKES="smoke:progress" ;;
  all)       SMOKES="smoke:auth smoke:payment smoke:payment-preview smoke:placement smoke:placement-levels smoke:operator smoke:placement-race smoke:placement-capacity smoke:lessons smoke:episode smoke:progress smoke:staff smoke:podcast-domain smoke:content-import smoke:content-admin smoke:library" ;;
  *) echo "unknown smoke group '$SMOKE_GROUP' (auth|payment|placement|lessons|progress|all)" >&2; exit 1 ;;
esac

for script in $SMOKES; do
  run pnpm run "$script"
done

# 3. Critical Playwright project (canonical journeys only).
run npx playwright test --grep '@critical'

# 4. Affected build.
case "$SURFACE" in
  app)     run npx vite build --config vite.app.config.ts ;;
  landing) run npx vite build --config vite.landing.config.ts
           run node scripts/prerender-landing.mjs ;;
  all)     run npx vite build --config vite.app.config.ts
           run npx vite build --config vite.landing.config.ts
           run node scripts/prerender-landing.mjs ;;
  *) echo "unknown surface '$SURFACE' (app|landing|all)" >&2; exit 1 ;;
esac

printf '\nAll feature verification checks passed.\n'

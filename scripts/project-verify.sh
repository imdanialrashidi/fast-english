#!/usr/bin/env bash
# Project verification gate: Pint + Pest (PostgreSQL) + typecheck + build + affected Playwright spec.
# Canonical entry point; scripts/verify.sh delegates here when executable.
set -Eeuo pipefail

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

BASE_URL="${BASE_URL:-http://127.0.0.1:8111}"

# Fail fast when PostgreSQL is unreachable.
if command -v php >/dev/null 2>&1 && php artisan db:show --count >/dev/null 2>&1; then
  :
elif command -v pg_isready >/dev/null 2>&1 && pg_isready -q; then
  :
else
  echo "BLOCKED: PostgreSQL unreachable" >&2
  exit 3
fi

vendor/bin/pint --test
php artisan test
npm run typecheck
npm run build

# Browser lane only when the app server answers on BASE_URL.
if curl -fsS -o /dev/null --max-time 5 "$BASE_URL" >/dev/null 2>&1; then
  npx playwright test m0-inertia --project=chromium
else
  echo "SKIP: browser lane (no server on :8111)"
fi

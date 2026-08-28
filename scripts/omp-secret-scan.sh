#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

TMP_ROOT="$ROOT_DIR/.artifacts/omp-secret-scan"
mkdir -p "$TMP_ROOT"
RAW="$(mktemp "$TMP_ROOT/raw.XXXXXX")"
FILTERED="$(mktemp "$TMP_ROOT/filtered.XXXXXX")"

cleanup() {
  rm -f "$RAW" "$FILTERED"
  rmdir "$TMP_ROOT" 2>/dev/null || true
}
trap cleanup EXIT

# Keep this pattern intentionally narrow and reviewable. It is a guardrail,
# not a substitute for provider-side secret scanning or repository review.
PATTERN='sk-[A-Za-z0-9_-]{16,}|(API_KEY|ACCESS_TOKEN|SECRET|PASSWORD)[[:space:]]*=[[:space:]]*[^"<${][^[:space:]]+'

# grep returns 1 when there are no matches; do not treat that as scanner failure.
find . -maxdepth 6 -type f \
  ! -path './.git/*' \
  ! -path './.artifacts/*' \
  ! -path './node_modules/*' \
  ! -path './.omp/npm/*' \
  ! -path './.pi/npm/*' \
  -print0 \
  | xargs -0 -r grep -IEn "$PATTERN" >"$RAW" 2>/dev/null || true

if [[ -f scripts/secret-scan-filter.mjs ]]; then
  node scripts/secret-scan-filter.mjs <"$RAW" >"$FILTERED"
else
  cp "$RAW" "$FILTERED"
fi

if [[ -s "$FILTERED" ]]; then
  cat "$FILTERED" >&2
  printf '%s\n' 'FAIL possible committed secret pattern found' >&2
  exit 1
fi

printf '%s\n' 'PASS no unapproved committed secret pattern found'

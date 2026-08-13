#!/usr/bin/env bash
# scripts/measure-app-perf.sh
# Fast English Podcast — reproducible LAB performance measurement harness.
#
# Measures the built Student App on representative production-like journeys
# (entry, login, Home, Library, Episode, Account) using Playwright-driven
# PerformanceObserver instrumentation against a disposable PocketBase with
# real imported content and a fully-entitled fixture student.
#
# IMPORTANT — evidence classification: this harness produces LAB evidence
# (local machine, local PocketBase, Chromium network/CPU throttling). It is
# NOT real-user field data. Field Web Vitals require RUM instrumentation in
# production (see docs/OBSERVABILITY.md).
#
# Usage:
#   bash scripts/measure-app-perf.sh [outfile]
#
# Outfile defaults to .artifacts/perf/<timestamp>.json; a machine-readable
# JSON report is written there and a human summary is printed to stdout.
#
# Environment:
#   FEP_PERF_PB_PORT   disposable PocketBase port (default 18121)
#   FEP_PERF_APP_PORT  vite preview port (default 18122)
#   FEP_PERF_TAG       report tag, e.g. "baseline" or "after" (default: timestamp)
set -Eeuo pipefail

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

PB_PORT="${FEP_PERF_PB_PORT:-18121}"
APP_PORT="${FEP_PERF_APP_PORT:-18122}"
TAG="${FEP_PERF_TAG:-$(date +%Y%m%d-%H%M%S)}"
OUT="${1:-.artifacts/perf/${TAG}.json}"

test -x server/pocketbase || {
  echo "server/pocketbase missing — run pnpm setup:pocketbase first" >&2
  exit 1
}

log() { printf '\n=== %s ===\n' "$*"; }

cleanup() {
  [[ -n "${APP_PID:-}" ]] && kill "$APP_PID" 2>/dev/null || true
  [[ -n "${PB_PID:-}" ]] && kill "$PB_PID" 2>/dev/null || true
  [[ -n "${DATA_DIR:-}" ]] && rm -rf "$DATA_DIR" || true
}
trap cleanup EXIT

log "Building the Student App (production)"
npx vite build --config vite.app.config.ts

log "Starting disposable PocketBase on 127.0.0.1:${PB_PORT}"
DATA_DIR="$(mktemp -d /tmp/fep-perf-pb-XXXXXX)"
SU_EMAIL="perf@fep-smoke.invalid"
SU_PASSWORD="perf-$(date +%s)-$$-${RANDOM}"
server/pocketbase superuser upsert "${SU_EMAIL}" "${SU_PASSWORD}" --dir="$DATA_DIR" >/dev/null 2>&1
PB_CORS_ORIGINS="http://127.0.0.1:${APP_PORT},http://localhost:${APP_PORT},http://localhost,https://localhost"
PB_TELEMETRY=0 PB_FEEDBACK=0 \
PB_ENCRYPTION="perf-dev-encryption-key-not-for-prod" \
server/pocketbase serve \
  --http "127.0.0.1:${PB_PORT}" \
  --dir "$DATA_DIR" \
  --migrationsDir server/pb_migrations \
  --hooksDir server/pb_hooks \
  --origins "$PB_CORS_ORIGINS" \
  --encryptionEnv "perf-dev-encryption-key-not-for-prod" \
  >/tmp/fep-perf-pb.log 2>&1 &
PB_PID=$!

log "Waiting for PocketBase health"
for _ in $(seq 1 60); do
  if curl -fsS "http://127.0.0.1:${PB_PORT}/api/health" >/dev/null 2>&1; then
    break
  fi
  sleep 0.5
done
curl -fsS "http://127.0.0.1:${PB_PORT}/api/health" >/dev/null || {
  echo "PocketBase did not become healthy; see /tmp/fep-perf-pb.log" >&2
  exit 1
}

log "Seeding content + fixtures (example episode, placement, entitled student)"
SEED_STATE=".artifacts/perf/seed-${TAG}.json"
mkdir -p "$(dirname "$OUT")"
PB_URL="http://127.0.0.1:${PB_PORT}" \
SU_EMAIL="$SU_EMAIL" \
SU_PASSWORD="$SU_PASSWORD" \
node scripts/measure-app-perf-seed.mjs --state "$SEED_STATE"

log "Starting vite preview on 127.0.0.1:${APP_PORT}"
VITE_API_TARGET="http://127.0.0.1:${PB_PORT}" \
  npx vite preview --config vite.app.config.ts --port "$APP_PORT" --strictPort --host 127.0.0.1 \
  >/tmp/fep-perf-preview.log 2>&1 &
APP_PID=$!
for _ in $(seq 1 60); do
  if curl -fsS "http://127.0.0.1:${APP_PORT}/" >/dev/null 2>&1; then
    break
  fi
  sleep 0.5
done
curl -fsS "http://127.0.0.1:${APP_PORT}/" >/dev/null || {
  echo "Preview did not start; see /tmp/fep-perf-preview.log" >&2
  exit 1
}

log "Running lab measurements (tag=${TAG})"
mkdir -p "$(dirname "$OUT")"
node scripts/measure-app-perf.mjs \
  --app "http://127.0.0.1:${APP_PORT}" \
  --pb "http://127.0.0.1:${PB_PORT}" \
  --state "$SEED_STATE" \
  --out "$OUT" \
  --tag "$TAG"

echo ""
echo "Report written to ${OUT}"

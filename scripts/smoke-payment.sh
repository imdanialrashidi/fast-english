#!/usr/bin/env bash
# scripts/smoke-payment.sh
# Start PocketBase with disposable data, wait for ready, then exec the
# given smoke command. Cleans up the data dir and the PB process on exit.
set -Eeuo pipefail

REPO_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

if [[ ! -x server/pocketbase ]]; then
  echo "PocketBase binary not found. Run: pnpm setup:pocketbase" >&2
  exit 1
fi

DATA_DIR="$(mktemp -d -t pb-smoke-pay-XXXXXX)"
PORT="${PB_SMOKE_PAY_PORT:-18091}"
HTTP="http://127.0.0.1:${PORT}"

PID=""

cleanup() {
  local code=$?
  if [[ -n "$PID" ]] && kill -0 "$PID" 2>/dev/null; then
    kill "$PID" 2>/dev/null || true
    wait "$PID" 2>/dev/null || true
  fi
  if [[ -f "$DATA_DIR/pb.log" ]]; then
    cp "$DATA_DIR/pb.log" "/tmp/pb-smoke-pay-last.log" || true
  fi
  rm -rf "$DATA_DIR"
  exit "$code"
}
trap cleanup EXIT INT TERM

echo "smoke-payment: starting PocketBase (data: $DATA_DIR, port: $PORT) ..."

CORS_ORIGINS="${PB_CORS_ORIGINS:-http://localhost:5173,http://127.0.0.1:5173,http://localhost,https://localhost}"

PB_TELEMETRY=0 \
PB_FEEDBACK=0 \
server/pocketbase serve \
  --http "127.0.0.1:${PORT}" \
  --dir "$DATA_DIR" \
  --migrationsDir server/pb_migrations \
  --hooksDir server/pb_hooks \
  --origins "$CORS_ORIGINS" \
  --encryptionEnv "${PB_ENCRYPTION:-dev-encryption-key-not-for-prod}" \
  > "$DATA_DIR/pb.log" 2>&1 &
PID=$!

# Poll for /api/health.
for _ in $(seq 1 80); do
  if curl --silent --fail "$HTTP/api/health" >/dev/null 2>&1; then
    echo "smoke-payment: PocketBase ready at $HTTP"
    export PB_SMOKE_URL="$HTTP"
    export PB_SMOKE_PID="$PID"
    export PB_DATA_DIR="$DATA_DIR"
    if [[ $# -gt 0 ]]; then
      "$@"
    fi
    exit 0
  fi
  sleep 0.2
done

echo "smoke-payment: PocketBase did not become ready" >&2
tail -n 40 "$DATA_DIR/pb.log" >&2 || true
exit 1

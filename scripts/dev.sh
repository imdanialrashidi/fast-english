#!/usr/bin/env bash
# scripts/dev.sh
# Start PocketBase with disposable data for local development.
# Never touches server/pb_data. Stops on Ctrl-C and cleans up.
set -Eeuo pipefail

REPO_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

if [[ ! -x server/pocketbase ]]; then
  echo "PocketBase binary not found. Run: pnpm setup:pocketbase" >&2
  exit 1
fi

DATA_DIR="$(mktemp -d -t pb-dev-XXXXXX)"
PORT="${PB_PORT:-8090}"
HTTP="http://127.0.0.1:${PORT}"
CORS_ORIGINS="${PB_CORS_ORIGINS:-http://localhost:5173,http://127.0.0.1:5173,http://localhost}"

PID=""

cleanup() {
  if [[ -n "$PID" ]] && kill -0 "$PID" 2>/dev/null; then
    kill "$PID" 2>/dev/null || true
    wait "$PID" 2>/dev/null || true
  fi
  rm -rf "$DATA_DIR"
}
trap cleanup EXIT INT TERM

echo "Starting PocketBase (data: $DATA_DIR, port: $PORT) ..."

# Disable telemetry/usage to avoid network calls during local dev.
PB_TELEMETRY=0 \
PB_FEEDBACK=0 \
server/pocketbase serve \
  --http "127.0.0.1:${PORT}" \
  --dir "$DATA_DIR" \
  --migrationsDir server/pb_migrations \
  --hooksDir server/pb_hooks \
  --origins "$CORS_ORIGINS" \
  --publicDir server/pb_public \
  --encryptionEnv "${PB_ENCRYPTION:-dev-encryption-key-not-for-prod}" \
  > "$DATA_DIR/pb.log" 2>&1 &
PID=$!

# Poll for /api/health.
for _ in $(seq 1 50); do
  if curl --silent --fail "$HTTP/api/health" >/dev/null 2>&1; then
    echo "PocketBase ready at $HTTP"
    wait "$PID"
    exit $?
  fi
  sleep 0.2
done

echo "PocketBase did not become ready in time. Last log lines:" >&2
tail -n 30 "$DATA_DIR/pb.log" >&2 || true
exit 1

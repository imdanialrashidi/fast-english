#!/usr/bin/env bash
# scripts/dev.sh
# Start PocketBase with persistent data for local development.
# The default data directory is server/pb_data and survives app/PocketBase
# restarts. Disposable data is opt-in with PB_DEV_EPHEMERAL=1 (smoke suites
# use their own wrappers and are always disposable).
set -Eeuo pipefail

REPO_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

if [[ ! -x server/pocketbase ]]; then
  echo "PocketBase binary not found. Run: pnpm setup:pocketbase" >&2
  exit 1
fi

PORT="${PB_PORT:-8090}"
HTTP="http://127.0.0.1:${PORT}"

# Local development must not silently discard Student accounts when the
# PocketBase process restarts. Use an explicit disposable mode only when a
# clean fixture database is intended (the smoke wrappers already do this).
EPHEMERAL=0
if [[ "${PB_DEV_EPHEMERAL:-0}" == "1" || "${PB_DEV_EPHEMERAL:-}" == "true" ]]; then
  DATA_DIR="$(mktemp -d -t pb-dev-XXXXXX)"
  EPHEMERAL=1
else
  DATA_DIR="${PB_DATA_DIR:-$REPO_ROOT/server/pb_data}"
  mkdir -p "$DATA_DIR"
fi

# Create/update a development-only superuser so PB does not open the browser
# installer. This never changes the application Student records.
source "$REPO_ROOT/scripts/pb-test-helper.sh"
pb_create_superuser "$DATA_DIR"

# Settings encryption is opt-in like production (--encryptionEnv names an env
# var holding the key). Without PB_DEV_ENCRYPTION_KEY the dev settings are
# stored unencrypted in the persistent data dir — documented, never silent.
ENCRYPTION_ARGS=()
if [[ -n "${PB_DEV_ENCRYPTION_KEY:-}" ]]; then
  ENCRYPTION_ARGS=(--encryptionEnv=PB_DEV_ENCRYPTION_KEY)
fi
# Dev-only CORS allowlist. Includes:
#   - Vite dev server on localhost / 127.0.0.1
#   - Capacitor's default https://localhost (debug APK bundled assets)
#   - http://localhost (adb reverse + plain http WebView fallback)
# These are dev-only origins. Production uses Caddy reverse-proxy and
# a strict origin allowlist per docs/ARCHITECTURE.md.
CORS_ORIGINS="${PB_CORS_ORIGINS:-http://localhost:5173,http://127.0.0.1:5173,http://localhost,https://localhost}"

PID=""

cleanup() {
  if [[ -n "$PID" ]] && kill -0 "$PID" 2>/dev/null; then
    kill "$PID" 2>/dev/null || true
    wait "$PID" 2>/dev/null || true
  fi
  if [[ "$EPHEMERAL" -eq 1 ]]; then
    rm -rf "$DATA_DIR"
  fi
}
trap cleanup EXIT INT TERM

if [[ "$EPHEMERAL" -eq 1 ]]; then
  echo "Starting PocketBase (DISPOSABLE data: $DATA_DIR, port: $PORT) ..."
else
  echo "Starting PocketBase (PERSISTENT data: $DATA_DIR, port: $PORT) ..."
fi

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
  "${ENCRYPTION_ARGS[@]}" \
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

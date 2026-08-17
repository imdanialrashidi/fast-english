#!/usr/bin/env bash
# scripts/restore-proof.sh
# Record-level backup/restore proof (hard release gate C) in a fully
# disposable environment. NEVER touches server/pb_data or any live
# database:
#
#   1. starts a disposable PocketBase (migrations + hooks, temp data dir)
#   2. node scripts/restore-proof.mjs create
#        - real Student signup -> payment request with receipt upload ->
#          staff approval -> subscription; content/progress/placement/
#          settings fixtures; backup ZIP via the PocketBase Backups API
#   3. stops the instance, WIPES the data dir (simulating loss)
#   4. unzips the backup into a CLEAN new data dir (the production
#      restore path — same as deploy/restore-drill.sh)
#   5. restarts PocketBase with the same migrations + hooks
#   6. node scripts/restore-proof.mjs verify
#        - same record IDs and important fields, the same Student
#          authenticates, receipt file bytes identical (sha256),
#          payment/subscription/progress/placement/content intact
#
# Usage: bash scripts/restore-proof.sh
# Exit:  0 proof passed; non-zero on any failure (fail-closed).
set -Eeuo pipefail

REPO_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

if [[ ! -x server/pocketbase ]]; then
  echo "PocketBase binary not found. Run: pnpm setup:pocketbase" >&2
  exit 1
fi

PORT="${PB_RESTORE_PROOF_PORT:-18097}"
HTTP="http://127.0.0.1:${PORT}"
WORK="$(mktemp -d -t fep-restore-proof-XXXXXX)"
DATA_DIR="$WORK/pb_data"
RESTORED_DIR="$WORK/pb_data_restored"
mkdir -p "$DATA_DIR" "$RESTORED_DIR"

source "$REPO_ROOT/scripts/pb-test-helper.sh"
pb_create_superuser "$DATA_DIR"

PID=""
cleanup() {
  local code=$?
  if [[ -n "$PID" ]] && kill -0 "$PID" 2>/dev/null; then
    kill "$PID" 2>/dev/null || true
    wait "$PID" 2>/dev/null || true
  fi
  rm -rf -- "$WORK"
  exit "$code"
}
trap cleanup EXIT INT TERM

start_pb() {
  local dir="$1"
  PB_TELEMETRY=0 PB_FEEDBACK=0 \
    server/pocketbase serve \
      --http "127.0.0.1:${PORT}" \
      --dir "$dir" \
      --migrationsDir server/pb_migrations \
      --hooksDir server/pb_hooks \
      --hooksWatch=false \
      --encryptionEnv "${PB_ENCRYPTION:-dev-encryption-key-not-for-prod}" \
      > "$WORK/pb.log" 2>&1 &
  PID=$!
  for _ in $(seq 1 100); do
    # Both conditions must hold: the health probe answers AND the process
    # we spawned is still alive (so a pre-existing instance on the port
    # can never be mistaken for ours).
    if kill -0 "$PID" 2>/dev/null && curl --silent --fail "$HTTP/api/health" >/dev/null 2>&1; then
      return 0
    fi
    if ! kill -0 "$PID" 2>/dev/null; then
      echo "restore-proof: PocketBase process exited during startup (dir $dir)" >&2
      tail -n 30 "$WORK/pb.log" >&2 || true
      return 1
    fi
    sleep 0.2
  done
  echo "restore-proof: PocketBase did not become healthy (dir $dir)" >&2
  tail -n 30 "$WORK/pb.log" >&2 || true
  return 1
}

echo "restore-proof: phase 1 — create fixture + backup"
start_pb "$DATA_DIR"
export PB_SMOKE_URL="$HTTP"
export PB_TEST_SU_EMAIL PB_TEST_SU_PASSWORD
STATE="$(node scripts/restore-proof.mjs create)"
echo "$STATE"
PROOF_STATE="$(printf '%s\n' "$STATE" | sed -n 's/^PROOF_STATE=//p' | tail -1)"
PROOF_BACKUP="$(printf '%s\n' "$STATE" | sed -n 's/^PROOF_BACKUP=//p' | tail -1)"
[[ -n "$PROOF_STATE" && -n "$PROOF_BACKUP" ]] || {
  echo "restore-proof: failed to capture proof state" >&2
  exit 1
}

echo "restore-proof: phase 2 — copy the backup out, stop the instance, wipe the data dir"
BACKUP_ZIP="$WORK/pb_data/backups/$PROOF_BACKUP"
if [[ ! -f "$BACKUP_ZIP" ]]; then
  BACKUP_ZIP="$(find "$WORK/pb_data" -type f -name "$PROOF_BACKUP" 2>/dev/null | head -1 || true)"
fi
[[ -f "$BACKUP_ZIP" ]] || {
  echo "restore-proof: backup ZIP missing under $WORK/pb_data (looked for $PROOF_BACKUP)" >&2
  find "$WORK/pb_data" -maxdepth 4 -type d | head -20 >&2 || true
  exit 1
}
cp "$BACKUP_ZIP" "$WORK/$PROOF_BACKUP"
SIZE="$(stat -c%s "$WORK/$PROOF_BACKUP")"
echo "restore-proof: backup ZIP $BACKUP_ZIP ($SIZE bytes)"

kill "$PID" 2>/dev/null || true
wait "$PID" 2>/dev/null || true
PID=""
rm -rf -- "$DATA_DIR"

BACKUP_ZIP="$WORK/$PROOF_BACKUP"

echo "restore-proof: phase 3 — restore into a CLEAN data dir"
unzip -q "$BACKUP_ZIP" -d "$RESTORED_DIR"
echo "restore-proof: restored ZIP into $RESTORED_DIR"

echo "restore-proof: phase 4 — start the restored instance (same migrations+hooks)"
start_pb "$RESTORED_DIR"

echo "restore-proof: phase 5 — verify records, files and auth"
export PB_RESTORED_DIR="$RESTORED_DIR"
export PB_PROOF_STATE="$PROOF_STATE"
node scripts/restore-proof.mjs verify
echo "restore-proof: PASS — backup/restore proof completed in a disposable environment"

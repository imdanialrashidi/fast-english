#!/usr/bin/env bash
# Fast English Podcast — isolated restore drill against a DISPOSABLE
# PocketBase instance. Never touches live production pb_data.
#
#   1. takes the newest backup from shared/backups (or an explicit path/name)
#   2. restores the ZIP into a fresh temporary data directory
#   3. starts the SAME PocketBase binary (0.39.9) on a temporary localhost port
#      with the CURRENT release's migrations+hooks (normal startup mechanism)
#   4. verifies health, authenticates with the superuser (MUST succeed) and
#      verifies every expected collection is readable with a numeric count
#      (fail-closed: any missing/uncountable collection fails the drill) —
#      WITHOUT exposing any private record values
#   5. stops the instance and removes the temporary environment
#
# Usage: bash deploy/restore-drill.sh [backup-name-or-path]
# Exit:  0 drill passed; non-zero on any failure (fail-closed).
# Requires: root or the fastenglish user, curl, python3, unzip, and the
# production secrets file (superuser credentials).
set -Eeuo pipefail

FEP_ROOT="${FEP_ROOT:-/opt/fast-english}"
SECRETS="$FEP_ROOT/shared/secrets/pocketbase.env"
PB_BIN="$FEP_ROOT/bin/pocketbase"
PORT="${FEP_RESTORE_PORT:-18099}"
MIGRATIONS="$FEP_ROOT/current/server/pb_migrations"
HOOKS="$FEP_ROOT/current/server/pb_hooks"

TMPDIR="$(mktemp -d /tmp/fep-restore-drill.XXXXXX)"
trap 'kill "${PB_PID:-}" 2>/dev/null || true; rm -rf -- "$TMPDIR"' EXIT

# --- 1. pick the backup ---------------------------------------------------
if [[ -n "${1:-}" ]]; then
  BACKUP="$1"
  [[ -f "$BACKUP" ]] || BACKUP="$FEP_ROOT/shared/backups/$1"
else
  BACKUP="$(ls -1t "$FEP_ROOT"/shared/backups/*.zip 2>/dev/null | head -1 || true)"
fi
[[ -n "$BACKUP" && -f "$BACKUP" ]] || { echo "drill: no backup found (passed '$1')" >&2; exit 1; }
SIZE="$(stat -c%s "$BACKUP")"
[[ "$SIZE" -gt 0 ]] || { echo "drill: backup $BACKUP is empty" >&2; exit 1; }
echo "drill: backup=$BACKUP size=$SIZE bytes"

# --- 2. restore into the disposable data dir ------------------------------
DATA_DIR="$TMPDIR/pb_data"
mkdir -p "$DATA_DIR"
unzip -q "$BACKUP" -d "$DATA_DIR"
echo "drill: restored ZIP into $DATA_DIR"

# --- 3. start the same PocketBase version on a temp port -------------------
if [[ ! -x "$PB_BIN" ]]; then echo "drill: $PB_BIN missing" >&2; exit 1; fi
"$PB_BIN" --version 2>&1 | grep -q "0.39.9" \
  || { echo "drill: unexpected PocketBase version ($("$PB_BIN" --version 2>&1 | tail -1))" >&2; exit 1; }

# Superuser auth against the drill instance (credentials from the secrets
# file — the production secrets file is mandatory for a drill; the backup
# always contains the superuser created by install.sh).
if [[ -r "$SECRETS" ]]; then
  set -a; # shellcheck disable=SC1090
  source "$SECRETS"; set +a
fi
if [[ -z "${FEP_SUPERUSER_EMAIL:-}" || -z "${FEP_SUPERUSER_PASSWORD:-}" ]]; then
  echo "drill: FAIL — FEP_SUPERUSER_EMAIL/FEP_SUPERUSER_PASSWORD required (secrets file $SECRETS)" >&2
  exit 1
fi

# If the secrets file defines PB_ENCRYPTION_KEY, the drill instance must pass
# --encryptionEnv to read the encrypted settings from the restored backup
# (verified against 0.39.9: without the key PB fails with "invalid settings
# db data or missing encryption key").
ENCRYPTION_ARGS=()
if [[ -n "${PB_ENCRYPTION_KEY:-}" ]]; then ENCRYPTION_ARGS=(--encryptionEnv=PB_ENCRYPTION_KEY); fi

# Auth body via a root-only temp file: the password never appears in argv
# (visible via ps) or stdout.
AUTH_JSON="$(mktemp /tmp/fep-drill-auth.XXXXXX)"   # 0600 by mktemp
trap 'kill "${PB_PID:-}" 2>/dev/null || true; rm -rf -- "$TMPDIR" "$AUTH_JSON"' EXIT
FEP_SUPERUSER_EMAIL="$FEP_SUPERUSER_EMAIL" FEP_SUPERUSER_PASSWORD="$FEP_SUPERUSER_PASSWORD" \
  python3 > "$AUTH_JSON" <<'PYEOF'
import json, os
print(json.dumps({"identity": os.environ["FEP_SUPERUSER_EMAIL"], "password": os.environ["FEP_SUPERUSER_PASSWORD"]}))
PYEOF

"$PB_BIN" serve --http="127.0.0.1:$PORT" --dir="$DATA_DIR" \
  --migrationsDir="$MIGRATIONS" --hooksDir="$HOOKS" --hooksWatch=false \
  "${ENCRYPTION_ARGS[@]}" \
  >"$TMPDIR/serve.log" 2>&1 &
PB_PID=$!

# --- 4. health + collection counts (counts only, never values) -------------
for _ in $(seq 1 30); do
  if curl -fsS "http://127.0.0.1:$PORT/api/health" >/dev/null 2>&1; then break; fi
  sleep 1
done
curl -fsS "http://127.0.0.1:$PORT/api/health" >/dev/null \
  || { echo "drill: instance did not become healthy" >&2; tail -20 "$TMPDIR/serve.log" >&2; exit 1; }
echo "drill: health OK"

# Auth MUST succeed: the production backup always contains the superuser.
# A failure here means the backup is corrupt, predates the superuser, or the
# secrets file credentials are stale (e.g. password rotation).
token="$(curl -fsS -X POST "http://127.0.0.1:$PORT/api/collections/_superusers/auth-with-password" \
  -H 'Content-Type: application/json' \
  --data-binary @"$AUTH_JSON" \
  | python3 -c 'import json,sys; print(json.load(sys.stdin)["token"])' 2>/dev/null)" \
  || { echo "drill: FAIL — superuser auth against the drill instance failed (backup corrupt or credentials stale)" >&2; exit 1; }
echo "drill: superuser auth OK"

echo "drill: collections (counts only, never record values):"
# Full launch-critical collection contract (Business Configuration slice).
# Derived from server/pb_migrations/*.js — every collection created by a
# migration must be readable after a restore. tests/restore-drill-collections.test.mjs
# re-derives this list from the migrations and fails CI when it goes stale.
# Order is stable (creation order) so a missing collection shows up clearly.
for col in _superusers fep_users plans payment_destination payment_requests subscriptions placement_questions placement_attempts topics lessons lesson_progress staff_admins categories lesson_vocabulary content_imports content_operations site_settings; do
  code="$(curl -sS -o "$TMPDIR/count.json" -w '%{http_code}' \
    "http://127.0.0.1:$PORT/api/collections/$col/records?page=1&perPage=1" \
    -H "Authorization: $token")" || { echo "drill: FAIL — cannot query $col" >&2; exit 1; }
  if [[ "$code" != "200" ]]; then
    echo "drill: FAIL — collection $col returned HTTP $code (backup predates the schema or is corrupted)" >&2
    exit 1
  fi
  total="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["totalItems"])' "$TMPDIR/count.json" 2>/dev/null)" \
    || { echo "drill: FAIL — cannot parse count for $col" >&2; exit 1; }
  echo "drill:   $col total=$total"
done

echo "drill: PASS — backup restores, same binary boots, health OK, superuser auth OK, all collections readable"

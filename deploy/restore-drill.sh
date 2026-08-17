#!/usr/bin/env bash
# Fast English Podcast — isolated restore drill against a DISPOSABLE
# PocketBase instance. Never touches live production pb_data.
#
# Coolify-era adaptation (docs/COOLIFY_DEPLOYMENT.md): migrations + hooks +
# binary now come from the REPOSITORY (the same sources the production
# images bake in) instead of the retired /opt/fast-english/current release
# symlink. Everything else is unchanged:
#   1. takes the newest backup from shared/backups (or an explicit path/name)
#   2. restores the ZIP into a fresh temporary data directory
#   3. starts the SAME PocketBase binary (version pinned by server/VERSION)
#      on a temporary localhost port with the release's migrations+hooks
#   4. verifies health, authenticates with the superuser (MUST succeed) and
#      verifies every expected collection is readable with a numeric count
#      (fail-closed) — WITHOUT exposing any private record values
#   5. stops the instance and removes the temporary environment
#
# Explicit protection (task §4): the drill REFUSES to run against the
# production data directory (/opt/fast-english/shared/pb_data), the
# development data directory (server/pb_data) or any unsafe root path.
#
# Usage: bash deploy/restore-drill.sh [backup-name-or-path]
# Exit:  0 drill passed; non-zero on any failure (fail-closed).
# Requires: curl, python3, unzip, the pinned PocketBase binary
# (scripts/setup-pocketbase.sh), and the production secrets file
# (superuser credentials) for the auth step.
set -Eeuo pipefail

REPO_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
FEP_ROOT="${FEP_ROOT:-/opt/fast-english}"
SECRETS="${FEP_SECRETS_FILE:-$FEP_ROOT/shared/secrets/pocketbase.env}"
PB_BIN="${FEP_PB_BIN:-$REPO_ROOT/server/pocketbase}"
MIGRATIONS="${FEP_PB_MIGRATIONS:-$REPO_ROOT/server/pb_migrations}"
HOOKS="${FEP_PB_HOOKS:-$REPO_ROOT/server/pb_hooks}"
PB_VERSION="$(tr -d '[:space:]' < "$REPO_ROOT/server/VERSION")"
PORT="${FEP_RESTORE_PORT:-18099}"

# ---- fail-closed guards ---------------------------------------------------
die() { echo "drill: $*" >&2; exit 1; }
guard_never_touch() {
  local p
  for p in "$@"; do
    local abs
    abs="$(readlink -f "$p" 2>/dev/null || echo "$p")"
    case "$abs" in
      /opt/fast-english*)
        die "REFUSED: $p is under /opt/fast-english (production data) — the drill only touches disposable directories"
        ;;
      "$REPO_ROOT"/server/pb_data*)
        die "REFUSED: $p is the development data directory (server/pb_data) — the drill only touches disposable directories"
        ;;
    esac
  done
}

# ---- disposable environment --------------------------------------------------
TMPDIR="$(mktemp -d /tmp/fep-restore-drill.XXXXXX)"
DATA_DIR="$TMPDIR/pb_data"
mkdir -p "$DATA_DIR"
guard_never_touch "$TMPDIR"
trap 'kill "${PB_PID:-}" 2>/dev/null || true; rm -rf -- "$TMPDIR" 2>/dev/null || true' EXIT

# --- 1. pick the backup ---------------------------------------------------
if [[ -n "${1:-}" ]]; then
  BACKUP="$1"
  [[ -f "$BACKUP" ]] || BACKUP="$FEP_ROOT/shared/backups/$1"
else
  BACKUP="$(ls -1t "$FEP_ROOT"/shared/backups/*.zip 2>/dev/null | head -1 || true)"
fi
[[ -n "$BACKUP" && -f "$BACKUP" ]] || die "no backup found (passed '$1')"
# NOTE: the backup is READ-ONLY INPUT — it is not guarded (the guard is on
# the disposable data dir $TMPDIR above). The default/reading a production
# backup under /opt/fast-english/shared/backups is the documented drill path.
SIZE="$(stat -c%s "$BACKUP")"
[[ "$SIZE" -gt 0 ]] || die "backup $BACKUP is empty"
echo "drill: backup=$BACKUP size=$SIZE bytes"

# --- 2. restore into the disposable data dir ------------------------------
unzip -q "$BACKUP" -d "$DATA_DIR"
echo "drill: restored ZIP into $DATA_DIR"

# --- 3. start the same PocketBase version on a temp port -------------------
[[ -x "$PB_BIN" ]] || die "PocketBase binary missing ($PB_BIN) — run scripts/setup-pocketbase.sh"
PB_VER="$("$PB_BIN" --version 2>&1 | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1)"
[[ "$PB_VER" == "$PB_VERSION" ]] || die "unexpected PocketBase version: $PB_VER (expected $PB_VERSION from server/VERSION)"
[[ -d "$MIGRATIONS" && -d "$HOOKS" ]] || die "migrations/hooks dirs missing ($MIGRATIONS / $HOOKS)"

if [[ -r "$SECRETS" ]]; then
  set -a; # shellcheck disable=SC1090
  source "$SECRETS"; set +a
fi
if [[ -z "${FEP_SUPERUSER_EMAIL:-}" || -z "${FEP_SUPERUSER_PASSWORD:-}" ]]; then
  die "FAIL — FEP_SUPERUSER_EMAIL/FEP_SUPERUSER_PASSWORD required (secrets file $SECRETS)"
fi

# If the secrets file defines PB_ENCRYPTION_KEY, the drill instance must pass
# --encryptionEnv to read the encrypted settings from the restored backup.
ENCRYPTION_ARGS=()
if [[ -n "${PB_ENCRYPTION_KEY:-}" ]]; then ENCRYPTION_ARGS=(--encryptionEnv=PB_ENCRYPTION_KEY); fi

# Auth body via a root-only temp file: the password never appears in argv
# (visible via ps) or stdout.
AUTH_JSON="$(mktemp /tmp/fep-drill-auth.XXXXXX)"   # 0600 by mktemp
trap 'kill "${PB_PID:-}" 2>/dev/null || true; rm -rf -- "$TMPDIR" "$AUTH_JSON" 2>/dev/null || true' EXIT
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
#!/usr/bin/env bash
# Fast English Podcast — off-VPS backup gate check (host side).
#
# Proves the C15 Production Gate: the PocketBase-native S3-compatible
# backup destination is configured AND reachable, so a full-VPS loss is
# actually recoverable from outside the server. Read-only: never creates
# or mutates anything (no backup is triggered).
#
# Checks (all against the loopback maintenance endpoint 127.0.0.1:8090):
#   1. superuser authentication (secrets file, never printed);
#   2. settings.backups.s3.enabled == true (S3 destination configured);
#   3. the S3 destination is reachable and the bucket lists — PocketBase
#      exposes the S3 backup list only when the S3 settings are valid
#      (the backups list merges local + S3 objects), so a successful
#      list response is the read-only reachability proof.
#
# Usage:  bash deploy/check-offsite.sh
# Exit:   0 gate PASS; non-zero with a clear message on any failure.
# Requires: root (secrets file), curl, python3, running PocketBase on the
# loopback port (host mapping 127.0.0.1:8090).
set -Eeuo pipefail

FEP_ROOT="${FEP_ROOT:-/opt/fast-english}"
SECRETS="$FEP_ROOT/shared/secrets/pocketbase.env"
PB_ADDR="${PB_ADDR:-http://127.0.0.1:8090}"

[[ -r "$SECRETS" ]] || { echo "check-offsite: secrets file $SECRETS not readable (run as root)" >&2; exit 1; }
set -a
# shellcheck disable=SC1090
source "$SECRETS"
set +a
: "${FEP_SUPERUSER_EMAIL:?FEP_SUPERUSER_EMAIL is required in the secrets file}"
: "${FEP_SUPERUSER_PASSWORD:?FEP_SUPERUSER_PASSWORD is required in the secrets file}"

# Auth via a 0600 temp file (no credential in argv or stdout).
AUTH_JSON="$(mktemp /tmp/fep-offsite-auth.XXXXXX)"
trap 'rm -f -- "$AUTH_JSON"' EXIT
FEP_SUPERUSER_EMAIL="$FEP_SUPERUSER_EMAIL" FEP_SUPERUSER_PASSWORD="$FEP_SUPERUSER_PASSWORD" \
  python3 > "$AUTH_JSON" <<'PYEOF'
import json, os
print(json.dumps({"identity": os.environ["FEP_SUPERUSER_EMAIL"], "password": os.environ["FEP_SUPERUSER_PASSWORD"]}))
PYEOF

token="$(curl -fsS -X POST "$PB_ADDR/api/collections/_superusers/auth-with-password" \
  -H 'Content-Type: application/json' --data-binary @"$AUTH_JSON" \
  | python3 -c 'import json,sys; print(json.load(sys.stdin)["token"])')" \
  || { echo "check-offsite: superuser auth failed (loopback $PB_ADDR)" >&2; exit 1; }

SETTINGS="$(curl -fsS "$PB_ADDR/api/settings" -H "Authorization: $token")" \
  || { echo "check-offsite: cannot read settings" >&2; exit 1; }

S3_ENABLED="$(printf '%s' "$SETTINGS" | python3 -c 'import json,sys; print(json.load(sys.stdin)["backups"]["s3"]["enabled"])' 2>/dev/null || echo false)"
if [[ "$S3_ENABLED" != "true" ]]; then
  echo "check-offsite: FAIL — backups.s3.enabled is $S3_ENABLED (off-VPS destination not configured)." >&2
  echo "check-offsite: configure FEP_BACKUP_S3_* + re-run deploy/configure.sh (see docs/BACKUP_RESTORE.md §7)." >&2
  exit 1
fi
echo "check-offsite: backups.s3.enabled = true"

# Reachability: the backups list merges local + S3 objects only when the
# S3 settings are valid; an invalid/blocked destination errors here.
LIST="$(curl -fsS "$PB_ADDR/api/backups" -H "Authorization: $token")" \
  || { echo "check-offsite: FAIL — S3 backup list unreachable (destination invalid or blocked)" >&2; exit 1; }
N="$(printf '%s' "$LIST" | python3 -c 'import json,sys; print(len(json.load(sys.stdin)))' 2>/dev/null || echo 0)"
echo "check-offsite: S3 backup list reachable ($N object(s) listed)"

echo "check-offsite: PASS — off-VPS backup gate satisfied"
exit 0
#!/usr/bin/env bash
# Fast English Podcast — production backup via the PocketBase Backups API.
#
#   - authenticates against 127.0.0.1:8090 using the superuser credentials
#     from /opt/fast-english/shared/secrets/pocketbase.env (never printed)
#   - creates a full pb_data snapshot ZIP (DB + uploaded files, excludes
#     local backups and S3 files — PocketBase behaviour, verified docs)
#   - verifies the backup exists, is non-empty, and the ZIP contains the
#     uploaded-file storage tree
#   - copies it to shared/backups (separate from the live pb_data) and
#     applies the 14-backup retention via backup-copy.sh
#
# Usage:   bash deploy/backup.sh [name]      (default fep-backup-<UTC ts>)
# Exit:    0 success, non-zero on any failure. Never prints credentials.
# Requires: curl, python3 (JSON parsing), root or fastenglish user access to
#           shared/backups.
set -Eeuo pipefail

FEP_ROOT="${FEP_ROOT:-/opt/fast-english}"
SECRETS="$FEP_ROOT/shared/secrets/pocketbase.env"
PB_ADDR="${PB_ADDR:-http://127.0.0.1:8090}"
KEEP="${FEP_BACKUP_KEEP:-14}"

if [[ ! -r "$SECRETS" ]]; then
  echo "backup: secrets file $SECRETS not readable (run as root)" >&2
  exit 1
fi
set -a
# shellcheck disable=SC1090
source "$SECRETS"
set +a
: "${FEP_SUPERUSER_EMAIL:?FEP_SUPERUSER_EMAIL is required in the secrets file}"
: "${FEP_SUPERUSER_PASSWORD:?FEP_SUPERUSER_PASSWORD is required in the secrets file}"

NAME="${1:-fep-backup-$(date -u +%Y%m%d%H%M%S).zip}"
# PocketBase 0.39.9 requires names to match ^[a-z0-9_-]+\.zip$
# (verified against apis/backup_create.go of the pinned binary).
NAME="$(printf '%s' "$NAME" | tr '[:upper:]' '[:lower:]')"
[[ "$NAME" == *.zip ]] || NAME="$NAME.zip"

json_get() { python3 -c "import json,sys; d=json.load(sys.stdin); print(d$1)"; }

# 1. Authenticate (token kept only in memory).
token="$(curl -fsS -X POST "$PB_ADDR/api/collections/_superusers/auth-with-password" \
  -H 'Content-Type: application/json' \
  --data-binary "{\"identity\":$(python3 -c 'import json,sys;print(json.dumps(sys.argv[1]))' "$FEP_SUPERUSER_EMAIL"),\"password\":$(python3 -c 'import json,sys;print(json.dumps(sys.argv[1]))' "$FEP_SUPERUSER_PASSWORD")}" \
  | json_get "['token']")"
[[ -n "$token" && "$token" != "None" ]] || { echo "backup: auth failed" >&2; exit 1; }
AUTH=(-H "Authorization: $token")

# 2. Create the backup.
echo "backup: creating $NAME"
curl -fsS -X POST "$PB_ADDR/api/backups" "${AUTH[@]}" -H 'Content-Type: application/json' \
  --data-binary "{\"name\":$(python3 -c 'import json,sys;print(json.dumps(sys.argv[1]))' "$NAME")}" >/dev/null

# 3. Verify: exists, size > 0. (0.39.9 lists entries under `key` — verified
#    against the pinned binary's GET /api/backups response.)
list="$(curl -fsS "$PB_ADDR/api/backups" "${AUTH[@]}")"
size="$(printf '%s' "$list" | python3 -c "
import json,sys
d=json.load(sys.stdin)
m=[b for b in d if b['key']=='$NAME']
print(m[0]['size'] if m else '')
")"
if [[ -z "$size" || "$size" -le 0 ]]; then
  echo "backup: FAILED — backup $NAME missing or empty" >&2
  exit 1
fi
echo "backup: verified $NAME size=$size bytes"

# 4. Verify uploaded files are included (storage tree inside the ZIP).
SRC_ZIP="$FEP_ROOT/shared/pb_data/backups/$NAME"
if [[ ! -f "$SRC_ZIP" ]]; then
  echo "backup: FAILED — $SRC_ZIP not found" >&2
  exit 1
fi
if ! unzip -l "$SRC_ZIP" | grep -q "storage/"; then
  echo "backup: WARNING — ZIP has no storage/ entries (no uploads yet or S3 mode)" >&2
else
  echo "backup: uploaded files included (storage/ tree present)"
fi

# 5. Copy off pb_data + retention (shared/backups is separate from pb_data).
echo "backup: copying to shared/backups"
bash "$(dirname -- "${BASH_SOURCE[0]}")/backup-copy.sh"

echo "backup: OK — $NAME ($size bytes)"

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
# Secret handling (finding #5): the superuser auth body and the Authorization
# header are written to root-only 0600 temp files and given to curl with
# --data-binary @file / -H @file — no credential or token ever appears in a
# process argument (visible via ps). curl has read headers from files since
# 7.88.0 (verified on 8.21.0); if a target curl predates that, use
# `--config <file>` with `header = "..."` instead — never put tokens in argv.
# install.sh's PocketBase CLI superuser-password argument remains the single
# documented exception (see deploy/install.sh).
# The operator-supplied backup name is hard-validated against
# ^[a-z0-9_-]+\.zip$ before any use (no interpolation injection).
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
# Hard validation (finding #5): enforce the safe charset here so an
# operator-supplied name cannot inject into any embedded script/snippet.
[[ "$NAME" =~ ^[a-z0-9_-]+\.zip$ ]] || {
  echo "backup: invalid backup name '$NAME' (must match ^[a-z0-9_-]+\\.zip$)" >&2
  exit 1
}

# 1. Authenticate. The auth body and the Authorization header are written to
#    root-only 0600 temp files (mktemp); the token never appears in argv.
AUTH_JSON="$(mktemp /tmp/fep-backup-auth.XXXXXX)"
AUTH_HDR="$(mktemp /tmp/fep-backup-hdr.XXXXXX)"
trap 'rm -f -- "${AUTH_JSON:-}" "${AUTH_HDR:-}"' EXIT
FEP_SUPERUSER_EMAIL="$FEP_SUPERUSER_EMAIL" FEP_SUPERUSER_PASSWORD="$FEP_SUPERUSER_PASSWORD" \
  python3 > "$AUTH_JSON" <<'PYEOF'
import json, os
print(json.dumps({"identity": os.environ["FEP_SUPERUSER_EMAIL"], "password": os.environ["FEP_SUPERUSER_PASSWORD"]}))
PYEOF
token="$(curl -fsS -X POST "$PB_ADDR/api/collections/_superusers/auth-with-password" \
  -H 'Content-Type: application/json' \
  --data-binary @"$AUTH_JSON" \
  | python3 -c 'import json,sys; print(json.load(sys.stdin)["token"])')"
[[ -n "$token" && "$token" != "None" ]] || { echo "backup: auth failed" >&2; exit 1; }
printf 'Authorization: %s\n' "$token" > "$AUTH_HDR"

# 2. Create the backup.
echo "backup: creating $NAME"
curl -fsS -X POST "$PB_ADDR/api/backups" -H 'Content-Type: application/json' \
  -H @"$AUTH_HDR" \
  --data-binary "{\"name\":$(python3 -c 'import json,sys;print(json.dumps(sys.argv[1]))' "$NAME")}" >/dev/null

# 3. Verify: exists, size > 0. (0.39.9 lists entries under `key` — verified
#    against the pinned binary's GET /api/backups response.)
list="$(curl -fsS "$PB_ADDR/api/backups" -H @"$AUTH_HDR")"
size="$(printf '%s' "$list" | NAME="$NAME" python3 -c "
import json,sys,os
d=json.load(sys.stdin)
m=[b for b in d if b['key']==os.environ['NAME']]
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

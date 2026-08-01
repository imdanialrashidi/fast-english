#!/usr/bin/env bash
# Fast English Podcast — one-time production PocketBase settings.
#
# Applies the approved production settings via the local Settings API:
#   meta.appName / meta.appURL / meta.hideControls (schema lock)
#   logs.maxDays=30, logs.logAuthId=false (no auth-ID logging), logs.logIP=true
#   backups.cron="30 2 * * *" (daily 02:30 UTC), backups.cronMaxKeep=14
#   trustedProxy headers for Caddy only (PB is bound to 127.0.0.1)
#   smtp.enabled=false unless FEP_SMTP_* credentials are approved
#   backups.s3 only when FEP_BACKUP_S3_* credentials are approved
# Rate-limiter settings are intentionally left to migration
# 1700000001_rate_limits.js (enabled with the documented rule set).
#
# Idempotent: safe to re-run after a restore or release change.
# Usage: bash deploy/configure.sh [--dry-run]
# Requires: root, running PocketBase on 127.0.0.1:8090, secrets file.
set -Eeuo pipefail

FEP_ROOT="${FEP_ROOT:-/opt/fast-english}"
SECRETS="$FEP_ROOT/shared/secrets/pocketbase.env"
PB_ADDR="${PB_ADDR:-http://127.0.0.1:8090}"
DRY_RUN=0
[[ "${1:-}" == "--dry-run" ]] && DRY_RUN=1

[[ -r "$SECRETS" ]] || { echo "configure: secrets file $SECRETS not readable" >&2; exit 1; }
set -a; # shellcheck disable=SC1090
source "$SECRETS"; set +a
: "${FEP_SUPERUSER_EMAIL:?FEP_SUPERUSER_EMAIL is required}"
: "${FEP_SUPERUSER_PASSWORD:?FEP_SUPERUSER_PASSWORD is required}"

if [[ "$DRY_RUN" -eq 0 ]]; then
  # Auth body is written to a root-only temp file so the superuser password
  # never appears in argv (visible via ps) or stdout; it is passed to curl
  # with --data-binary @file.
  AUTH_JSON="$(mktemp /tmp/fep-configure-auth.XXXXXX)"   # 0600 by mktemp
  trap 'rm -f -- "$AUTH_JSON"' EXIT
  FEP_SUPERUSER_EMAIL="$FEP_SUPERUSER_EMAIL" FEP_SUPERUSER_PASSWORD="$FEP_SUPERUSER_PASSWORD" \
    python3 > "$AUTH_JSON" <<'PYEOF'
import json, os
print(json.dumps({"identity": os.environ["FEP_SUPERUSER_EMAIL"], "password": os.environ["FEP_SUPERUSER_PASSWORD"]}))
PYEOF
  token="$(curl -fsS -X POST "$PB_ADDR/api/collections/_superusers/auth-with-password" \
    -H 'Content-Type: application/json' \
    --data-binary @"$AUTH_JSON" \
    | python3 -c 'import json,sys; print(json.load(sys.stdin)["token"])')"
else
  token="DRY-RUN"
fi
AUTH=(-H "Authorization: $token")

# Build the settings patch (no secrets in output).
BACKUPS_JSON='{"cron":"30 2 * * *","cronMaxKeep":14}'
if [[ "${FEP_BACKUP_S3_ENABLED:-false}" == "true" ]]; then
  : "${FEP_BACKUP_S3_BUCKET:?}" "${FEP_BACKUP_S3_ENDPOINT:?}" "${FEP_BACKUP_S3_ACCESS_KEY:?}" "${FEP_BACKUP_S3_SECRET_KEY:?}"
  BACKUPS_JSON="{\"cron\":\"30 2 * * *\",\"cronMaxKeep\":14,\"s3\":{\"enabled\":true,\"bucket\":\"$FEP_BACKUP_S3_BUCKET\",\"region\":\"${FEP_BACKUP_S3_REGION:-us-east-1}\",\"endpoint\":\"$FEP_BACKUP_S3_ENDPOINT\",\"accessKey\":\"$FEP_BACKUP_S3_ACCESS_KEY\",\"secret\":\"$FEP_BACKUP_S3_SECRET_KEY\",\"forcePathStyle\":${FEP_BACKUP_S3_FORCE_PATH_STYLE:-false}}}"
fi

SMTP_JSON='{"enabled":false}'
if [[ -n "${FEP_SMTP_HOST:-}" ]]; then
  : "${FEP_SMTP_PORT:?FEP_SMTP_PORT is required when FEP_SMTP_HOST is set}" "${FEP_SMTP_USERNAME:?FEP_SMTP_USERNAME is required}" "${FEP_SMTP_PASSWORD:?FEP_SMTP_PASSWORD is required}"
  SMTP_JSON="{\"enabled\":true,\"host\":\"$FEP_SMTP_HOST\",\"port\":${FEP_SMTP_PORT},\"username\":\"$FEP_SMTP_USERNAME\",\"password\":\"$FEP_SMTP_PASSWORD\",\"tls\":${FEP_SMTP_TLS:-true}}"
fi

PATCH="{
  \"meta\": {\"appName\":\"Fast English Podcast\",\"appURL\":\"https://app.fastenglishpodcast.com\",\"hideControls\":true},
  \"logs\": {\"maxDays\":30,\"logIP\":true,\"logAuthId\":false},
  \"backups\": $BACKUPS_JSON,
  \"smtp\": $SMTP_JSON,
  \"trustedProxy\": {\"headers\":[\"X-Forwarded-For\",\"X-Forwarded-Proto\",\"X-Forwarded-Host\",\"X-Real-IP\"],\"useLeftmostIP\":false}
}"

echo "configure: settings patch (secrets omitted):"
python3 - "$PATCH" <<'PYEOF'
import json, sys
p = json.loads(sys.argv[1])
p.get("smtp", {}).pop("password", None)
s3 = p.get("backups", {}).get("s3", {})
s3.pop("secret", None)
s3.pop("accessKey", None)
print(json.dumps(p, indent=2, ensure_ascii=False))
PYEOF

if [[ "$DRY_RUN" -eq 1 ]]; then
  echo "configure: dry-run — no changes applied"
  exit 0
fi

# Send the settings patch via the temp file as well: it contains SMTP/S3
# credentials and must not appear in argv or stdout.
printf '%s' "$PATCH" > "$AUTH_JSON"
RESP="$(curl -fsS -X PATCH "$PB_ADDR/api/settings" "${AUTH[@]}" -H 'Content-Type: application/json' \
  --data-binary @"$AUTH_JSON")" || { echo "configure: settings update FAILED" >&2; exit 1; }

# Verify the applied values (secrets are redacted by PB itself).
echo "$RESP" | python3 -c "
import json,sys
s=json.load(sys.stdin)
print('configure: verified ->')
print('  meta.appName      =', s['meta']['appName'])
print('  meta.appURL       =', s['meta']['appURL'])
print('  meta.hideControls =', s['meta']['hideControls'])
print('  logs.maxDays      =', s['logs']['maxDays'])
print('  logs.logAuthId    =', s['logs']['logAuthId'])
print('  backups.cron      =', s['backups']['cron'])
print('  backups.maxKeep   =', s['backups']['cronMaxKeep'])
print('  backups.s3.enabled=', s['backups']['s3']['enabled'])
print('  smtp.enabled      =', s['smtp']['enabled'])
print('  trustedProxy.hdrs =', s['trustedProxy']['headers'])
print('  rateLimits.enabled=', s['rateLimits']['enabled'])
"
echo "configure: OK"

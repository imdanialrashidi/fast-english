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
# Secret handling (finding #5): no credential or auth token ever appears in
# a process argument (visible via ps) or stdout. The superuser auth body, the
# settings patch (which can contain SMTP/S3 secrets) and the Authorization
# header are written to root-only 0600 temp files and passed to curl with
# --data-binary @file / -H @file. curl has read headers from files since
# 7.88.0 (verified on 8.21.0); if a target curl predates that, use
# `--config <file>` with `header = "..."` instead — never put tokens in argv.
# install.sh's PocketBase CLI superuser-password argument remains the single
# documented exception (see deploy/install.sh).
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

# All credential-bearing material lives in root-only 0600 temp files (mktemp
# creates them 0600); one trap cleans every exit path, including the --dry-run
# early exit. No secret is ever passed to a subprocess as an argument.
AUTH_JSON="$(mktemp /tmp/fep-configure-auth.XXXXXX)"   # superuser auth body
PATCH_JSON="$(mktemp /tmp/fep-configure-patch.XXXXXX)" # settings patch body
AUTH_HDR="$(mktemp /tmp/fep-configure-hdr.XXXXXX)"     # Authorization header
trap 'rm -f -- "${AUTH_JSON:-}" "${PATCH_JSON:-}" "${AUTH_HDR:-}"' EXIT

if [[ "$DRY_RUN" -eq 0 ]]; then
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
# The token is handed to curl via a 0600 header file (-H @file), never argv.
printf 'Authorization: %s\n' "$token" > "$AUTH_HDR"

# Build the settings patch (no secrets in output). The JSON is composed in
# python from env vars, so S3/SMTP values are quoted correctly and never
# appear in argv or in shell-interpolated strings.
if [[ "${FEP_BACKUP_S3_ENABLED:-false}" == "true" ]]; then
  : "${FEP_BACKUP_S3_BUCKET:?FEP_BACKUP_S3_BUCKET is required}" \
    "${FEP_BACKUP_S3_ENDPOINT:?FEP_BACKUP_S3_ENDPOINT is required}" \
    "${FEP_BACKUP_S3_ACCESS_KEY:?FEP_BACKUP_S3_ACCESS_KEY is required}" \
    "${FEP_BACKUP_S3_SECRET_KEY:?FEP_BACKUP_S3_SECRET_KEY is required}"
fi
if [[ -n "${FEP_SMTP_HOST:-}" ]]; then
  : "${FEP_SMTP_PORT:?FEP_SMTP_PORT is required when FEP_SMTP_HOST is set}" \
    "${FEP_SMTP_USERNAME:?FEP_SMTP_USERNAME is required}" \
    "${FEP_SMTP_PASSWORD:?FEP_SMTP_PASSWORD is required}"
fi
python3 > "$PATCH_JSON" <<'PYEOF'
import json, os
backups = {"cron": "30 2 * * *", "cronMaxKeep": 14}
if os.environ.get("FEP_BACKUP_S3_ENABLED", "false") == "true":
    backups["s3"] = {
        "enabled": True,
        "bucket": os.environ["FEP_BACKUP_S3_BUCKET"],
        "region": os.environ.get("FEP_BACKUP_S3_REGION", "us-east-1"),
        "endpoint": os.environ["FEP_BACKUP_S3_ENDPOINT"],
        "accessKey": os.environ["FEP_BACKUP_S3_ACCESS_KEY"],
        "secret": os.environ["FEP_BACKUP_S3_SECRET_KEY"],
        "forcePathStyle": os.environ.get("FEP_BACKUP_S3_FORCE_PATH_STYLE", "false").lower() == "true",
    }
if os.environ.get("FEP_SMTP_HOST"):
    smtp = {
        "enabled": True,
        "host": os.environ["FEP_SMTP_HOST"],
        "port": int(os.environ["FEP_SMTP_PORT"]),
        "username": os.environ["FEP_SMTP_USERNAME"],
        "password": os.environ["FEP_SMTP_PASSWORD"],
        "tls": os.environ.get("FEP_SMTP_TLS", "true").lower() == "true",
    }
else:
    smtp = {"enabled": False}
print(json.dumps({
    "meta": {"appName": "Fast English Podcast", "appURL": "https://app.fastenglishpodcast.com", "hideControls": True},
    "logs": {"maxDays": 30, "logIP": True, "logAuthId": False},
    "backups": backups,
    "smtp": smtp,
    "trustedProxy": {"headers": ["X-Forwarded-For", "X-Forwarded-Proto", "X-Forwarded-Host", "X-Real-IP"], "useLeftmostIP": False},
}))
PYEOF

echo "configure: settings patch (secrets omitted):"
python3 - "$PATCH_JSON" <<'PYEOF'
import json, sys
with open(sys.argv[1], encoding="utf-8") as f:
    p = json.load(f)
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
RESP="$(curl -fsS -X PATCH "$PB_ADDR/api/settings" \
  -H 'Content-Type: application/json' -H @"$AUTH_HDR" \
  --data-binary @"$PATCH_JSON")" || { echo "configure: settings update FAILED" >&2; exit 1; }

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

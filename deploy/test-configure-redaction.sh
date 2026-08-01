#!/usr/bin/env bash
# Fast English Podcast — executable proof that configure.sh --dry-run prints
# no credentials: superuser password, S3 access key + secret, SMTP password.
#
# Runs configure.sh in --dry-run (no root, no PocketBase) with sentinel
# credentials in a temporary FEP_ROOT and asserts no sentinel appears in the
# captured output (the settings patch printer redacts them).
set -Eeuo pipefail

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

command -v python3 >/dev/null 2>&1 || {
  echo "skip: python3 required by configure.sh is not available"
  exit 0
}

TMP="$(mktemp -d /tmp/fep-configure-redact.XXXXXX)"
trap 'rm -rf -- "$TMP"' EXIT
mkdir -p "$TMP/shared/secrets"
cat > "$TMP/shared/secrets/pocketbase.env" <<'EOF'
FEP_SUPERUSER_EMAIL=redact-probe@example.com
FEP_SUPERUSER_PASSWORD=S3NT1NEL-SUPER-PASS-8f3a9c2d
FEP_BACKUP_S3_ENABLED=true
FEP_BACKUP_S3_BUCKET=redact-bucket
FEP_BACKUP_S3_ENDPOINT=https://s3.example.com
FEP_BACKUP_S3_ACCESS_KEY=S3NT1NEL-AKIA-7b1d4e9f
FEP_BACKUP_S3_SECRET_KEY=S3NT1NEL-SECRET-2c5a8d1f
FEP_SMTP_HOST=smtp.example.com
FEP_SMTP_PORT=587
FEP_SMTP_USERNAME=smtp-probe@example.com
FEP_SMTP_PASSWORD=S3NT1NEL-SMTP-PASS-4e6b9c3a
EOF
chmod 600 "$TMP/shared/secrets/pocketbase.env"

out="$(FEP_ROOT="$TMP" bash deploy/configure.sh --dry-run 2>&1)" || {
  echo "configure.sh --dry-run failed:" >&2
  echo "$out" >&2
  exit 1
}

fail=0
for s in S3NT1NEL-SUPER-PASS-8f3a9c2d S3NT1NEL-AKIA-7b1d4e9f S3NT1NEL-SECRET-2c5a8d1f S3NT1NEL-SMTP-PASS-4e6b9c3a; do
  if [[ "$out" == *"$s"* ]]; then
    echo "FAIL: sentinel $s leaked into configure.sh output"
    fail=1
  fi
done
if [[ "$fail" -eq 0 ]]; then
  echo "PASS: configure.sh output contains no sentinel credentials (superuser/S3/SMTP)"
fi
exit "$fail"

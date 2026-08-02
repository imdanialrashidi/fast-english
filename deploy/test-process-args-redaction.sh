#!/usr/bin/env bash
# Fast English Podcast — executable proof that deployment scripts never place
# credentials or auth tokens in process arguments (argv), where any local
# user could read them via ps or /proc/<pid>/cmdline (finding #5).
#
# Wraps python3 and curl in a temporary bin/ that appends every invocation's
# argv to TMP/argv.log before exec'ing the real binaries, then runs:
#   - configure.sh --dry-run (patch build + redacted print; no network)
#   - backup.sh against an unreachable PB_ADDR (the auth body is built before
#     any network call, so the failure path still exercises the credential
#     handling; the script must fail with connection refused)
# and asserts no sentinel credential and no Authorization: token line ever
# appears in argv.log.
#
# The sentinels are only ever compared with grep -q and never printed.
set -Eeuo pipefail

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

command -v python3 >/dev/null 2>&1 || {
  echo "skip: python3 required by configure.sh/backup.sh is not available"
  exit 0
}
command -v curl >/dev/null 2>&1 || {
  echo "skip: curl required by configure.sh/backup.sh is not available"
  exit 0
}

TMP="$(mktemp -d /tmp/fep-argv-redact.XXXXXX)"
trap 'rm -rf -- "$TMP"' EXIT
chmod 700 "$TMP"
mkdir -p "$TMP/bin" "$TMP/shared/secrets"

REAL_PYTHON="$(command -v python3)"
REAL_CURL="$(command -v curl)"
cat > "$TMP/bin/python3" <<EOF
#!/usr/bin/env bash
printf '%s\n' "\$@" >> "$TMP/argv.log"
exec "$REAL_PYTHON" "\$@"
EOF
cat > "$TMP/bin/curl" <<EOF
#!/usr/bin/env bash
printf '%s\n' "\$@" >> "$TMP/argv.log"
exec "$REAL_CURL" "\$@"
EOF
chmod 700 "$TMP/bin/python3" "$TMP/bin/curl"

cat > "$TMP/shared/secrets/pocketbase.env" <<'EOF'
FEP_SUPERUSER_EMAIL=argv-probe@example.com
FEP_SUPERUSER_PASSWORD=ARGV-SENTINEL-SUPER-9f1c4d7e
FEP_BACKUP_S3_ENABLED=true
FEP_BACKUP_S3_BUCKET=argv-bucket
FEP_BACKUP_S3_ENDPOINT=https://s3.example.com
FEP_BACKUP_S3_ACCESS_KEY=ARGV-SENTINEL-AKIA-3b6e9c2a
FEP_BACKUP_S3_SECRET_KEY=ARGV-SENTINEL-SECRET-8d1f4a7c
FEP_SMTP_HOST=smtp.example.com
FEP_SMTP_PORT=587
FEP_SMTP_USERNAME=argv-probe@example.com
FEP_SMTP_PASSWORD=ARGV-SENTINEL-SMTP-5c8b2e6f
EOF
chmod 600 "$TMP/shared/secrets/pocketbase.env"

export PATH="$TMP/bin:$PATH"

# 1. configure.sh --dry-run must succeed and may not leak into argv.
FEP_ROOT="$TMP" bash deploy/configure.sh --dry-run >/dev/null 2>&1 || {
  echo "FAIL: configure.sh --dry-run failed" >&2
  exit 1
}

# 2. backup.sh must fail (unreachable PB), exercising the pre-network
#    credential build; a success would mean the harness hit a live server.
if FEP_ROOT="$TMP" PB_ADDR="http://127.0.0.1:1" bash deploy/backup.sh >/dev/null 2>&1; then
  echo "FAIL: backup.sh against unreachable PB_ADDR unexpectedly succeeded" >&2
  exit 1
fi

fail=0
for s in ARGV-SENTINEL-SUPER-9f1c4d7e ARGV-SENTINEL-AKIA-3b6e9c2a \
         ARGV-SENTINEL-SECRET-8d1f4a7c ARGV-SENTINEL-SMTP-5c8b2e6f; do
  if grep -q "$s" "$TMP/argv.log"; then
    echo "FAIL: a sentinel credential appeared in a process argument (argv.log)" >&2
    fail=1
  fi
done
if grep -q '^Authorization:' "$TMP/argv.log"; then
  echo "FAIL: an Authorization: header (auth token) appeared in a process argument" >&2
  fail=1
fi
if [[ "$fail" -eq 0 ]]; then
  echo "PASS: no credential or token appears in any captured process argument (configure.sh/backup.sh)"
fi
exit "$fail"

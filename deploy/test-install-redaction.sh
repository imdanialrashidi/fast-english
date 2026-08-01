#!/usr/bin/env bash
# Fast English Podcast — executable proof that install.sh NEVER prints the
# superuser password: not on stdout/stderr, not in --dry-run mode.
#
# Runs install.sh in --dry-run (no root, no systemd) with sentinel
# credentials in a temporary FEP_ROOT and asserts the sentinel never appears
# in the captured output, while the [REDACTED] marker is present.
#
# Skips (exit 0) when the pinned PocketBase binary is not present — CI does
# not fetch it; run scripts/setup-pocketbase.sh locally first.
set -Eeuo pipefail

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

[[ -f server/pocketbase ]] || {
  echo "skip: server/pocketbase binary not present (run scripts/setup-pocketbase.sh first)"
  exit 0
}

TMP="$(mktemp -d /tmp/fep-install-redact.XXXXXX)"
trap 'rm -rf -- "$TMP"' EXIT
mkdir -p "$TMP/shared/secrets"
cat > "$TMP/shared/secrets/pocketbase.env" <<'EOF'
FEP_SUPERUSER_EMAIL=redact-probe@example.com
FEP_SUPERUSER_PASSWORD=S3NT1NEL-SUPER-PASS-8f3a9c2d
EOF
chmod 600 "$TMP/shared/secrets/pocketbase.env"

out="$(FEP_ROOT="$TMP" bash deploy/install.sh --dry-run 2>&1)" || {
  echo "install.sh --dry-run failed:" >&2
  echo "$out" >&2
  exit 1
}

fail=0
if [[ "$out" == *"S3NT1NEL-SUPER-PASS-8f3a9c2d"* ]]; then
  echo "FAIL: superuser password leaked into install.sh output"
  fail=1
fi
if [[ "$out" != *"[REDACTED]"* ]]; then
  echo "FAIL: expected the [REDACTED] marker on the superuser upsert line"
  fail=1
fi
if [[ "$fail" -eq 0 ]]; then
  echo "PASS: install.sh output contains no sentinel secret; upsert line is redacted"
fi
exit "$fail"

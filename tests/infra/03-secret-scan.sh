#!/usr/bin/env bash
# tests/infra/03-secret-scan.sh
# Image security audit. Mounts the repository scanner script
# (tests/infra/scan-in-image.sh) read-only into each runtime image and runs
# it as the image's own (non-root) user, so the audit sees the filesystem
# exactly as the running container does.
#
# Covers the accepted audit list:
#   no .git; no .env.production; no passwords; no PocketBase superuser
#   credentials; no S3 secrets; no signing keys; no Android keystore; no
#   development databases; no Playwright artifacts; no source screenshots
#   with private data; no node_modules/build cache; no accidental
#   production receipt/user fixtures; pb_data never exists in an image.
# Fail closed: any hit fails the scan.
set -Eeuo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

require_cmd docker

SCANNER="$REPO_ROOT/tests/infra/scan-in-image.sh"
[[ -f "$SCANNER" ]] || fep_infra_fail "scanner script missing: $SCANNER"

scan_image() {
  local img="$1" label="$2"
  infra_echo "secret scan: $label ($img)"
  if docker run --rm \
      -v "$SCANNER:/scan/scan-in-image.sh:ro" \
      --entrypoint /bin/sh "$img" \
      -c 'sh /scan/scan-in-image.sh' > /tmp/fep-scan-out.$$ 2>&1; then
    echo "  PASS  $label clean"
  else
    echo "$(cat /tmp/fep-scan-out.$$)" >&2
    fep_infra_fail "secret scan FAILED for $label — see hits above"
  fi
}

scan_image "fep-infra/pocketbase:test" "pocketbase"
scan_image "fep-infra/landing:test" "landing"
scan_image "fep-infra/app:test" "app"
scan_image "fep-infra/admin:test" "admin"

echo
echo "image secret scan: ALL PASS"
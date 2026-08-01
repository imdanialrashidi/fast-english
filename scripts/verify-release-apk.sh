#!/usr/bin/env bash
# scripts/verify-release-apk.sh
# P4-S2 — Verify a signed Release APK with official Android tools and emit
# release metadata for the Landing page and P4-S3 deployment.
#
# Runs:
#   apksigner verify --verbose --print-certs
#   zipalign -c -v 4
#   aapt dump badging          (package id, version, sdk levels)
#   sha256sum
# and writes:
#   releases/release-metadata.json   (no secrets, no paths)
#   releases/RELEASE-NOTES.md        (human-readable, for P4-S3)
#
# Usage:
#   bash scripts/verify-release-apk.sh [<apk-path>] [--if-present]
#   --if-present: exit 0 with a notice when no Release APK exists yet
#                 (used by the canonical verification script, which must
#                 run without signing secrets).
#
# Exits non-zero on any verification failure. Never prints secrets.

set -Eeuo pipefail

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

RELEASE_DIR="releases"
APK_PATH="${1:-}"
IF_PRESENT=0
if [[ "${2:-}" == "--if-present" || "${1:-}" == "--if-present" ]]; then
  IF_PRESENT=1
  APK_PATH=""
fi

if [[ -z "$APK_PATH" ]]; then
  # Resolve the deterministic filename from the gradle configuration.
  VERSION_NAME_FROM_GRADLE="$(node -e "
    const fs = require('fs');
    const g = fs.readFileSync('android/app/build.gradle', 'utf8');
    process.stdout.write(g.match(/versionName\\s+\"([^\"]+)\"/)?.[1] ?? '1.0.0');
  ")"
  APK_PATH="$RELEASE_DIR/fast-english-podcast-v${VERSION_NAME_FROM_GRADLE}.apk"
fi

if [[ ! -f "$APK_PATH" ]]; then
  if [[ "$IF_PRESENT" -eq 1 ]]; then
    echo "verify-release-apk: no Release APK at $APK_PATH (skipped — requires approved signing material)"
    exit 0
  fi
  echo "Release APK not found: $APK_PATH" >&2
  exit 1
fi

# --- Android SDK tool resolution (official build-tools) ---
SDK_ROOT="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-}}"
if [[ -z "$SDK_ROOT" || ! -d "$SDK_ROOT/build-tools" ]]; then
  echo "ANDROID_HOME/ANDROID_SDK_ROOT with build-tools is required" >&2
  exit 1
fi
BT_DIR="$(ls -1 "$SDK_ROOT/build-tools" | sort -V | tail -1)"
BT="$SDK_ROOT/build-tools/$BT_DIR"
APKSIGNER="$BT/apksigner"
ZIPALIGN="$BT/zipalign"
AAPT="$BT/aapt"
for tool in "$APKSIGNER" "$ZIPALIGN" "$AAPT"; do
  if [[ ! -x "$tool" ]]; then
    echo "Missing Android tool: $tool" >&2
    exit 1
  fi
done

echo "=== apksigner verify --verbose --print-certs ==="
"$APKSIGNER" verify --verbose --print-certs "$APK_PATH"

echo ""
echo "=== zipalign -c -v 4 ==="
"$ZIPALIGN" -c -v 4 "$APK_PATH"

echo ""
echo "=== aapt dump badging ==="
BADGING="$("$AAPT" dump badging "$APK_PATH")"
echo "$BADGING"

echo ""
echo "=== sha256sum ==="
SHA256="$(sha256sum "$APK_PATH" | cut -d' ' -f1)"
echo "$SHA256  $APK_PATH"

# --- metadata ---
PACKAGE_ID="$(echo "$BADGING" | grep -oP "package: name='\K[^']+" | head -1)"
VERSION_NAME="$(echo "$BADGING" | grep -oP "versionName='\K[^']+" | head -1)"
VERSION_CODE="$(echo "$BADGING" | grep -oP "versionCode='\K[^']+" | head -1)"
MIN_SDK="$(echo "$BADGING" | grep -oP "sdkVersion:'\K[^']+" | head -1)"
TARGET_SDK="$(echo "$BADGING" | grep -oP "targetSdkVersion:'\K[^']+" | head -1)"
CERT_SHA256="$( "$APKSIGNER" verify --print-certs "$APK_PATH" | grep -oP "SHA-256 digest:\s*\K[0-9A-Fa-f:]+" | head -1 | tr 'a-f' 'A-F' )"
SIZE_BYTES="$(stat -c%s "$APK_PATH")"
BUILT_AT="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
FILE_NAME="$(basename "$APK_PATH")"

mkdir -p "$RELEASE_DIR"
METADATA="$RELEASE_DIR/release-metadata.json"
cat > "$METADATA" <<JSON
{
  "versionName": "$VERSION_NAME",
  "versionCode": $VERSION_CODE,
  "packageId": "$PACKAGE_ID",
  "fileName": "$FILE_NAME",
  "sizeBytes": $SIZE_BYTES,
  "sha256": "$SHA256",
  "signingCertificateSha256": "$CERT_SHA256",
  "minimumAndroidApi": $MIN_SDK,
  "targetAndroidApi": $TARGET_SDK,
  "builtAt": "$BUILT_AT"
}
JSON
echo ""
echo "=== release metadata ($METADATA) ==="
cat "$METADATA"

cat > "$RELEASE_DIR/RELEASE-NOTES.md" <<NOTES
# Fast English Podcast — Release ${VERSION_NAME} (${FILE_NAME})

- **Package ID:** \`${PACKAGE_ID}\`
- **Version:** ${VERSION_NAME} (versionCode ${VERSION_CODE})
- **File:** ${FILE_NAME}
- **Size:** ${SIZE_BYTES} bytes
- **SHA-256:** \`${SHA256}\`
- **Signing certificate SHA-256:** \`${CERT_SHA256}\`
- **Minimum Android:** API ${MIN_SDK}
- **Target Android:** API ${TARGET_SDK}
- **Built at:** ${BUILT_AT}

## Verification (official Android tools)
- \`apksigner verify --verbose --print-certs\` — PASS
- \`zipalign -c -v 4\` — PASS
- \`aapt dump badging\` — package/version/sdk inspection — PASS
- \`sha256sum\` — see above

## For P4-S3 (Landing download page)
- Intended public download path: \`/releases/${FILE_NAME}\` under the release
  host configured for the Landing (do NOT set \`VITE_ANDROID_APK_URL\` to a
  local path).
- Landing input values: \`VITE_ANDROID_APK_URL\` + \`VITE_ANDROID_APK_VERSION=${VERSION_NAME}\`,
  plus the SHA-256 above rendered on the page.

## Identity stability
- This APK keeps the same application ID (\`${PACKAGE_ID}\`) and signing
  certificate. Every future update MUST increase \`versionCode\`.
NOTES
echo ""
echo "=== release notes ($RELEASE_DIR/RELEASE-NOTES.md) ==="
cat "$RELEASE_DIR/RELEASE-NOTES.md"

echo ""
echo "All release verification checks passed."

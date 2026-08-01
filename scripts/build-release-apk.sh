#!/usr/bin/env bash
# scripts/build-release-apk.sh
# P4-S2 — Build the signed Release APK with the approved production key.
#
# Signing-key safety gate:
#   - The distributable Release APK is NEVER signed with the debug key and
#     is NEVER unsigned.
#   - Signing material is read from the environment (or an ignored local
#     config that exports the same variables); it is never committed.
#   - Without the variables the build FAILS SAFELY with a clear message.
#
# Workflow: build the Product App -> capacitor sync -> gradlew clean
# assembleRelease -> copy the artifact to releases/ (gitignored) with a
# deterministic filename -> verify.
#
# Usage:
#   bash scripts/build-release-apk.sh [--precheck]
#   --precheck: only validate the signing environment (fast, no build).

set -Eeuo pipefail

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

export FEP_ANDROID_KEYSTORE_PATH="${FEP_ANDROID_KEYSTORE_PATH:-}"
export FEP_ANDROID_KEY_ALIAS="${FEP_ANDROID_KEY_ALIAS:-}"
export FEP_ANDROID_KEYSTORE_PASSWORD="${FEP_ANDROID_KEYSTORE_PASSWORD:-}"
export FEP_ANDROID_KEY_PASSWORD="${FEP_ANDROID_KEY_PASSWORD:-}"

fail_signing_required() {
  cat >&2 <<'MSG'
Production signing material: REQUIRED
The Release APK must be signed with an approved production key. Set all four
variables (values stay local; never commit them):
  FEP_ANDROID_KEYSTORE_PATH=<path to .jks/.keystore>
  FEP_ANDROID_KEY_ALIAS=<key alias>
  FEP_ANDROID_KEYSTORE_PASSWORD=<store password>
  FEP_ANDROID_KEY_PASSWORD=<key password>
The debug key must never sign the distributable APK.
MSG
  exit 1
}

if [[ -z "$FEP_ANDROID_KEYSTORE_PATH" || -z "$FEP_ANDROID_KEY_ALIAS" || -z "$FEP_ANDROID_KEYSTORE_PASSWORD" || -z "$FEP_ANDROID_KEY_PASSWORD" ]]; then
  fail_signing_required
fi

if [[ ! -f "$FEP_ANDROID_KEYSTORE_PATH" ]]; then
  cat >&2 <<MSG
Production signing material: REQUIRED
FEP_ANDROID_KEYSTORE_PATH points to a missing file: $FEP_ANDROID_KEYSTORE_PATH
MSG
  exit 1
fi

if [[ "${1:-}" == "--precheck" ]]; then
  echo "Release signing environment OK (keystore: $(basename "$FEP_ANDROID_KEYSTORE_PATH"), alias: $FEP_ANDROID_KEY_ALIAS)"
  exit 0
fi

VERSION_NAME="$(node -e "
  const fs = require('fs');
  const g = fs.readFileSync('android/app/build.gradle', 'utf8');
  process.stdout.write(g.match(/versionName\\s+\"([^\"]+)\"/)?.[1] ?? '');
")"
if [[ -z "$VERSION_NAME" ]]; then
  echo "Could not read versionName from android/app/build.gradle" >&2
  exit 1
fi

APK_FILE="fast-english-podcast-v${VERSION_NAME}.apk"
RELEASE_DIR="releases"
mkdir -p "$RELEASE_DIR"

echo "=== 1/5 Product App build ==="
pnpm run build:app

echo "=== 2/5 Capacitor Android sync ==="
pnpm run android:sync

echo "=== 3/5 Gradle clean + signed assembleRelease ==="
cd android
./gradlew clean assembleRelease --no-daemon
cd "$ROOT_DIR"

echo "=== 4/5 Copy artifact ==="
SOURCE_APK="android/app/build/outputs/apk/release/app-release.apk"
if [[ ! -f "$SOURCE_APK" ]]; then
  echo "Release APK not found at $SOURCE_APK — build failed?" >&2
  exit 1
fi
cp "$SOURCE_APK" "$RELEASE_DIR/$APK_FILE"
echo "Artifact: $RELEASE_DIR/$APK_FILE ($(du -h "$RELEASE_DIR/$APK_FILE" | cut -f1))"

echo "=== 5/5 Release verification ==="
bash scripts/verify-release-apk.sh "$RELEASE_DIR/$APK_FILE"

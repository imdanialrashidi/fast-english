#!/usr/bin/env bash
# scripts/setup-pocketbase.sh
# Download the official PocketBase binary for the version pinned in
# server/VERSION. Never modify server/pb_data here. Never commit the binary.
set -Eeuo pipefail

REPO_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

VERSION="$(tr -d '[:space:]' < server/VERSION)"
if [[ -z "$VERSION" ]]; then
  echo "server/VERSION is empty" >&2
  exit 1
fi

case "$(uname -m)" in
  x86_64) ARCH=amd64 ;;
  aarch64 | arm64) ARCH=arm64 ;;
  *)
    echo "Unsupported architecture: $(uname -m)" >&2
    exit 1
    ;;
esac

ASSET="pocketbase_${VERSION}_linux_${ARCH}.zip"
URL="https://github.com/pocketbase/pocketbase/releases/download/v${VERSION}/${ASSET}"
TMP_DIR="$(mktemp -d -t pocketbase-setup-XXXXXX)"
trap 'rm -rf "$TMP_DIR"' EXIT

# The release checksum is pinned in server/pocketbase.sha256 (one line per
# linux architecture: '<sha256>  <asset-name>'). The download is verified
# against it before anything is extracted — the same contract the
# docker/pocketbase/Dockerfile enforces at image build time.
SHA_FILE="server/pocketbase.sha256"
if [[ -f "$SHA_FILE" ]]; then
  EXPECTED="$(awk -v a="$ASSET" '$2 == a {print $1}' "$SHA_FILE")"
  if [[ -z "$EXPECTED" ]]; then
    echo "No checksum for $ASSET found in $SHA_FILE" >&2
    exit 1
  fi
fi

echo "Downloading $ASSET ..."
if ! curl --fail --location --silent --show-error -o "$TMP_DIR/$ASSET" "$URL"; then
  echo "Download failed: $URL" >&2
  exit 1
fi

if [[ -n "${EXPECTED:-}" ]]; then
  ACTUAL="$(sha256sum "$TMP_DIR/$ASSET" | awk '{print $1}')"
  if [[ "$ACTUAL" != "$EXPECTED" ]]; then
    echo "Checksum mismatch for $ASSET:" >&2
    echo "  expected $EXPECTED" >&2
    echo "  actual   $ACTUAL" >&2
    exit 1
  fi
  echo "Checksum OK ($ACTUAL)"
fi

# Verify the archive contains a pocketbase binary.
if ! unzip -l "$TMP_DIR/$ASSET" 2>/dev/null | grep -q 'pocketbase$'; then
  echo "Archive does not contain a pocketbase binary" >&2
  exit 1
fi

unzip -o -q "$TMP_DIR/$ASSET" -d "$TMP_DIR/unpacked"

SRC="$TMP_DIR/unpacked/pocketbase"
if [[ ! -f "$SRC" ]]; then
  echo "Extracted binary not found at $SRC" >&2
  exit 1
fi

mkdir -p server
install -m 0755 "$SRC" server/pocketbase

INSTALLED_RAW="$(server/pocketbase --version 2>/dev/null || true)"
INSTALLED_NUM="$(printf '%s\n' "$INSTALLED_RAW" | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1 || true)"
echo "Installed PocketBase ${INSTALLED_RAW:-unknown} (parsed ${INSTALLED_NUM:-n/a}, expected ${VERSION})"

if [[ -n "$INSTALLED_NUM" && "$INSTALLED_NUM" != "$VERSION" ]]; then
  echo "Installed version does not match server/VERSION" >&2
  exit 1
fi

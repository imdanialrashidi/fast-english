#!/bin/sh
# tests/infra/scan-in-image.sh
# Runs INSIDE a runtime image (mounted read-only as /scan) to audit its
# filesystem for forbidden material. POSIX sh (busybox).
#
#   part 1 — structural: files/dirs whose very existence is forbidden in a
#            production runtime image;
#   part 2 — strings: credential-shaped content in text files only.
#
# Exit 0 = clean. On any hit prints "HIT:" lines and exits 1. Hits are
# buffered in /tmp (world-writable 1777 for the non-root runtime users),
# so subshells cannot lose them.
set -eu

HITS="/tmp/fep-scan-hits.$$"
: > "$HITS"
trap 'rm -f -- "$HITS"' EXIT HUP INT TERM

hit() { echo "HIT: $*" >> "$HITS"; }

# --- part 1: structural ------------------------------------------------------
struct() {
  for bad in "$@"; do
    for f in $(find / -xdev \( -path /proc -o -path /sys -o -path /dev \) -prune \
                 -o -name "$bad" -print 2>/dev/null | head -5); do
      hit "struct pattern=$bad path=$f"
    done
  done
}

# VCS metadata and local-only configuration
struct ".git" ".env" ".env.local" ".env.production"
# signing / secret material file names
struct "*.jks" "*.keystore" "*.p12" "*.pfx" "keystore.properties" "*.storepass" "*.keypass"
# data / artifacts that must never live in a runtime image
# (note: the Landing image intentionally contains the empty /srv/releases
# HOST mount point — content always comes from the /opt/fast-english/shared/
# releases volume; the mount point itself is allowed)
struct "pb_data" "server/pb_data" "playwright-report" "test-results"
struct "node_modules" "server/pocketbase"
# `releases` pattern: only flag copies NOT named /srv/releases
for f in $(find / -xdev \( -path /proc -o -path /sys -o -path /dev \) -prune \
             -o -type d -name releases -print 2>/dev/null | head -5); do
  case "$f" in /srv/releases|/srv/releases/*) continue ;; esac
  hit "struct pattern=releases path=$f"
done

# any leftover package manifest in a runtime image
for f in $(find / -xdev \( -path /proc -o -path /sys -o -path /dev \) -prune \
             -o -name "package.json" -print 2>/dev/null | head -20); do
  hit "struct runtime image carries package.json at $f"
done

# --- part 2: string scan over text files --------------------------------------
# Only flags credential-packed strings: private-key headers, common token
# prefixes, cloud credential IDs, and secret env ASSIGNMENTS with a value
# (env NAMES without values are legitimate and not flagged).
strings_scan() {
  root="$1"
  [ -d "$root" ] || return 0
  find "$root" -type f -size -300k \
    ! -name "*.woff2" ! -name "*.png" ! -name "*.jpg" ! -name "*.jpeg" \
    ! -name "*.webp" ! -name "*.svg" ! -name "*.gif" ! -name "*.ico" \
    ! -name "*.wasm" 2>/dev/null | while IFS= read -r f; do
      # skip binary-looking files (NUL bytes in the first 200 bytes)
      if [ "$(head -c 200 "$f" 2>/dev/null | tr -d '\000' | wc -c)" != "200" ]; then
        continue
      fi
      grep -nEH \
        -e 'BEGIN (RSA |EC |OPENSSH |DSA )?PRIVATE KEY' \
        -e 'AKIA[0-9A-Z]{16}' \
        -e 'ghp_[A-Za-z0-9]{36}' \
        -e 'gho_[A-Za-z0-9]{36}' \
        -e 'github_pat_[A-Za-z0-9_]{22,}' \
        -e 'glpat-[A-Za-z0-9_-]{20,}' \
        -e 'xox[baprs]-[A-Za-z0-9-]+' \
        -e 'COOLIFY_API_TOKEN=[^[:space:]]' \
        -e 'GHCR_PUBLISH_TOKEN=[^[:space:]]' \
        -e 'FEP_(SUPERUSER_PASSWORD|BACKUP_S3_SECRET_KEY|BACKUP_S3_ACCESS_KEY|SMTP_PASSWORD|SMTP_USERNAME|ANDROID_KEYSTORE_PASSWORD|ANDROID_KEY_PASSWORD)=[^[:space:]]' \
        -e 'PB_ENCRYPTION_KEY=[^[:space:]]' \
        "$f" 2>/dev/null | while IFS= read -r line; do
          hit "string $line"
        done
    done
}

strings_scan /pb
strings_scan /usr/share/nginx
strings_scan /etc/nginx

if [ -s "$HITS" ]; then
  cat "$HITS"
  exit 1
fi
exit 0
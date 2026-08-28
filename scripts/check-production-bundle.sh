#!/usr/bin/env bash
# Fast English Podcast — production bundle gate (P4-S3).
#
# Verifies a built release bundle (landing/ + app/) contains the configured
# production values and NO development/private material:
#   * the official APK URL and version are embedded in the landing
#   * the web app URL is the production origin
#   * no 10.0.2.2 / development IPs / dev server ports / debug APK links /
#     keystore paths / local filesystem paths / test credentials
#   * `localhost`/`127.0.0.1` occur ONLY in known-inert contexts:
#       - the PocketBase JS SDK's fallback and error message strings
#       - the Android debug-origin validation error message
#       - the landing URL validator that REJECTS loopback hosts
#
# Usage: bash scripts/check-production-bundle.sh <landing-dir> <app-dir> [<admin-dir>]
# Exit:  0 gate passed; 1 otherwise.
set -Eeuo pipefail

LANDING="${1:-dist-landing}"
APP="${2:-dist-app}"
ADMIN="${3:-dist-admin}"

fail=0
note() { echo "OK   $*"; }
bad() { echo "FAIL $*"; fail=1; }

[[ -f "$LANDING/index.html" ]] || { echo "missing $LANDING/index.html" >&2; exit 1; }
[[ -f "$APP/index.html" ]] || { echo "missing $APP/index.html" >&2; exit 1; }
[[ -f "$ADMIN/index.html" ]] || { echo "missing $ADMIN/index.html" >&2; exit 1; }

# Admin Console surface identity + no PWA artifacts (Podcast Slice 1).
if grep -q 'admin-surface' "$ADMIN/index.html"; then
  note "admin bundle carries the admin-surface marker"
else
  bad "admin bundle missing the admin-surface marker"
fi
if [[ -f "$ADMIN/sw.js" || -f "$ADMIN/manifest.webmanifest" ]]; then
  bad "admin bundle must not contain a Service Worker or manifest"
else
  note "admin bundle has no Service Worker / manifest"
fi

# --- 1. configured production values --------------------------------------
# The APK checks apply ONLY when VITE_ANDROID_APK_URL is configured at
# build time; an unconfigured build must show the honest "coming soon"
# state instead (never a fabricated or dead download link).
if [[ -n "${VITE_ANDROID_APK_URL:-}" ]]; then
  if grep -rq "$VITE_ANDROID_APK_URL" "$LANDING"; then
    note "landing embeds the official APK URL"
  else
    bad "landing does not embed the configured APK URL ($VITE_ANDROID_APK_URL)"
  fi
  if [[ -n "${VITE_ANDROID_APK_VERSION:-}" ]] && grep -rq "$VITE_ANDROID_APK_VERSION" "$LANDING/install.html" 2>/dev/null; then
    note "landing shows APK version $VITE_ANDROID_APK_VERSION"
  else
    bad "landing APK version missing"
  fi
else
  if grep -rq "نسخهٔ اندروید به‌زودی منتشر می‌شود" "$LANDING"; then
    note "landing shows the honest Android coming-soon state (no APK configured)"
  else
    bad "landing missing the honest Android coming-soon state"
  fi
  if grep -R -q 'href="[^"]*\.apk"' --include="*.html" "$LANDING"; then
    bad "landing contains an APK link without a configured official URL"
  fi
fi
if grep -rq "https://app.fastenglishpodcast.com" "$LANDING"; then
  note "landing uses the production web-app URL"
else
  bad "landing web-app URL missing"
fi

# --- 1b. release identity (version markers) -------------------------------
# Every surface must identify its deployed release from the served HTML and
# must NEVER report the pre-release 0.0.0 identity in a production build.
# The exact expected version comes from the root package.json (the single
# canonical web version; Android versionName is cross-checked separately by
# scripts/check-android-version.mjs).
PKG_VERSION="$(node -p "require('./package.json').version" 2>/dev/null || echo '0.0.0')"
if [[ "$PKG_VERSION" == "0.0.0" || ! "$PKG_VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  bad "root package.json version is not a real release version: '$PKG_VERSION'"
else
  note "root package.json version: $PKG_VERSION"
  for pair in "$APP:data-app-version" "$LANDING:data-landing-version" "$ADMIN:data-admin-version"; do
    dir="${pair%%:*}"; marker="${pair##*:}"
    if grep -rq "$marker=\"$PKG_VERSION\"" "$dir" 2>/dev/null; then
      note "$dir embeds $marker=$PKG_VERSION"
    else
      bad "$dir missing $marker=\"$PKG_VERSION\" release marker"
    fi
    if grep -rqE "$marker=\"0\.0\.0" "$dir" 2>/dev/null; then
      bad "$dir still reports the pre-release $marker=0.0.0"
    fi
  done
fi

# --- 2. hard-forbidden tokens ----------------------------------------------
HARD_FORBIDDEN=(
  '10\.0\.2\.2'
  '192\.168\.'
  ':5173'
  ':4173'
  ':5175'
  ':4175'
  'app-debug'
  '\.debug\.apk'
  'debug\.keystore'
  'keystore\.properties'
  '\.jks'
  'VITE_ANDROID_API_ORIGIN=http'
  '/home/'
  '/opt/'
  '/tmp/'
  'SmokePass'
  'FEP_SUPERUSER'
)
for dir in "$LANDING" "$APP" "$ADMIN"; do
  for pat in "${HARD_FORBIDDEN[@]}"; do
    if grep -rIqE "$pat" "$dir" 2>/dev/null; then
      bad "$dir contains forbidden pattern: $pat"
      grep -rInE "$pat" "$dir" 2>/dev/null | head -2
    fi
  done
done

# --- 3. localhost/127.0.0.1 only in known-inert contexts --------------------
# Each occurrence must match one of the allowed inert regex patterns:
#   (a) PocketBase JS SDK connection error text (contains "localhost to 127.0.0.1")
#   (b) Android debug-origin validation error message ("adb reverse")
#   (c) SDK default base-URL fallback (http://localhost; with a window object)
#   (d) landing URL validator that REJECTS loopback hosts (hostname===...)
ALLOWED_INERT=(
  'localhost to 127\.0\.0\.1'
  'native debug builds \(e\.g\. http://localhost:8090 with adb reverse\)'
  'http://localhost`;e&&\(r=e\.location\.origin'
  'e\.hostname===`(localhost|127\.0\.0\.1)`'
)
for dir in "$LANDING" "$APP" "$ADMIN"; do
  hits="$(grep -rIoE '.{0,50}(localhost|127\.0\.0\.1).{0,50}' "$dir" --include='*.js' --include='*.html' --include='*.webmanifest' 2>/dev/null || true)"
  if [[ -z "$hits" ]]; then
    note "$dir has no localhost/127.0.0.1 occurrences"
    continue
  fi
  while IFS= read -r hit; do
    ok_inert=0
    for allowed in "${ALLOWED_INERT[@]}"; do
      if [[ "$hit" =~ $allowed ]]; then ok_inert=1; break; fi
    done
    if [[ "$ok_inert" -eq 1 ]]; then
      note "$dir inert context: …$(echo "$hit" | tr -d '\n' | cut -c1-60)…"
    else
      bad "$dir UNEXPECTED localhost/127.0.0.1 occurrence: $hit"
    fi
  done <<< "$hits"
done

if [[ "$fail" -eq 0 ]]; then
  echo ""
  echo "production bundle gate: PASS"
else
  echo ""
  echo "production bundle gate: FAIL" >&2
  exit 1
fi

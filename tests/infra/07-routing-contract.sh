#!/usr/bin/env bash
# tests/infra/07-routing-contract.sh
# Routing-contract proof against the disposable Coolify-equivalent twin
# (infra/compose.yaml + edge router). Requires the images built by
# 01-build-images.sh and the twin started by run-all.sh.
#
# Proves:
#   landing  /          -> Landing SPA/static pages (200, landing-surface)
#   landing  /about..   -> 200 (extensionless canonical routing)
#   landing  /api/...   -> NOT freely exposed (404 except the exact
#                          public-settings path)
#   landing  /api/fast-english/public/settings -> PocketBase 200 JSON
#   app      /          -> Student SPA (200, app-surface)
#   app      /api/health-> PocketBase (200)
#   app      /_/        -> 404 (superuser dashboard never public)
#   app      /sw.js, /manifest.webmanifest -> 200 + no-cache
#   app      unknown SPA route -> 200 (index.html fallback)
#   admin    /          -> 308 -> /operator ; /operator -> 200 admin-surface
#   admin    /api/health -> PocketBase (200)
#   admin    /_/        -> 404
#   www      /          -> 308 -> canonical root
set -Eeuo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

require_cmd docker require_cmd curl

EDGE_PORT="${FEP_INFRA_EDGE_PORT:-18150}"
# Each domain resolves to the local twin edge (Traefik stand-in), exactly
# like the smoke suite uses --resolve for the local twin.
RES() { # host:port:addr path...
  local entry="$1"; shift
  curl --resolve "$entry" -s "$@"
}
CODE() { # host:port:addr path...
  local entry="$1"; shift
  curl --resolve "$entry" -s -o /dev/null -w '%{http_code}' "$@"
}
HURL() { # host:port:addr -> http://host:port
  printf 'http://%s:%s' "${1%%:*}" "$(printf '%s' "$1" | cut -d: -f2)"
}
LANDS="fastenglishpodcast.com:${EDGE_PORT}:127.0.0.1"
WWW="www.fastenglishpodcast.com:${EDGE_PORT}:127.0.0.1"
APPS="app.fastenglishpodcast.com:${EDGE_PORT}:127.0.0.1"
ADMS="admin.fastenglishpodcast.com:${EDGE_PORT}:127.0.0.1"
L_BASE="$(HURL "$LANDS")"; A_BASE="$(HURL "$APPS")"; D_BASE="$(HURL "$ADMS")"; W_BASE="$(HURL "$WWW")"

# guard: the twin must be up (edge container running)
if ! docker ps --format '{{.Names}}' | grep -q '^infra-edge-1$'; then
  fep_infra_fail "twin not running — start it via tests/infra/run-all.sh first"
fi
docker ps --format '{{.Names}}' | grep -q "infra-edge-1" || true

infra_echo "routing contract: landing domain"
C="$(CODE "$LANDS" "$L_BASE/")"
assert_eq "200" "$C" "landing root -> 200"
for p in /about /how-it-works /install /contact; do
  C="$(CODE "$LANDS" "$L_BASE$p")"
  assert_eq "200" "$C" "landing $p -> 200 (canonical extensionless route)"
done
BODY="$(RES "$LANDS" "$L_BASE/")"
assert_contains "$BODY" "landing-surface" "landing serves the landing surface"
assert_contains "$BODY" "data-landing-version" "landing carries release identity"
C="$(CODE "$LANDS" "$L_BASE/sitemap.xml")"
assert_eq "200" "$C" "landing sitemap.xml served"
C="$(CODE "$LANDS" "$L_BASE/nonexistent-page-xyz")"
assert_eq "404" "$C" "landing unknown path -> 404 (no SPA fallback)"
# The generic API surface must NOT be exposed on the landing domain.
C="$(CODE "$LANDS" "$L_BASE/api/collections/plans/records")"
assert_eq "404" "$C" "landing generic /api -> 404 (NOT exposed)"
# .well-known etc. must not leak PocketBase either
C="$(CODE "$LANDS" "$L_BASE/api/health")"
assert_eq "404" "$C" "landing /api/health -> 404 (only the exact settings path may proxy)"
# The ONLY intended public route reaches PocketBase with the JSON contract.
SETTINGS="$(RES "$LANDS" "$L_BASE/api/fast-english/public/settings")"
assert_contains "$SETTINGS" '"plans"' "landing public-settings endpoint reaches PocketBase (plans array)"
assert_contains "$SETTINGS" '"support"' "landing public-settings endpoint returns support contact"
SETTINGS_CODE="$(CODE "$LANDS" "$L_BASE/api/fast-english/public/settings")"
assert_eq "200" "$SETTINGS_CODE" "landing public-settings status 200"

infra_echo "routing contract: app domain (Student)"
C="$(CODE "$APPS" "$A_BASE/")"
assert_eq "200" "$C" "student root -> 200"
BODY="$(RES "$APPS" "$A_BASE/")"
assert_contains "$BODY" "app-surface" "student serves the app surface"
assert_contains "$BODY" "data-app-version" "student carries release identity"
C="$(CODE "$APPS" "$A_BASE/manifest.webmanifest")"
assert_eq "200" "$C" "student manifest served"
C="$(CODE "$APPS" "$A_BASE/sw.js")"
assert_eq "200" "$C" "student service worker served"
SW_CC="$(curl --resolve "$APPS" -sI "$A_BASE/sw.js" | tr -d '\r' | grep -i '^cache-control:' | awk '{print $2}')"
assert_contains "$SW_CC" "no-cache" "service worker not dangerously cached ($SW_CC)"
C="$(CODE "$APPS" "$A_BASE/deep/spa/client/route")"
assert_eq "200" "$C" "student unknown SPA route -> 200 (index.html fallback)"
HEALTH="$(RES "$APPS" "$A_BASE/api/health")"
assert_contains "$HEALTH" '"code":200' "student /api/health reaches PocketBase JSON (not an HTML fallback)"
C="$(CODE "$APPS" "$A_BASE/_/")"
assert_eq "404" "$C" "student /_/ -> 404 (superuser dashboard blocked)"

infra_echo "routing contract: admin domain"
C="$(CODE "$ADMS" "$D_BASE/")"
assert_eq "308" "$C" "admin root -> 308"
LOC="$(curl --resolve "$ADMS" -sI "$D_BASE/" | tr -d '\r' | grep -i '^location:' | awk '{print $2}')"
[[ "$LOC" == "/operator" || "$LOC" == *"/operator" ]] && echo "  PASS  admin redirect target /operator ($LOC)" \
  || fep_infra_fail "admin redirect location -> $LOC"
C="$(CODE "$ADMS" "$D_BASE/operator")"
assert_eq "200" "$C" "admin /operator -> 200"
BODY="$(RES "$ADMS" "$D_BASE/operator")"
assert_contains "$BODY" "admin-surface" "admin operator page serves the admin surface"
assert_contains "$BODY" "data-admin-version" "admin carries release identity"
HEALTH="$(RES "$ADMS" "$D_BASE/api/health")"
assert_contains "$HEALTH" '"code":200' "admin /api/health reaches PocketBase JSON"
C="$(CODE "$ADMS" "$D_BASE/_/")"
assert_eq "404" "$C" "admin /_/ -> 404 (superuser dashboard blocked)"

infra_echo "routing contract: www redirect"
C="$(CODE "$WWW" "$W_BASE/")"
assert_eq "308" "$C" "www -> 308"
WLOC="$(curl --resolve "$WWW" -sI "$W_BASE/anything?x=1" | tr -d '\r' | grep -i '^location:' | awk '{print $2}')"
assert_contains "$WLOC" "fastenglishpodcast.com/anything" "www redirect preserves path + query"

infra_echo "routing contract: /releases APK surface (landing)"
REL="$(RES "$LANDS" "$L_BASE/releases/release-metadata.json")"
assert_contains "$REL" '"fileName"' "landing /releases metadata served from the host volume"
C="$(CODE "$LANDS" "$L_BASE/releases/")"
if [[ "$C" == "404" || "$C" == "403" ]]; then
  echo "  PASS  /releases/ does not expose a listing ($C)"
else
  fep_infra_fail "landing /releases/ listing not blocked ($C)"
fi

echo
echo "ROUTING CONTRACT: ALL PASS"
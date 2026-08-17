#!/usr/bin/env bash
# scripts/prod-health-check.sh
# Independent public health verification against the REAL HTTPS domains
# (or the local twin when FEP_PROD_HEALTH_ROOT_* overrides are set).
# Never trusts the Coolify trigger response: this probe runs AFTER Coolify
# reports a deployment finished and validates the actual public endpoints.
#
# Checks:
#   root/landing  200 + landing release marker
#   www           308 -> canonical root
#   app           200 + app marker; /api/health -> PocketBase JSON (validates
#                 the BODY, so a Traefik "fallback to root" HTML response can
#                 never masquerade as a healthy backend)
#   admin         308 -> /operator; /operator 200 + admin marker
#   admin /api/health -> PocketBase JSON
#   landing public-settings path -> 200 JSON (exact-path route)
#   landing generic /api -> 404 (never exposed)
# Exit: 0 healthy; non-zero with the failing check identically reported.
set -Eeuo pipefail

ROOT="${FEP_PROD_HEALTH_ROOT:-https://fastenglishpodcast.com}"
WWW="${FEP_PROD_HEALTH_WWW:-https://www.fastenglishpodcast.com}"
APP="${FEP_PROD_HEALTH_APP:-https://app.fastenglishpodcast.com}"
ADMIN="${FEP_PROD_HEALTH_ADMIN:-https://admin.fastenglishpodcast.com}"
TIMEOUT="${FEP_HEALTH_TIMEOUT:-40}"

CURL=(-s --max-time "$TIMEOUT")
# Local twin mode: FEP_PROD_HEALTH_RESOLVE="host:port:ip host:port:ip" keeps the
# real hostnames while connecting to the disposable twin edge (mirrors the
# smoke suite's FEP_SMOKE_RESOLVE convention).
if [[ -n "${FEP_PROD_HEALTH_RESOLVE:-}" ]]; then
  for entry in $FEP_PROD_HEALTH_RESOLVE; do CURL+=(--resolve "$entry"); done
fi
# -k only for the targets that were explicitly overridden to plain http
[[ "$ROOT" == http://* ]] && CURL_ROOT=(-k) || CURL_ROOT=()
[[ "$APP" == http://* ]] && CURL_APP=(-k) || CURL_APP=()
[[ "$ADMIN" == http://* ]] && CURL_ADMIN=(-k) || CURL_ADMIN=()
[[ "$WWW" == http://* ]] && CURL_WWW=(-k) || CURL_WWW=()
code() { local extra="$1"; shift; curl "${CURL[@]}" ${extra} -o /dev/null -w '%{http_code}' "$@" 2>/dev/null || echo 000; }

failures=0
chk() { # label, condition-result
  if [[ "$2" == "OK" ]]; then echo "  PASS  $1"; else failures=$((failures+1)); echo "  FAIL  $1"; fi
}

echo "=== prod health: root=$ROOT app=$APP admin=$ADMIN ==="

# --- landing ---
C="$(code "${CURL_ROOT[*]:-}" "$ROOT/")"
chk "landing root -> 200" "$([ "$C" = 200 ] && echo OK || echo "got $C")"
HTML="$(curl "${CURL[@]}" ${CURL_ROOT[*]:-} -f "$ROOT/" 2>/dev/null || true)"
[ -n "$HTML" ] && case "$HTML" in *landing-surface*) chk "landing surface marker" OK ;; *) chk "landing surface marker" "missing" ;; esac
S="$(curl "${CURL[@]}" ${CURL_ROOT[*]:-} -f "$ROOT/api/fast-english/public/settings" 2>/dev/null || true)"
case "$S" in *'"plans"'*) chk "landing public-settings -> PB JSON" OK ;; *) chk "landing public-settings -> PB JSON" "bad/none" ;; esac
C="$(code "${CURL_ROOT[*]:-}" "$ROOT/api/collections/plans/records")"
chk "landing generic /api not exposed -> 404" "$([ "$C" = 404 ] && echo OK || echo "got $C")"

# --- www ---
C="$(code "${CURL_WWW[*]:-}" "$WWW/")"
chk "www -> 308 canonical redirect" "$([ "$C" = 308 ] && echo OK || echo "got $C")"

# --- app ---
C="$(code "${CURL_APP[*]:-}" "$APP/")"
chk "app root -> 200" "$([ "$C" = 200 ] && echo OK || echo "got $C")"
PAPI="$(curl "${CURL[@]}" ${CURL_APP[*]:-} -f "$APP/api/health" 2>/dev/null || true)"
case "$PAPI" in *'"code":200'*) chk "app /api/health -> real PocketBase JSON" OK ;; *) chk "app /api/health -> real PocketBase JSON" "bad/none" ;; esac
C="$(code "${CURL_APP[*]:-}" "$APP/_/")"
chk "app /_/ blocked -> 404" "$([ "$C" = 404 ] && echo OK || echo "got $C")"
C="$(code "${CURL_APP[*]:-}" "$APP/sw.js")"
chk "app service worker served" "$([ "$C" = 200 ] && echo OK || echo "got $C")"

# --- admin ---
C="$(code "${CURL_ADMIN[*]:-}" "$ADMIN/")"
chk "admin root -> 308" "$([ "$C" = 308 ] && echo OK || echo "got $C")"
C="$(code "${CURL_ADMIN[*]:-}" "$ADMIN/operator")"
chk "admin /operator -> 200" "$([ "$C" = 200 ] && echo OK || echo "got $C")"
AAPI="$(curl "${CURL[@]}" ${CURL_ADMIN[*]:-} -f "$ADMIN/api/health" 2>/dev/null || true)"
case "$AAPI" in *'"code":200'*) chk "admin /api/health -> real PocketBase JSON" OK ;; *) chk "admin /api/health -> real PocketBase JSON" "bad/none" ;; esac
C="$(code "${CURL_ADMIN[*]:-}" "$ADMIN/_/")"
chk "admin /_/ blocked -> 404" "$([ "$C" = 404 ] && echo OK || echo "got $C")"

echo ""
if [[ $failures -eq 0 ]]; then echo "PROD HEALTH: ALL PASS"; exit 0; fi
echo "PROD HEALTH: $failures check(s) FAILED" >&2
exit 1
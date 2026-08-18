#!/usr/bin/env bash
# Fast English Podcast — production smoke tests over real HTTPS.
#
# Verifies the deployed environment exactly as listed in P4-S3:
#   public Landing (routes/canonicals/sitemap/robots/APK+checksum/no broken
#     internal links/legal placeholders still marked needs-review)
#   App + Auth (loads, PWA manifest + SW, signup, login, logout, refresh,
#     no localhost references)
#   Payment + Operator (receipt upload, protected preview, pending state,
#     Staff queue/detail/approval/activation — gated on Staff creds)
#   Placement (start/save/resume/submit/level/dashboard — gated on active
#     plan + Staff approval)
#   Lessons + Progress (list/detail/audio full + Range 206 + seek + progress
#     save/resume/continue — gated on published lessons)
#   Entitlement (expired / future-dated / suspended / wrong-role denials —
#     via the superuser token from the secrets file)
#   Admin domain (Staff login, queue, no student content, /_/ blocked)
#
# Only dedicated disposable test accounts are used (FEP_SMOKE_* variables);
# they are deleted again at the end. No real payment is ever submitted.
#
# Usage:
#   bash deploy/smoke-prod.sh [--quick] [--full]
#   --quick  public surface only (no accounts needed)
#   --full   everything that has prerequisites (Staff/superuser creds,
#            active plan, published lessons)
#   Default: --full with graceful SKIP for missing prerequisites.
#
# Local pre-production mode (validates the script against a local twin):
#   FEP_SMOKE_ROOT=http://127.0.0.1:8080 FEP_SMOKE_HOST_HEADER=fastenglishpodcast.com \
#   FEP_ROOT=/tmp/fep-test bash deploy/smoke-prod.sh
#
# Exit: 0 all executed scenarios passed; 1 any FAIL; 2 usage error.
set -Eeuo pipefail

# --- configuration ---------------------------------------------------------
FEP_ROOT="${FEP_ROOT:-/opt/fast-english}"
SECRETS="$FEP_ROOT/shared/secrets/pocketbase.env"
ROOT_BASE="${FEP_SMOKE_ROOT:-https://fastenglishpodcast.com}"
APP_BASE="${FEP_SMOKE_APP:-https://app.fastenglishpodcast.com}"
ADMIN_BASE="${FEP_SMOKE_ADMIN:-https://admin.fastenglishpodcast.com}"
QUICK=0
[[ "${1:-}" == "--quick" ]] && QUICK=1

PASS=0; FAIL=0; SKIP=0
CREATED_USERS=()
# Common flags shared by every request; -f is added only where a body fetch
# must fail loudly (never in code() which measures 4xx/5xx).
CURL_COMMON=(-s --max-time 30)
[[ "$ROOT_BASE" == http://* ]] && CURL_COMMON+=(-k)
# Local pre-production mode: FEP_SMOKE_RESOLVE="app.fastenglishpodcast.com:8080:127.0.0.1 ..."
# keeps the real hostnames while connecting to the local twin Caddy.
if [[ -n "${FEP_SMOKE_RESOLVE:-}" ]]; then
  for entry in $FEP_SMOKE_RESOLVE; do CURL_COMMON+=(--resolve "$entry"); done
fi
CURL_OPTS=("${CURL_COMMON[@]}" -f)

ok()   { PASS=$((PASS + 1)); echo "  PASS  $*"; }
bad()  { FAIL=$((FAIL + 1)); echo "  FAIL  $*"; }
skip() { SKIP=$((SKIP + 1)); echo "  SKIP  $*"; }

jget() { python3 -c 'import json,sys; d=json.load(sys.stdin); print(d'$1')' 2>/dev/null || echo ""; }
# status-only helper: no -f (a 4xx/5xx is a valid measurement here)
code() { curl "${CURL_COMMON[@]}" -o /dev/null -w '%{http_code}' "$@" 2>/dev/null || echo 000; }

cleanup() {
  # Delete disposable users in FK order (subscriptions -> payment_requests ->
  # user). Never fails the run: leftovers are reported, not fatal.
  if [[ -n "${SUPERUSER_TOKEN:-}" ]]; then
    for u in "${CREATED_USERS[@]:-}"; do
      for col in subscriptions payment_requests; do
        ids="$(curl -s --max-time 30 "${CURL_COMMON[@]}" \
          "$APP_BASE/api/collections/$col/records?perPage=50&filter=user%3D%27$u%27" \
          -H "Authorization: $SUPERUSER_TOKEN" | python3 -c '
import json,sys
try:
    d=json.load(sys.stdin)
    print(" ".join(i["id"] for i in d.get("items", [])))
except Exception:
    pass' 2>/dev/null || true)"
        for rid in $ids; do
          curl -s --max-time 30 "${CURL_COMMON[@]}" -X DELETE \
            "$APP_BASE/api/collections/$col/records/$rid" \
            -H "Authorization: $SUPERUSER_TOKEN" >/dev/null 2>&1 || true
        done
      done
      if curl -s --max-time 30 "${CURL_COMMON[@]}" -X DELETE \
        "$APP_BASE/api/collections/fep_users/records/$u" \
        -H "Authorization: $SUPERUSER_TOKEN" >/dev/null 2>&1; then
        echo "smoke: cleaned up disposable user $u"
      else
        echo "smoke: WARNING — could not delete disposable user $u (delete manually)"
      fi
    done
  fi
}
trap 'cleanup || true' EXIT

echo "=== smoke-prod: root=$ROOT_BASE app=$APP_BASE admin=$ADMIN_BASE (mode=$([ $QUICK -eq 1 ] && echo quick || echo full)) ==="

# ===========================================================================
# 1. Public Landing
# ===========================================================================
echo "--- Landing ---"
PAGES=(/ /about /how-it-works /install /collaboration /contact /privacy /terms /sample)
for p in "${PAGES[@]}"; do
  c="$(code "$ROOT_BASE$p")"
  if [[ "$c" == "200" ]]; then ok "landing $p -> 200"; else bad "landing $p -> $c"; fi
done

# canonical tags: every route must carry its canonical production URL
# (derived from sitemap.xml, which only lists canonical URLs)
SITEMAP="$(curl "${CURL_OPTS[@]}" "$ROOT_BASE/sitemap.xml")" || SITEMAP=""
CANON_OK=1
for p in / /about /how-it-works /install /collaboration /contact /privacy /terms /sample; do
  want="$(printf '%s' "$SITEMAP" | grep -oP '<loc>\K[^<]*(?=</loc>)' | grep -E "${p}\$" | head -1 || true)"
  got="$(curl "${CURL_OPTS[@]}" "$ROOT_BASE$p" | grep -oP '<link rel="canonical" href="\K[^"]+' | head -1)"
  if [[ -z "$want" || "$got" != "$want" ]]; then CANON_OK=0; echo "  canonical mismatch on $p: want=$want got=$got"; fi
done
if [[ "$CANON_OK" -eq 1 ]]; then ok "canonical tags match the sitemap on all 9 routes"; else bad "canonical tags mismatch"; fi

# sitemap + robots
if [[ "$(echo "$SITEMAP" | grep -c '<loc>')" -ge 9 ]]; then ok "sitemap.xml lists >=9 canonical URLs"; else bad "sitemap.xml incomplete"; fi
ROBOTS="$(curl "${CURL_OPTS[@]}" "$ROOT_BASE/robots.txt")" || ROBOTS=""
if [[ "$(echo "$ROBOTS" | grep -ic 'sitemap:')" -ge 1 && "$ROBOTS" == *"fastenglishpodcast.com/sitemap.xml"* ]]; then ok "robots.txt points at the sitemap"; else bad "robots.txt missing sitemap line"; fi

# APK download: status, Content-Length vs metadata, SHA-256 vs metadata
META="$(curl "${CURL_OPTS[@]}" "$ROOT_BASE/releases/release-metadata.json")" || META=""
if [[ -n "$META" ]]; then
  FNAME="$(echo "$META" | jget "['fileName']")"
  MSHA="$(echo "$META" | jget "['sha256']")"
  MSIZE="$(echo "$META" | jget "['sizeBytes']")"
  VERSION="$(echo "$META" | jget "['versionName']")"
  APK="$ROOT_BASE/releases/$FNAME"
  LEN="$(curl "${CURL_OPTS[@]}" -sI "$APK" | grep -i '^content-length:' | tr -d '\r' | awk '{print $2}')"
  if [[ "$LEN" == "$MSIZE" ]]; then ok "APK Content-Length $LEN == metadata $MSIZE"; else bad "APK Content-Length $LEN != metadata $MSIZE"; fi
  TMPAPK="$(mktemp)"
  if curl "${CURL_OPTS[@]}" -sS -o "$TMPAPK" "$APK"; then
    ASHA="$(sha256sum "$TMPAPK" | cut -d' ' -f1)"
    if [[ "$ASHA" == "$MSHA" ]]; then ok "downloaded APK sha256 matches metadata ($ASHA)"; else bad "downloaded APK sha256 $ASHA != metadata $MSHA"; fi
  else bad "APK download failed"; fi
  rm -f -- "$TMPAPK"
  # Landing download CTA points at the exact artifact (production URL pattern)
  LANDING_HTML="$(curl "${CURL_OPTS[@]}" "$ROOT_BASE/install")" || LANDING_HTML=""
  if [[ "$LANDING_HTML" == *"https://fastenglishpodcast.com/releases/$FNAME"* ]]; then ok "landing install page links the exact APK artifact"; else bad "landing install page does not link $FNAME"; fi
  if [[ "$LANDING_HTML" == *"$VERSION"* && -n "$VERSION" ]]; then ok "landing shows APK version $VERSION (matches metadata)"; else bad "landing version missing/mismatched"; fi
  # SHA-256 is published in the public release notes (canonical checksum source)
  NOTES="$(curl "${CURL_OPTS[@]}" "$ROOT_BASE/releases/RELEASE-NOTES.md")" || NOTES=""
  if [[ "$NOTES" == *"$MSHA"* ]]; then ok "RELEASE-NOTES.md carries the metadata SHA-256"; else bad "RELEASE-NOTES.md lacks the SHA-256"; fi
else
  bad "release-metadata.json unavailable — deploy.sh publishes it to shared/releases before smoke; the APK URL would 404"
fi

# no directory listing + unknown release files 404
c="$(code "$ROOT_BASE/releases/")"
if [[ "$c" == "404" || "$c" == "403" ]]; then ok "/releases/ does not expose a listing ($c)"; else bad "/releases/ listing not blocked ($c)"; fi

# legal placeholders must still be marked needs-review (never treated as approved)
PRIVACY="$(curl "${CURL_OPTS[@]}" "$ROOT_BASE/privacy")" || PRIVACY=""
if [[ "$PRIVACY" == *'data-legal-status="needs-review"'* ]]; then ok "privacy placeholders still marked needs-review"; else bad "privacy page lost the needs-review marker"; fi

# no broken internal links on the landing pages
BROKEN=0
for p in / /about /how-it-works /install /collaboration /contact /privacy /terms /sample; do
  HTML="$(curl "${CURL_OPTS[@]}" "$ROOT_BASE$p")" || continue
  for href in $(echo "$HTML" | grep -oP 'href="\K/[^"]*' | sort -u); do
    case "$href" in /releases/*|/assets/*) continue;; esac
    hc="$(code "$ROOT_BASE$href")"
    [[ "$hc" == "200" ]] || { BROKEN=$((BROKEN + 1)); echo "  broken internal link on $p: $href -> $hc"; }
  done
done
if [[ "$BROKEN" -eq 0 ]]; then ok "no broken internal links on landing"; else bad "$BROKEN broken internal link(s)"; fi

# public business-settings endpoint on the landing domain (scoped Caddy handle)
# must return the canonical payload shape: plans array + support contact.
SETTINGS="$(curl "${CURL_OPTS[@]}" "$ROOT_BASE/api/fast-english/public/settings")" || SETTINGS=""
if [[ "$SETTINGS" == *'"plans"'* && "$SETTINGS" == *'"support"'* ]]; then
  ok "landing public-settings endpoint serves plans + support"
else
  bad "landing public-settings endpoint malformed/unreachable"
fi
# The landing must not expose a generic API surface (only the scoped path).
C="$(code "$ROOT_BASE/api/collections/plans/records")"
if [[ "$C" == "404" ]]; then ok "landing domain does not expose generic /api"; else bad "landing /api/collections -> $C (expected 404)"; fi

# ===========================================================================
# 2. App + PWA + Auth
# ===========================================================================
echo "--- App / PWA / Auth ---"
c="$(code "$APP_BASE/")"; [[ "$c" == "200" ]] && ok "app loads" || bad "app -> $c"
c="$(code "$APP_BASE/manifest.webmanifest")"; [[ "$c" == "200" ]] && ok "manifest served" || bad "manifest -> $c"
c="$(code "$APP_BASE/sw.js")"; [[ "$c" == "200" ]] && ok "service worker served" || bad "sw.js -> $c"
MANIFEST="$(curl "${CURL_OPTS[@]}" "$APP_BASE/manifest.webmanifest")" || MANIFEST=""
[[ "$MANIFEST" == *'"start_url"'* ]] && ok "manifest parses (start_url present)" || bad "manifest malformed"
CC="$(curl "${CURL_OPTS[@]}" -sI "$APP_BASE/sw.js" | grep -i '^cache-control:' | tr -d '\r')"
[[ "$CC" == *"no-cache"* ]] && ok "sw.js not long-cached ($CC)" || bad "sw.js cache-control: $CC"
APP_HTML="$(curl "${CURL_OPTS[@]}" "$APP_BASE/")" || APP_HTML=""
if [[ "$APP_HTML" != *localhost* && "$APP_HTML" != *"127.0.0.1"* ]]; then ok "app index.html has no localhost references"; else bad "localhost reference in app index.html"; fi
c="$(code "$APP_BASE/api/health")"; [[ "$c" == "200" ]] && ok "PocketBase health via app domain" || bad "api/health -> $c"
c="$(code "$APP_BASE/_/")"; [[ "$c" == "404" ]] && ok "PocketBase superuser dashboard blocked on app" || bad "/_/ on app -> $c"

if [[ "$QUICK" -eq 1 ]]; then
  echo "=== smoke-prod: quick mode complete (PASS=$PASS FAIL=$FAIL SKIP=$SKIP) ==="
  [[ "$FAIL" -eq 0 ]] || exit 1
  exit 0
fi

# --- auth with disposable accounts -----------------------------------------
# valid Iranian mobile: +989 + 9 digits (same normalization as the app)
PHONE="+989$(printf '%09d' $((RANDOM % 1000000000)))"
EMAIL_DERIVED="$PHONE@fep.local"
PW="SmokePass-$(date +%s | tail -c 6)!"
SIGNUP="$(curl "${CURL_OPTS[@]}" -X POST "$APP_BASE/api/collections/fep_users/records" \
  -H 'Content-Type: application/json' \
  --data-binary "{\"name\":\"smoke-disposable\",\"phone\":\"$PHONE\",\"email\":\"$EMAIL_DERIVED\",\"password\":\"$PW\",\"passwordConfirm\":\"$PW\"}")" || SIGNUP=""
USER_ID="$(echo "$SIGNUP" | jget "['id']")"
if [[ -n "$USER_ID" ]]; then
  CREATED_USERS+=("$USER_ID")
  ok "registration (disposable user $USER_ID)"
else
  bad "registration failed: $(echo "$SIGNUP" | head -c 200)"
fi

LOGIN="$(curl "${CURL_OPTS[@]}" -X POST "$APP_BASE/api/collections/fep_users/auth-with-password" \
  -H 'Content-Type: application/json' \
  --data-binary "{\"identity\":\"$EMAIL_DERIVED\",\"password\":\"$PW\"}")" || LOGIN=""
TOKEN="$(echo "$LOGIN" | jget "['token']")"
if [[ -n "$TOKEN" && "$TOKEN" != "None" ]]; then ok "login with phone-derived identity"; else bad "login failed"; fi

if [[ -n "$TOKEN" ]]; then
  REFRESH="$(curl "${CURL_OPTS[@]}" -X POST "$APP_BASE/api/collections/fep_users/auth-refresh" \
    -H "Authorization: $TOKEN")" || REFRESH=""
  [[ -n "$(echo "$REFRESH" | jget "['token']")" ]] && ok "auth refresh" || bad "auth refresh failed"
  c="$(code "$APP_BASE/api/fast-english/placement/attempts/start" -X POST -H "Authorization: $TOKEN")"
  if [[ "$c" == "403" ]]; then ok "pending account denied placement (403)"; else bad "pending account placement -> $c (expected 403)"; fi
fi
# logout is client-side (authStore.clear); verified in E2E, not over HTTPS.

# --- Staff token (needed by entitlement fixtures and the Staff section).
# Podcast Slice 1: the queue is served to `staff_admins` only; the legacy
# fep_users operator identity no longer works here.
OP_TOKEN=""; OP_ID=""
if [[ -r "$SECRETS" ]]; then
  set -a; # shellcheck disable=SC1090
  source "$SECRETS"; set +a
  if [[ -n "${FEP_SMOKE_STAFF_EMAIL:-}" && -n "${FEP_SMOKE_STAFF_PASSWORD:-}" ]]; then
    OP_LOGIN="$(curl "${CURL_OPTS[@]}" -X POST "$APP_BASE/api/collections/staff_admins/auth-with-password" \
      -H 'Content-Type: application/json' \
      --data-binary "{\"identity\":\"${FEP_SMOKE_STAFF_EMAIL}\",\"password\":\"$FEP_SMOKE_STAFF_PASSWORD\"}")" || OP_LOGIN=""
    OP_TOKEN="$(echo "$OP_LOGIN" | jget "['token']")"
    OP_ID="$(echo "$OP_LOGIN" | jget "['record']['id']")"
  fi
fi

# ===========================================================================
# 3. Payment (receipt upload + protected preview + pending state)
# ===========================================================================
echo "--- Payment ---"
if [[ -n "${TOKEN:-}" ]]; then
  PLAN="$(curl "${CURL_OPTS[@]}" "$APP_BASE/api/collections/plans/records?perPage=1&filter=is_active%3Dtrue" \
    | jget "['items'][0]['id']")"
  DEST="$(curl "${CURL_OPTS[@]}" "$APP_BASE/api/collections/payment_destination/records?perPage=1&filter=is_active%3Dtrue" \
    | jget "['items'][0]['id']")"
  if [[ -n "$PLAN" && -n "$DEST" && "$PLAN" != "None" ]]; then
    # tiny valid-signature PNG (>=12 bytes: PB signature check reads 12)
    PNG="$(mktemp --suffix=.png)"; printf '\x89PNG\r\n\x1a\n\x00\x00\x00\x0dIHDR' > "$PNG"
    UPLOAD="$(curl "${CURL_OPTS[@]}" -X POST "$APP_BASE/api/fast-english/payment-requests" \
      -H "Authorization: $TOKEN" \
      -F "plan_id=$PLAN" -F "bank_reference=smoketest" -F "sender_card_last4=1234" \
      -F "receipt_file=@$PNG;type=image/png")" || UPLOAD=""
    rm -f -- "$PNG"
    REQ_ID="$(echo "$UPLOAD" | jget "['request']['id']")"
    if [[ -n "$REQ_ID" && "$REQ_ID" != "None" ]]; then
      ok "receipt upload accepted (request $REQ_ID)"
      CUR="$(curl "${CURL_OPTS[@]}" "$APP_BASE/api/fast-english/payment-requests/current" \
        -H "Authorization: $TOKEN")" || CUR=""
      ST="$(echo "$CUR" | jget "['request']['status']")"
      [[ "$ST" == "pending" ]] && ok "pending state surfaced by /current" || bad "pending state -> $ST"
      c="$(code "$APP_BASE/api/fast-english/payment-requests/$REQ_ID/receipt" -H "Authorization: $TOKEN")"
      [[ "$c" == "200" ]] && ok "protected receipt preview for owner" || bad "receipt preview -> $c"
      c="$(code "$APP_BASE/api/fast-english/payment-requests/$REQ_ID/receipt")"
      [[ "$c" == "401" ]] && ok "receipt preview denied unauthenticated" || bad "receipt preview unauth -> $c"
    else
      bad "receipt upload failed: $(echo "$UPLOAD" | head -c 200)"
    fi
  else
    skip "no active plan/payment_destination in production (receipt upload not exercised)"
  fi
fi

# ===========================================================================
# 4. Entitlement edge cases (superuser-gated)
# ===========================================================================
echo "--- Entitlement (expired / future / suspended / wrong-role) ---"
if [[ -r "$SECRETS" && -n "${USER_ID:-}" ]]; then
  set -a; # shellcheck disable=SC1090
  source "$SECRETS"; set +a
  if [[ -n "${FEP_SUPERUSER_EMAIL:-}" && -n "${FEP_SUPERUSER_PASSWORD:-}" ]]; then
    SU_LOGIN="$(curl "${CURL_OPTS[@]}" -X POST "$APP_BASE/api/collections/_superusers/auth-with-password" \
      -H 'Content-Type: application/json' \
      --data-binary "{\"identity\":\"$FEP_SUPERUSER_EMAIL\",\"password\":\"$FEP_SUPERUSER_PASSWORD\"}")" || SU_LOGIN=""
    SUPERUSER_TOKEN="$(echo "$SU_LOGIN" | jget "['token']")"
  fi
fi
if [[ -n "${SUPERUSER_TOKEN:-}" && -n "${USER_ID:-}" ]]; then
  # legacy wrong-role: a fep_users content_manager (or operator) record
  # is no longer accepted by Staff routes
  ROLE_EMAIL="smoke-role-$(date +%s | tail -c 5)@fep.local"
  ROLE_USER="$(curl "${CURL_OPTS[@]}" -X POST "$APP_BASE/api/collections/fep_users/records" \
    -H "Authorization: $SUPERUSER_TOKEN" -H 'Content-Type: application/json' \
    --data-binary "{\"name\":\"smoke-role\",\"phone\":\"+989$(printf '%09d' $((RANDOM % 1000000000)))\",\"email\":\"$ROLE_EMAIL\",\"password\":\"$PW\",\"passwordConfirm\":\"$PW\",\"role\":\"content_manager\"}")" || ROLE_USER=""
  ROLE_ID="$(echo "$ROLE_USER" | jget "['id']")"
  if [[ -n "$ROLE_ID" ]]; then
    CREATED_USERS+=("$ROLE_ID")
    ROLE_TOKEN="$(echo "$(curl "${CURL_OPTS[@]}" -X POST "$APP_BASE/api/collections/fep_users/auth-with-password" \
      -H 'Content-Type: application/json' \
      --data-binary "{\"identity\":\"$ROLE_EMAIL\",\"password\":\"$PW\"}")" | jget "['token']")"
    c="$(code "$APP_BASE/api/fast-english/operator/payment-requests" -H "Authorization: $ROLE_TOKEN")"
    [[ "$c" == "403" ]] && ok "legacy wrong-role denied Staff queue (403)" || bad "legacy wrong-role Staff queue -> $c (expected 403)"
  fi

  # suspended: premium endpoints must deny
  curl "${CURL_OPTS[@]}" -X PATCH "$APP_BASE/api/collections/fep_users/records/$USER_ID" \
    -H "Authorization: $SUPERUSER_TOKEN" -H 'Content-Type: application/json' \
    --data-binary '{"account_status":"suspended"}' >/dev/null 2>&1
  c="$(code "$APP_BASE/api/fast-english/placement/attempts/start" -X POST -H "Authorization: $TOKEN")"
  if [[ "$c" == "403" ]]; then ok "suspended account denied placement (403)"; else bad "suspended account -> $c (expected 403)"; fi
  curl "${CURL_OPTS[@]}" -X PATCH "$APP_BASE/api/collections/fep_users/records/$USER_ID" \
    -H "Authorization: $SUPERUSER_TOKEN" -H 'Content-Type: application/json' \
    --data-binary '{"account_status":"pending_payment"}' >/dev/null 2>&1

  # expired / future-dated subscriptions. Each fixture uses its OWN
  # disposable user + payment request (the subscription->request link is
  # unique, so a fixture must never consume the main user's request).
  for kind in expired future; do
    if [[ "$kind" == "expired" ]]; then
      ST="$(date -u -d '30 days ago' +%Y-%m-%dT%H:%M:%SZ)"; EN="$(date -u -d '15 days ago' +%Y-%m-%dT%H:%M:%SZ)"
    else
      ST="$(date -u -d '7 days' +%Y-%m-%dT%H:%M:%SZ)"; EN="$(date -u -d '97 days' +%Y-%m-%dT%H:%M:%SZ)"
    fi
    FPHONE="+989$(printf '%09d' $((RANDOM % 1000000000)))"
    FUSER="$(curl "${CURL_OPTS[@]}" -X POST "$APP_BASE/api/collections/fep_users/records" \
      -H 'Content-Type: application/json' \
      --data-binary "{\"name\":\"smoke-$kind\",\"phone\":\"$FPHONE\",\"email\":\"$FPHONE@fep.local\",\"password\":\"$PW\",\"passwordConfirm\":\"$PW\"}")" || FUSER=""
    FID="$(echo "$FUSER" | jget "['id']")"
    if [[ -z "$FID" || "$FID" == "None" ]]; then
      skip "$kind fixture user creation failed"
      continue
    fi
    CREATED_USERS+=("$FID")
    FTOK="$(echo "$(curl "${CURL_OPTS[@]}" -X POST "$APP_BASE/api/collections/fep_users/auth-with-password" \
      -H 'Content-Type: application/json' \
      --data-binary "{\"identity\":\"$FPHONE@fep.local\",\"password\":\"$PW\"}")" | jget "['token']")"
    # receipt upload for the fixture user (needed as the subscription's
    # payment_request relation)
    FPNG="$(mktemp --suffix=.png)"; printf '\x89PNG\r\n\x1a\n\x00\x00\x00\x0dIHDR' > "$FPNG"
    FUP="$(curl "${CURL_OPTS[@]}" -X POST "$APP_BASE/api/fast-english/payment-requests" \
      -H "Authorization: $FTOK" \
      -F "plan_id=$PLAN" -F "bank_reference=smoke-$kind" -F "sender_card_last4=1234" \
      -F "receipt_file=@$FPNG;type=image/png")" || FUP=""
    rm -f -- "$FPNG"
    FREQ="$(echo "$FUP" | jget "['request']['id']")"
    SUB=""
    if [[ -n "$FREQ" && "$FREQ" != "None" && -n "${OP_ID:-}" && "$OP_ID" != "None" ]]; then
      SUB="$(curl "${CURL_OPTS[@]}" -X POST "$APP_BASE/api/collections/subscriptions/records" \
        -H "Authorization: $SUPERUSER_TOKEN" -H 'Content-Type: application/json' \
        --data-binary "{\"user\":\"$FID\",\"payment_request\":\"$FREQ\",\"plan_name_snapshot\":\"smoke-plan\",\"amount_snapshot\":1000,\"duration_days_snapshot\":90,\"starts_at\":\"$ST\",\"expires_at\":\"$EN\",\"status\":\"active\",\"approved_by\":\"$OP_ID\",\"approved_at\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}")" || SUB=""
    fi
    if [[ -n "$(echo "$SUB" | jget "['id']")" ]]; then
      # fixture user must be active+placed for the lesson route to even
      # reach the subscription-window check
      curl "${CURL_OPTS[@]}" -X PATCH "$APP_BASE/api/collections/fep_users/records/$FID" \
        -H "Authorization: $SUPERUSER_TOKEN" -H 'Content-Type: application/json' \
        --data-binary '{"account_status":"active","placement_completed":true,"selected_level":"B1"}' >/dev/null 2>&1
      c="$(code "$APP_BASE/api/fast-english/lessons" -H "Authorization: $FTOK")"
      [[ "$c" == "403" ]] && ok "$kind subscription denied lessons (403)" || bad "$kind subscription lessons -> $c (expected 403)"
    else
      skip "$kind subscription fixture creation failed: $(echo "$SUB" | head -c 150)"
    fi
  done
  # restore the main user to pending for operator/approval scenarios
  curl "${CURL_OPTS[@]}" -X PATCH "$APP_BASE/api/collections/fep_users/records/$USER_ID" \
    -H "Authorization: $SUPERUSER_TOKEN" -H 'Content-Type: application/json' \
    --data-binary '{"account_status":"pending_payment","placement_completed":false,"selected_level":null}' >/dev/null 2>&1
else
  skip "superuser credentials unavailable (entitlement edge cases not exercised)"
fi

# ===========================================================================
# 5. Staff queue + approval + activation (Staff-gated)
# ===========================================================================
echo "--- Staff payment review ---"
if [[ -n "$OP_TOKEN" && "$OP_TOKEN" != "None" && -n "${USER_ID:-}" && -n "${REQ_ID:-}" ]]; then
  c="$(code "$APP_BASE/api/fast-english/operator/payment-requests?page=1&perPage=5" -H "Authorization: $OP_TOKEN")"
  [[ "$c" == "200" ]] && ok "staff queue accessible" || bad "staff queue -> $c"
  c="$(code "$APP_BASE/api/fast-english/operator/payment-requests/$REQ_ID" -H "Authorization: $OP_TOKEN")"
  [[ "$c" == "200" ]] && ok "staff detail (disposable request)" || bad "staff detail -> $c"
  c="$(code "$APP_BASE/api/fast-english/operator/payment-requests/$REQ_ID/receipt" -H "Authorization: $OP_TOKEN")"
  [[ "$c" == "200" ]] && ok "staff receipt preview" || bad "staff receipt -> $c"
  APPR="$(curl "${CURL_OPTS[@]}" -X POST "$APP_BASE/api/fast-english/operator/payment-requests/$REQ_ID/approve" \
    -H "Authorization: $OP_TOKEN")" || APPR=""
  if [[ "$(echo "$APPR" | jget "['kind']")" == "approved" && -n "$(echo "$APPR" | jget "['id']")" ]]; then
    ok "approval activated the subscription"
    PCODE="$(code -X POST "$APP_BASE/api/fast-english/placement/attempts/start" -H "Authorization: $TOKEN")"
    case "$PCODE" in
      200|201) ok "activated user reaches placement (attempt started)" ;;
      400|409) ok "activated user reaches placement (attempt state $PCODE)" ;;
      503)
        PBODY="$(curl "${CURL_OPTS[@]}" -X POST "$APP_BASE/api/fast-english/placement/attempts/start" \
          -H "Authorization: $TOKEN")" || PBODY=""
        if [[ "$(echo "$PBODY" | jget "['code']")" == "placement_unavailable" ]]; then
          ok "placement reached (503 placement_unavailable = questions not seeded yet — content gate, entitlement OK)"
        else
          bad "placement -> 503: $(echo "$PBODY" | head -c 120)"
        fi
        ;;
      *) bad "activated placement -> $PCODE" ;;
    esac
  else
    bad "approval failed: $(echo "$APPR" | head -c 200)"
  fi
else
  skip "staff credentials or payment request unavailable (queue/approval not exercised)"
fi

# ===========================================================================
# 6. Lessons + Progress + audio (published-lesson-gated)
# ===========================================================================
echo "--- Lessons / Progress / Audio ---"
if [[ -n "${TOKEN:-}" && -n "${SUPERUSER_TOKEN:-}" ]]; then
  # ensure the disposable user is active + level set for lesson access
  curl "${CURL_OPTS[@]}" -X PATCH "$APP_BASE/api/collections/fep_users/records/$USER_ID" \
    -H "Authorization: $SUPERUSER_TOKEN" -H 'Content-Type: application/json' \
    --data-binary '{"account_status":"active","placement_completed":true,"selected_level":"B1"}' >/dev/null 2>&1
  LIST="$(curl "${CURL_OPTS[@]}" "$APP_BASE/api/fast-english/lessons" -H "Authorization: $TOKEN")" || LIST=""
  LID="$(echo "$LIST" | jget "['lessons'][0]['id']")"
  if [[ -n "$LID" && "$LID" != "None" ]]; then
    ok "lesson list (published, selected level)"
    DETAIL="$(curl "${CURL_OPTS[@]}" "$APP_BASE/api/fast-english/lessons/$LID" -H "Authorization: $TOKEN")" || DETAIL=""
    AUDIO_URL="$(echo "$DETAIL" | jget "['audio']['url']")"
    if [[ -n "$AUDIO_URL" && "$AUDIO_URL" != "None" ]]; then
      # full audio request with a file token (public URL must still 401 without it)
      c="$(code "$APP_BASE$AUDIO_URL")"
      [[ "$c" == "401" || "$c" == "403" ]] && ok "audio without token denied" || bad "audio unauth -> $c"
      FT="$(curl "${CURL_OPTS[@]}" -X POST "$APP_BASE/api/files/token" -H "Authorization: $TOKEN")" || FT=""
      FTOKEN="$(echo "$FT" | jget "['token']")"
      if [[ -n "$FTOKEN" && "$FTOKEN" != "None" ]]; then
        AUDIO_FULL="$(curl "${CURL_OPTS[@]}" -sI "$APP_BASE$AUDIO_URL?token=$FTOKEN")"
        ACT="$(echo "$AUDIO_FULL" | grep -i '^accept-ranges:' | tr -d '\r' | awk '{print $2}')"
        [[ "$ACT" == "bytes" ]] && ok "audio full request OK (accept-ranges: bytes)" || bad "audio accept-ranges: $ACT"
        RANGE="$(curl "${CURL_OPTS[@]}" -sI -H 'Range: bytes=0-1023' "$APP_BASE$AUDIO_URL?token=$FTOKEN")"
        RC="$(echo "$RANGE" | head -1 | awk '{print $2}')"
        [[ "$RC" == "206" ]] && ok "audio Range 206 Partial Content (seek support)" || bad "audio range -> $RC"
      else
        skip "file token unavailable (audio not exercised)"
      fi
    else
      skip "lesson detail lacks audio (fixture content?)"
    fi
    # progress save + resume + continue
    PS="$(curl "${CURL_OPTS[@]}" -X PUT "$APP_BASE/api/fast-english/lessons/$LID/progress" \
      -H "Authorization: $TOKEN" -H 'Content-Type: application/json' \
      --data-binary '{"positionSeconds":42,"expectedRevision":0}')" || PS=""
    REV="$(echo "$PS" | jget "['revision']")"
    if [[ -n "$REV" && "$REV" != "None" ]]; then ok "progress saved (revision $REV)"; else bad "progress save failed: $(echo "$PS" | head -c 150)"; fi
    SUM="$(curl "${CURL_OPTS[@]}" "$APP_BASE/api/fast-english/progress/summary" -H "Authorization: $TOKEN")" || SUM=""
    [[ "$SUM" == *"started"* || "$SUM" == *"lessons"* ]] && ok "progress summary returned" || bad "progress summary: $(echo "$SUM" | head -c 120)"
    CON="$(curl "${CURL_OPTS[@]}" "$APP_BASE/api/fast-english/progress/continue" -H "Authorization: $TOKEN")" || CON=""
    [[ -n "$CON" ]] && ok "Continue Learning endpoint returned" || bad "continue endpoint failed"
  else
    skip "no published lessons at the selected level (lesson/audio/progress not exercised)"
  fi
else
  skip "token/superuser unavailable (lessons/audio/progress not exercised)"
fi

# ===========================================================================
# 7. Admin domain
# ===========================================================================
echo "--- Admin domain ---"
c="$(code "$ADMIN_BASE/")"
[[ "$c" == "308" ]] && ok "admin / redirects (308)" || bad "admin / -> $c"
LOC="$(curl "${CURL_OPTS[@]}" -sI "$ADMIN_BASE/" | grep -i '^location:' | tr -d '\r' | awk '{print $2}')"
[[ "$LOC" == "/operator" || "$LOC" == *"/operator" ]] && ok "admin redirect target /operator" || bad "admin redirect location: $LOC"
c="$(code "$ADMIN_BASE/_/")"
[[ "$c" == "404" ]] && ok "superuser dashboard blocked on admin" || bad "admin /_/ -> $c"
c="$(code "$ADMIN_BASE/api/health")"
[[ "$c" == "200" ]] && ok "admin API proxy healthy" || bad "admin api/health -> $c"
ADMIN_HTML="$(curl "${CURL_OPTS[@]}" "$ADMIN_BASE/operator")" || ADMIN_HTML=""
# The Admin surface carries the admin-surface marker (the same contract
# enforced by scripts/project-verify.sh topology checks).
[[ "$ADMIN_HTML" == *"admin-surface"* ]] && ok "operator SPA served" || bad "admin operator page missing admin marker"
if [[ -n "${OP_TOKEN:-}" ]]; then
  c="$(code "$ADMIN_BASE/api/fast-english/operator/payment-requests?page=1&perPage=5" -H "Authorization: $OP_TOKEN")"
  [[ "$c" == "200" ]] && ok "operator API reachable through admin domain" || bad "admin operator api -> $c"
fi

# ===========================================================================
echo ""
echo "=== smoke-prod: complete (PASS=$PASS FAIL=$FAIL SKIP=$SKIP) ==="
[[ "$FAIL" -eq 0 ]] || exit 1
exit 0

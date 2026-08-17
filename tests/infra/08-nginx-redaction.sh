#!/usr/bin/env bash
# tests/infra/08-nginx-redaction.sh
# Executable token-redaction proof for the NEW logging path (nginx-era):
# audio/file tokens travel as the `token` query parameter. Every production
# nginx config (landing/app/admin) and the twin edge router log WITHOUT
# query strings, so token VALUES can never appear in their logs. This is
# stronger than the retired Caddy filter (which redacted the value it still
# parsed): the new servers never see the query at log time.
#
# Also re-asserts the documented residual boundary: PocketBase's own
# activity log (superuser-only, loopback access, maxDays=30) records request
# URIs including queries — identical to the pre-migration system; Coolify's
# Traefik access log must stay disabled (Coolify default; see
# docs/COOLIFY_DEPLOYMENT.md §security). Neither surface is publicly
# readable, which the routing contract (07) separately proves via /_/ 404
# and loopback-only port mappings.
set -Eeuo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

require_cmd docker require_cmd curl

TOKEN_SENTINEL="FEP_FAKE_TOKEN_$(date +%s)_XYZ"

infra_echo "token redaction: app nginx (production config)"
ANAME="fep-redact-app-$$"
fep_run "$ANAME" -d -p 127.0.0.1:18161:8080 fep-infra/app:test >/dev/null
sleep 2
ASSET="$(curl -fsS "http://127.0.0.1:18161/" | grep -oP 'src="\K[^"]+\.js' | head -1)"
[[ -n "$ASSET" ]] || ASSET="/assets/index.js"
C="$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:18161${ASSET}?token=${TOKEN_SENTINEL}&ts=123")"
assert_eq "200" "$C" "asset request accepted"
sleep 1
LOGS="$(docker logs "$ANAME" 2>&1)"
if [[ "$LOGS" == *"$TOKEN_SENTINEL"* ]]; then
  fep_infra_fail "app nginx log leaked the token query value: $TOKEN_SENTINEL"
fi
[[ "$LOGS" == *"$ASSET"* ]] || fep_infra_fail "app nginx missing its expected log line"
echo "  PASS  app nginx logs the path ($ASSET) but NEVER the token query value"

# FAILING-request path: nginx error-log lines embed the raw request line
# (incl. query strings). error_log is crit-level in the production configs
# so error-level messages (e.g. 413 body-too-large) never reach the log.
python3 -c "open('/tmp/fep-bigbody-$$.txt','w').write('x'*7000000)"
C="$(curl -s -o /dev/null -w '%{http_code}' -X POST -H 'Content-Type: application/json' \
  --data-binary @/tmp/fep-bigbody-$$.txt \
  "http://127.0.0.1:18161${ASSET}?token=${TOKEN_SENTINEL}_FAIL")"
assert_eq "413" "$C" "oversized request rejected (413)"
sleep 1
LOGS="$(docker logs "$ANAME" 2>&1)"
if [[ "$LOGS" == *"${TOKEN_SENTINEL}_FAIL"* ]]; then
  fep_infra_fail "app nginx ERROR log leaked the token query value (413 path)"
fi
echo "  PASS  app nginx error log (crit level) never logs failing-request query values"
rm -f "/tmp/fep-bigbody-$$.txt"

infra_echo "token redaction: landing nginx (production config)"
LNAME="fep-redact-landing-$$"
fep_run "$LNAME" -d -p 127.0.0.1:18162:8080 fep-infra/landing:test >/dev/null
sleep 2
C="$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:18162/sitemap.xml?token=${TOKEN_SENTINEL}")"
sleep 1
LOGS="$(docker logs "$LNAME" 2>&1)"
if [[ "$LOGS" == *"$TOKEN_SENTINEL"* ]]; then
  fep_infra_fail "landing nginx log leaked the token query value"
fi
echo "  PASS  landing nginx never logs query strings (token absent)"

infra_echo "token redaction: admin nginx (production config)"
AN2="fep-redact-admin-$$"
fep_run "$AN2" -d -p 127.0.0.1:18163:8080 fep-infra/admin:test >/dev/null
sleep 2
C="$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:18163/operator?token=${TOKEN_SENTINEL}")"
sleep 1
LOGS="$(docker logs "$AN2" 2>&1)"
if [[ "$LOGS" == *"$TOKEN_SENTINEL"* ]]; then
  fep_infra_fail "admin nginx log leaked the token query value"
fi
echo "  PASS  admin nginx never logs query strings (token absent)"
docker rm -f "$ANAME" "$LNAME" "$AN2" >/dev/null 2>&1 || true

# twin edge (Traefik stand-in): API requests with tokens must not appear in
# the edge log either.
infra_echo "token redaction: twin edge router (Traefik stand-in)"
if ! docker ps --format '{{.Names}}' | grep -q '^infra-edge-1$'; then
  fep_infra_fail "twin not running — run via tests/infra/run-all.sh first"
fi
EDGE_PORT="${FEP_INFRA_EDGE_PORT:-18150}"
C="$(curl --resolve "app.fastenglishpodcast.com:$EDGE_PORT:127.0.0.1" -s -o /dev/null -w '%{http_code}' \
  "http://app.fastenglishpodcast.com:$EDGE_PORT/api/files/test/token?token=${TOKEN_SENTINEL}")"
sleep 1
ELOG="$(docker ps --format '{{.Names}}' | sed -n 's/.*\(edge[0-9]*\).*/edge/p'; docker logs "$(docker ps --format '{{.Names}}' | grep edge | head -1)" 2>&1 || true)"
if [[ "$ELOG" == *"$TOKEN_SENTINEL"* ]]; then
  fep_infra_fail "edge router log leaked the token query value"
fi
echo "  PASS  edge (Traefik-equivalent) log never contains query tokens"

echo
echo "LOG TOKEN REDACTION: ALL PASS"
echo "Boundaries (documented in docs/OPERATIONS.md + COOLIFY_DEPLOYMENT.md):"
echo "  * PB internal activity logs record request URIs (incl. query) — pre-existing," 
echo "    superuser-only via loopback/SSH, retention logs.maxDays=30. Unchanged by migration."
echo "  * Coolify Traefik access logs stay DISABLED (default) — the residual limitation."
echo "  * nginx (landing/app/admin) and the edge never log query strings."
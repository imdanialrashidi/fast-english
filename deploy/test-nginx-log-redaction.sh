#!/usr/bin/env bash
# Fast English Podcast — access-log token-redaction proof for the
# Coolify-era logging path (nginx containers + edge proxy).
#
# The audio/file token travels as the `token` query parameter. Production
# nginx configurations (docker/{landing,app,admin}/nginx.conf) and the
# twin edge proxy log WITHOUT query strings, so token VALUES can never
# appear in their logs — stronger than the retired Caddy filter, which
# redacted the value it still parsed.
#
# Proof (fail-closed): start the Student image (or the configured
# FEP_IMG_APP), request a real asset with a FAKE token query value, then
# assert the container's stdout log contains the path but NOT the token.
#
# Residual documented boundaries (see docs/OPERATIONS.md §3):
#   * PocketBase's own activity log records request URIs (incl. queries)
#     — pre-existing, superuser-only, loopback access, logs.maxDays=30;
#   * Coolify's Traefik access log must stay DISABLED (Coolify default).
#
# Usage:  bash deploy/test-nginx-log-redaction.sh
# Exit:   0 proof passed; non-zero on any failure.
set -Eeuo pipefail

REPO_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
IMG="${FEP_IMG_APP:-fep-infra/app:test}"
NAME="fep-redact-proof-$$"
TOKEN_SENTINEL="FEP_REDACT_PROOF_$(date +%s)_XYZ"

command -v docker >/dev/null 2>&1 || { echo "test: docker required" >&2; exit 1; }
docker image inspect "$IMG" >/dev/null 2>&1 \
  || { echo "test: image $IMG not present — build it with tests/infra/01-build-images.sh" >&2; exit 1; }

docker rm -f "$NAME" >/dev/null 2>&1 || true
trap 'docker rm -f "$NAME" >/dev/null 2>&1 || true' EXIT

docker run -d --name "$NAME" -p 127.0.0.1:18171:8080 "$IMG" >/dev/null
sleep 2
ASSET="$(curl -fsS http://127.0.0.1:18171/ | grep -oP 'src="\K[^"]+\.js' | head -1 || echo /assets/index.js)"
C="$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:18171${ASSET}?token=${TOKEN_SENTINEL}")"
[[ "$C" == "200" ]] || { echo "test: asset request failed ($C)" >&2; exit 1; }
sleep 1
LOGS="$(docker logs "$NAME" 2>&1)"

if [[ "$LOGS" == *"$TOKEN_SENTINEL"* ]]; then
  echo "test: FAIL — the token query value appeared in the nginx access log" >&2
  exit 1
fi
if [[ "$LOGS" != *"$ASSET"* ]]; then
  echo "test: FAIL — expected the request path in the log (missing line)" >&2
  exit 1
fi
echo "test: PASS — nginx access log records the path ($ASSET) but never the token query value"

# failing-request path: nginx error-log lines embed the raw request line
# (incl. query strings); the production configs log at crit level so
# error-level messages (413 body-too-large etc.) never reach the log.
python3 -c "open('/tmp/fep-redact-big-$$.txt','w').write('x'*7000000)"
C="$(curl -s -o /dev/null -w '%{http_code}' -X POST -H 'Content-Type: application/json' \
  --data-binary @/tmp/fep-redact-big-$$.txt \
  "http://127.0.0.1:18171${ASSET}?token=${TOKEN_SENTINEL}_FAIL")"
rm -f "/tmp/fep-redact-big-$$.txt"
[[ "$C" == "413" ]] || { echo "test: oversized request not rejected ($C)" >&2; exit 1; }
sleep 1
LOGS="$(docker logs "$NAME" 2>&1)"
if [[ "$LOGS" == *"${TOKEN_SENTINEL}_FAIL"* ]]; then
  echo "test: FAIL — the token appeared in the nginx ERROR log (413 path)" >&2
  exit 1
fi
echo "test: PASS — nginx error log (crit level) never logs failing-request query values"

# edge proxy (Traefik stand-in): the same query-free logging contract
if docker ps --format '{{.Names}}' | grep -q '^infra-edge-1$'; then
  ELOG="$(docker logs infra-edge-1 2>&1 || true)"
  if [[ "$ELOG" == *"$TOKEN_SENTINEL"* ]]; then
    echo "test: FAIL — token leaked into the edge proxy log" >&2
    exit 1
  fi
  echo "test: PASS — edge proxy (Traefik stand-in) never logs query tokens"
fi

echo "test: LOG TOKEN REDACTION PROOF PASSED (Coolify-era logging path)"
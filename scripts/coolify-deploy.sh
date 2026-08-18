#!/usr/bin/env bash
# scripts/coolify-deploy.sh
# Repository-side Coolify deployment orchestrator (single surface).
#
# Used by .github/workflows/release-deploy.yml (and rollback-deploy.yml) and
# runnable locally/staging to integrate with a real Coolify instance. Uses
# the CURRENT official Coolify API contract (verified against the Coolify
# docs + controller source, coolify-docs @ v4 / Coolify Cloud):
#
#   POST /api/v1/deploy            {"uuid":"<app-uuid>","force":bool}
#        -> 200 {"message":..., "deployment_uuid": "..."}
#   GET  /api/v1/deployments/<deployment_uuid>
#        -> {"status": "queued"|"in_progress"|"finished"|"failed"|
#                          "cancelled-by-user", ...}
#
# Success is NOT declared from the trigger's HTTP 2xx alone: the deployment
# UUID is polled to a terminal state, then the caller must run the
# independent public health + smoke verification (see
# scripts/prod-health-check.sh + deploy/smoke-prod.sh). Failures are mapped
# to explicit RED outcomes with exact next actions (docs/COOLIFY_DEPLOYMENT.md
# §failure handling).
#
# Secrets never appear in process arguments or stdout: the token is read
# from COOLIFY_API_TOKEN and handed to curl through a 0600 header file.
#
# Usage:  COOLIFY_API_TOKEN=<...> \
#         FEP_COOLIFY_APP_UUID_<SURFACE>=<...> \
#         bash scripts/coolify-deploy.sh <surface> [--force]
# Surfaces: landing app admin pocketbase
# Exit:    0 finished; 1 usage/param; 2 trigger failed; 3 deployment failed;
#          4 poll timeout/connection; 5 rate-limited.
set -Eeuo pipefail

SURFACE="${1:-}"
[[ -n "$SURFACE" ]] || { echo "usage: coolify-deploy.sh <landing|app|admin|pocketbase> [--force]" >&2; exit 1; }
case "$SURFACE" in landing|app|admin|pocketbase) ;; *) echo "unknown surface: $SURFACE" >&2; exit 1 ;; esac
FORCE="false"; [[ "${2:-}" == "--force" ]] && FORCE="true"

BASE_URL="${COOLIFY_BASE_URL:-https://app.coolify.io}"
API="${BASE_URL%/}/api/v1"
TOKEN="${COOLIFY_API_TOKEN:-}"
[[ -n "$TOKEN" ]] || { echo "FATAL: COOLIFY_API_TOKEN is required (env only, never argv)" >&2; exit 1; }
UUID_VAR="FEP_COOLIFY_APP_UUID_$(printf '%s' "$SURFACE" | tr '[:lower:]' '[:upper:]')"
APP_UUID="${!UUID_VAR:-}"
[[ -n "$APP_UUID" ]] || { echo "FATAL: $UUID_VAR is required (Coolify application UUID for $SURFACE)" >&2; exit 1; }

HDR="$(mktemp /tmp/fep-coolify-hdr.XXXXXX)"
printf 'Authorization: Bearer %s\n' "$TOKEN" > "$HDR"
chmod 600 "$HDR"

POLL_TIMEOUT="${COOLIFY_POLL_TIMEOUT:-1200}"
POLL_INTERVAL="${COOLIFY_POLL_INTERVAL:-10}"

red() { echo "RED  $*" >&2; }

# --- 1. trigger ---------------------------------------------------------------
echo "deploy: triggering $SURFACE (force=$FORCE) via $API/deploy"
CURL_ERR="$(mktemp /tmp/fep-deploy-curl.XXXXXX)"
trap 'rm -f -- "$HDR" "$CURL_ERR"' EXIT
RESP="$(curl -fsS -m 90 -X POST "$API/deploy" \
  -H @"$HDR" -H 'Content-Type: application/json' \
  --data "{\"uuid\":\"$APP_UUID\",\"force\":$FORCE}" 2>"$CURL_ERR")" \
  || { red "deploy trigger FAILED for $SURFACE (exit $?): $(tail -1 "$CURL_ERR")"; exit 2; }
DEPLOYMENT_UUID="$(printf '%s' "$RESP" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("deployment_uuid") or "")' 2>/dev/null || true)"
if [[ -z "$DEPLOYMENT_UUID" ]]; then
  red "deploy trigger for $SURFACE returned no deployment_uuid: $(printf '%s' "$RESP" | head -c 300)"
  exit 2
fi
echo "deploy: $SURFACE queued as deployment $DEPLOYMENT_UUID"

# --- 2. poll to terminal state -------------------------------------------------
STATUS="queued"; elapsed=0
while true; do
  GET="$(curl -fsS -m 30 "$API/deployments/$DEPLOYMENT_UUID" -H @"$HDR" 2>/dev/null)" \
    || { red "deploy status poll FAILED for $SURFACE ($DEPLOYMENT_UUID)"; exit 4; }
  PREV="$STATUS"
  STATUS="$(printf '%s' "$GET" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("status",""))' 2>/dev/null || true)"
  [[ -n "$STATUS" ]] || STATUS="$PREV"
  [[ "$STATUS" == "$PREV" ]] || echo "deploy: $SURFACE status -> $STATUS"
  case "$STATUS" in
    finished) echo "deploy: $SURFACE FINISHED (deployment $DEPLOYMENT_UUID)"; exit 0 ;;
    failed)   red "deploy: $SURFACE FAILED — Coolify reported deployment failure (see Coolify dashboard deployment log)"; exit 3 ;;
    cancelled-by-user) red "deploy: $SURFACE CANCELLED"; exit 3 ;;
    queued|in_progress|"") : ;;
    *) red "deploy: $SURFACE unexpected status '$STATUS'"; exit 3 ;;
  esac
  elapsed=$((elapsed + POLL_INTERVAL))
  if [[ $elapsed -ge $POLL_TIMEOUT ]]; then
    red "deploy: $SURFACE poll TIMEOUT after ${elapsed}s (deployment $DEPLOYMENT_UUID still $STATUS)"
    exit 4
  fi
  sleep "$POLL_INTERVAL"
done
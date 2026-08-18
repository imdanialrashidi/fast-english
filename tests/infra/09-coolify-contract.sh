#!/usr/bin/env bash
# tests/infra/09-coolify-contract.sh
# Coolify integration contract validation (repository side):
#   1. static contract checks on the workflows + orchestrator scripts
#      (tests/infra/check-workflows.mjs) — always run;
#   2. OPTIONAL live read-only probe against a real Coolify instance when
#      COOLIFY_BASE_URL + COOLIFY_API_TOKEN are provided (staging phase).
#      The probe only reads GET endpoints (never triggers a deployment).
# Fail closed in both modes. No real credentials are ever required.
set -Eeuo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

require_cmd node

infra_echo "coolify contract: static workflow validation"
node "$(dirname "${BASH_SOURCE[0]}")/check-workflows.mjs"

if [[ -n "${COOLIFY_BASE_URL:-}" && -n "${COOLIFY_API_TOKEN:-}" ]]; then
  infra_echo "coolify contract: LIVE read-only probe"
  API="${COOLIFY_BASE_URL%/}/api/v1"
  HDR="$(mktemp /tmp/fep-coolify-contract-hdr.XXXXXX)"
  trap 'rm -f -- "$HDR"' EXIT
  printf 'Authorization: Bearer %s\n' "$COOLIFY_API_TOKEN" > "$HDR"
  chmod 600 "$HDR"

  # 1. the API responds and the token is valid
  TEAMS="$(curl -fsS -m 30 "$API/teams" -H @"$HDR")" \
    || fep_infra_fail "Coolify API /teams probe failed (is COOLIFY_BASE_URL right and the token valid?)"
  echo "  PASS  Coolify API reachable, token valid (teams: $(printf '%s' "$TEAMS" | python3 -c 'import json,sys; print(len(json.load(sys.stdin)))' 2>/dev/null || echo 'n/a'))"

  # 2. every configured application UUID resolves via the read-only endpoint
  for surface in landing app admin pocketbase; do
    var="FEP_COOLIFY_APP_UUID_$(printf '%s' "$surface" | tr '[:lower:]' '[:upper:]')"
    uuid="${!var:-}"
    if [[ -z "$uuid" ]]; then
      echo "  SKIP  $surface: ${var} not set (no live probe for this surface)"
      continue
    fi
    code="$(curl -s -o /dev/null -w '%{http_code}' -m 30 "$API/applications/$uuid" -H @"$HDR")"
    [[ "$code" == "200" ]] || fep_infra_fail "Coolify application $surface (uuid $uuid) -> HTTP $code (check the UUID)"
    echo "  PASS  Coolify application ${surface} resolves (uuid $uuid)"
  done

  # 3. deployments list endpoint readable (status shape spot-check)
  DEP="$(curl -fsS -m 30 "$API/deployments" -H @"$HDR")"
  if [[ "$DEP" == *'"status"'* || "$DEP" == "[]" || "$DEP" == *'message'* ]]; then
    echo "  PASS  Coolify /deployments endpoint readable"
  else
    echo "  WARN  /deployments response shape unexpected: $(printf '%s' "$DEP" | head -c 200)"
  fi
  echo "  NOTE  live deploy trigger + status polling is exercised in staging (never from this test)"
elif [[ -n "${COOLIFY_BASE_URL:-}" || -n "${COOLIFY_API_TOKEN:-}" ]]; then
  fep_infra_fail "COOLIFY_BASE_URL and COOLIFY_API_TOKEN must be set together for the live probe"
else
  echo "  NOTE  no Coolify credentials present — static contract validation only (live probe runs in staging)"
fi

echo
echo "COOLIFY CONTRACT: ALL PASS"
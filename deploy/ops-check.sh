#!/usr/bin/env bash
# Fast English Podcast — lightweight operational checks (manual + automatable).
# Coolify-era (docs/COOLIFY_DEPLOYMENT.md): the retired Caddy/systemd layer
# is replaced by Coolify-managed containers + Traefik, so this script
# checks the container and public-HTTPS reality instead of systemd units:
#   * PocketBase container state + restart count (docker) + loopback health
#   * public HTTPS reachability + certificates (all four domains)
#   * disk usage (root + /opt/fast-english)
#   * backup freshness (newest shared/backups zip age) + failed-backup
#     detection (PocketBase container logs)
#   * HTTP 5xx visibility from the frontend container logs
#   * optional Coolify API surface when COOLIFY_BASE_URL+COOLIFY_API_TOKEN
#     are provided (deployment/container status)
#
# Usage: bash deploy/ops-check.sh            (exit 0 healthy, 1 degraded, 2 critical)
# Run from cron for automation; stdout is the report, exit code the state.
# Container name discovery: Coolify names containers per project/environment;
# set FEP_OPS_PB_CONTAINER / FEP_OPS_FRONTEND_CONTAINERS explicitly, or let
# the script auto-detect by image name (fast-english/pocketbase, /landing, ...).
set -Eeuo pipefail

FEP_ROOT="${FEP_ROOT:-/opt/fast-english}"
BACKUPS_DIR="$FEP_ROOT/shared/backups"
DOMAINS="fastenglishpodcast.com www.fastenglishpodcast.com app.fastenglishpodcast.com admin.fastenglishpodcast.com"
HOST="${FEP_OPS_HOST:-app.fastenglishpodcast.com}"
STATE=0

warn() { echo "WARN $*"; [[ "$STATE" -lt 1 ]] && STATE=1; return 0; }
crit() { echo "CRIT $*"; STATE=2; return 0; }

echo "=== Fast English Podcast — ops check (Coolify era) ($(date -u +%Y-%m-%dT%H:%M:%SZ)) ==="

# --- containers ---------------------------------------------------------------
PB_CONTAINER="${FEP_OPS_PB_CONTAINER:-}"
if [[ -z "$PB_CONTAINER" ]]; then
  # auto-detect by IMAGE basename (container names vary per Coolify project)
  PB_CONTAINER="$(for cid in $(docker ps -q --filter "status=running" 2>/dev/null); do
                    img="$(docker inspect "$cid" --format '{{.Config.Image}}' 2>/dev/null || true)"
                    case "$img" in *pocketbase*|*"fast-english/pb"*) echo "$cid"; break ;; esac
                  done || true)"
fi
if [[ -n "$PB_CONTAINER" ]]; then
  echo "OK  pocketbase container running ($(docker inspect "$PB_CONTAINER" --format '{{.Name}}' | tr -d '/'))"
  RESTARTS="$(docker inspect "$PB_CONTAINER" --format '{{.RestartCount}}' 2>/dev/null || echo 0)"
  echo "OK  pocketbase restarts = $RESTARTS"
  [[ "$RESTARTS" -gt 10 ]] && warn "pocketbase restart count unusually high ($RESTARTS)"
else
  crit "pocketbase container NOT running"
fi

# --- public HTTPS + certificates ------------------------------------------------
for d in $DOMAINS; do
  expires="$(echo | timeout 10 openssl s_client -servername "$d" -connect "$HOST:443" 2>/dev/null \
    | openssl x509 -noout -enddate 2>/dev/null | cut -d= -f2)" || expires=""
  if [[ -z "$expires" ]]; then
    warn "certificate for $d could not be read (TLS reachability?)"
  else
    days=$(( ($(date -d "$expires" +%s) - $(date +%s)) / 86400 ))
    if [[ "$days" -lt 14 ]]; then warn "certificate for $d expires in $days days ($expires)"
    else echo "OK  certificate $d expires in $days days"; fi
  fi
done

# --- disk ---------------------------------------------------------------------
DF="$(df -P / 2>/dev/null || true)"
[[ -d "$FEP_ROOT" ]] && DF="$DF
$(df -P "$FEP_ROOT" 2>/dev/null || true)"
while read -r line; do
  [[ -n "$line" ]] || continue
  pct="$(echo "$line" | awk '{print $5}' | tr -d '%')"
  fs="$(echo "$line" | awk '{print $6}')"
  if [[ "$pct" =~ ^[0-9]+$ ]]; then
    if [[ "$pct" -ge 90 ]]; then crit "disk $fs at ${pct}%"
    elif [[ "$pct" -ge 75 ]]; then warn "disk $fs at ${pct}%"
    else echo "OK  disk $fs at ${pct}%"; fi
  fi
done <<< "$DF"

# --- backups ------------------------------------------------------------------
NEWEST="$(ls -1t "$BACKUPS_DIR"/*.zip 2>/dev/null | head -1 || true)"
if [[ -z "$NEWEST" ]]; then
  crit "no backups in $BACKUPS_DIR (backup automation failing?)"
else
  AGE_H=$(( ($(date +%s) - $(stat -c%Y "$NEWEST")) / 3600 ))
  SIZE="$(stat -c%s "$NEWEST")"
  if [[ "$AGE_H" -gt 26 ]]; then crit "newest backup is $AGE_H hours old ($NEWEST)"
  else echo "OK  newest backup $NEWEST age=${AGE_H}h size=$SIZE bytes"; fi
fi
# failed-backup detection from the PocketBase container logs (48h)
if [[ -n "$PB_CONTAINER" ]] && docker logs --since 48h "$PB_CONTAINER" 2>&1 \
  | grep -qiE "backup.*(fail|error)|failed to (create|list).*backup"; then
  crit "PocketBase backup errors found in container logs (48h)"
else
  echo "OK  no backup errors in PocketBase container logs (48h)"
fi

# --- HTTP 5xx visibility --------------------------------------------------------
# Coolify-era: frontend containers log access (no query strings by design);
# grep for 5xx status codes in the last 2000 lines of each container.
FRONTENDS="${FEP_OPS_FRONTEND_CONTAINERS:-}"
if [[ -z "$FRONTENDS" ]]; then
  FRONTENDS="$(docker ps -q --filter "status=running" 2>/dev/null \
    | while read -r cid; do
        img="$(docker inspect "$cid" --format '{{.Config.Image}}' 2>/dev/null || true)"
        case "$img" in *fast-english*landing*|*fast-english*app*|*fast-english*admin*) echo "$cid";; esac
      done || true)"
fi
ERR5=""
if [[ -n "$FRONTENDS" ]]; then
  for cid in $FRONTENDS; do
    ERR5="$ERR5$(docker logs --tail 2000 "$cid" 2>&1 | grep -E '" (5[0-9][0-9]) ' || true)"
  done
fi
if [[ -n "$ERR5" ]]; then
  n="$(echo "$ERR5" | grep -cE '5[0-9][0-9]' || true)"
  warn "$n 5xx response(s) in frontend container logs:"
  echo "$ERR5" | tail -5 | sed 's/^/  /'
else
  echo "OK  no 5xx in frontend container logs"
fi

# --- PocketBase health (loopback; the host mapping is 127.0.0.1:8090) -----------
if curl -fsS --max-time 5 http://127.0.0.1:8090/api/health >/dev/null 2>&1; then
  echo "OK  PocketBase /api/health on 127.0.0.1:8090 (loopback)"
else
  crit "PocketBase health endpoint unreachable on 127.0.0.1:8090"
fi
# public health via the edge (Traefik)
PUB="$(curl -fsS --max-time 10 "https://$HOST/api/health" 2>/dev/null || true)"
case "$PUB" in
  *'"code":200'*) echo "OK  public $HOST/api/health (real PocketBase JSON)" ;;
  *) warn "public $HOST/api/health did not return PocketBase JSON" ;;
esac

# --- optional Coolify API surface ------------------------------------------------
if [[ -n "${COOLIFY_BASE_URL:-}" && -n "${COOLIFY_API_TOKEN:-}" ]]; then
  if curl -fsS --max-time 10 -H "Authorization: Bearer $COOLIFY_API_TOKEN" \
      "${COOLIFY_BASE_URL%/}/api/v1/deployments" >/dev/null 2>&1; then
    echo "OK  Coolify API reachable (deployments list)"
  else
    warn "Coolify API unreachable/unauthenticated"
  fi
fi

echo ""
echo "ops-check state=$STATE (0 ok, 1 warn, 2 crit)"
exit "$STATE"
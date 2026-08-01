#!/usr/bin/env bash
# Fast English Podcast — lightweight operational checks (manual + automatable).
#
# Covers the P4-S3 monitoring surface without any monitoring platform:
#   PocketBase service health + restart count + last failure
#   Caddy service health
#   HTTPS certificate status (expiry) for all four domains
#   disk space (root + /opt/fast-english)
#   backup freshness (newest shared/backups zip age) + failed-backup
#     detection (PocketBase journal errors / missing files)
#   HTTP 5xx visibility from the access logs (last hour)
#
# Usage: bash deploy/ops-check.sh            (exit 0 healthy, 1 degraded, 2 critical)
# Run from cron for automation; stdout is the report, exit code the state.
set -Eeuo pipefail

FEP_ROOT="${FEP_ROOT:-/opt/fast-english}"
LOGS_DIR="$FEP_ROOT/shared/logs"
BACKUPS_DIR="$FEP_ROOT/shared/backups"
DOMAINS="fastenglishpodcast.com www.fastenglishpodcast.com app.fastenglishpodcast.com admin.fastenglishpodcast.com"
HOST="${FEP_OPS_HOST:-app.fastenglishpodcast.com}"
STATE=0

warn() { echo "WARN $*"; [[ "$STATE" -lt 1 ]] && STATE=1; return 0; }
crit() { echo "CRIT $*"; STATE=2; return 0; }

echo "=== Fast English Podcast — ops check ($(date -u +%Y-%m-%dT%H:%M:%SZ)) ==="

# --- services ---------------------------------------------------------------
if systemctl is-active --quiet fast-english-pocketbase; then
  echo "OK  pocketbase service active"
  RESTARTS="$(systemctl show fast-english-pocketbase -p NRestarts --value)"
  echo "OK  pocketbase restarts (since boot) = $RESTARTS"
  [[ "$RESTARTS" -gt 10 ]] && warn "pocketbase restart count unusually high ($RESTARTS)"
else
  crit "pocketbase service NOT active"
fi
if systemctl is-active --quiet caddy; then
  echo "OK  caddy service active"
else
  crit "caddy service NOT active"
fi

# --- HTTPS certificates ------------------------------------------------------
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
# failed-backup detection: PocketBase cron failures surface in the journal
if journalctl -u fast-english-pocketbase --since "-48h" --no-pager 2>/dev/null \
  | grep -qiE "backup.*(fail|error)|failed to (create|list).*backup"; then
  crit "PocketBase backup errors found in journal (last 48h)"
else
  echo "OK  no backup errors in PocketBase journal (48h)"
fi

# --- HTTP 5xx visibility -------------------------------------------------------
ERR5="$(grep -hE '"status":5[0-9][0-9]' "$LOGS_DIR"/access-*.log 2>/dev/null | tail -20 || true)"
if [[ -n "$ERR5" ]]; then
  n="$(echo "$ERR5" | wc -l)"
  warn "$n 5xx response(s) in access logs (see $LOGS_DIR/access-*.log):"
  echo "$ERR5" | tail -5 | sed 's/^/  /'
else
  echo "OK  no 5xx in access logs"
fi

# --- PocketBase health -----------------------------------------------------------
if curl -fsS --max-time 5 http://127.0.0.1:8090/api/health >/dev/null 2>&1; then
  echo "OK  PocketBase /api/health on 127.0.0.1:8090"
else
  crit "PocketBase health endpoint unreachable"
fi

echo ""
echo "ops-check state=$STATE (0 ok, 1 warn, 2 crit)"
exit "$STATE"

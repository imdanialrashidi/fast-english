#!/usr/bin/env bash
# tests/infra/lib.sh — shared helpers for the Fast English Coolify-era
# infrastructure verification suite. Source this file from any test.
#
# Rules enforced here (fail closed):
#   * the suite NEVER touches real production paths (/opt/fast-english) or
#     the development database (server/pb_data);
#   * every disposable directory comes from mktemp;
#   * docker containers are always removed by an EXIT trap even on failure.
set -Eeuo pipefail

REPO_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)"

# Image tags used by the whole suite (fixed local tags, never `latest`).
FEP_IMG_PB="${FEP_IMG_PB:-fep-infra/pocketbase:test}"
FEP_IMG_LANDING="${FEP_IMG_LANDING:-fep-infra/landing:test}"
FEP_IMG_APP="${FEP_IMG_APP:-fep-infra/app:test}"
FEP_IMG_ADMIN="${FEP_IMG_ADMIN:-fep-infra/admin:test}"

# Runtime identity: as root we run the images with their built-in UID/GID
# (10001 for PocketBase) and chown disposable dirs accordingly; as an
# unprivileged local user we run the container with our own UID/GID so the
# bind mount is writable without privileges. The production contract (UID
# 10001 built into the image) is additionally asserted in 02-image-verify.
CURRENT_UID="$(id -u)"
CURRENT_GID="$(id -g)"
if [[ "$CURRENT_UID" == "0" ]]; then
  PB_RUNTIME_UID="${PB_RUNTIME_UID:-10001}"
  PB_RUNTIME_GID="${PB_RUNTIME_GID:-10001}"
  PB_DOCKER_USER=()
else
  PB_RUNTIME_UID="$CURRENT_UID"
  PB_RUNTIME_GID="$CURRENT_GID"
  PB_DOCKER_USER=(--user "${CURRENT_UID}:${CURRENT_GID}")
fi

# ---------------------------------------------------------------------------
# Fail-closed guards
# ---------------------------------------------------------------------------
fep_infra_fail() { echo "INFRA-FAIL: $*" >&2; exit 1; }

# Refuse any path that could be live/production/dev data. Call with each
# candidate path before using it.
guard_never_touch() {
  local p
  for p in "$@"; do
    [[ -n "$p" ]] || continue
    local abs
    abs="$(readlink -f "$p" 2>/dev/null || echo "$p")"
    case "$abs" in
      /opt/fast-english*)
        fep_infra_fail "REFUSED: $p resolves under /opt/fast-english (production) — the infra suite never touches production"
        ;;
      "$REPO_ROOT"/server/pb_data*)
        fep_infra_fail "REFUSED: $p resolves under $REPO_ROOT/server/pb_data (development data) — the infra suite never touches dev data"
        ;;
      "$REPO_ROOT"/releases)
        fep_infra_fail "REFUSED: $p is the repository releases directory"
        ;;
    esac
    if [[ -e "$abs" && ! -d "$abs" && ! -f "$abs" ]]; then
      fep_infra_fail "REFUSED: $p is not a regular directory/file"
    fi
  done
}

# All disposable data dirs live under this root (mktemp at suite start).
FEP_INFRA_TMPDIR="${FEP_INFRA_TMPDIR:-}"
new_disposable_dir() {
  # shellcheck disable=SC2317
  local base="${FEP_INFRA_TMPDIR:-$(mktemp -d /tmp/fep-infra.XXXXXX)}"
  FEP_INFRA_TMPDIR="$base"
  mkdir -p "$base"
  local d
  d="$(mktemp -d "$base/dir.XXXXXX")"
  guard_never_touch "$d"
  echo "$d"
}

# ---------------------------------------------------------------------------
# Docker helpers
# ---------------------------------------------------------------------------
_fep_containers_created=()
fep_cleanup_containers() {
  if [[ ${#_fep_containers_created[@]} -gt 0 ]]; then
    docker rm -f "${_fep_containers_created[@]}" >/dev/null 2>&1 || true
    _fep_containers_created=()
  fi
}
# Every suite that sources this library auto-removes the containers it
# created — also on failure — so stray test containers never hold host ports.
trap 'fep_cleanup_containers' EXIT
fep_trap_push() {
  : # (kept for compatibility; the global EXIT trap above covers cleanup)
}

fep_run() {
  # docker run with auto-record for cleanup; args: name then docker args.
  local name="$1"; shift
  if docker ps -a --format '{{.Names}}' | grep -qx "$name"; then
    docker rm -f "$name" >/dev/null 2>&1 || true
  fi
  docker run --name "$name" "$@"
  _fep_containers_created+=("$name")
}

fep_wait_health() {
  local port="$1" timeout="${2:-60}" tries=0
  until curl -fsS -o /dev/null "http://127.0.0.1:${port}/api/health" 2>/dev/null; do
    tries=$((tries + 1))
    [[ $tries -ge $((timeout)) ]] && return 1
    sleep 1
  done
  return 0
}

fep_create_superuser() {
  # args: container name, data dir inside container, optional extra args
  local container="$1" datadir="${2:-/pb/pb_data}"; shift 2 || true
  local email="${FEP_INFRA_SU_EMAIL:-infra-su-$(date +%s | tail -c 6)@fep-infra.invalid}"
  local pw="Infra-SU-$(date +%s | tail -c 8)!"
  docker exec "$container" /pb/pocketbase superuser upsert "$email" "$pw" \
    --dir="$datadir" "${@:-}" >/dev/null 2>&1 \
    || fep_infra_fail "superuser upsert failed in $container"
  echo "$email $pw"
}

# ---------------------------------------------------------------------------
# Assertions (fail closed)
# ---------------------------------------------------------------------------
assert_eq() {
  local want="$1" got="$2" label="$3"
  if [[ "$want" != "$got" ]]; then
    fep_infra_fail "$label: expected '$want', got '$got'"
  fi
  echo "  PASS  $label ($got)"
}
assert_contains() {
  local hay="$1" needle="$2" label="$3"
  if [[ "$hay" != *"$needle"* ]]; then
    fep_infra_fail "$label: expected to contain '$needle'"
  fi
  echo "  PASS  $label"
}
require_cmd() {
  command -v "$1" >/dev/null 2>&1 || fep_infra_fail "required command missing: $1"
}

# print an infra-verification header
infra_echo() { echo; echo "===== $* ====="; }
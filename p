#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

if ! command -v pi >/dev/null 2>&1; then
  cat >&2 <<'MSG'
Pi is not installed.

Install the official package:
  npm install -g --ignore-scripts @earendil-works/pi-coding-agent@0.84.2
MSG
  exit 127
fi

if [[ -f "$ROOT_DIR/.pi/models.env" ]]; then
  # shellcheck disable=SC1091
  source "$ROOT_DIR/.pi/models.env"
fi

export PI_TELEMETRY="${PI_TELEMETRY:-0}"
export PI_SKIP_VERSION_CHECK="${PI_SKIP_VERSION_CHECK:-1}"
export PI_CACHE_RETENTION="${PI_CACHE_RETENTION:-long}"
export PI_EXPERIMENTAL="${PI_EXPERIMENTAL:-1}"
export PI_SMART_READ="${PI_SMART_READ:-1}"
export PI_SMART_READ_BYTES="${PI_SMART_READ_BYTES:-98304}"
export PI_SMART_READ_LINES="${PI_SMART_READ_LINES:-400}"
export PI_BLIND_RETRY_LIMIT="${PI_BLIND_RETRY_LIMIT:-2}"
export PI_CONTINUITY="${PI_CONTINUITY:-1}"
export PI_GUARD_MODE="${PI_GUARD_MODE:-autonomous}"
export PI_GUARD_FILE_SCOPE="${PI_GUARD_FILE_SCOPE:-full}"
export PI_GUARD_EXTERNAL_MUTATION="${PI_GUARD_EXTERNAL_MUTATION:-deny}"
export PI_GIT_MUTATION="${PI_GIT_MUTATION:-deny}"
export PI_PROJECT_ROOT="$ROOT_DIR"

args=(
  --tools
  "read,bash,edit,write,grep,find,ls,harness_tools"
)

case "${PI_PROJECT_TRUST:-always}" in
  always) args+=(--approve) ;;
  ask) ;;
  never) args+=(--no-approve) ;;
  *)
    printf 'PI_PROJECT_TRUST must be one of: always, ask, never\n' >&2
    exit 2
    ;;
esac

if [[ -n "${PI_MAIN_MODEL:-}" ]]; then
  args+=(--model "$PI_MAIN_MODEL")
fi

if [[ -n "${PI_MAIN_THINKING:-}" ]]; then
  args+=(--thinking "$PI_MAIN_THINKING")
fi

if [[ -n "${PI_ENABLED_MODELS:-}" ]]; then
  args+=(--models "$PI_ENABLED_MODELS")
fi

exec pi "${args[@]}" "$@"

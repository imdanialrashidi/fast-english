#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
IMAGE_NAME="${PI_SANDBOX_IMAGE:-pi-workflow-sandbox:0.84.1}"

if ! command -v docker >/dev/null 2>&1; then
  printf 'Docker is required. See https://pi.dev/docs/latest/containerization\n' >&2
  exit 127
fi

if ! docker image inspect "$IMAGE_NAME" >/dev/null 2>&1; then
  docker build --tag "$IMAGE_NAME" --file "$ROOT_DIR/Dockerfile.pi" "$ROOT_DIR"
fi

env_args=()
for name in \
  ANTHROPIC_API_KEY \
  OPENAI_API_KEY \
  GEMINI_API_KEY \
  OPENROUTER_API_KEY \
  CONTEXT7_API_KEY \
  EXA_API_KEY
do
  if [[ -n "${!name:-}" ]]; then
    env_args+=(--env "$name")
  fi
done

tty_args=()
if [[ -t 0 && -t 1 ]]; then
  tty_args=(-it)
fi

docker run --rm "${tty_args[@]}" \
  --user "$(id -u):$(id -g)" \
  --read-only \
  --cap-drop ALL \
  --security-opt no-new-privileges \
  --pids-limit "${PI_SANDBOX_PIDS:-512}" \
  --memory "${PI_SANDBOX_MEMORY:-4g}" \
  --cpus "${PI_SANDBOX_CPUS:-4}" \
  --tmpfs /tmp:rw,nosuid,nodev,size=1g,mode=1777 \
  --env HOME=/tmp/pi-home \
  --env PI_TELEMETRY=0 \
  --env "PI_GUARD_MODE=${PI_GUARD_MODE:-strict}" \
  --volume "$ROOT_DIR:/workspace" \
  --workdir /workspace \
  "${env_args[@]}" \
  "$IMAGE_NAME" "$@"

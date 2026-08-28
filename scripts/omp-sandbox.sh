#!/usr/bin/env bash
set -Eeuo pipefail
ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
IMAGE_NAME="${OMP_SANDBOX_IMAGE:-omp-workflow-sandbox:18.0.6}"
if ! command -v docker >/dev/null 2>&1; then
  printf '%s\n' 'Docker is required for this optional OS boundary; see SECURITY.md.' >&2
  exit 127
fi
if ! docker image inspect "$IMAGE_NAME" >/dev/null 2>&1; then
  docker build --tag "$IMAGE_NAME" --file "$ROOT_DIR/Dockerfile.omp" "$ROOT_DIR"
fi
env_args=()
for name in ANTHROPIC_API_KEY OPENAI_API_KEY GEMINI_API_KEY OPENROUTER_API_KEY EXA_API_KEY; do
  if [[ -n "${!name:-}" ]]; then env_args+=(--env "$name"); fi
done
tty_args=()
if [[ -t 0 && -t 1 ]]; then tty_args=(-it); fi
docker run --rm "${tty_args[@]}" \
  --user "$(id -u):$(id -g)" --read-only --cap-drop ALL \
  --security-opt no-new-privileges --pids-limit "${OMP_SANDBOX_PIDS:-256}" \
  --memory "${OMP_SANDBOX_MEMORY:-3g}" --cpus "${OMP_SANDBOX_CPUS:-2}" \
  --tmpfs /tmp:rw,nosuid,nodev,size=1g,mode=1777 \
  --env PI_CODING_AGENT_DIR=/tmp/omp-agent \
  --env XDG_CACHE_HOME=/tmp/omp-cache \
  --env OMP_GUARD_MODE=strict --env OMP_GUARD_FILE_SCOPE=repository \
  --env OMP_GIT_MUTATION=deny --env AI_PR_DELIVERY=off \
  --env OMP_GUARD_EXTERNAL_MUTATION=deny \
  --volume "$ROOT_DIR:/workspace" --workdir /workspace \
  "${env_args[@]}" "$IMAGE_NAME" --config .omp/eval.config.yml "$@"

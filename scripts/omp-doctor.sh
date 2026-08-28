#!/usr/bin/env bash
set -Eeuo pipefail
ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"
# Keep disposable test fixtures in the repository's ignored artifact area when
# the host does not expose a conventional /tmp directory.
mkdir -p "$ROOT_DIR/.artifacts/tmp"
if [[ -z "${TMPDIR:-}" || ! -d "$TMPDIR" ]]; then export TMPDIR="$ROOT_DIR/.artifacts/tmp"; fi
static=0
native=0
for argument in "$@"; do
  case "$argument" in
    --ci) ;;
    --static) static=1 ;;
    --native) native=1 ;;
    *) printf 'Unknown argument: %s\n' "$argument" >&2; exit 2 ;;
  esac
done
node scripts/validate-workflow.mjs
node scripts/validate-project-context.mjs --static
node scripts/validate-skill-evals.mjs
bash -n scripts/omp-doctor.sh scripts/omp-sandbox.sh scripts/verify.sh scripts/ci-install.sh
if [[ "$static" -eq 0 ]]; then
  node --test tests/*.test.mjs
fi
node scripts/run-workflow-evals.mjs --dry-run
if [[ "$native" -eq 1 ]]; then
  node scripts/omp-native-smoke.mjs
else
  printf '%s\n' 'NOT EXECUTED: live OMP compatibility. Run bash scripts/omp-doctor.sh --native with OMP 18.0.6 installed.'
fi

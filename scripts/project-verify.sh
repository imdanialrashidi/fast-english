#!/usr/bin/env bash
# Fast English Podcast — project-specific verification gate.
# Called by scripts/verify.sh. Run from the repository root.
#
# Does not install or modify dependencies. Does not auto-format.
# Fails on the first real failure. Preserves readable command output.
set -Eeuo pipefail

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

run() {
  printf '\n=== %s ===\n' "$*"
  "$@"
}

# 1. Strict typecheck across both surfaces and Vite configs.
run npx tsc --noEmit

# 2. Biome lint/format check (no auto-fix).
run npx biome check .

# 3. Test command (passWithNoTests is acceptable for topology-only slices).
run npx vitest run --passWithNoTests

# 4. Build both surfaces deterministically.
run npx vite build --config vite.app.config.ts
run npx vite build --config vite.landing.config.ts

# 5. Topology output verification.
printf '\n=== topology verification ===\n'

test -f dist-landing/index.html || { echo 'missing dist-landing/index.html' >&2; exit 1; }
test -f dist-app/index.html || { echo 'missing dist-app/index.html' >&2; exit 1; }

# Outputs must be distinct files.
if [[ dist-landing/index.html -ef dist-app/index.html ]]; then
  echo 'dist-landing/index.html and dist-app/index.html must be distinct files' >&2
  exit 1
fi

# Required markers.
grep -q 'app-surface' dist-app/index.html || {
  echo 'app-surface marker missing in dist-app/index.html' >&2
  exit 1
}
grep -q 'landing-surface' dist-landing/index.html || {
  echo 'landing-surface marker missing in dist-landing/index.html' >&2
  exit 1
}

# No cross-leakage of the other surface's marker into a built output.
if grep -rq 'landing-surface' dist-app/; then
  echo 'landing-surface marker leaked into dist-app bundle' >&2
  exit 1
fi
if grep -rq 'app-surface' dist-landing/; then
  echo 'app-surface marker leaked into dist-landing bundle' >&2
  exit 1
fi

printf '\nAll project verification checks passed.\n'

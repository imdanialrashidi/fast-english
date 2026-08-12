#!/usr/bin/env bash
# scripts/verify.sh
# Fast English Podcast — CI/release compatibility entry.
#
# The canonical full application gate is `pnpm verify:full`
# (scripts/verify-full.sh): scripts/project-verify.sh (typecheck + Biome +
# Vitest + all 16 real-Backend smoke suites + deterministic three-surface
# builds + topology/boundary/PWA/Android/deploy checks) followed by the full
# Playwright suite. This dispatcher stays as the compatibility entry used
# by CI and release tooling and delegates to that gate — it never silently
# downgrades to the fast lane.
set -Eeuo pipefail

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

exec bash scripts/verify-full.sh

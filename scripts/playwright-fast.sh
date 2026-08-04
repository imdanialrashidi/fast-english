#!/usr/bin/env bash
# scripts/playwright-fast.sh [--] [playwright args...]
# Low-resource local Playwright lane (PW_FAST=1): dev-mode Vite server,
# one worker, no retries, no video/trace/screenshots, no landing build.
#
# pnpm forwards `--` verbatim to package scripts, and the Playwright CLI
# ignores every argument after a literal `--`. Strip bare `--` tokens so
# `pnpm test:e2e:fast -- e2e/operator-redesign.spec.ts` filters to the
# exact spec instead of running the whole suite.
set -Eeuo pipefail

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

args=()
for a in "$@"; do
  [[ "$a" == "--" ]] && continue
  args+=("$a")
done

# `--list` (and `--last-failed` without a prior run) never executes
# global-setup, but the specs read test-results/pb-*.txt at module load.
# Placeholders let listing work on a clean tree; real runs overwrite them.
if [[ "${args[*]:-}" == *"--list"* ]]; then
  mkdir -p test-results
  [[ -f test-results/pb-url.txt ]] || : > test-results/pb-url.txt
  [[ -f test-results/pb-data-dir.txt ]] || : > test-results/pb-data-dir.txt
fi

exec env PW_FAST=1 "$ROOT_DIR/node_modules/.bin/playwright" test "${args[@]}"

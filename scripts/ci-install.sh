#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if [[ -f package.json ]]; then
  if [[ -f pnpm-lock.yaml ]]; then
    command -v corepack >/dev/null || { echo "pnpm lockfile found but corepack is unavailable" >&2; exit 1; }
    corepack enable
    pnpm install --frozen-lockfile
  elif [[ -f yarn.lock ]]; then
    command -v corepack >/dev/null || { echo "yarn lockfile found but corepack is unavailable" >&2; exit 1; }
    corepack enable
    yarn install --immutable
  elif [[ -f package-lock.json ]]; then
    npm ci
  else
    echo "A Node project must commit exactly one supported lockfile." >&2
    exit 1
  fi
fi

if [[ -f pyproject.toml || -f requirements.txt ]]; then
  python -m pip install --upgrade pip
  if [[ -f requirements.txt ]]; then
    python -m pip install -r requirements.txt
  elif command -v uv >/dev/null 2>&1 && [[ -f uv.lock ]]; then
    uv sync --frozen
  else
    python -m pip install -e .
  fi
fi

#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

# The full release gate. `pnpm verify:full` is the canonical entry point;
# this dispatcher stays as the compatibility entry used by CI and
# release tooling.
# Fast verification for local development.
if [[ -x scripts/verify-fast.sh ]]; then
  exec scripts/verify-fast.sh
fi

ran=0

run_node_script() {
  local script="$1"
  node -e "const p=require('./package.json'); process.exit(p.scripts && p.scripts['$script'] ? 0 : 1)" >/dev/null 2>&1 || return 0
  ran=1
  if [[ -f pnpm-lock.yaml ]]; then pnpm run "$script"
  elif [[ -f yarn.lock ]]; then yarn "$script"
  else npm run "$script"
  fi
}

if [[ -f package.json ]]; then
  if node -e "const p=require('./package.json'); process.exit(p.scripts && p.scripts.ci ? 0 : 1)" >/dev/null 2>&1; then
    ran=1
    if [[ -f pnpm-lock.yaml ]]; then pnpm run ci
    elif [[ -f yarn.lock ]]; then yarn ci
    else npm run ci
    fi
  else
    run_node_script "format:check"
    run_node_script "typecheck"
    run_node_script "lint"
    run_node_script "test"
    run_node_script "build"
  fi
fi

if [[ -f pyproject.toml || -f requirements.txt ]]; then
  ran=1
  python -m compileall -q -x '(^|/)(\.venv|venv|build|dist|node_modules)/' .
  command -v ruff >/dev/null 2>&1 && ruff check .
  command -v mypy >/dev/null 2>&1 && mypy .
  command -v pytest >/dev/null 2>&1 && pytest
fi

if [[ -f go.mod ]]; then
  ran=1
  unformatted="$(gofmt -l .)"
  [[ -z "$unformatted" ]] || { printf 'Unformatted Go files:\n%s\n' "$unformatted" >&2; exit 1; }
  go vet ./...
  go test ./...
fi

if [[ -f Cargo.toml ]]; then
  ran=1
  cargo fmt --all -- --check
  cargo clippy --all-targets --all-features -- -D warnings
  cargo test --all-features
fi

if [[ "$ran" -eq 0 ]]; then
  cat >&2 <<'MSG'
No supported project or verification command was found.
Add normal package scripts (format:check/typecheck/lint/test/build or ci),
or create executable scripts/project-verify.sh for this repository.
MSG
  exit 1
fi

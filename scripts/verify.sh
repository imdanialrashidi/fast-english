#!/usr/bin/env bash
# Canonical verification gate for this repository.
# DSH workflow self-checks first, then the cheapest project lane that applies.
set -Eeuo pipefail

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

TEMPLATE_ONLY=0
if [[ "${1:-}" == "--template-only" ]]; then
  TEMPLATE_ONLY=1
fi

fail=0
note() { printf '%s\n' "$1"; }
bad() { printf 'FAIL: %s\n' "$1" >&2; fail=1; }

# 1. Whitespace errors in tracked changes.
if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  git --no-pager diff --check || bad "git diff --check reported whitespace errors."
fi

# 2. Every project skill needs matching kebab-case name + description frontmatter
#    (DSH discovery drops a skill whose name or description is invalid).
for skill in .dsh/skills/*/SKILL.md; do
  [[ -f "$skill" ]] || continue
  dir="$(basename "$(dirname "$skill")")"
  front="$(sed -n '1,/^---$/p' "$skill" | sed '1d;$d')"
  name="$(printf '%s\n' "$front" | sed -n 's/^name:[[:space:]]*//p' | head -n 1 | tr -d "\"'")"
  [[ -n "$name" ]] || bad "$skill is missing frontmatter name."
  [[ "$name" == "$dir" ]] || bad "$skill frontmatter name '$name' does not match directory '$dir'."
  [[ "$name" =~ ^[a-z0-9]+(-[a-z0-9]+)*$ ]] || bad "$skill name is not kebab-case."
  grep -Eq '^description: .+' <<<"$front" || bad "$skill is missing frontmatter description."
done

# 3. Workflow entry points must exist and be non-empty.
for file in AGENTS.md docs/WORKFLOW.md docs/REVIEW-POLICY.md docs/QUALITY.md docs/GIT_POLICY.md; do
  [[ -s "$file" ]] || bad "missing or empty workflow file: $file."
done

# 4. Scoped delivery helper must parse.
if command -v node >/dev/null 2>&1; then
  node --check scripts/pr-deliver.mjs || bad "scripts/pr-deliver.mjs does not parse."
else
  note "SKIP: node not installed; cannot syntax-check scripts/pr-deliver.mjs."
fi

[[ "$fail" -eq 0 ]] || exit 1
note "Workflow self-checks passed."

if [[ "$TEMPLATE_ONLY" -eq 1 ]]; then
  exit 0
fi

# 5. Project override wins when the repo defines its own gate.
if [[ -x scripts/project-verify.sh ]]; then
  exec scripts/project-verify.sh
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
  if grep -Fxq -- '- Primary users:' docs/PRODUCT.md; then
    printf '\nTemplate-only verification passed. Fill docs/PRODUCT.md on the first /spec.\n'
    exit 0
  fi
  cat >&2 <<'MSG'
No supported project or verification command was found.
Add normal package scripts (format:check/typecheck/lint/test/build or ci),
or create executable scripts/project-verify.sh for this repository.
MSG
  exit 1
fi

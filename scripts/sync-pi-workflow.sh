#!/usr/bin/env bash
set -Eeuo pipefail
IFS=$'\n\t'

SCRIPT_NAME="${0##*/}"
TEMPLATE_REPO="${PI_WORKFLOW_TEMPLATE_REPO:-imdanialrashidi/pi-production-workflow-template}"
TEMPLATE_REF="${PI_WORKFLOW_TEMPLATE_REF:-main}"
TARGET=""
SOURCE_DIR=""
MODE="dry-run"
RUN_BOOTSTRAP=0
ALLOW_DIRTY=0
MAKE_BACKUP=1
RUN_VALIDATION=1
RUN_FULL_VERIFY=0
TMP_DIR=""
SOURCE_ROOT=""
SOURCE_SHA="local"
BACKUP_FILE=""

if [[ -t 1 && -z "${NO_COLOR:-}" ]]; then
  BOLD=$'\033[1m'; DIM=$'\033[2m'; RED=$'\033[31m'; GREEN=$'\033[32m'; YELLOW=$'\033[33m'; BLUE=$'\033[34m'; RESET=$'\033[0m'
else
  BOLD=""; DIM=""; RED=""; GREEN=""; YELLOW=""; BLUE=""; RESET=""
fi

log()     { printf '%s\n' "${BLUE}→${RESET} $*"; }
ok()      { printf '%s\n' "${GREEN}✓${RESET} $*"; }
warn()    { printf '%s\n' "${YELLOW}!${RESET} $*" >&2; }
die()     { printf '%s\n' "${RED}✗${RESET} $*" >&2; exit 1; }
section() { printf '\n%s%s%s\n' "$BOLD" "$*" "$RESET"; }

usage() {
  cat <<USAGE
${BOLD}Pi workflow synchronizer${RESET}

Usage:
  $SCRIPT_NAME [options]

Safe default: preview only. Use --apply to modify the working tree.

Options:
  --target DIR             Target project (default: current Git repository root)
  --template-repo O/R      Workflow template repository
                           (default: $TEMPLATE_REPO)
  --ref REF                Template branch/tag/SHA (default: $TEMPLATE_REF)
  --source-dir DIR         Use a local template checkout; no network download
  --dry-run                Preview changes only (default)
  --apply                  Apply the synchronization
  --bootstrap              After sync, run Pi /bootstrap to reconcile project-specific adaptation
  --allow-dirty            Permit an already-dirty target working tree
  --no-backup              Do not create the pre-change backup (not recommended)
  --skip-validation        Skip deterministic harness validation
  --full-verify            Also run the project's scripts/verify.sh after harness validation
  -h, --help               Show this help

Examples:
  $SCRIPT_NAME
  $SCRIPT_NAME --apply
  $SCRIPT_NAME --apply --bootstrap
  $SCRIPT_NAME --source-dir ../pi-production-workflow-template --apply --bootstrap

What is preserved deterministically:
  - .pi/verification.json
  - scripts/verify.sh
  - scripts/ci-install.sh
  - .github/workflows/**
  - project-specific product/architecture/design/plan docs
  - root application files such as package.json, README.md, .gitignore, source code

The script never commits, stages, fetches, pulls, pushes, switches branches, or opens/updates PRs.
USAGE
}

cleanup() {
  if [[ -n "$TMP_DIR" && -d "$TMP_DIR" ]]; then
    rm -rf "$TMP_DIR"
  fi
}

on_error() {
  local exit_code=$?
  local line_no=${1:-?}
  trap - ERR
  printf '\n%s✗ Synchronization stopped at line %s (exit %s).%s\n' "$RED" "$line_no" "$exit_code" "$RESET" >&2
  if [[ -n "$BACKUP_FILE" && -f "$BACKUP_FILE" && -n "$TARGET" ]]; then
    printf '%sRecovery backup:%s %s\n' "$YELLOW" "$RESET" "$BACKUP_FILE" >&2
    printf 'Restore with: tar -xzf %q -C %q\n' "$BACKUP_FILE" "$TARGET" >&2
  fi
  exit "$exit_code"
}
trap 'on_error $LINENO' ERR
trap cleanup EXIT

while (($#)); do
  case "$1" in
    --target)          [[ $# -ge 2 ]] || die "--target needs a directory"; TARGET=$2; shift 2 ;;
    --template-repo)   [[ $# -ge 2 ]] || die "--template-repo needs owner/repo"; TEMPLATE_REPO=$2; shift 2 ;;
    --ref)             [[ $# -ge 2 ]] || die "--ref needs a branch/tag/SHA"; TEMPLATE_REF=$2; shift 2 ;;
    --source-dir)      [[ $# -ge 2 ]] || die "--source-dir needs a directory"; SOURCE_DIR=$2; shift 2 ;;
    --dry-run)         MODE="dry-run"; shift ;;
    --apply)           MODE="apply"; shift ;;
    --bootstrap)       RUN_BOOTSTRAP=1; shift ;;
    --allow-dirty)     ALLOW_DIRTY=1; shift ;;
    --no-backup)       MAKE_BACKUP=0; shift ;;
    --skip-validation) RUN_VALIDATION=0; shift ;;
    --full-verify)     RUN_FULL_VERIFY=1; shift ;;
    -h|--help)         usage; exit 0 ;;
    *)                  die "Unknown option: $1 (use --help)" ;;
  esac
done

command -v git >/dev/null 2>&1 || die "git is required"
command -v tar >/dev/null 2>&1 || die "tar is required"

if [[ -z "$TARGET" ]]; then
  TARGET="$(git rev-parse --show-toplevel 2>/dev/null || true)"
  [[ -n "$TARGET" ]] || die "Run this from the target Git repository or pass --target DIR"
fi
TARGET="$(cd "$TARGET" && pwd -P)"
git -C "$TARGET" rev-parse --is-inside-work-tree >/dev/null 2>&1 || die "Target is not a Git working tree: $TARGET"

CURRENT_BRANCH="$(git -C "$TARGET" symbolic-ref --quiet --short HEAD 2>/dev/null || printf 'detached')"
CURRENT_HEAD="$(git -C "$TARGET" rev-parse --short=12 HEAD 2>/dev/null || printf 'unborn')"
DIRTY_STATE="$(git -C "$TARGET" status --porcelain=v1 --untracked-files=normal)"
if [[ -n "$DIRTY_STATE" && $ALLOW_DIRTY -eq 0 && "$MODE" == "apply" ]]; then
  printf '%s\n' "$DIRTY_STATE" >&2
  die "Target already has uncommitted/untracked changes. Re-run with --allow-dirty only if you intentionally want to layer the workflow sync on top."
fi

urlencode() {
  local s="$1" out="" c i
  for ((i=0; i<${#s}; i++)); do
    c=${s:i:1}
    case "$c" in
      [a-zA-Z0-9.~_-]) out+="$c" ;;
      *) printf -v c '%%%02X' "'$c"; out+="$c" ;;
    esac
  done
  printf '%s' "$out"
}

fetch_template() {
  if [[ -n "$SOURCE_DIR" ]]; then
    SOURCE_ROOT="$(cd "$SOURCE_DIR" && pwd -P)"
    if git -C "$SOURCE_ROOT" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
      SOURCE_SHA="$(git -C "$SOURCE_ROOT" rev-parse HEAD 2>/dev/null || printf 'local')"
    fi
    return
  fi

  command -v curl >/dev/null 2>&1 || die "curl is required when --source-dir is not used"
  TMP_DIR="$(mktemp -d "${TMPDIR:-/tmp}/pi-workflow-sync.XXXXXX")"
  local api_ref api_url auth=() json sha archive extract_dir
  api_ref="$(urlencode "$TEMPLATE_REF")"
  api_url="https://api.github.com/repos/${TEMPLATE_REPO}/commits/${api_ref}"
  if [[ -n "${GITHUB_TOKEN:-}" ]]; then
    auth=(-H "Authorization: Bearer ${GITHUB_TOKEN}")
  fi

  log "Resolving ${TEMPLATE_REPO}@${TEMPLATE_REF}"
  json="$(curl -fsSL --retry 3 --retry-delay 1 \
    -H 'Accept: application/vnd.github+json' \
    -H 'X-GitHub-Api-Version: 2022-11-28' \
    "${auth[@]}" \
    "$api_url")"
  sha="$(printf '%s\n' "$json" | grep -m1 '"sha"' | sed -E 's/.*"sha"[[:space:]]*:[[:space:]]*"([0-9a-f]{40})".*/\1/')"
  [[ "$sha" =~ ^[0-9a-f]{40}$ ]] || die "Could not resolve template commit SHA for ${TEMPLATE_REPO}@${TEMPLATE_REF}"
  SOURCE_SHA="$sha"

  archive="$TMP_DIR/template.tar.gz"
  extract_dir="$TMP_DIR/template"
  mkdir -p "$extract_dir"
  log "Downloading immutable template snapshot ${sha:0:12}"
  curl -fsSL --retry 3 --retry-delay 1 \
    -H 'Accept: application/vnd.github+json' \
    -H 'X-GitHub-Api-Version: 2022-11-28' \
    "${auth[@]}" \
    "https://api.github.com/repos/${TEMPLATE_REPO}/tarball/${sha}" \
    -o "$archive"
  tar -xzf "$archive" -C "$extract_dir"
  SOURCE_ROOT="$(find "$extract_dir" -mindepth 1 -maxdepth 1 -type d -print -quit)"
  [[ -n "$SOURCE_ROOT" && -d "$SOURCE_ROOT" ]] || die "Downloaded template archive did not contain a repository directory"
}

validate_template_shape() {
  local required=(
    "AGENTS.md"
    ".mcp.json"
    "p"
    ".pi/APPEND_SYSTEM.md"
    ".pi/prompts"
    ".pi/skills"
    ".pi/extensions"
    ".pi/evals"
    "scripts/pi-doctor.sh"
    "scripts/verify-affected.mjs"
    "docs/HARNESS.md"
    "docs/GIT_POLICY.md"
    "docs/EVALUATION.md"
    "docs/RESEARCH.md"
  )
  local rel
  for rel in "${required[@]}"; do
    [[ -e "$SOURCE_ROOT/$rel" ]] || die "Template is missing required workflow surface: $rel"
  done
}

preview_action() {
  local action=$1 rel=$2
  printf '  %-9s %s\n' "$action" "$rel"
}

replace_path() {
  local rel=$1 src="$SOURCE_ROOT/$1" dst="$TARGET/$1"
  [[ -e "$src" ]] || return 0
  preview_action "replace" "$rel"
  [[ "$MODE" == "apply" ]] || return 0
  rm -rf "$dst"
  mkdir -p "$(dirname "$dst")"
  cp -a "$src" "$dst"
}

overlay_dir() {
  local rel=$1 src="$SOURCE_ROOT/$1" dst="$TARGET/$1"
  [[ -d "$src" ]] || return 0
  preview_action "overlay" "$rel"
  [[ "$MODE" == "apply" ]] || return 0
  mkdir -p "$dst"
  cp -a "$src/." "$dst/"
}

preserve_path() {
  local rel=$1
  if [[ -e "$TARGET/$rel" ]]; then
    preview_action "preserve" "$rel"
  else
    preview_action "preserve*" "$rel (currently absent; bootstrap may create/adapt it)"
  fi
}

create_backup() {
  [[ "$MODE" == "apply" && $MAKE_BACKUP -eq 1 ]] || return 0
  local git_backup_path backup_dir stamp shortsha
  git_backup_path="$(git -C "$TARGET" rev-parse --git-path pi-workflow-backups)"
  if [[ "$git_backup_path" = /* ]]; then
    backup_dir="$git_backup_path"
  else
    backup_dir="$TARGET/$git_backup_path"
  fi
  mkdir -p "$backup_dir"
  stamp="$(date -u +'%Y%m%dT%H%M%SZ')"
  shortsha="${SOURCE_SHA:0:12}"
  BACKUP_FILE="$backup_dir/${stamp}-before-${shortsha}.tar.gz"

  local candidates=(AGENTS.md .mcp.json .pi p scripts .github/workflows docs tests)
  local existing=() rel
  for rel in "${candidates[@]}"; do
    [[ -e "$TARGET/$rel" ]] && existing+=("$rel")
  done
  if ((${#existing[@]})); then
    tar -czf "$BACKUP_FILE" -C "$TARGET" "${existing[@]}"
    ok "Backup created outside the working tree: $BACKUP_FILE"
  else
    BACKUP_FILE=""
  fi
}

sync_workflow() {
  section "Deterministic workflow sync"

  # Exact upstream-owned root surfaces.
  replace_path "AGENTS.md"
  replace_path ".mcp.json"
  replace_path "p"

  # .pi ownership policy:
  # - verification.json is a real-project adaptation and must remain truthful to the app.
  # - prompts/skills/extensions are upstream runtime policy and are replaced exactly so stale files disappear.
  # - evals are overlaid so project-specific eval cases can coexist with upstream cases.
  # - other template .pi root children are upstream-owned and replaced exactly.
  local child name
  while IFS= read -r -d '' child; do
    name="${child##*/}"
    case "$name" in
      verification.json) preserve_path ".pi/verification.json" ;;
      prompts|skills|extensions) replace_path ".pi/$name" ;;
      evals) overlay_dir ".pi/evals" ;;
      *) replace_path ".pi/$name" ;;
    esac
  done < <(find "$SOURCE_ROOT/.pi" -mindepth 1 -maxdepth 1 -print0 | sort -z)

  # Canonical workflow documentation only. Project product/design/architecture docs remain project-owned.
  local doc
  for doc in HARNESS.md GIT_POLICY.md EVALUATION.md RESEARCH.md TOOLING_SETUP.md; do
    [[ -e "$SOURCE_ROOT/docs/$doc" ]] && replace_path "docs/$doc"
  done
  [[ -e "$SOURCE_ROOT/docs/exec-plans/README.md" ]] && replace_path "docs/exec-plans/README.md"

  # Harness scripts are synced from the template except real-project verification/install contracts.
  preserve_path "scripts/verify.sh"
  preserve_path "scripts/ci-install.sh"
  while IFS= read -r -d '' child; do
    name="${child##*/}"
    case "$name" in
      verify.sh|ci-install.sh) ;;
      *) replace_path "scripts/$name" ;;
    esac
  done < <(find "$SOURCE_ROOT/scripts" -mindepth 1 -maxdepth 1 -print0 | sort -z)

  # Workflow regression tests are additive; target-only application tests are never deleted.
  [[ -d "$SOURCE_ROOT/tests" ]] && overlay_dir "tests"

  # CI workflow is deliberately project-owned. New harness expectations are reconciled by /bootstrap.
  preserve_path ".github/workflows"

  # cp -a preserves executable modes from the template. Project-owned scripts are not chmod'd.
}

run_bootstrap() {
  [[ $RUN_BOOTSTRAP -eq 1 ]] || return 0
  [[ "$MODE" == "apply" ]] || { warn "--bootstrap requested in dry-run mode; bootstrap is not executed."; return 0; }
  [[ -x "$TARGET/p" ]] || die "Cannot run bootstrap: $TARGET/p is missing or not executable"

  section "Project-specific /bootstrap adaptation"
  local prompt
  prompt=$(cat <<'PROMPT'
/bootstrap Update this repository's existing Pi harness adaptation to match the newly synced production workflow while preserving its real project contracts.

This is explicit workflow maintenance.

Preserve project-owned adaptations already present, especially .pi/verification.json, scripts/verify.sh, scripts/ci-install.sh, .github/workflows, and project product/architecture/design/plan documentation. Reconcile them only where the new harness contract requires it; never replace a validated project-specific contract with a generic template placeholder.

Acceptance:
- Current project commands, routes, and verification lanes remain truthful to this repository.
- The owner-controlled Git/GitHub boundary remains intact.
- Doctor, affected-verification routing, and deterministic workflow tests pass.
- No validated project-specific behavior or contract regresses because of generic template assumptions.

Do not create or switch branches, stage or commit, fetch, pull, push, open or mutate a PR, or perform any other Git/GitHub mutation.
PROMPT
)
  (
    cd "$TARGET"
    ./p "$prompt"
  )
}

run_validation() {
  [[ $RUN_VALIDATION -eq 1 ]] || { warn "Deterministic validation skipped by request."; return 0; }
  [[ "$MODE" == "apply" ]] || { log "Dry-run: validation would run after apply."; return 0; }

  section "Deterministic validation"
  if [[ -x "$TARGET/scripts/pi-doctor.sh" ]]; then
    (cd "$TARGET" && ./scripts/pi-doctor.sh)
  elif [[ -f "$TARGET/scripts/pi-doctor.sh" ]]; then
    (cd "$TARGET" && bash ./scripts/pi-doctor.sh)
  else
    die "Synced workflow has no scripts/pi-doctor.sh"
  fi
  ok "pi-doctor passed"

  if command -v node >/dev/null 2>&1 && [[ -d "$SOURCE_ROOT/tests" ]]; then
    local tests=() t rel
    while IFS= read -r -d '' t; do
      rel="${t#"$SOURCE_ROOT/"}"
      tests+=("$rel")
    done < <(find "$SOURCE_ROOT/tests" -type f -name '*.test.mjs' -print0 | sort -z)
    if ((${#tests[@]})); then
      (cd "$TARGET" && node --test "${tests[@]}")
      ok "Template workflow regression tests passed (${#tests[@]} files)"
    fi
  else
    warn "node is unavailable or template contains no .test.mjs files; skipped Node workflow tests"
  fi

  if [[ $RUN_FULL_VERIFY -eq 1 ]]; then
    [[ -x "$TARGET/scripts/verify.sh" || -f "$TARGET/scripts/verify.sh" ]] || die "--full-verify requested but scripts/verify.sh is missing"
    if [[ -x "$TARGET/scripts/verify.sh" ]]; then
      (cd "$TARGET" && ./scripts/verify.sh)
    else
      (cd "$TARGET" && bash ./scripts/verify.sh)
    fi
    ok "Project full verification passed"
  fi
}

final_report() {
  section "Result"
  printf 'Target:          %s\n' "$TARGET"
  printf 'Target HEAD:     %s (%s)\n' "$CURRENT_HEAD" "$CURRENT_BRANCH"
  if [[ -n "$SOURCE_DIR" ]]; then
    printf 'Template source: %s\n' "$SOURCE_ROOT"
  else
    printf 'Template source: %s@%s\n' "$TEMPLATE_REPO" "$TEMPLATE_REF"
  fi
  printf 'Template commit: %s\n' "$SOURCE_SHA"
  printf 'Mode:            %s\n' "$MODE"
  [[ -n "$BACKUP_FILE" ]] && printf 'Backup:          %s\n' "$BACKUP_FILE"

  if [[ "$MODE" == "dry-run" ]]; then
    printf '\n%sNo files were modified.%s Re-run with %s--apply%s when the preview is acceptable.\n' "$BOLD" "$RESET" "$BOLD" "$RESET"
    printf 'Recommended: %s --apply --bootstrap\n' "$SCRIPT_NAME"
    return
  fi

  printf '\n%sWorking-tree changes (read-only Git inspection):%s\n' "$BOLD" "$RESET"
  git -C "$TARGET" status --short || true
  printf '\n%sDiff stat:%s\n' "$BOLD" "$RESET"
  git -C "$TARGET" diff --stat || true
  printf '\n%sNo Git mutation was performed.%s Review the diff; commit/push only if you explicitly choose to do so.\n' "$GREEN" "$RESET"
}

section "Pi workflow synchronizer"
printf 'Target:      %s\n' "$TARGET"
printf 'Branch/HEAD: %s / %s\n' "$CURRENT_BRANCH" "$CURRENT_HEAD"
printf 'Mode:        %s\n' "$MODE"
[[ -n "$DIRTY_STATE" ]] && warn "Target is already dirty; continuing because mode is dry-run or --allow-dirty was supplied."

fetch_template
validate_template_shape
printf 'Template:    %s @ %s\n' "$TEMPLATE_REPO" "${SOURCE_SHA:0:12}"

create_backup
sync_workflow
run_bootstrap
run_validation
final_report

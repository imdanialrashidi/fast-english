#!/usr/bin/env bash
set -eu

# Simple Pi workflow sync for Arch Linux / GNU userland.
#
# Normal use:
#   ./scripts/sync-pi-workflow.sh
#
# Preview only:
#   ./scripts/sync-pi-workflow.sh --dry-run
#
# This script intentionally does NOT run Pi or /bootstrap and does NOT mutate Git.

TEMPLATE_REPO="${PI_WORKFLOW_TEMPLATE_REPO:-imdanialrashidi/pi-production-workflow-template}"
TEMPLATE_REF="${PI_WORKFLOW_TEMPLATE_REF:-main}"
TARGET=""
SOURCE_DIR="${PI_WORKFLOW_SOURCE_DIR:-}"
DRY_RUN=0
TMP_DIR=""
SOURCE_ROOT=""
BACKUP_FILE=""

if [[ -t 1 && -z "${NO_COLOR:-}" ]]; then
  BOLD=$'\033[1m'
  GREEN=$'\033[32m'
  YELLOW=$'\033[33m'
  RED=$'\033[31m'
  BLUE=$'\033[34m'
  RESET=$'\033[0m'
else
  BOLD=""; GREEN=""; YELLOW=""; RED=""; BLUE=""; RESET=""
fi

info() { printf '%s→%s %s\n' "$BLUE" "$RESET" "$*"; }
ok()   { printf '%s✓%s %s\n' "$GREEN" "$RESET" "$*"; }
warn() { printf '%s!%s %s\n' "$YELLOW" "$RESET" "$*" >&2; }
die()  { printf '%s✗%s %s\n' "$RED" "$RESET" "$*" >&2; exit 1; }

usage() {
  cat <<EOF_USAGE
${BOLD}Pi workflow sync${RESET}

Usage:
  ${0##*/} [--dry-run] [--target DIR] [--source-dir DIR]

Default behavior:
  - syncs ${TEMPLATE_REPO}@${TEMPLATE_REF}
  - creates a backup before changing files
  - preserves project-specific verification/install/CI configuration
  - does NOT run /bootstrap
  - does NOT stage, commit, pull, push, switch branches, or modify Git history

Options:
  --dry-run          Show what would be changed without modifying files
  --target DIR       Target Git repository (default: current repository)
  --source-dir DIR   Use a local template checkout instead of downloading GitHub
  -h, --help         Show this help

Environment overrides:
  PI_WORKFLOW_TEMPLATE_REPO=owner/repo
  PI_WORKFLOW_TEMPLATE_REF=branch-or-tag
  PI_WORKFLOW_SOURCE_DIR=/path/to/template
  GITHUB_TOKEN=...   Optional; useful if the template repository is private
EOF_USAGE
}

cleanup() {
  if [[ -n "$TMP_DIR" && -d "$TMP_DIR" ]]; then
    rm -rf -- "$TMP_DIR"
  fi
}
trap cleanup EXIT INT TERM

while (($#)); do
  case "$1" in
    --dry-run)
      DRY_RUN=1
      shift
      ;;
    --target)
      [[ $# -ge 2 ]] || die "--target needs a directory"
      TARGET="$2"
      shift 2
      ;;
    --source-dir)
      [[ $# -ge 2 ]] || die "--source-dir needs a directory"
      SOURCE_DIR="$2"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      die "Unknown option: $1. Use --help."
      ;;
  esac
done

need() {
  command -v "$1" >/dev/null 2>&1 || die "Missing required command: $1"
}

need git
need tar
need find
need mktemp
need cp
need rm
need mkdir

if [[ -z "$TARGET" ]]; then
  TARGET="$(git rev-parse --show-toplevel 2>/dev/null || true)"
  [[ -n "$TARGET" ]] || die "Run this inside fast-english (or another target Git repo)."
fi

TARGET="$(cd "$TARGET" 2>/dev/null && pwd -P)" || die "Target directory does not exist."
git -C "$TARGET" rev-parse --is-inside-work-tree >/dev/null 2>&1 || die "Target is not a Git repository: $TARGET"

BRANCH="$(git -C "$TARGET" symbolic-ref --quiet --short HEAD 2>/dev/null || printf 'detached')"
HEAD="$(git -C "$TARGET" rev-parse --short=12 HEAD 2>/dev/null || printf 'unborn')"

printf '\n%sPi workflow sync%s\n' "$BOLD" "$RESET"
printf 'Target:   %s\n' "$TARGET"
printf 'Branch:   %s (%s)\n' "$BRANCH" "$HEAD"
printf 'Template: %s@%s\n\n' "$TEMPLATE_REPO" "$TEMPLATE_REF"

if [[ -n "$(git -C "$TARGET" status --porcelain=v1 --untracked-files=all)" ]]; then
  warn "Working tree has local changes. Continuing safely; touched workflow files will be backed up first."
fi

path_exists() {
  [[ -e "$1" || -L "$1" ]]
}

fetch_template() {
  if [[ -n "$SOURCE_DIR" ]]; then
    SOURCE_ROOT="$(cd "$SOURCE_DIR" 2>/dev/null && pwd -P)" || die "Template source directory does not exist: $SOURCE_DIR"
    ok "Using local template: $SOURCE_ROOT"
    return
  fi

  need curl
  TMP_DIR="$(mktemp -d "${TMPDIR:-/tmp}/pi-workflow-sync.XXXXXX")" || die "Could not create a temporary directory."

  local archive="$TMP_DIR/template.tar.gz"
  local extract_dir="$TMP_DIR/template"
  local curl_log="$TMP_DIR/curl.log"
  local tar_log="$TMP_DIR/tar.log"
  local url="https://api.github.com/repos/${TEMPLATE_REPO}/tarball/${TEMPLATE_REF}"
  local headers=()

  mkdir -p "$extract_dir"
  headers=(-H 'Accept: application/vnd.github+json' -H 'X-GitHub-Api-Version: 2022-11-28')
  if [[ -n "${GITHUB_TOKEN:-}" ]]; then
    headers+=(-H "Authorization: Bearer ${GITHUB_TOKEN}")
  fi

  info "Downloading latest workflow template..."
  if ! curl --fail --location --silent --show-error \
      --retry 2 --retry-delay 1 --connect-timeout 15 \
      "${headers[@]}" "$url" -o "$archive" 2>"$curl_log"; then
    if [[ "${DEBUG:-0}" == "1" && -s "$curl_log" ]]; then
      cat "$curl_log" >&2
    fi
    die "Could not download the workflow template. Check internet access${GITHUB_TOKEN:+ or GITHUB_TOKEN}."
  fi

  if ! tar -xzf "$archive" -C "$extract_dir" 2>"$tar_log"; then
    if [[ "${DEBUG:-0}" == "1" && -s "$tar_log" ]]; then
      cat "$tar_log" >&2
    fi
    die "The downloaded workflow archive could not be extracted. Try again."
  fi

  SOURCE_ROOT="$(find "$extract_dir" -mindepth 1 -maxdepth 1 -type d -print -quit)"
  [[ -n "$SOURCE_ROOT" && -d "$SOURCE_ROOT" ]] || die "GitHub returned an unexpected template archive."
  ok "Template downloaded"
}

validate_template() {
  local required=(
    "AGENTS.md"
    ".mcp.json"
    "p"
    ".pi/APPEND_SYSTEM.md"
    ".pi/prompts"
    ".pi/skills"
    ".pi/extensions"
    "scripts/pi-doctor.sh"
    "docs/HARNESS.md"
    "docs/GIT_POLICY.md"
  )
  local rel

  for rel in "${required[@]}"; do
    path_exists "$SOURCE_ROOT/$rel" || die "Template looks incomplete; missing: $rel"
  done
}

backup_workflow() {
  (( DRY_RUN == 0 )) || return 0

  local git_backup_path backup_dir stamp
  local candidates=(
    "AGENTS.md"
    ".mcp.json"
    "p"
    ".pi"
    "scripts"
    "docs/HARNESS.md"
    "docs/GIT_POLICY.md"
    "docs/EVALUATION.md"
    "docs/RESEARCH.md"
    "docs/TOOLING_SETUP.md"
    "docs/exec-plans/README.md"
    "tests"
  )
  local existing=()
  local rel

  git_backup_path="$(git -C "$TARGET" rev-parse --git-path pi-workflow-backups)"
  if [[ "$git_backup_path" = /* ]]; then
    backup_dir="$git_backup_path"
  else
    backup_dir="$TARGET/$git_backup_path"
  fi

  mkdir -p "$backup_dir"
  stamp="$(date -u +'%Y%m%dT%H%M%SZ')"
  BACKUP_FILE="$backup_dir/${stamp}-before-workflow-sync.tar.gz"

  for rel in "${candidates[@]}"; do
    if path_exists "$TARGET/$rel"; then
      existing+=("$rel")
    fi
  done

  if ((${#existing[@]} == 0)); then
    BACKUP_FILE=""
    return 0
  fi

  if ! tar -czf "$BACKUP_FILE" -C "$TARGET" "${existing[@]}"; then
    rm -f -- "$BACKUP_FILE"
    BACKUP_FILE=""
    die "Could not create the safety backup; no files were changed."
  fi

  ok "Backup created: $BACKUP_FILE"
}

show_action() {
  printf '  %-8s %s\n' "$1" "$2"
}

replace_path() {
  local rel="$1"
  local src="$SOURCE_ROOT/$rel"
  local dst="$TARGET/$rel"

  path_exists "$src" || return 0
  show_action "update" "$rel"
  (( DRY_RUN == 1 )) && return 0

  rm -rf -- "$dst"
  mkdir -p -- "$(dirname "$dst")"
  cp -a -- "$src" "$dst"
}

overlay_dir() {
  local rel="$1"
  local src="$SOURCE_ROOT/$rel"
  local dst="$TARGET/$rel"

  [[ -d "$src" ]] || return 0
  show_action "merge" "$rel"
  (( DRY_RUN == 1 )) && return 0

  mkdir -p -- "$dst"
  cp -a -- "$src/." "$dst/"
}

keep_or_seed() {
  local rel="$1"
  if path_exists "$TARGET/$rel"; then
    show_action "keep" "$rel"
  else
    replace_path "$rel"
  fi
}

sync_workflow() {
  printf '\n%sSyncing workflow files%s\n' "$BOLD" "$RESET"

  # Canonical root workflow files.
  replace_path "AGENTS.md"
  replace_path ".mcp.json"
  replace_path "p"

  # Project-specific verification is preserved. Runtime policy is refreshed.
  local child name
  while IFS= read -r -d '' child; do
    name="${child##*/}"
    case "$name" in
      verification.json)
        keep_or_seed ".pi/verification.json"
        ;;
      prompts|skills|extensions)
        replace_path ".pi/$name"
        ;;
      evals)
        overlay_dir ".pi/evals"
        ;;
      *)
        replace_path ".pi/$name"
        ;;
    esac
  done < <(find "$SOURCE_ROOT/.pi" -mindepth 1 -maxdepth 1 -print0)

  # Only workflow documentation is replaced. Product/design/architecture docs stay untouched.
  local doc
  for doc in HARNESS.md GIT_POLICY.md EVALUATION.md RESEARCH.md TOOLING_SETUP.md; do
    replace_path "docs/$doc"
  done
  replace_path "docs/exec-plans/README.md"

  # Keep real-project install/verification contracts; update the rest of harness scripts.
  keep_or_seed "scripts/verify.sh"
  keep_or_seed "scripts/ci-install.sh"

  while IFS= read -r -d '' child; do
    name="${child##*/}"
    case "$name" in
      verify.sh|ci-install.sh)
        ;;
      *)
        replace_path "scripts/$name"
        ;;
    esac
  done < <(find "$SOURCE_ROOT/scripts" -mindepth 1 -maxdepth 1 -print0)

  # Add/update workflow regression tests without deleting project-only tests.
  overlay_dir "tests"

  # .github/workflows and application files are intentionally untouched.
  show_action "keep" ".github/workflows/**"
  show_action "keep" "project app/product/architecture/design files"
}

light_validation() {
  (( DRY_RUN == 0 )) || return 0

  # Keep validation deliberately lightweight. Do not execute Pi, bootstrap,
  # dependency installation, project builds, or tests here.
  if [[ -f "$TARGET/p" ]]; then
    bash -n "$TARGET/p" || die "The synced ./p launcher has invalid Bash syntax. Restore the backup and inspect the template."
  fi

  if [[ -f "$TARGET/scripts/pi-doctor.sh" ]]; then
    bash -n "$TARGET/scripts/pi-doctor.sh" || die "The synced pi-doctor.sh has invalid Bash syntax. Restore the backup and inspect the template."
  fi

  if [[ -f "$TARGET/scripts/pi-sandbox.sh" ]]; then
    bash -n "$TARGET/scripts/pi-sandbox.sh" || die "The synced pi-sandbox.sh has invalid Bash syntax. Restore the backup and inspect the template."
  fi

  ok "Basic syntax checks passed"
}

fetch_template
validate_template
backup_workflow
sync_workflow
light_validation

printf '\n'
if (( DRY_RUN == 1 )); then
  ok "Dry run complete. Nothing was changed."
  printf 'Run normally to apply: %s./scripts/sync-pi-workflow.sh%s\n' "$BOLD" "$RESET"
else
  ok "Workflow sync complete."
  [[ -n "$BACKUP_FILE" ]] && printf 'Backup: %s\n' "$BACKUP_FILE"
  printf 'Bootstrap: not run (by design). Run it manually when you want.\n'
  printf 'Git: no stage/commit/pull/push/checkout operations were performed.\n'
fi

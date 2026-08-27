#!/usr/bin/env bash
set -Eeuo pipefail

# universal-pi-to-omp.sh
#
# Universal, rerunnable migration/sync helper for repositories that use
# Danial's Pi production workflow and should move to the OMP production workflow.
#
# Source:
#   https://github.com/imdanialrashidi/pi-production-workflow-template
#
# Destination:
#   https://github.com/imdanialrashidi/omp-production-workflow-template
#
# Design goals:
#   - safe to rerun after an interrupted migration
#   - no separate "repair" mode required
#   - discovers workflow scripts/tests from the OMP template instead of keeping
#     a brittle hand-written file list
#   - preserves project/product context, application CI, deployment logic and
#     project verification entrypoints
#   - backs up every path it may replace/remove/patch
#   - separates OMP harness CI from application CI
#   - never commits, pushes, merges, deploys, installs OMP, rotates credentials,
#     or mutates external state
#
# Normal usage:
#   chmod +x universal-pi-to-omp.sh
#   ./universal-pi-to-omp.sh
#
# Preview:
#   ./universal-pi-to-omp.sh --dry-run
#
# Run against another repository:
#   ./universal-pi-to-omp.sh --project /path/to/repo
#
# After a successful migration:
#   omp
#   /wf-bootstrap

VERSION="3.4.0"

DEFAULT_TEMPLATE_URL="https://github.com/imdanialrashidi/omp-production-workflow-template.git"
DEFAULT_TEMPLATE_REF="e81dddc0f982d7d7ce819dc584de800f9517853f"

PROJECT="."
TEMPLATE_URL="${OMP_TEMPLATE_URL:-$DEFAULT_TEMPLATE_URL}"
TEMPLATE_REF="${OMP_TEMPLATE_REF:-$DEFAULT_TEMPLATE_REF}"

DRY_RUN=0
VERIFY=1
FULL_VERIFY=0
FORCE_DIRTY=0
INSTALL_CI=1

log()  { printf '%s\n' "$*"; }
info() { printf '→ %s\n' "$*"; }
ok()   { printf '✓ %s\n' "$*"; }
warn() { printf '⚠ %s\n' "$*" >&2; }
die()  { printf '✗ %s\n' "$*" >&2; exit 1; }

usage() {
  cat <<EOF
Universal Pi → OMP migrator v$VERSION

Usage:
  $(basename "$0") [options]

Options:
  --project PATH       Target Git repository. Default: current repository
  --template URL       OMP workflow template Git URL/path
  --ref REF            Template branch/tag/commit. Default: reviewed pinned commit
                       Use --ref main to intentionally follow latest template main
  --dry-run            Inspect the plan only; do not change project files
  --no-verify          Skip deterministic post-migration checks
  --full-verify        Also run the project's scripts/verify.sh after migration
  --no-ci              Do not install the dedicated omp-workflow GitHub Action
  --force-dirty        Allow unrelated dirty project files (not recommended)
  -h, --help           Show help

Environment:
  OMP_TEMPLATE_URL
  OMP_TEMPLATE_REF

Examples:
  $(basename "$0")
  $(basename "$0") --dry-run
  $(basename "$0") --project ~/Documents/Projects/fast-english
  $(basename "$0") --full-verify
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --project)
      [[ $# -ge 2 ]] || die "--project requires a path."
      PROJECT="$2"
      shift 2
      ;;
    --template)
      [[ $# -ge 2 ]] || die "--template requires a URL/path."
      TEMPLATE_URL="$2"
      shift 2
      ;;
    --ref)
      [[ $# -ge 2 ]] || die "--ref requires a branch, tag, or commit."
      TEMPLATE_REF="$2"
      shift 2
      ;;
    --dry-run)
      DRY_RUN=1
      shift
      ;;
    --no-verify)
      VERIFY=0
      shift
      ;;
    --full-verify)
      FULL_VERIFY=1
      shift
      ;;
    --no-ci)
      INSTALL_CI=0
      shift
      ;;
    --force-dirty)
      FORCE_DIRTY=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      die "Unknown option: $1"
      ;;
  esac
done

for cmd in git bash node find grep sed; do
  command -v "$cmd" >/dev/null 2>&1 || die "Required command is missing: $cmd"
done

PROJECT="$(cd "$PROJECT" 2>/dev/null && pwd)" || die "Project path does not exist: $PROJECT"
ROOT="$(git -C "$PROJECT" rev-parse --show-toplevel 2>/dev/null || true)"
[[ -n "$ROOT" ]] || die "Target is not inside a Git repository: $PROJECT"
cd "$ROOT"

HEAD_SHA="$(git rev-parse HEAD)"
BRANCH="$(git branch --show-current 2>/dev/null || true)"

SELF_ABS="$(realpath "$0" 2>/dev/null || true)"
SELF_REL=""
if [[ -n "$SELF_ABS" && "$SELF_ABS" == "$ROOT/"* ]]; then
  SELF_REL="${SELF_ABS#"$ROOT/"}"
fi

STATE_FILE="$ROOT/.git/omp-migration-state"
BACKUP_BASE="$ROOT/.git/omp-migration-backups"
mkdir -p "$BACKUP_BASE"

TMP="$(mktemp -d "${TMPDIR:-/tmp}/pi-to-omp.XXXXXX")"
trap 'rm -rf "$TMP"' EXIT

# ---------------------------------------------------------------------------
# Fetch and validate the destination template.
# ---------------------------------------------------------------------------

info "Fetching OMP workflow template..."

if [[ "$TEMPLATE_REF" == "main" ]]; then
  if ! git clone --quiet --depth 1 --branch main "$TEMPLATE_URL" "$TMP/template"; then
    die "Could not clone OMP template main branch."
  fi
else
  git clone --quiet "$TEMPLATE_URL" "$TMP/template" \
    || die "Could not clone OMP workflow template."

  if ! git -C "$TMP/template" checkout --quiet "$TEMPLATE_REF" 2>/dev/null; then
    git -C "$TMP/template" fetch --quiet origin "$TEMPLATE_REF" \
      || die "Could not resolve template ref: $TEMPLATE_REF"
    git -C "$TMP/template" checkout --quiet FETCH_HEAD \
      || die "Could not checkout template ref: $TEMPLATE_REF"
  fi
fi

TEMPLATE_ROOT="$TMP/template"
TEMPLATE_SHA="$(git -C "$TEMPLATE_ROOT" rev-parse HEAD)"

for required in \
  ".omp/compatibility.json" \
  ".omp/config.yml" \
  ".omp/extensions/safety-guard.js" \
  "AGENTS.md" \
  "scripts/omp-doctor.sh" \
  "scripts/validate-workflow.mjs" \
  "scripts/lib/workflow-evals.mjs" \
  "scripts/lib/eval-isolation.mjs" \
  "scripts/lib/omp-rpc.mjs"
do
  [[ -e "$TEMPLATE_ROOT/$required" ]] \
    || die "OMP template is incomplete at $TEMPLATE_SHA; missing: $required"
done

OMP_VERSION="$(
  node -e '
    const fs=require("fs");
    const p=process.argv[1];
    const x=JSON.parse(fs.readFileSync(p,"utf8"));
    process.stdout.write(String(x?.omp?.version ?? ""));
  ' "$TEMPLATE_ROOT/.omp/compatibility.json"
)"
[[ -n "$OMP_VERSION" ]] || die "Could not determine reviewed OMP version from compatibility.json."

# ---------------------------------------------------------------------------
# Discover workflow-owned files dynamically.
# ---------------------------------------------------------------------------

PROJECT_DOC_BASENAMES=(
  "PRODUCT.md"
  "ARCHITECTURE.md"
  "QUALITY.md"
  "DESIGN.md"
  "PLAN.md"
)

is_project_doc_basename() {
  local base="$1"
  local item
  for item in "${PROJECT_DOC_BASENAMES[@]}"; do
    [[ "$item" == "$base" ]] && return 0
  done
  return 1
}

WORKFLOW_DOCS=()
while IFS= read -r -d '' file; do
  rel="${file#"$TEMPLATE_ROOT/"}"
  base="$(basename "$rel")"
  if ! is_project_doc_basename "$base"; then
    case "$base" in
      VALIDATION.md|RESEARCH_PI_BASELINE.md)
        # Template-specific evidence/provenance; do not present it as project evidence.
        ;;
      *)
        WORKFLOW_DOCS+=("$rel")
        ;;
    esac
  fi
done < <(find "$TEMPLATE_ROOT/docs" -maxdepth 1 -type f -name '*.md' -print0 | sort -z)

if [[ -f "$TEMPLATE_ROOT/docs/exec-plans/README.md" ]]; then
  WORKFLOW_DOCS+=("docs/exec-plans/README.md")
fi

WORKFLOW_SCRIPTS=()
while IFS= read -r -d '' file; do
  rel="${file#"$TEMPLATE_ROOT/"}"
  case "$rel" in
    scripts/verify.sh|scripts/ci-install.sh)
      # These are project integration points and may contain real stack logic.
      ;;
    *)
      WORKFLOW_SCRIPTS+=("$rel")
      ;;
  esac
done < <(find "$TEMPLATE_ROOT/scripts" -type f -print0 | sort -z)

WORKFLOW_TESTS=()
while IFS= read -r -d '' file; do
  rel="${file#"$TEMPLATE_ROOT/"}"
  WORKFLOW_TESTS+=("$rel")
done < <(find "$TEMPLATE_ROOT/tests" -maxdepth 1 -type f -name '*.test.mjs' -print0 | sort -z)

REPLACE_DIRS=(
  ".omp"
  "evals"
  ".github/omp-runtime"
)

REPLACE_ROOT_FILES=(
  "AGENTS.md"
  "Dockerfile.omp"
)

REMOVE_PI_PATHS=(
  ".pi"
  ".mcp.json"
  "p"
  "Dockerfile.pi"
  "scripts/pi-doctor.sh"
  "scripts/pi-sandbox.sh"
  "scripts/verify-package-integrity.mjs"
  "tests/harness-runtime.test.mjs"
  "tests/launcher.test.mjs"
  "tests/quick-fix-skill.test.mjs"
)

PROJECT_PATCH_FILES=(
  ".gitignore"
  "scripts/verify.sh"
  "docs/PRODUCT.md"
  "docs/ARCHITECTURE.md"
  "docs/QUALITY.md"
  "docs/DESIGN.md"
  "docs/PLAN.md"
)

# ---------------------------------------------------------------------------
# Determine whether a dirty tree is safe to resume.
# ---------------------------------------------------------------------------

dirty_files() {
  {
    git diff --name-only -z
    git diff --cached --name-only -z
    git ls-files --others --exclude-standard -z
  } | node -e '
    let b=[];
    process.stdin.on("data",d=>b.push(d));
    process.stdin.on("end",()=>{
      const x=Buffer.concat(b).toString("utf8").split("\0").filter(Boolean);
      for (const p of [...new Set(x)].sort()) process.stdout.write(p+"\n");
    });
  '
}

is_migration_managed_path() {
  local path="$1"
  local item

  [[ -n "$SELF_REL" && "$path" == "$SELF_REL" ]] && return 0

  case "$path" in
    migrate-pi-to-omp*.sh|universal-pi-to-omp*.sh)
      # Local migration utilities are not product state.
      return 0
      ;;
    .pi|.pi/*|.omp|.omp/*|evals|evals/*|.github/omp-runtime|.github/omp-runtime/*)
      return 0
      ;;
    .github/workflows/*.yml|.github/workflows/*.yaml)
      return 0
      ;;
    .gitignore|AGENTS.md|Dockerfile.pi|Dockerfile.omp|.mcp.json|p)
      return 0
      ;;
    docs/PRODUCT.md|docs/ARCHITECTURE.md|docs/QUALITY.md|docs/DESIGN.md|docs/PLAN.md)
      return 0
      ;;
  esac

  for item in \
    "${WORKFLOW_DOCS[@]}" \
    "${WORKFLOW_SCRIPTS[@]}" \
    "${WORKFLOW_TESTS[@]}" \
    "${REMOVE_PI_PATHS[@]}" \
    "${PROJECT_PATCH_FILES[@]}"; do
    [[ "$path" == "$item" ]] && return 0
  done

  return 1
}

mapfile -t DIRTY_RAW < <(dirty_files)

# It is common to download this migrator directly into the target repository.
# The migrator itself is not project state and must never make an otherwise
# clean repository fail the dirty-tree preflight.
DIRTY=()
for path in "${DIRTY_RAW[@]}"; do
  [[ -n "$SELF_REL" && "$path" == "$SELF_REL" ]] && continue
  DIRTY+=("$path")
done

RESUME_MODE=0
if [[ "${#DIRTY[@]}" -gt 0 && "$FORCE_DIRTY" -ne 1 ]]; then
  if [[ -d .omp || -f "$STATE_FILE" ]]; then
    unsafe=()
    for path in "${DIRTY[@]}"; do
      is_migration_managed_path "$path" || unsafe+=("$path")
    done

    if [[ "${#unsafe[@]}" -eq 0 ]]; then
      RESUME_MODE=1
      warn "Detected an incomplete/previous OMP migration; resuming safely."
    else
      printf '✗ Unrelated local changes exist. Commit/stash them first:\n' >&2
      printf '  %s\n' "${unsafe[@]}" >&2
      printf '\nIf you intentionally accept the risk, rerun with --force-dirty.\n' >&2
      exit 1
    fi
  else
    cat >&2 <<'EOF'
✗ Working tree is not clean.

Commit or stash current project work first. The migrator only auto-resumes dirty
trees after an OMP migration has already started.

Use --force-dirty only when you intentionally accept mixing unrelated edits.
EOF
    exit 1
  fi
fi

# ---------------------------------------------------------------------------
# Plan.
# ---------------------------------------------------------------------------

DEFAULT_BRANCH="$(
  git symbolic-ref --quiet --short refs/remotes/origin/HEAD 2>/dev/null \
    | sed 's#^origin/##' || true
)"
[[ -n "$DEFAULT_BRANCH" ]] || DEFAULT_BRANCH="${BRANCH:-main}"

log
log "Universal Pi → OMP migration"
log "────────────────────────────────────────────────────────"
log "Repository:          $ROOT"
log "Mode:                $([[ "$RESUME_MODE" -eq 1 ]] && echo resume/sync || echo migration)"
log "Current branch:      ${BRANCH:-detached}"
log "Default branch:      $DEFAULT_BRANCH"
log "Current commit:      $HEAD_SHA"
log "Template ref:        $TEMPLATE_REF"
log "Template commit:     $TEMPLATE_SHA"
log "Reviewed OMP:        $OMP_VERSION"
log "Workflow scripts:    ${#WORKFLOW_SCRIPTS[@]}"
log "Workflow tests:      ${#WORKFLOW_TESTS[@]}"
log "Workflow docs:       ${#WORKFLOW_DOCS[@]}"
log
log "Preserved project surfaces:"
log "  • docs/PRODUCT.md, ARCHITECTURE.md, QUALITY.md, DESIGN.md, PLAN.md"
log "  • docs/exec-plans/active and completed"
log "  • existing application/deployment GitHub workflows"
log "  • scripts/verify.sh, scripts/ci-install.sh, scripts/project-verify.sh"
log "  • README/SECURITY/CONTRIBUTING, package files and application code"
log
log "No commit, push, merge, deployment, secret change, package install, or external mutation will occur."

if [[ "$DRY_RUN" -eq 1 ]]; then
  ok "Dry run complete. No project files were changed."
  exit 0
fi

# ---------------------------------------------------------------------------
# Backup current state.
# ---------------------------------------------------------------------------

STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
BACKUP_ROOT="$BACKUP_BASE/$STAMP"
mkdir -p "$BACKUP_ROOT"

backup_path() {
  local path="$1"
  [[ -e "$path" || -L "$path" ]] || return 0
  mkdir -p "$BACKUP_ROOT/$(dirname "$path")"
  cp -a "$path" "$BACKUP_ROOT/$path"
}

info "Creating rollback backup..."

for path in "${REPLACE_DIRS[@]}" "${REPLACE_ROOT_FILES[@]}" \
            "${WORKFLOW_DOCS[@]}" "${WORKFLOW_SCRIPTS[@]}" \
            "${WORKFLOW_TESTS[@]}" "${REMOVE_PI_PATHS[@]}" \
            "${PROJECT_PATCH_FILES[@]}"; do
  backup_path "$path"
done

backup_path ".github/workflows"

cat > "$BACKUP_ROOT/MIGRATION.txt" <<EOF
Universal Pi → OMP migration
============================

Migrator version:       $VERSION
Date UTC:               $STAMP
Repository:             $ROOT
Branch:                 ${BRANCH:-detached}
Default branch:         $DEFAULT_BRANCH
Original HEAD:          $HEAD_SHA
Template URL:           $TEMPLATE_URL
Template requested ref: $TEMPLATE_REF
Template resolved SHA:  $TEMPLATE_SHA
Reviewed OMP version:   $OMP_VERSION
Resume mode:            $RESUME_MODE

The backup contains the pre-run state of every project path this migrator may
replace, remove, or patch.
EOF

# ---------------------------------------------------------------------------
# Sync workflow-owned surfaces.
# ---------------------------------------------------------------------------

replace_from_template() {
  local path="$1"
  [[ -e "$TEMPLATE_ROOT/$path" || -L "$TEMPLATE_ROOT/$path" ]] \
    || die "Template path disappeared during migration: $path"

  rm -rf "$path"
  mkdir -p "$(dirname "$path")"
  cp -a "$TEMPLATE_ROOT/$path" "$path"
}

info "Synchronizing OMP workflow-owned files..."

for path in "${REPLACE_DIRS[@]}" "${REPLACE_ROOT_FILES[@]}" \
            "${WORKFLOW_DOCS[@]}" "${WORKFLOW_SCRIPTS[@]}" \
            "${WORKFLOW_TESTS[@]}"; do
  replace_from_template "$path"
done

# Generic integration entrypoints are installed only when the real project has
# no existing implementation.
if [[ ! -f scripts/verify.sh ]]; then
  replace_from_template "scripts/verify.sh"
fi

if [[ ! -f scripts/ci-install.sh ]]; then
  replace_from_template "scripts/ci-install.sh"
fi

info "Removing obsolete Pi-only runtime files..."
for path in "${REMOVE_PI_PATHS[@]}"; do
  rm -rf "$path"
done

# ---------------------------------------------------------------------------
# Preserve project files while adapting only known Pi integration references.
# ---------------------------------------------------------------------------

patch_operational_file() {
  local file="$1"
  [[ -f "$file" ]] || return 0

  node - "$file" <<'NODE'
const fs = require("node:fs");
const file = process.argv[2];
let text = fs.readFileSync(file, "utf8");
const before = text;

text = text
  .replaceAll("scripts/pi-doctor.sh --ci", "scripts/omp-doctor.sh --static")
  .replaceAll("scripts/pi-doctor.sh --static", "scripts/omp-doctor.sh --static")
  .replaceAll("scripts/pi-doctor.sh", "scripts/omp-doctor.sh")
  .replaceAll("scripts/pi-sandbox.sh", "scripts/omp-sandbox.sh")
  .replaceAll(".pi/verification.json", ".omp/verification.json")
  .replaceAll("Dockerfile.pi", "Dockerfile.omp")
  .replaceAll("`/bootstrap`", "`/wf-bootstrap`")
  .replaceAll(" /bootstrap", " /wf-bootstrap")
  .replaceAll("Pi harness validation", "OMP harness validation")
  .replaceAll("Pi harness", "OMP harness");

// Remove only the exact obsolete Pi package-integrity GitHub Actions step.
text = text.replace(
  /\n([ \t]*)-\s+name:\s+Verify pinned packages against npm\s*\n\1[ \t]+run:\s+node scripts\/verify-package-integrity\.mjs --online\s*\n/g,
  "\n"
);

// Migrate exact generic Pi quality-contract wording when it survived a prior
// /bootstrap. Custom project prose is otherwise preserved.
text = text.replace(
  /For trust-boundary changes, require the `risk-review` workflow\./g,
  "For trust-boundary changes, require an independent risk/security review using OMP's bundled `security-reviewer` when relevant."
);

text = text.replace(
  /For a new interface, redesign, launch surface, or explicitly high-aesthetic task, load `frontend-design` and evaluate the rendered result using its visual-quality rubric\./g,
  "For a new interface, redesign, launch surface, or explicitly high-aesthetic task, use OMP's bundled `designer` and evaluate the rendered result against `docs/VISUAL_REVIEW.md`."
);

if (text !== before) {
  fs.writeFileSync(file, text);
  process.stdout.write(`patched ${file}\n`);
}
NODE
}

info "Adapting project-owned Pi integration references..."

patch_operational_file "scripts/verify.sh"

for file in \
  docs/PRODUCT.md \
  docs/ARCHITECTURE.md \
  docs/QUALITY.md \
  docs/DESIGN.md \
  docs/PLAN.md
do
  patch_operational_file "$file"
done

if [[ -d .github/workflows ]]; then
  while IFS= read -r -d '' file; do
    [[ "$file" == ".github/workflows/omp-workflow.yml" ]] && continue
    patch_operational_file "$file"
  done < <(
    find .github/workflows -maxdepth 1 -type f \
      \( -name '*.yml' -o -name '*.yaml' \) -print0
  )
fi

# ---------------------------------------------------------------------------
# Normalize template self-tests for a real migrated project.
#
# Upstream has tests that intentionally inspect untouched template docs.
# Real repositories intentionally preserve specialized PRODUCT/QUALITY docs,
# so those assertions must use synthetic template input / workflow-owned
# contracts rather than resetting project context.
# ---------------------------------------------------------------------------

normalize_project_tests() {
  node <<'NODE'
const fs = require("node:fs");

function patch(file, transform) {
  if (!fs.existsSync(file)) return;
  const before = fs.readFileSync(file, "utf8");
  const after = transform(before);
  if (after !== before) {
    fs.writeFileSync(file, after);
    process.stdout.write(`normalized ${file}\n`);
  }
}

patch("tests/context-readiness.test.mjs", text => {
  if (text.includes("an untouched template-shaped context is explicitly not ready")) return text;

  const oldBlock = `test("the untouched template is explicitly not ready for product work", () => {
  const report = analyzeProjectContext();
  assert.equal(report.ready, false);
  assert.equal(report.documents.length, contextDocuments.length);
  assert(report.documents.every((document) => document.signals.length > 0));
  assert(report.blockedDocuments.includes("docs/PRODUCT.md"));
});`;

  const newBlock = `test("an untouched template-shaped context is explicitly not ready for product work", () => {
  const documents = Object.fromEntries(
    contextDocuments.map(({ path }) => [
      path,
      "# Template contract\\\\n\\\\n- Primary users:\\\\n\\\\nKeep this document short after /wf-bootstrap.\\\\n",
    ]),
  );
  const report = analyzeProjectContext(documents);
  assert.equal(report.ready, false);
  assert.equal(report.documents.length, contextDocuments.length);
  assert(report.documents.every((document) => document.signals.length > 0));
  assert(report.blockedDocuments.includes("docs/PRODUCT.md"));
});`;

  if (!text.includes(oldBlock)) {
    throw new Error(
      "Upstream context-readiness template test changed; refusing to guess a migration patch."
    );
  }
  return text.replace(oldBlock, newBlock);
});

patch("tests/test-design-contract.test.mjs", text => {
  const oldAssertion =
    '  assert.match(quality, /Coverage, assertion count, and test count are diagnostic signals/);';
  const newAssertion =
    '  assert.match(await read(".omp/skills/test-design/SKILL.md"), /Do not create tests to hit a count, percentage, uncovered line/);';

  if (text.includes(newAssertion)) return text;
  if (!text.includes(oldAssertion)) {
    throw new Error(
      "Upstream test-design template test changed; refusing to guess a migration patch."
    );
  }
  return text.replace(oldAssertion, newAssertion);
});
NODE
}

info "Normalizing template-only tests for real project context..."
normalize_project_tests

# ---------------------------------------------------------------------------
# Maintain an idempotent OMP runtime .gitignore block.
# ---------------------------------------------------------------------------

node <<'NODE'
const fs = require("node:fs");

const file = ".gitignore";
const begin = "# >>> omp-production-workflow runtime >>>";
const end = "# <<< omp-production-workflow runtime <<<";

const block = `${begin}
.omp/npm/
.omp/git/
.omp/sessions/
.omp/cache/
.omp/auth.json
.omp/models.json
.omp/trust.json
.omp/mcp.json
.omp/mcp-oauth/
.omp/mcp-traces/
.omp/agent.db*
.omp/config.local.yml
.omp/config.local.yaml
.omp/models.yml
.omp/models.yaml
.omp/state/
.omp/agents.local/
.omp/managed-skills/
${end}`;

let text = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
const pattern = new RegExp(
  begin.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") +
  "[\\s\\S]*?" +
  end.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
  "m"
);

if (pattern.test(text)) {
  text = text.replace(pattern, block);
} else {
  text = text.replace(/\s*$/, "");
  text += `${text ? "\n\n" : ""}${block}\n`;
}
fs.writeFileSync(file, text);
NODE

# ---------------------------------------------------------------------------
# Install a dedicated, low-cost OMP harness CI workflow.
#
# Application CI remains project-owned. This workflow validates only the
# harness/runtime contract, so migration does not replace or duplicate the
# project's release/build/test topology.
# ---------------------------------------------------------------------------

if [[ "$INSTALL_CI" -eq 1 ]]; then
  info "Installing dedicated OMP workflow CI..."

  TEMPLATE_QUALITY="$TEMPLATE_ROOT/.github/workflows/quality.yml"
  [[ -f "$TEMPLATE_QUALITY" ]] || die "Template quality workflow is missing."

  CHECKOUT_REF="$(grep -m1 'uses: actions/checkout@' "$TEMPLATE_QUALITY" | sed 's/.*uses: //')"
  SETUP_NODE_REF="$(grep -m1 'uses: actions/setup-node@' "$TEMPLATE_QUALITY" | sed 's/.*uses: //')"
  SETUP_BUN_REF="$(grep -m1 'uses: oven-sh/setup-bun@' "$TEMPLATE_QUALITY" | sed 's/.*uses: //')"
  NODE_VERSION="$(grep -m1 'node-version:' "$TEMPLATE_QUALITY" | sed 's/.*node-version:[[:space:]]*//')"
  BUN_VERSION="$(grep -m1 'bun-version:' "$TEMPLATE_QUALITY" | sed 's/.*bun-version:[[:space:]]*//')"

  [[ -n "$CHECKOUT_REF" && -n "$SETUP_NODE_REF" && -n "$SETUP_BUN_REF" ]] \
    || die "Could not derive reviewed GitHub Action pins from template quality.yml."

  mkdir -p .github/workflows

  TEST_COMMAND="node --test"
  for path in "${WORKFLOW_TESTS[@]}"; do
    TEST_COMMAND+=" $path"
  done

  cat > .github/workflows/omp-workflow.yml <<EOF
# Managed by universal-pi-to-omp.sh.
# Application CI remains in the project's existing workflows.
name: omp-workflow

on:
  pull_request:
  push:
    branches: [$DEFAULT_BRANCH, ai-changes]

permissions:
  contents: read

concurrency:
  group: omp-workflow-\${{ github.workflow }}-\${{ github.ref }}
  cancel-in-progress: true

jobs:
  harness:
    runs-on: ubuntu-latest
    timeout-minutes: 15

    steps:
      - name: Checkout
        uses: $CHECKOUT_REF
        with:
          persist-credentials: false

      - name: Set up Node
        uses: $SETUP_NODE_REF
        with:
          node-version: $NODE_VERSION

      - name: Validate OMP workflow contract
        run: |
          bash scripts/omp-doctor.sh --static
          $TEST_COMMAND

      - name: Set up Bun
        uses: $SETUP_BUN_REF
        with:
          bun-version: $BUN_VERSION

      - name: Install reviewed OMP into CI-only directory
        run: bun install --cwd .github/omp-runtime --ignore-scripts

      - name: Validate real OMP CLI and project discovery
        env:
          PI_CODING_AGENT_DIR: \${{ runner.temp }}/omp-workflow-agent
          OMP_PACKAGE_ROOT: \${{ github.workspace }}/.github/omp-runtime/node_modules/@oh-my-pi/pi-coding-agent
          AI_PR_DELIVERY: "off"
        run: |
          export PATH="\$PWD/.github/omp-runtime/node_modules/.bin:\$PATH"
          node scripts/omp-native-smoke.mjs
          bun scripts/omp-discovery-smoke.ts
EOF
fi

# ---------------------------------------------------------------------------
# Stale operational-reference checks.
#
# Historical provenance files such as .omp/migration-map.json and
# docs/RESEARCH_PI_BASELINE.md are intentionally excluded.
# ---------------------------------------------------------------------------

STALE_OPERATIONAL="$TMP/stale-operational.txt"
: > "$STALE_OPERATIONAL"

for target in AGENTS.md scripts .github/workflows; do
  [[ -e "$target" ]] || continue
  grep -RInE \
    'scripts/pi-doctor\.sh|scripts/pi-sandbox\.sh|verify-package-integrity\.mjs|Dockerfile\.pi|\.pi/verification\.json|(^|[[:space:]])\./p([[:space:]]|$)' \
    "$target" 2>/dev/null >> "$STALE_OPERATIONAL" || true
done

# Ignore the migration script itself if it lives inside the project.
if [[ -n "$SELF_REL" && -s "$STALE_OPERATIONAL" ]]; then
  node - "$STALE_OPERATIONAL" "$SELF_REL" <<'NODE'
const fs = require("node:fs");
const file = process.argv[2];
const self = process.argv[3] + ":";
const lines = fs.readFileSync(file, "utf8").split(/\r?\n/).filter(Boolean);
fs.writeFileSync(file, lines.filter(line => !line.startsWith(self)).join("\n") + (lines.length ? "\n" : ""));
NODE
fi

if [[ -s "$STALE_OPERATIONAL" ]]; then
  warn "Operational Pi references remain:"
  sed 's/^/  /' "$STALE_OPERATIONAL" >&2
fi

# ---------------------------------------------------------------------------
# Record migration state before verification so an interrupted run can rerun
# safely without a special repair mode.
# ---------------------------------------------------------------------------

cat > "$STATE_FILE" <<EOF
version=$VERSION
repository=$ROOT
template_sha=$TEMPLATE_SHA
omp_version=$OMP_VERSION
last_run_utc=$STAMP
status=applied
backup=$BACKUP_ROOT
EOF

# ---------------------------------------------------------------------------
# Deterministic verification.
# ---------------------------------------------------------------------------

VERIFY_FAILED=0
CONTEXT_READY="unknown"

run_check() {
  local label="$1"
  shift
  info "$label"
  if "$@"; then
    return 0
  fi
  warn "$label failed."
  VERIFY_FAILED=1
  return 0
}

if [[ "$VERIFY" -eq 1 ]]; then
  run_check "Validating OMP workflow contract..." \
    node scripts/validate-workflow.mjs

  # Context readiness is informational until /wf-bootstrap.
  info "Inspecting project-context readiness..."
  if CONTEXT_OUTPUT="$(node scripts/validate-project-context.mjs --static 2>&1)"; then
    printf '%s\n' "$CONTEXT_OUTPUT"
    if printf '%s' "$CONTEXT_OUTPUT" | grep -q '^READY project context:'; then
      CONTEXT_READY="ready"
    else
      CONTEXT_READY="needs-bootstrap"
    fi
  else
    printf '%s\n' "$CONTEXT_OUTPUT" >&2
    warn "Project-context validator itself failed."
    VERIFY_FAILED=1
  fi

  run_check "Validating domain skill routing..." \
    node scripts/validate-skill-evals.mjs

  info "Running workflow regression tests..."
  if node --test "${WORKFLOW_TESTS[@]}"; then
    :
  else
    warn "Workflow regression tests failed."
    VERIFY_FAILED=1
  fi

  run_check "Validating workflow eval suite without model calls..." \
    node scripts/run-workflow-evals.mjs --dry-run

  run_check "Validating affected-verification routing..." \
    node scripts/verify-affected.mjs --file .omp/config.yml --plan

  # Syntax-check project integration shell entrypoints without executing them.
  SHELL_CHECKS=(scripts/omp-doctor.sh scripts/omp-sandbox.sh)
  [[ -f scripts/verify.sh ]] && SHELL_CHECKS+=(scripts/verify.sh)
  [[ -f scripts/ci-install.sh ]] && SHELL_CHECKS+=(scripts/ci-install.sh)
  [[ -f scripts/project-verify.sh ]] && SHELL_CHECKS+=(scripts/project-verify.sh)

  run_check "Checking shell integration syntax..." \
    bash -n "${SHELL_CHECKS[@]}"

  if command -v omp >/dev/null 2>&1; then
    INSTALLED_OMP="$(omp --version 2>/dev/null || true)"
    info "Local OMP detected: ${INSTALLED_OMP:-unknown version}"
    run_check "Running native OMP smoke..." \
      node scripts/omp-native-smoke.mjs
  else
    warn "OMP is not installed locally; native smoke is NOT EXECUTED."
    warn "Reviewed runtime for this template: OMP $OMP_VERSION"
  fi

  if [[ "$FULL_VERIFY" -eq 1 ]]; then
    [[ -f scripts/verify.sh ]] || die "--full-verify requested but scripts/verify.sh is missing."
    run_check "Running project full verification..." \
      bash scripts/verify.sh
  fi
fi

if [[ -s "$STALE_OPERATIONAL" ]]; then
  VERIFY_FAILED=1
fi

if [[ "$VERIFY_FAILED" -eq 0 ]]; then
  FINAL_STATE="verified"
else
  FINAL_STATE="verification-failed"
fi

node - "$STATE_FILE" "$FINAL_STATE" <<'NODE'
const fs = require("node:fs");
const file = process.argv[2];
const state = process.argv[3];
let text = fs.readFileSync(file, "utf8");
text = text.replace(/^status=.*$/m, `status=${state}`);
fs.writeFileSync(file, text);
NODE

# ---------------------------------------------------------------------------
# Final report.
# ---------------------------------------------------------------------------

log
log "Migration summary"
log "────────────────────────────────────────────────────────"
ok "OMP workflow synchronized from $TEMPLATE_SHA"
ok "Reviewed OMP version: $OMP_VERSION"
ok "Project-specific product/application/deployment state preserved."
ok "Rollback backup: $BACKUP_ROOT"

case "$CONTEXT_READY" in
  ready)
    ok "Project context is already READY."
    ;;
  needs-bootstrap)
    warn "Project context still needs /wf-bootstrap; this is not a migration failure."
    ;;
esac

log
log "Git changes:"
git status --short || true

log
log "Next:"
log "  1. Review:  git diff"
log "  2. Start:   omp"
log "  3. Adapt:   /wf-bootstrap"
log "  4. Gate:    node scripts/validate-project-context.mjs --require-ready"
log
log "Optional full application gate:"
log "  bash scripts/verify.sh"
log
log "Nothing was committed, pushed, merged, deployed, installed, or published."

if [[ "$VERIFY_FAILED" -ne 0 ]]; then
  log
  warn "Migration files are applied, but deterministic verification is not fully green."
  warn "Fix the reported check and simply rerun this SAME script; it will auto-resume safely."
  exit 2
fi

ok "Migration completed and deterministic workflow verification is green."

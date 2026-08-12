#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

ci_mode=0
static_mode=0
for argument in "$@"; do
  case "$argument" in
    --ci) ci_mode=1 ;;
    --static) static_mode=1 ;;
    *) printf 'Unknown argument: %s\n' "$argument" >&2; exit 2 ;;
  esac
done

failures=0

pass() { printf 'PASS  %s\n' "$1"; }
warn() { printf 'WARN  %s\n' "$1" >&2; }
fail() { printf 'FAIL  %s\n' "$1" >&2; failures=$((failures + 1)); }

version_at_least() {
  node -e '
    const parse = (value) => value.split(".").map((part) => Number.parseInt(part, 10) || 0);
    const current = parse(process.argv[1]);
    const minimum = parse(process.argv[2]);
    const length = Math.max(current.length, minimum.length);
    for (let index = 0; index < length; index += 1) {
      const left = current[index] || 0;
      const right = minimum[index] || 0;
      if (left > right) process.exit(0);
      if (left < right) process.exit(1);
    }
    process.exit(0);
  ' "$1" "$2"
}

required=(
  AGENTS.md
  CHANGELOG.md
  CONTRIBUTING.md
  SECURITY.md
  Dockerfile.pi
  .dockerignore
  .github/dependabot.yml
  .github/pull_request_template.md
  p
  .mcp.json
  .pi/settings.json
  .pi/package-integrity.json
  .pi/verification.json
  .pi/models.env
  .pi/APPEND_SYSTEM.md
  .pi/extensions/safety-guard.js
  .pi/prompts/bootstrap.md
  .pi/prompts/discover.md
  .pi/prompts/design.md
  .pi/prompts/spec.md
  .pi/prompts/adr.md
  .pi/prompts/build.md
  .pi/prompts/build-ui.md
  .pi/prompts/design-review.md
  .pi/prompts/plan.md
  .pi/prompts/release-plan.md
  .pi/prompts/review.md
  .pi/prompts/ship.md
  .pi/prompts/incident.md
  .pi/prompts/handoff.md
  .pi/prompts/resume.md
  .pi/prompts/test.md
  .pi/skills/risk-review/SKILL.md
  .pi/skills/verification-routing/SKILL.md
  .pi/skills/test-design/SKILL.md
  .pi/skills/browser-qa/SKILL.md
  .pi/skills/frontend-design/SKILL.md
  .pi/skills/frontend-design/references/visual-quality-rubric.md
  docs/HARNESS.md
  docs/RESEARCH.md
  docs/DESIGN.md
  docs/EVALUATION.md
  docs/QUALITY.md
  docs/exec-plans/README.md
  docs/TOOLING_SETUP.md
  evals/cases.json
  evals/fixtures/tiered-pricing/pricing.mjs
  evals/fixtures/tiered-pricing/pricing.test.mjs
  evals/fixtures/tiered-pricing/verify-regression.mjs
  scripts/pi-sandbox.sh
  scripts/verify-package-integrity.mjs
  scripts/secret-scan-filter.mjs
  scripts/secret-scan-allowlist.json
  scripts/run-workflow-evals.mjs
  scripts/lib/workflow-evals.mjs
  scripts/verify-affected.mjs
  tests/safety-guard.test.mjs
  tests/launcher.test.mjs
  tests/workflow-evals.test.mjs
  tests/verify-affected.test.mjs
)

for file in "${required[@]}"; do
  [[ -f "$file" ]] && pass "$file exists" || fail "$file is missing"
done

node_version="$(node -p 'process.versions.node' 2>/dev/null || true)"
if [[ -n "$node_version" ]] && version_at_least "$node_version" "22.19.0"; then
  pass "Node $node_version satisfies Pi 0.84.1 requirement (>=22.19.0)"
else
  fail "Node >=22.19.0 is required for the reviewed Pi pin"
fi

if node -e 'for (const f of [".pi/settings.json", ".pi/verification.json", ".mcp.json", "evals/cases.json", "scripts/secret-scan-allowlist.json"]) JSON.parse(require("fs").readFileSync(f,"utf8"))' >/dev/null 2>&1; then
  pass "Pi, verification, MCP, evaluation, and secret-scan allowlist configs are valid JSON"
else
  fail "a Pi, verification, MCP, evaluation, or secret-scan allowlist config is invalid JSON"
fi

if node --check .pi/extensions/safety-guard.js >/dev/null 2>&1; then
  pass "safety guard parses"
else
  fail "safety guard has a JavaScript syntax error"
fi

if [[ "$static_mode" -eq 1 ]]; then
  pass "workflow behavior tests omitted in explicit static-only mode"
elif node --test tests/*.test.mjs; then
  pass "workflow behavior tests pass"
else
  fail "workflow behavior tests failed"
fi

if node --check scripts/run-workflow-evals.mjs >/dev/null 2>&1 && \
   node --check scripts/lib/workflow-evals.mjs >/dev/null 2>&1 && \
   node --check scripts/verify-affected.mjs >/dev/null 2>&1 && \
   node --check scripts/secret-scan-filter.mjs >/dev/null 2>&1; then
  pass "workflow evaluation, verification, and secret-scan runners parse"
else
  fail "a workflow evaluation, verification, or secret-scan runner has a syntax error"
fi

if bash -n p scripts/verify.sh scripts/pi-doctor.sh scripts/pi-sandbox.sh scripts/ci-install.sh; then
  pass "shell entrypoints parse"
else
  fail "shell syntax validation failed"
fi

if node scripts/run-workflow-evals.mjs --dry-run >/dev/null; then
  pass "workflow evaluation suite is structurally valid"
else
  fail "workflow evaluation suite validation failed"
fi

if node scripts/verify-package-integrity.mjs >/dev/null; then
  pass "configured package pins have reviewed integrity records"
else
  fail "package integrity manifest validation failed"
fi

check_context_budget() {
  local file="$1" max_lines="$2" max_bytes="$3"
  local lines bytes
  lines="$(wc -l <"$file" | tr -d ' ')"
  bytes="$(wc -c <"$file" | tr -d ' ')"
  if (( lines <= max_lines && bytes <= max_bytes )); then
    pass "$file stays within always-loaded context budget (${lines} lines, ${bytes} bytes)"
  else
    fail "$file is too large for always-loaded context (${lines}/${max_lines} lines, ${bytes}/${max_bytes} bytes); move detail to docs/skills"
  fi
}

check_context_budget AGENTS.md 180 9000
check_context_budget .pi/APPEND_SYSTEM.md 180 12000

combined_context_lines="$(cat AGENTS.md .pi/APPEND_SYSTEM.md | wc -l | tr -d ' ')"
combined_context_bytes="$(( $(wc -c <AGENTS.md) + $(wc -c <.pi/APPEND_SYSTEM.md) ))"
if (( combined_context_lines <= 220 && combined_context_bytes <= 12000 )); then
  pass "combined always-loaded context stays within budget (${combined_context_lines} lines, ${combined_context_bytes} bytes)"
else
  fail "combined always-loaded context is too large (${combined_context_lines}/220 lines, ${combined_context_bytes}/12000 bytes)"
fi

for reference in 'docs/HARNESS.md' 'docs/QUALITY.md' 'verification-routing' 'test-design'; do
  if grep -Fq "$reference" AGENTS.md; then
    pass "AGENTS.md maps to $reference"
  else
    fail "AGENTS.md must map to $reference"
  fi
done

if grep -Fq 'at most two evaluator/repair rounds' .pi/APPEND_SYSTEM.md && \
   grep -Fq 'same check or implementation approach fails twice' .pi/APPEND_SYSTEM.md; then
  pass "execution policy includes bounded evaluator and failure-recovery loops"
else
  fail "execution policy is missing evaluator/failure-recovery bounds"
fi

if node <<'NODE'
const fs = require('fs');
const settings = JSON.parse(fs.readFileSync('.pi/settings.json', 'utf8'));
const installed = new Set((settings.packages || []).map((entry) =>
  typeof entry === 'string' ? entry : entry && entry.source
));
const required = [
  'npm:pi-sub-agent@0.1.5',
  'npm:pi-mcp-adapter@2.20.1',
  'npm:@juicesharp/rpiv-todo@2.1.0',
  'npm:pi-lsp-adapter@0.1.3',
  'npm:@dreki-gg/pi-doc-search@0.3.2',
  'npm:@getpipher/vision@0.5.2',
  'npm:@bytetrue/pi-web-search@0.1.3',
];
const missing = required.filter((item) => !installed.has(item));
if (missing.length) {
  console.error(`Missing package pins: ${missing.join(', ')}`);
  process.exit(1);
}
if (installed.has('npm:@bytetrue/pi-vision@0.2.0')) {
  console.error('Obsolete vision package is still configured; use npm:@getpipher/vision@0.5.2 only.');
  process.exit(1);
}
const mcpPackage = (settings.packages || []).find((entry) =>
  entry && typeof entry === 'object' && entry.source === 'npm:pi-mcp-adapter@2.20.1'
);
if (!mcpPackage || !Array.isArray(mcpPackage.skills) || mcpPackage.skills.length !== 0) {
  console.error('MCP adapter package skills must be disabled to avoid loading mcpScript guidance.');
  process.exit(1);
}
NODE
then
  pass "production package pins are present"
else
  fail "production package pin validation failed"
fi

if node <<'NODE'
const fs = require('fs');
const config = JSON.parse(fs.readFileSync('.mcp.json', 'utf8'));
const server = config.mcpServers?.playwright;
if (!server) throw new Error('Playwright MCP server is missing');
if (config.settings?.scriptMode !== false) throw new Error('MCP scripting must be disabled');
if (!Array.isArray(server.args) || !server.args.includes('@playwright/mcp@0.0.79')) {
  throw new Error('Playwright MCP version pin is missing');
}
if (!server.args.includes('--block-service-workers')) {
  throw new Error('Playwright MCP must block service workers in isolated QA sessions');
}
if (server.lifecycle !== 'lazy') throw new Error('Playwright MCP must be lazy');
const included = new Set(server.includeTools || []);
const excluded = new Set(server.excludeTools || []);
for (const unsafe of ['browser_file_upload', 'browser_drop']) {
  if (included.has(unsafe)) throw new Error(`Unsafe browser tool exposed: ${unsafe}`);
  if (!excluded.has(unsafe)) throw new Error(`Unsafe browser tool must be explicitly excluded: ${unsafe}`);
}
for (const required of ['browser_snapshot', 'browser_find', 'browser_navigate', 'browser_take_screenshot', 'browser_evaluate']) {
  if (!included.has(required)) throw new Error(`Required browser tool missing: ${required}`);
}
if (server.args.includes('--allowed-origins')) {
  throw new Error('Autonomous browser mode must not be limited to localhost by MCP config');
}
NODE
then
  pass "Playwright MCP is pinned, lazy, autonomous, and blocks file injection"
else
  fail "Playwright MCP policy validation failed"
fi

launcher_tools=(
  subagent
  todo
  mcp
  lsp_diagnostics
  doc_search_get_library_docs
  describe_image
  web_search
  web_fetch
)

for tool in "${launcher_tools[@]}"; do
  if grep -Fq "$tool" p; then
    pass "launcher allows $tool"
  else
    fail "launcher does not allow $tool"
  fi
done

if grep -Fq 'PI_PROJECT_TRUST:-always' p && \
   grep -Fq 'args+=(--approve)' p && \
   grep -Fq 'PI_GUARD_MODE:-autonomous' p && \
   grep -Fq 'PI_GUARD_MODE=${PI_GUARD_MODE:-strict}' scripts/pi-sandbox.sh; then
  pass "launcher defaults to trusted autonomous mode and sandbox launcher opts into strict mode"
else
  fail "launcher autonomy/trust defaults are inconsistent"
fi

if grep -Fq '/vision-use' docs/TOOLING_SETUP.md && \
   grep -Fq '["text", "image"]' docs/TOOLING_SETUP.md && \
   ! grep -Fq 'image_ask' p README.md .pi/APPEND_SYSTEM.md docs/TOOLING_SETUP.md .pi/skills/browser-qa/SKILL.md; then
  pass "dual-model vision setup and capability contract are documented"
else
  fail "vision setup must document model switching and use describe_image"
fi

doctor_tmp_dir=".artifacts/pi-doctor"
mkdir -p "$doctor_tmp_dir"
frontmatter_scan_file="$(mktemp "$doctor_tmp_dir/frontmatter.XXXXXX")"
secret_scan_file=""
secret_filtered_file=""
cleanup() {
  [[ -z "$frontmatter_scan_file" ]] || rm -f "$frontmatter_scan_file"
  [[ -z "$secret_scan_file" ]] || rm -f "$secret_scan_file"
  [[ -z "$secret_filtered_file" ]] || rm -f "$secret_filtered_file"
  rmdir "$doctor_tmp_dir" 2>/dev/null || true
}
trap cleanup EXIT

missing_frontmatter=0
{
  find .pi/prompts -type f -name '*.md' -print0
  find .pi/skills -type f -name 'SKILL.md' -print0
} >"$frontmatter_scan_file"
while IFS= read -r -d '' file; do
  first_line="$(head -n 1 "$file" || true)"
  if [[ "$first_line" != "---" ]]; then
    printf 'Missing frontmatter: %s\n' "$file" >&2
    missing_frontmatter=1
  fi
done <"$frontmatter_scan_file"
rm -f "$frontmatter_scan_file"
frontmatter_scan_file=""

if [[ "$missing_frontmatter" -eq 0 ]]; then
  pass "prompt and skill frontmatter markers found"
else
  fail "one or more prompt/skill files have no YAML frontmatter"
fi

if grep -Fq 'Visual excellence' docs/QUALITY.md && \
   grep -Fq '3.25/4' docs/QUALITY.md && \
   grep -Fq 'Anti-template review' .pi/skills/frontend-design/references/visual-quality-rubric.md && \
   grep -Fq 'LCP ≤ 2.5 s' .pi/skills/frontend-design/references/visual-quality-rubric.md; then
  pass "frontend design contract includes hard gates, anti-template review, and craft thresholds"
else
  fail "frontend design quality contract is incomplete"
fi

if grep -Eq '^export PI_MAIN_MODEL=""$' .pi/models.env && \
   grep -Eq '^export PI_MAIN_THINKING=""$' .pi/models.env; then
  pass "generic template does not force a model/provider"
else
  fail "generic template must leave PI_MAIN_MODEL and PI_MAIN_THINKING empty"
fi

secret_scan_file="$(mktemp "$doctor_tmp_dir/secrets.XXXXXX")"
secret_filtered_file="$(mktemp "$doctor_tmp_dir/secrets-filtered.XXXXXX")"

# The scan pattern is fixed and full-tree. The filter then drops only the
# documented non-secret classes (see scripts/secret-scan-filter.mjs):
# placeholder values (`...`, `change-me-*`), environment references
# (`process.env.*`), and the exact path-scoped synthetic/sentinel test
# credentials committed for the Fast English redaction/smoke proofs
# (scripts/secret-scan-allowlist.json). Everything else still fails.
if find . -maxdepth 6 -type f \
  ! -path './.git/*' \
  ! -path './.artifacts/*' \
  ! -path './node_modules/*' \
  ! -path './.pi/npm/*' \
  -print0 |
  xargs -0 grep -En \
    'sk-[A-Za-z0-9_-]{16,}|(API_KEY|ACCESS_TOKEN|SECRET|PASSWORD)[[:space:]]*=[[:space:]]*[^"<${][^[:space:]]+' \
    >"$secret_scan_file" 2>/dev/null; then
  if node scripts/secret-scan-filter.mjs <"$secret_scan_file" >"$secret_filtered_file" 2>/dev/null; then
    if [[ -s "$secret_filtered_file" ]]; then
      cat "$secret_filtered_file" >&2
      fail "possible secret found"
    else
      allowed="$(wc -l <"$secret_scan_file" | tr -d ' ')"
      pass "no obvious committed secret pattern found ($allowed documented placeholder/env/synthetic line(s) exempted)"
    fi
  else
    fail "secret scan filter could not run (scripts/secret-scan-filter.mjs)"
  fi
else
  pass "no obvious committed secret pattern found"
fi

if [[ -e opencode.jsonc || -e .opencode || -e oc ]]; then
  fail "legacy OpenCode workflow files remain"
else
  pass "legacy OpenCode workflow removed"
fi

if command -v pi >/dev/null 2>&1; then
  version="$(pi --version 2>/dev/null | grep -Eo '[0-9]+\.[0-9]+\.[0-9]+' | head -1 || true)"
  if [[ -n "$version" ]]; then
    if version_at_least "$version" "0.84.1"; then
      pass "Pi $version satisfies minimum 0.84.1"
      if [[ "$version" != "0.84.1" ]]; then
        warn "Pi $version differs from the reviewed template pin 0.84.1; revalidate package/tool compatibility"
      fi
    else
      fail "Pi $version is older than required 0.84.1"
    fi
  else
    warn "Pi is installed but its version could not be parsed"
  fi
elif [[ "$ci_mode" -eq 1 ]]; then
  warn "Pi CLI is not installed in CI; static workflow validation only"
else
  fail "Pi CLI is not installed"
fi

if [[ "$failures" -gt 0 ]]; then
  printf '\n%d validation failure(s)\n' "$failures" >&2
  exit 1
fi

printf '\nPi workflow validation passed.\n'

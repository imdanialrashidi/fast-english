# OMP setup and capability routing

## Requirements

- Reviewed OMP **18.0.6**, upstream commit `b4e8e856ad40294167679a3f88417c07429fe59b`.
- Bun >=1.3.14 for package installation; the standalone OMP build does not need a separate Bun runtime.
- Node >=22.19, Bash and Git for the project-owned verification and PR utilities.
- Authenticated `gh` and ordinary Git push credentials only for fixed-lane PR delivery.
- Browser downloads, language servers, product dependencies and provider credentials are conditional prerequisites, not bundled guarantees.

Install from the official release or run:

```bash
bun install -g @oh-my-pi/pi-coding-agent@18.0.6
```

Authenticate through OMP's native provider setup. Do not extract, migrate or
commit credential stores.

## Launch directly

Start in the project root:

```bash
omp
```

OMP discovers the project `.omp/config.yml`, commands, skills, append prompt and
extensions from the current working directory. There is no project launcher,
custom tool allowlist, package loader or shell-sourced model file.

Use native `/model`, `/setup` and `/settings` for model/provider configuration.
The template does not ship a project model overlay or force a vendor. Global or
CLI configuration remains owned by OMP.

## Project configuration

The JSON-compatible YAML file contains only deliberate project differences:

- safer write-mode approvals and explicit browser/eval/computer/security policy;
- a resource cap of two children, one recursion level and bounded child runtime/request budget;
- catalog-only lazy-device docs to reduce prompt schema overhead;
- a deterministic browser screenshot directory;
- native GitHub and native secret redaction enabled.

Keys whose values already equal OMP defaults are intentionally omitted. OMP
resolves them from its pinned schema. The eval overlay changes only the policies
needed for a deterministic isolated run: direct tools, one child, denied broad
runtimes and disabled project MCP config.

## Native capability routing

| Need | Native OMP route | Remaining project contract |
|---|---|---|
| Tiny fix | Direct default workflow or one bundled `sonic` task | One targeted proof; no ceremony |
| Planning | `/plan` and native `todo` | Observable acceptance; ExecPlan only when continuity needs it |
| Discovery | Bundled `scout` | Stop after sufficient evidence |
| Review | Bundled `reviewer` | Judge the accepted contract and cite real evidence |
| Security review | Bundled `security-reviewer` | Apply project authority/data rules |
| UI work | Bundled `designer` and native `browser` | `docs/DESIGN.md` and `docs/VISUAL_REVIEW.md` |
| Delegated implementation | One bundled `task`/`sonic`/`designer` writer | Parent does not edit concurrently |
| Exact edits | Native hashline `edit` | Re-read stale anchors |
| Semantic code | Native `lsp`, `ast_grep` and `ast_edit` | Inspect affected callers and tests |
| Research | Bundled `librarian`, native `web_search`, URL `read` and `github` reads | Prefer versioned primary sources |
| Rare schema | `read xd://` then the device docs | No custom loader |
| Continuity | `/handoff`, `/resume`, sessions and compaction | Working tree and current proof outrank summaries |

The bundled `librarian` and `reviewer` include Bash in OMP 18.0.6. The project
guard blocks Git/external/sensitive mutations, and the repository policy still
requires exactly one active writer. Native agent instructions remain authoritative
for their own read-only roles; no project agent copy shadows them.

The project skills are intentionally split into three always-available workflow
contracts and four conditional domain contracts:

- `browser-qa` — rendered journey, DOM and pixel evidence;
- `test-design` — economical tests with an independent oracle;
- `verification-routing` — affected checks with a conservative full fallback.
- `accessibility-audit` — scoped WCAG and assistive-technology evidence when a
  user-facing accessibility criterion is in scope;
- `web-performance` — repeatable route measurements and lab/field separation
  when loading, latency, layout or asset budgets are in scope;
- `technical-seo` — public indexability, rendering, metadata, crawl and
  structured-data evidence when search discoverability is in scope;
- `rtl-i18n` — direction, bidi, formatting and long-string evidence when
  localized or RTL behavior is in scope.

These four are not a second browser, test, SEO, profiling, or translation
framework. OMP's native tools and the repository's existing commands remain the
execution layer. Routing fixtures live in `evals/skill-cases.json`; validate
them with `node scripts/validate-skill-evals.mjs`.

Run `node scripts/validate-project-context.mjs --static` before work. The
unbootstrapped template is intentionally `NOT READY`; after `/wf-bootstrap`,
`--require-ready` is a real gate against empty contract prompts.

The eight `wf-*` commands cover only product/spec/design/test/ship/release/incident
contracts for which OMP has no equivalent project policy. Ordinary build, review,
discovery, plan, handoff and resume wrappers are intentionally absent.

## Optional isolation

`bash scripts/omp-sandbox.sh` provides an optional container boundary stronger
than native task filesystem isolation. It is not required for trusted ordinary
work and does not replace network policy.

Native MCP remains available for a genuinely missing integration. No MCP server
is required for browser, task, todo, LSP, GitHub or web search.

## Verification levels

1. `bash scripts/omp-doctor.sh --static` — structure, pins, metadata and eval-copy validation.
2. `bash scripts/verify.sh` — deterministic workflow tests and the product gate: fast verification plus all 18 real-PocketBase smoke suites, deterministic three-surface builds, topology and PWA checks.
3. `bash scripts/omp-doctor.sh --native` — installed CLI and effective config.
4. `bun scripts/omp-discovery-smoke.ts` — pinned SDK discovery, bundled agents and extension loading.
5. `node scripts/run-workflow-evals.mjs --model <provider/model> --trials 3` — opt-in paid model trials.

The 18 suites are the canonical `pnpm smoke:*` family (auth, payment, payment-preview, placement, placement-levels, placement-race, placement-capacity, lessons, episode, progress, podcast-domain, content-import, content-admin, library, business-settings, staff, operator, plus one alias) — see `docs/QUALITY.md` for the mapped lane.

An unavailable prerequisite is `NOT EXECUTED` or `BLOCKED`, not `PASS`.

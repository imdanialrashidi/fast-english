# Pi → OMP migration

## Pinned inputs

- Source: `imdanialrashidi/pi-production-workflow-template` at
  `40d1c630fdea3acbd29dbb1c7a68e3bd2efb0477` (77 files).
- Runtime: OMP `v18.0.6`, commit `b4e8e856ad40294167679a3f88417c07429fe59b`.
- Destination: `imdanialrashidi/omp-production-workflow-template`.

The complete machine-readable inventory is [migration-map.json](../.omp/migration-map.json).
Every original file has its blob identity, disposition, destination(s) and reason.
No private profile information is part of this template.

## Invariants retained

The four task classes, acceptance criteria, one writer, bounded delegation,
test-value gate, independent oracle, red-before-green proof, two repair rounds,
truthful evidence vocabulary, visual product/studio passes, craft thresholds,
security/data boundaries, fixed PR lane, recovery and durable ExecPlans survive.
Eight project prompts and seven focused skills remain after the native-surface
audit. Three skills protect workflow evidence and four conditional domain skills
cover accessibility, web performance, public technical SEO, and RTL/i18n without
shipping duplicate browser, test, designer, or agent runtimes. Wrappers duplicated
by OMP commands, bundled agents or the default system workflow were removed. All
17 source eval IDs remain and now exercise native surfaces directly where their
former wrapper disappeared.

## Component decisions

| Previous component | Decision | OMP-native replacement / retained gap |
|---|---|---|
| Ordinary build and quick-fix wrappers | Remove project command/skill | OMP default implementation workflow; bundled `sonic` or `task` when delegation adds value |
| Discovery wrapper | Remove project command | Bundled `scout` |
| Review and risk wrappers | Remove project command/skill/agent | Bundled `reviewer` and `security-reviewer`; project quality contract remains |
| UI build/design-review wrappers and frontend skill | Remove | Bundled `designer` plus native `browser`; retain `docs/VISUAL_REVIEW.md` as an acceptance rubric, not a tool |
| Plan, handoff and resume wrappers | Remove | Native `/plan`, `/handoff`, `/resume`, sessions and `todo` |
| `p` launcher and model overlay example | Remove | Run `omp` directly; use native `/model`, `/setup`, `/settings` and CLI overlays |
| `pi-sub-agent` | Remove package | Native `task` and bundled specialist roles |
| `rpiv-todo` | Remove package | Native `todo` and plan mode |
| `pi-lsp-adapter` | Remove package | Native LSP, diagnostics, semantic/AST tools |
| `pi-web-search` | Remove package | Native web search/provider routing |
| `pi-doc-search` | Remove default dependency | Installed types/source + primary URL/GitHub reads; optional native MCP only for a demonstrated gap |
| `pi-mcp-adapter` | Remove package | Native MCP lifecycle and `xd://` discovery |
| Playwright MCP server | Remove | Native browser; keep project Playwright tests when appropriate |
| `harness_tools` dynamic loader | Remove | Native lazy devices/catalog |
| Smart Read wrapper | Remove | Native structural reads and output artifacts; exact selectors for evidence |
| Continuity capsule | Remove | Native session/compaction plus explicit ExecPlans |
| Failure-only third-call block | Native adaptation | Native repeated-call steering + unchanged two-failure workflow stop rule |
| Runtime Vision metadata | Remove | Native image blocks and explicit inspect/re-capture discipline |
| `models.env`, Pi CLI flags | Remove | Native model roles and optional CLI config overlay |
| Pi package integrity list | Replace | Reviewed OMP version/source/schema pin; no obsolete package list |
| Safety guard | Port and extend | Repo policy not supplied by native approvals; covers native GitHub and `xd://` |
| PR helper | Preserve | Native `github pr_push/pr_create` do not provide its scoped fixed-lane/CAS/receipt contract |
| Affected router and project gates | Preserve | OMP executing a command is not dependency-aware verification selection |
| RPC eval runner | Port | Terminal `agent_end`, not Pi `agent_settled`; preserve slash expansion |

## Deliberate non-equivalences

- Native `/plan`, `/handoff` and `/resume` keep their meanings; review uses the
  bundled `reviewer`. The eight remaining project prompts are uniformly prefixed
  `wf-`; undocumented shell-style `${ARGUMENTS:-...}` is replaced with supported
  `$ARGUMENTS` and explicit fallback prose.
- Native planning can forbid writing `docs/exec-plans/` while active. Use its
  plan file and transfer durable state after approved exit; never bypass the guard.
- Native repeated-call steering is not a failure-only hard block. Do not claim
  mechanical equivalence; validate the two-attempt policy on real failure cases.
- Native browser/eval execute broad code. They require approval in normal mode
  and are denied in strict/default eval mode. This intentionally avoids treating
  page-only Playwright permissions as sufficient for the new runtime.
- The bundled reviewer has Bash in OMP 18.0.6. The project no longer shadows it;
  native agent instructions, the project guard and the one-active-writer policy
  define the remaining boundary.
- Native GitHub operations remain useful for reads, but mutations cannot bypass
  the reviewed PR helper. Native cloud security scans do not imply permission to
  transmit repository data or create external findings.
- Canonical OMP environment variables can retain a `PI_` prefix upstream
  (`PI_CODING_AGENT_DIR`). Do not mechanically rename genuine native APIs.

## Upgrade and rollback

Update the source pin and schema snapshot together, review native API changes,
run deterministic and native discovery checks, then compare repeated matched-model
trials. Do not claim output quality improved from dependency count alone.
Keep the preceding verified Git commit/tag as the recovery point; rollback is an
owner-authorized normal revert, never a destructive reset or force push.

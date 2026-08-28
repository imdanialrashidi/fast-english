# Source-backed OMP design decisions

Reviewed **2026-08-26** against OMP **18.0.6** and the exact Pi baseline in
[MIGRATION.md](MIGRATION.md). Source review covered runtime configuration,
discovery, skills, prompt expansion, tool approvals, native tasks/browser/GitHub,
extensions, hashline/LSP, compaction, and RPC—not just the marketing page.

## Primary OMP evidence

All runtime links below use the reviewed release rather than a moving main branch.

| Primary source | Decision | Limit / proof needed |
|---|---|---|
| [Settings](https://github.com/can1357/oh-my-pi/blob/v18.0.6/docs/settings.md), [schema](https://github.com/can1357/oh-my-pi/blob/v18.0.6/packages/coding-agent/src/config/settings-schema.ts) | Keep only deliberate project deviations in `.omp/config.yml`; omit values already supplied by the schema | CLI/global overrides can still alter effective settings; validate the installed runtime |
| [Slash discovery/expansion](https://github.com/can1357/oh-my-pi/blob/v18.0.6/docs/slash-command-internals.md), [built-in modes](https://github.com/can1357/oh-my-pi/blob/v18.0.6/packages/coding-agent/src/slash-commands/builtin-modes.ts), [lifecycle](https://github.com/can1357/oh-my-pi/blob/v18.0.6/packages/coding-agent/src/slash-commands/builtin-lifecycle.ts) | Retain eight unique `.omp/commands/wf-*` prompts; remove project plan/handoff/resume and ordinary-work wrappers | Built-ins win collisions; native command behavior must not be approximated by prompt copies |
| [Skills](https://github.com/can1357/oh-my-pi/blob/v18.0.6/docs/skills.md), [context](https://github.com/can1357/oh-my-pi/blob/v18.0.6/docs/context-files.md) | Retain only browser-QA, test-design and verification-routing skills | Design, quick-fix and risk wrappers duplicated bundled agents/default behavior |
| [System append](https://github.com/can1357/oh-my-pi/blob/v18.0.6/docs/system-prompt-customization.md) | Append workflow policy; do not ship SYSTEM.md | Replacing the default prompt would remove native tool/workflow guidance |
| [Task discovery](https://github.com/can1357/oh-my-pi/blob/v18.0.6/docs/task-agent-discovery.md), [task](https://github.com/can1357/oh-my-pi/blob/v18.0.6/docs/tools/task.md), [bundled agents](https://github.com/can1357/oh-my-pi/blob/v18.0.6/packages/coding-agent/src/task/agents.ts) | Use bundled scout/reviewer/security-reviewer/librarian/designer/sonic/task directly; no project agent copies | Upstream concurrency is 32; two and one active writer are project resource/authority choices |
| [Bundled reviewer](https://github.com/can1357/oh-my-pi/blob/v18.0.6/packages/coding-agent/src/prompts/agents/reviewer.md) | Use the native reviewer rather than shadowing it | It includes Bash; native instructions plus the project Git/secret/external guard remain defense in depth, not a hard filesystem sandbox |
| [Approval mode](https://github.com/can1357/oh-my-pi/blob/v18.0.6/docs/approval-mode.md) | Explicit write mode, prompt browser/eval, deny broad runtimes in eval | Default yolo and headless child behavior must not be mistaken for task authority |
| [Browser](https://github.com/can1357/oh-my-pi/blob/v18.0.6/docs/tools/browser.md) | Replace Playwright MCP; use ARIA → interaction → pixels | Browser run has host/runtime helpers; not merely page JavaScript |
| [Native lazy dispatch](https://github.com/can1357/oh-my-pi/blob/v18.0.6/packages/coding-agent/src/tools/xdev.ts) | Remove custom tool loader; inspect inner calls in guard/eval accounting | Mounted tool writes are not ordinary filesystem writes |
| [GitHub tool](https://github.com/can1357/oh-my-pi/blob/v18.0.6/docs/tools/github.md) | Use native reads, retain fixed-lane delivery helper | Native PR operations are not the helper's scope/receipt/fast-forward policy |
| [Extension hooks](https://github.com/can1357/oh-my-pi/blob/v18.0.6/docs/extensions.md), [loading](https://github.com/can1357/oh-my-pi/blob/v18.0.6/docs/extension-loading.md) | Port only project-specific pre-execution policy | Load/hook failure must fail verification; source compatibility is not runtime proof |
| [RPC](https://github.com/can1357/oh-my-pi/blob/v18.0.6/docs/rpc.md) | Wait for terminal agent_end and session stats; fail sticky errors | Nonterminal maintenance/async events and immediate acknowledgements are not completion |
| [Read](https://github.com/can1357/oh-my-pi/blob/v18.0.6/docs/tools/read.md), [edit](https://github.com/can1357/oh-my-pi/blob/v18.0.6/docs/tools/edit.md), [LSP](https://github.com/can1357/oh-my-pi/blob/v18.0.6/docs/tools/lsp.md) | Keep native structured reads, hashline and semantic tooling | A symbol summary or diagnostic does not prove behavior |
| [Compaction](https://github.com/can1357/oh-my-pi/blob/v18.0.6/docs/compaction.md), [loop detector](https://github.com/can1357/oh-my-pi/blob/v18.0.6/packages/ai/src/utils/tool-call-loop-guard.ts) | Remove duplicate capsule/read/retry machinery | Native loop steering differs from the previous hard block; retain policy and evals |

## Retained testing research

The complete prior research record is preserved as
[historical evidence](RESEARCH_PI_BASELINE.md), not current OMP instructions.
Its TestGen-LLM, Playwright best practices, mutation-guided test generation, and
design choices in LLM-based test generators sources continue to support the
test-value policy. Require an independently derived oracle and a named failure
model; a green generated test or high coverage alone is insufficient.

## Domain quality layer (2026-08-27)

The project intentionally adds four conditional skills after the native-surface
audit. They are evidence contracts over OMP's browser, DOM, build and existing
test interfaces—not replacements for OMP's designer, reviewer, browser, task,
or default workflow. The descriptions are narrow so automatic selection is
progressive rather than always-loaded.

| Domain | Retained project decision | Evidence boundary |
|---|---|---|
| Accessibility | Add `accessibility-audit` for WCAG keyboard, semantics, focus, contrast, reflow, target-size, motion and negative states | Browser/DOM/keyboard evidence; screenshots alone never prove semantics or interaction |
| Web performance | Add `web-performance` for measured route, asset and interaction regressions | Matched lab profile and p75 budget; lab is not field/RUM proof |
| Technical SEO | Add `technical-seo` for public route rendering, crawl directives, canonical, sitemap and structured data | Delivered response/HTML plus crawl evidence; valid schema is not a rich-result guarantee |
| RTL/i18n | Add `rtl-i18n` for direction, logical layout, bidi islands, formatting and long strings | Locale/direction/viewport evidence; LTR or English passes do not prove RTL coverage |

The routing dataset uses 20 cases (three positive and two negative controls per
skill). `node scripts/validate-skill-evals.mjs` checks the manifest mechanically;
only matched repeated OMP model trials can estimate activation precision or a
quality improvement. Project context readiness is likewise a mechanical guard
against empty templates, not a judgment of product strategy.

## Improvements: verified facts vs hypotheses

Verified structurally: no six Pi extension packages, no Playwright MCP server,
no duplicate loader/read/capsule/launcher runtime, no project copies of bundled
agents, eight unique project commands, seven unique project skills (three
workflow and four conditional domain), native
terminal event handling, preserved original case IDs and policy tests.

Hypotheses to evaluate: lower startup/resource cost, less schema/context overhead,
better native editing/navigation, and improved delivered quality. These require
matched repeated trials; we do not present them as proven performance gains.
Do not promote a candidate with unproven mandatory visual/security evidence.

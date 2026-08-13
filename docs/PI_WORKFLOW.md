# Pi Workflow Architecture

## Objective

Optimize for high-quality, production-safe vertical slices with end-to-end autonomy on modest local hardware.

The workflow deliberately avoids a large agent organization. Quality comes from acceptance clarity, agent-legible tools, focused context, independent evaluation, deterministic constraints, and executable evidence—not from maximizing the number of agents or skills.

## Harness V2 in one loop

```text
intent
→ task classification
→ acceptance contract
→ just-in-time discovery
→ one primary writer
→ targeted verification
→ independent evaluator(s) where justified
→ bounded repair
→ feature/full gate
→ acceptance → evidence report
→ task-branch commit/push/PR when delivery is in scope
```

For long-running work:

```text
active execution plan
→ incremental progress
→ structured handoff
→ fresh context
→ /resume
```

## Layers

### 1. Always-loaded map: `AGENTS.md`

`AGENTS.md` is intentionally small. It contains the mission, source-of-truth order, task classes, acceptance-contract shape, non-negotiable invariants, context discipline, hard stops, and definition of done.

It points to deeper sources rather than duplicating them. `scripts/pi-doctor.sh` enforces an always-loaded context budget so it cannot silently grow back into a manual.

### 2. Detailed harness playbook: `docs/HARNESS.md`

Loaded only for non-trivial, repeated-failure, complex, or multi-session work. It defines:

- acceptance contracts;
- just-in-time discovery;
- evaluator/repair loops;
- failure-recovery ladder;
- execution-plan/handoff protocol;
- quality-ratchet ordering;
- harness evaluation metrics.

### 3. Project quality contract: `docs/QUALITY.md`

Defines evaluator-facing quality rules and project-specific quality invariants after `/bootstrap`.

The central rule is that accepted behavior must be functional and proven. Placeholder handlers, display-only controls, fake persistence, or TODO implementations do not satisfy an accepted functional criterion.

### 4. Product design contract: `docs/DESIGN.md`

Stores the accepted product-specific visual thesis, signature element, semantic tokens, type and composition system, state language, motion, responsive transformation, content voice, and screen-level proof. It lets separate sessions implement and review the same direction instead of regenerating taste from scratch.

### 5. Parent execution policy: `.pi/APPEND_SYSTEM.md`

Routes the primary session without duplicating all detail:

- task classification;
- autonomous Scout/Reviewer/Security delegation when justified;
- bounded evaluator/repair rounds;
- failure-recovery trigger;
- skill/tool routing;
- browser workflow;
- final evidence reporting.

### 6. On-demand procedures: `.pi/skills/`

- `verification-routing` — targeted, feature, and full verification lanes;
- `test-design` — behavioral or boundary-oriented tests, defect sensitivity, reliability filters, and economical execution;
- `risk-review` — security, correctness, data integrity, reliability, performance, UX, migration, and operational review;
- `browser-qa` — low-resource browser, interaction, accessibility, responsive, and visual verification;
- `frontend-design` — brief-specific visual direction, anti-template implementation, hard gates, and a scored studio review.

Keep specialized procedures here only when domain fit is real. Generic advice does not deserve another skill.

### 7. User workflows: `.pi/prompts/`

- `/bootstrap` — adapt the generic harness to the real project and make the app/test/runtime interfaces agent-legible;
- `/discover` — turn an idea into a product contract, riskiest assumptions, and evidence-gated roadmap;
- `/design` — choose and persist a distinctive visual/interaction direction before code;
- `/spec` — turn an outcome into a bounded implementation-ready feature contract;
- `/adr` — record one evidence-backed durable architecture decision;
- `/build` — acceptance-driven implementation and evaluator loop;
- `/test` — add the smallest meaningful regression coverage without mirroring implementation;
- `/build-ui` — implement a functional, visually exceptional UI slice and prove it in the browser;
- `/design-review` — independently grade rendered hard gates and visual craft;
- `/plan` — bounded design or durable execution plan;
- `/review` — independent acceptance/risk evaluation;
- `/release-plan` — define evidence gates from current state through staged production;
- `/ship` — final acceptance and release-readiness evidence;
- `/incident` — structure production diagnosis, recovery proof, and corrective learning;
- `/handoff` — write clean multi-session state before a context reset;
- `/resume` — validate and continue from an execution plan in a fresh context.

### 8. Durable complex-task state: `docs/exec-plans/`

Execution plans are used only when todo/chat state is not durable enough. They capture accepted criteria, verified current state, decisions, evidence, risks, and the smallest next action.

They are not transcripts and are not required for ordinary work.

### 9. Tool interface

The launcher exposes a deliberately small tool surface:

- repository read/edit/bash/search primitives;
- `subagent` for bounded independent contexts;
- `todo` for visible multi-step state;
- LSP for semantic code intelligence;
- `doc_search_*` for version-sensitive docs;
- web search/fetch for current external evidence;
- `mcp` as a compact lazy proxy;
- image analysis only when visual evidence materially matters.

Playwright MCP is configured lazily through `.mcp.json` for localhost and public HTTP(S) browser evidence. Focused page evaluation is available when snapshots/interactions cannot expose the required state; file upload/drop and MCP scripting remain unavailable. Repository-local Playwright Test remains the durable regression/CI layer.

### 10. Deterministic guardrails

`.pi/extensions/safety-guard.js` defaults to an autonomous workspace policy: routine workflow edits, task-branch Git delivery, public HTTP(S) navigation, page evaluation, generated artifacts, and OS-temp writes are allowed. It still blocks secrets, destructive host/Git operations, force/deleting pushes, publication/deployment/production actions, and browser upload or scripting. `PI_GUARD_MODE=strict` restores workflow/Git/local-navigation locks for the optional contained launcher. Its behavior is regression-tested, but it is not a complete shell/interpreter parser or security boundary.

Prompt instructions shape behavior; guardrails limit blast radius. Pi project trust is not an operating-system sandbox.

## Acceptance-driven execution

For Standard or larger work, the agent defines 3–7 observable criteria and proof required for each before implementation.

This gives planning, implementation, review, browser QA, verification, and final reporting the same target. An evaluator grades the contract rather than inventing its own adjacent scope.

For a bug, prefer evidence of the failure before the fix. For performance, capture a baseline. For UI, exercise the actual critical journey.

For visually significant UI, define the direction in `docs/DESIGN.md`, then evaluate in two passes: product/interaction hard gates followed by a rendered studio/craft score. This prevents a polished screenshot from hiding broken behavior and prevents functional-but-generic UI from being mislabeled exceptional.

## Evaluator-optimizer loop

Independent evaluation is used where it has measurable value:

- non-trivial user-facing behavior;
- cross-module changes;
- production bug fixes;
- material regression risk;
- High-risk security/data/money changes.

The default is at most two evaluator/repair rounds. This catches last-mile incompleteness without creating an unbounded agent swarm or infinite review loop.

## Failure recovery and context resets

If the same approach fails twice without new evidence, the agent stops blind retrying, preserves the failure, forms competing hypotheses, and gathers discriminating observations.

Compaction is useful for a coherent continuing task. A structured handoff plus fresh context is preferred when stale hypotheses, long tool history, or session boundaries make the old context actively harmful.

## Progressive disclosure and context

The repository is the durable system of record. The model should receive a map and stable identifiers, then pull exact code/docs/evidence just in time.

Preferred context order:

1. accepted intent and repository map;
2. exact symbols/tests/files;
3. local semantic/type evidence;
4. project docs;
5. version-matched official docs;
6. current external evidence only when necessary.

## Mechanical quality ratchet

When a defect class repeats, prefer encoding the fix in the environment:

1. regression test;
2. type/schema/boundary validation;
3. lint/structural rule;
4. clearer project API/helper;
5. focused documentation;
6. specialized skill;
7. more always-loaded prompt text only as a last resort.

`/bootstrap` should identify project-specific architectural invariants that can be enforced mechanically without inventing new architecture.

## Verification strategy

### Targeted

Repeated during implementation: exact tests, reviewed routes from `scripts/verify-affected.mjs`, relevant type/static checks, and the affected browser spec. Unknown paths use the canonical full fallback.

### Feature

Once after the bounded slice: static checks, unit/integration suite, relevant build, small E2E smoke set.

### Full

Once for final delivery or High-risk work: canonical repository gate and required release/security/migration checks.

Interactive reviewer/browser output is evidence, not a substitute for executable tests when those are practical.

## Harness evaluation

Evaluate harness changes on realistic repository tasks using:

- acceptance success;
- repair rounds;
- tool calls and tool errors;
- wall-clock duration;
- token/context growth;
- unnecessary broad reads;
- regressions caught before handoff;
- user interventions required for routine reversible work;
- peak local resource use where relevant.

The v2 RPC runner adds deterministic completion/mutation/command checks, tool/error/duplicate/repair metrics, per-case medians, and baseline regression gates. Mechanical success still requires separate qualitative rubric scoring before promotion.

A sophisticated harness component that does not improve representative outcomes should be removed.

## What remains intentionally excluded

- parallel write-capable agent swarms;
- vector memory by default;
- direct protected-branch pushes, merge, releases, deployment, or production mutation without explicit scope;
- browser file injection or unrestricted MCP scripting;
- repeated full-suite testing during implementation;
- a second specification framework;
- marketplace-wide skill packs;
- autonomous infinite loops without bounded evaluation/recovery rules.

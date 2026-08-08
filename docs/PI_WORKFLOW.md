# Pi Workflow Architecture

## Objective

Optimize for high-quality, production-safe vertical slices with strong autonomy on modest local hardware.

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

### 4. Parent execution policy: `.pi/APPEND_SYSTEM.md`

Routes the primary session without duplicating all detail:

- task classification;
- automatic Scout/Reviewer/Security delegation;
- bounded evaluator/repair rounds;
- failure-recovery trigger;
- skill/tool routing;
- browser workflow;
- final evidence reporting.

### 5. On-demand procedures: `.pi/skills/`

- `verification-routing` — targeted, feature, and full verification lanes;
- `risk-review` — security, correctness, data integrity, reliability, performance, UX, migration, and operational review;
- `browser-qa` — low-resource browser, interaction, accessibility, responsive, and visual verification.

Keep specialized procedures here only when domain fit is real. Generic advice does not deserve another skill.

### 6. User workflows: `.pi/prompts/`

- `/bootstrap` — adapt the generic harness to the real project and make the app/test/runtime interfaces agent-legible;
- `/build` — acceptance-driven implementation and evaluator loop;
- `/plan` — bounded design or durable execution plan;
- `/review` — independent acceptance/risk evaluation;
- `/ship` — final acceptance and release-readiness evidence;
- `/handoff` — write clean multi-session state before a context reset;
- `/resume` — validate and continue from an execution plan in a fresh context.

### 7. Durable complex-task state: `docs/exec-plans/`

Execution plans are used only when todo/chat state is not durable enough. They capture accepted criteria, verified current state, decisions, evidence, risks, and the smallest next action.

They are not transcripts and are not required for ordinary work.

### 8. Tool interface

The launcher exposes a deliberately small tool surface:

- repository read/edit/bash/search primitives;
- `subagent` for bounded independent contexts;
- `todo` for visible multi-step state;
- LSP for semantic code intelligence;
- Context7 for version-sensitive docs;
- web search/fetch for current external evidence;
- `mcp` as a compact lazy proxy;
- image analysis only when visual evidence materially matters.

Playwright MCP is configured lazily through `.mcp.json` for real interactive browser evidence. Repository-local Playwright Test remains the durable regression/CI layer.

### 9. Deterministic guardrails

`.pi/extensions/safety-guard.js` blocks secrets, destructive host actions, Git history/remote mutation, production/deployment actions, unsafe MCP tools, non-local browser navigation, and accidental edits to harness policy files.

Prompt instructions shape behavior; guardrails limit blast radius. Pi project trust is not an operating-system sandbox.

## Acceptance-driven execution

For Standard or larger work, the agent defines 3–7 observable criteria and proof required for each before implementation.

This gives planning, implementation, review, browser QA, verification, and final reporting the same target. An evaluator grades the contract rather than inventing its own adjacent scope.

For a bug, prefer evidence of the failure before the fix. For performance, capture a baseline. For UI, exercise the actual critical journey.

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

Repeated during implementation: exact tests, relevant type/static checks, affected browser spec.

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

A sophisticated harness component that does not improve representative outcomes should be removed.

## What remains intentionally excluded

- parallel write-capable agent swarms;
- vector memory by default;
- automatic commits, pushes, releases, or deployment;
- unrestricted browser JavaScript/file injection;
- repeated full-suite testing during implementation;
- a second specification framework;
- marketplace-wide skill packs;
- autonomous infinite loops without bounded evaluation/recovery rules.

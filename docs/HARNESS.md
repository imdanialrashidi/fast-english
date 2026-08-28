# Agent Harness Operating Playbook

This document contains the detailed operating model for non-trivial OMP coding sessions. `AGENTS.md` should remain a short map and point here instead of duplicating these rules.

## Design principles

1. **Intent steers; the agent finishes.** Convert the request into observable acceptance criteria, then execute reversible implementation and evidence gathering without intermediate approval loops.
2. **Repository knowledge is the system of record.** Durable product, architecture, quality, decision, and execution state belongs in versioned repository artifacts rather than chat memory.
3. **Progressive disclosure beats giant prompts.** Keep always-loaded instructions small and retrieve code, docs, skills, and external facts just in time. Domain skills are conditional; do not load all four for every task.
4. **The interface is part of intelligence.** High-quality tools, focused outputs, browser evidence, diagnostics, and deterministic verification materially affect coding-agent performance.
5. **Prefer mechanical constraints over repeated prose.** If an invariant can be linted, tested, typed, validated, or blocked by tooling, encode it there.
6. **Evaluation needs a contract.** Independent review is most useful when it judges explicit observable criteria, not vague taste.
7. **Complexity must earn its cost.** Add agents, skills, tools, loops, or persistent artifacts only for demonstrated failure modes.
8. **Visual quality needs an explicit direction.** Aesthetic evaluation is useful only when it judges a product-specific thesis, rendered states, and measurable usability constraints rather than generic taste.

## Execution protocol

### 1. Classify the task

Use the task classes in `AGENTS.md`.

- Localized: use OMP's native direct workflow—one focused patch, one targeted proof and scoped diff review. Do not add a project quick-fix wrapper.
- Context readiness: before product/UI work, run `node scripts/validate-project-context.mjs --static`; after `/wf-bootstrap`, require `--require-ready` so empty contract prompts cannot silently become invented requirements.
- Domain routing: load `accessibility-audit`, `web-performance`, `technical-seo`, or `rtl-i18n` only when the accepted scope contains that domain. They provide evidence contracts over native OMP/browser/build tools; they do not install duplicate frameworks.
- Standard: compact acceptance contract, focused implementation, and material self-review; add an independent evaluator only when its evidence justifies the cost.
- Complex: planning plus persistent execution state when continuity is needed.
- High risk: threat-boundary analysis, independent review, negative-path proof, full gate.

### 2. Establish the acceptance contract

For Standard or larger work, write a compact contract before editing:

```text
Goal:
Non-goals:
Acceptance:
- A1 ... -> proof: ...
- A2 ... -> proof: ...
- A3 ... -> proof: ...
```

Good criteria describe user-visible or externally observable behavior. Avoid implementation trivia such as exact internal function names unless the public contract requires them.

Additional rules:

- Bug: capture the failure or a precise characterization before changing code when practical.
- Performance: capture a reproducible baseline and target.
- UI: include the critical user journey plus important loading/error/empty/permission states.
- Visual UI: include the accepted `docs/DESIGN.md` thesis/signature, desktop/mobile proof, accessibility/performance hard gates, and craft threshold.
- Security/data: include rejection/tampering/idempotency/ownership evidence where relevant.
- Do not accept placeholder buttons, stub handlers, fake persistence, TODO implementations, or display-only controls as satisfying functional criteria.

Ordinary contracts may live in the todo state. Complex or multi-session contracts belong in an execution plan.

The agent derives the contract from available evidence. It asks a question only when no safe reversible interpretation exists; ordinary product, implementation, naming, tooling, and test choices are agent-owned.

### 3. Discover with a context budget

Start from identifiers, not bulk context.

Use OMP's native `read`, `grep`, `glob`, `edit`, `write`, and `bash` for focused work. OMP owns lazy tool discovery: read `xd://` and then `xd://<tool>` for a missing schema; write the documented JSON arguments to that device. Do not install a second tool loader or assume a mounted tool is unavailable. Keep native hashline edits and re-read stale anchors instead of inventing replacements.

Native structural reads and output artifacts bound context; explicit selectors retrieve exact evidence. A summary is not a full source read. Keep native defaults unless a measured task justifies a change; do not restore the old 96 KiB wrapper.

Preferred order:

1. repository map and relevant project docs;
2. exact search/symbol lookup;
3. focused source ranges and affected tests;
4. LSP definitions/references/diagnostics;
5. installed types and local dependency source;
6. native `web_search`, `read` URL support, or native `github` file reads for version-matched primary documentation;
7. web search for current upstream issues, advisories, regressions, or release notes.

If subagents are available, use `scout` only when the relevant surface or cross-module flow is genuinely unclear. Otherwise investigate directly. Do not delegate the same discovery twice.

### 4. Implement one coherent vertical slice

Prefer a complete end-to-end behavior over many half-finished layers. Keep one primary writer.

During implementation:

- use the narrowest reliable verification after meaningful edits;
- map the affected symbols/contracts/dependencies and nearest tests before editing;
- when tests change, use `test-design` and pass its Test Value Gate: distinct failure model, evidence gap, independent oracle, cheapest faithful layer, and defect sensitivity where practical; `no new test` is valid when existing evidence is already sufficient;
- preserve existing architectural boundaries;
- avoid speculative abstractions;
- keep data validation at boundaries;
- keep business rules testable outside UI/transport code where appropriate;
- do not clean unrelated code merely because it is nearby.

### 5. Evaluate independently

After the slice is functionally complete and targeted checks pass, evaluate against the acceptance contract and `docs/QUALITY.md`.

Use OMP's bundled `reviewer` for non-trivial user-facing, cross-module, production-bug, or material-regression work only when independent context adds value. Use bundled `security-reviewer` for High-risk work under the same condition; otherwise perform a separate evidence-focused pass directly. Provide the accepted contract, scoped diff and real verification output—not your verdict. Bundled `scout` covers bounded discovery. Bundled `designer`, `sonic` or `task` may own one implementation slice, but the parent must stop editing until that writer finishes. Default concurrency is two children, recursion one, with no child auto-apply or branch merge. The project does not shadow bundled agents.

For browser-visible behavior, use the real application through `browser-qa`'s pixel-inspection loop. Accessibility snapshots and interaction evidence come before screenshots. For material appearance changes, inspect supplied references and the rendered baseline, then actually receive and inspect current desktop/mobile images. The runtime reports configured image capability and returned image blocks; neither proves perception. Use focused crops for detail, deterministic measurements for exact claims, and re-capture after repairs. If pixels cannot be inspected, mark appearance-dependent criteria `UNPROVEN`.

For visually significant work, read `docs/VISUAL_REVIEW.md`, use the bundled `designer` when a separate specialist pass adds value, and evaluate in two passes. The product pass proves journey, states, accessibility, responsiveness and measurable budgets. The studio pass compares rendered evidence with `docs/DESIGN.md`, runs the anti-template review and scores visual craft where the evidence is actually inspectable. Novelty never cancels a hard-gate failure.

The evaluator should answer:

- Which acceptance criterion is proven?
- Which criterion is not proven or fails?
- Is any accepted functionality stubbed or only visually represented?
- Did the change introduce a regression outside the narrow happy path?
- What is the smallest evidence-backed fix?

Default to at most **two evaluator/repair rounds**. If a BLOCKER or MAJOR issue remains after two evidence-driven repair rounds, stop repeating the same loop: reassess the contract/root cause, create or update an execution plan, or report the blocker.

### 6. Verify and report evidence

Load `verification-routing` and use its targeted, affected, feature, and full lanes. A configured affected route may narrow known changes, but an unmatched file must use the full fallback. The final report maps every acceptance criterion to evidence.

Never convert these into the same status:

- passed;
- failed;
- skipped;
- blocked by prerequisite;
- not executed.

### 7. Deliver the scoped pull request

For implementation, follow `docs/GIT_POLICY.md`: prepare the persistent `ai-changes` branch before editing, finish accepted verification, then run the scoped PR helper with explicit file paths and exact evidence. It commits/pushes and creates the PR or updates the same related PR. Do not create per-task branches, mix unrelated work into an open PR, write to `main`, or merge automatically. Read-only/local-only tasks and evals do not deliver. A missing credential blocks delivery, not safe local implementation; report both states accurately.

## Failure-recovery ladder

Repeated blind retries are a harness failure. When the same check or approach fails twice without materially new evidence:

1. Stop repeating the unchanged action.
2. Preserve the exact failure: command, error, relevant log/response, and current diff state.
3. State 1–3 competing root-cause hypotheses.
4. Choose the cheapest discriminating observation for each hypothesis.
5. Use semantic/local evidence first; use official/current external sources only when needed.
6. Revert only the agent's own failed local experiment when a safe targeted reversal exists; never overwrite unrelated user work.
7. If the task is still unclear and subagents are available, delegate one focused read-only investigation rather than another broad implementation attempt; otherwise run that focused investigation directly.
8. If the context has become noisy, the goal changed materially, or progress must survive a fresh session, use the handoff protocol.

OMP's native repeated-tool detector supplies corrective steering at three consecutive identical single-tool turns. It is not the old failure-only hard block, does not cover every batched call, and does not prove a retry became useful. The workflow rule above still stops an unchanged failed approach after two attempts. Do not claim those mechanisms are identical. Evaluate recovery behavior with real traces before changing the threshold.

A failure that recurs across different tasks should become a harness improvement: a regression test, clearer tool, structural check, documented invariant, or safety rule. Do not merely add another paragraph to the system prompt.

## Execution plans and long-running work

Use a persistent execution plan when any of these is true:

- the task is expected to span multiple sessions or context resets;
- several modules or services must change in sequence;
- migrations, rollout, recovery, or high-risk state transitions require staged work;
- investigation has produced decisions that would be expensive to rediscover;
- the todo state alone is not enough to resume safely.

Store active plans under `docs/exec-plans/active/` and completed historical plans under `docs/exec-plans/completed/` when the project benefits from retaining them.

An execution plan should contain:

```text
Goal / non-goals
Acceptance contract
Confirmed current state
Relevant files/systems
Decisions and rationale
Ordered next actions
Verification evidence
Open risks/blockers
Handoff note
```

Keep it concise and update facts, decisions, evidence, and next steps—not a transcript of every tool call.

Use OMP's native sessions, todos, compaction, and handoff rather than a parallel continuity capsule. The current working tree and durable ExecPlan remain authoritative. Re-run stale proof after edits and reopen visual evidence after context loss. A native session summary is a navigation aid, not proof of a passing test or current UI.

## Handoff and context reset

Compaction is useful for a continuing coherent task, but a clean context can be better when the task has accumulated stale hypotheses or is crossing sessions.

Before a clean restart:

1. update the active execution plan or create a concise handoff artifact;
2. record what is actually implemented, not what was intended;
3. record exact verification outcomes;
4. record unresolved hypotheses and the next discriminating action;
5. record relevant changed files and user-owned work that must be preserved.

Then use native `/handoff [focus]` and start or select the next session with native `/resume`. Mention the relevant ExecPlan path in the resumed prompt when durable project state exists.

Do not use a handoff to hide an unresolved failure or to mark unfinished criteria complete.

## Quality ratchet

Treat repeated agent mistakes as evidence about the environment.

When a class of defect recurs, prefer this order:

1. regression test;
2. type/schema/boundary validation;
3. deterministic lint or structural test;
4. clearer repository-local API or helper;
5. focused documentation/reference;
6. specialized skill only if the workflow is truly domain-specific;
7. extra always-loaded prompt text only as a last resort.

Project bootstrap should identify important architecture or quality invariants that can be enforced mechanically and add project-specific checks where justified.

## Harness evaluation

Judge harness changes against realistic tasks, not toy prompts. Useful measures include:

- task success against observable acceptance criteria;
- number of repair rounds;
- total tool calls and tool errors;
- wall-clock duration;
- token/context growth;
- unnecessary broad reads/searches;
- regressions caught by reviewer/browser/security evaluation;
- visual hard-gate pass rate and craft-score distribution for frontend eval cases;
- generic-design failure rate (interchangeable palettes, type, cards, hero, copy, or motion);
- number of user interventions required for routine reversible work.

Do not keep a harness feature because it feels sophisticated. Keep it because it improves outcomes or reduces cost/risk on representative tasks.

## Research basis

[`docs/RESEARCH.md`](RESEARCH.md) records the primary sources, the exact workflow decision derived from each, benchmark limitations, the repository audit, and the promotion protocol. Keep that evidence map current when a harness component or threshold changes.

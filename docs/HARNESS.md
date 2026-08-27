# Agent Harness Operating Playbook

This document contains the detailed operating model for non-trivial Pi coding sessions. `AGENTS.md` should remain a short map and point here instead of duplicating these rules.

## Design principles

1. **Intent steers; the agent finishes.** Convert the request into observable acceptance criteria, then execute reversible implementation and evidence gathering without intermediate approval loops.
2. **Repository knowledge is the system of record.** Durable product, architecture, quality, decision, and execution state belongs in versioned repository artifacts rather than chat memory.
3. **Progressive disclosure beats giant prompts.** Keep always-loaded instructions small and retrieve code, docs, skills, and external facts just in time.
4. **The interface is part of intelligence.** High-quality tools, focused outputs, browser evidence, diagnostics, and deterministic verification materially affect coding-agent performance.
5. **Prefer mechanical constraints over repeated prose.** If an invariant can be linted, tested, typed, validated, or blocked by tooling, encode it there.
6. **Evaluation needs a contract.** Independent review is most useful when it judges explicit observable criteria, not vague taste.
7. **Complexity must earn its cost.** Add agents, skills, tools, loops, or persistent artifacts only for demonstrated failure modes.
8. **Visual quality needs an explicit direction.** Aesthetic evaluation is useful only when it judges a product-specific thesis, rendered states, and measurable usability constraints rather than generic taste.

## Execution protocol

### 1. Classify the task

Use the task classes in `AGENTS.md`.

- Localized: load `/skill:quick-fix` when minimal ceremony is requested; use one direct patch, one targeted proof, and scoped diff review.
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

The initial runtime surface is `read`, `bash`, `edit`, `write`, `grep`, `find`, `ls`, and `harness_tools`. Stay on that core for localized work. When the task needs planning, delegation, browser evidence, LSP, version-sensitive documentation, or current web evidence, call `harness_tools` once with every required capability instead of activating specialists one by one.

An implicit read of a regular text file at or above 96 KiB is bounded to 400 lines and returns the next offset. An explicit `offset` or `limit` is always preserved. Prefer exact search/symbol lookup and focused ranges over walking the rest of a large file linearly.

Preferred order:

1. repository map and relevant project docs;
2. exact search/symbol lookup;
3. focused source ranges and affected tests;
4. LSP definitions/references/diagnostics;
5. installed types and local dependency source;
6. `doc_search_*` for version-sensitive official docs;
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

Use an independent `reviewer` for non-trivial user-facing, cross-module, production-bug, or material-regression work only when subagents are available and isolated context adds value. Use `security-auditor` for High-risk work under the same condition; otherwise perform a separate evidence-focused pass directly.

For browser-visible behavior, use the real application through `browser-qa`'s pixel-inspection loop. Accessibility snapshots and interaction evidence come before screenshots. For material appearance changes, inspect supplied references and the rendered baseline, then actually receive and inspect current desktop/mobile images. The runtime reports configured image capability and returned image blocks; neither proves perception. Use focused crops for detail, deterministic measurements for exact claims, and re-capture after repairs. If pixels cannot be inspected, mark appearance-dependent criteria `UNPROVEN`.

For visually significant work, load `frontend-design` and evaluate in two passes. The product pass proves journey, states, accessibility, responsiveness, and measurable budgets. The studio pass compares rendered evidence with `docs/DESIGN.md`, runs the anti-template review, and scores visual craft where the evidence is actually inspectable. Novelty never cancels a hard-gate failure.

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

The runtime hashes the tool name plus canonical arguments and blocks a third identical call after two errored executions. It never persists the arguments themselves. A different successful evidence/action step clears the blind-retry counter; changing only wording without changing the actual tool input does not.

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

The runtime continuity capsule is a recovery aid, not the execution plan. It persists a bounded list of active specialist groups, repository-relative modified paths, recent recognized verification outcomes, hashed open failures, and Smart Read count. It is injected once after session restore or compaction. Pi's built-in compaction summary and the execution plan remain authoritative for goals, decisions, constraints, and unresolved reasoning.

## Handoff and context reset

Compaction is useful for a continuing coherent task, but a clean context can be better when the task has accumulated stale hypotheses or is crossing sessions.

Before a clean restart:

1. update the active execution plan or create a concise handoff artifact;
2. record what is actually implemented, not what was intended;
3. record exact verification outcomes;
4. record unresolved hypotheses and the next discriminating action;
5. record relevant changed files and user-owned work that must be preserved.

Then start a fresh Pi session and use `/resume <plan-path>`.

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

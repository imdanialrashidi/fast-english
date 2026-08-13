# Agent Harness Operating Playbook

This document contains the detailed operating model for non-trivial Pi coding sessions. `AGENTS.md` should remain a short map and point here instead of duplicating these rules.

## Design principles

1. **Intent steers; the agent finishes.** Convert the request into observable acceptance criteria, then execute reversible implementation and delivery decisions without intermediate approval loops.
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

- Localized: no ceremony.
- Standard: compact acceptance contract and one evaluator pass.
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

Preferred order:

1. repository map and relevant project docs;
2. exact search/symbol lookup;
3. focused source ranges and affected tests;
4. LSP definitions/references/diagnostics;
5. installed types and local dependency source;
6. `doc_search_*` for version-sensitive official docs;
7. web search for current upstream issues, advisories, regressions, or release notes.

Use `scout` when the relevant surface or cross-module flow is genuinely unclear. Do not delegate the same discovery twice.

### 4. Implement one coherent vertical slice

Prefer a complete end-to-end behavior over many half-finished layers. Keep one primary writer.

During implementation:

- use the narrowest reliable verification after meaningful edits;
- map the affected symbols/contracts/dependencies and nearest tests before editing;
- when tests change, use `test-design` and require defect sensitivity where practical;
- preserve existing architectural boundaries;
- avoid speculative abstractions;
- keep data validation at boundaries;
- keep business rules testable outside UI/transport code where appropriate;
- do not clean unrelated code merely because it is nearby.

### 5. Evaluate independently

After the slice is functionally complete and targeted checks pass, evaluate against the acceptance contract and `docs/QUALITY.md`.

Use an independent `reviewer` for non-trivial user-facing, cross-module, production-bug, or material-regression work. Use `security-auditor` for High-risk work.

For browser-visible behavior, use the real application through the `browser-qa` workflow. Accessibility snapshots and interaction evidence come before screenshots; screenshots plus vision analysis are used when appearance materially matters.

For visually significant work, load `frontend-design` and evaluate in two passes. The product pass proves journey, states, accessibility, responsiveness, and measurable budgets. The studio pass compares rendered evidence with `docs/DESIGN.md`, runs the anti-template review, and scores visual craft. Novelty never cancels a hard-gate failure.

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

### 7. Finish through reversible delivery

Do not stop after producing a patch when the accepted outcome includes repository delivery. If credentials and a configured remote are available, create or reuse a task branch, commit only the scoped diff, push it, and create or update the PR without requesting another confirmation.

Direct protected-branch mutation, merging, releasing, deploying, production/data mutation, or real-money action still requires explicit scope because those cross a shared or difficult-to-reverse boundary. A missing publishing credential does not block local implementation and verification: finish those first and leave exact continuation state.

## Failure-recovery ladder

Repeated blind retries are a harness failure. When the same check or approach fails twice without materially new evidence:

1. Stop repeating the unchanged action.
2. Preserve the exact failure: command, error, relevant log/response, and current diff state.
3. State 1–3 competing root-cause hypotheses.
4. Choose the cheapest discriminating observation for each hypothesis.
5. Use semantic/local evidence first; use official/current external sources only when needed.
6. Revert only the agent's own failed local experiment when a safe targeted reversal exists; never overwrite unrelated user work.
7. If the task is still unclear, delegate one focused read-only investigation rather than another broad implementation attempt.
8. If the context has become noisy, the goal changed materially, or progress must survive a fresh session, use the handoff protocol.

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

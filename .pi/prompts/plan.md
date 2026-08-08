---
description: Create the smallest safe plan or durable execution plan for a complex goal
argument-hint: "<goal>"
---

Analyze this goal:

$ARGUMENTS

Read `AGENTS.md`, `docs/HARNESS.md`, `docs/PRODUCT.md`, `docs/ARCHITECTURE.md`, `docs/QUALITY.md`, and only relevant code/contracts.

Use `planner` or `scout` only when cross-module discovery is genuinely needed. Do not implement application code.

For a bounded Complex/High-risk task that may span contexts or requires durable decisions, create/update `docs/exec-plans/active/<short-slug>.md` using `docs/exec-plans/README.md`.

Use `docs/PLAN.md` only for project-level roadmap/phase planning rather than as a scratchpad for every task.

The plan must contain:

1. Goal and explicit non-goals
2. 3–7 observable acceptance criteria with proof required for each
3. Confirmed facts, constraints, assumptions, and material unknowns
4. Existing patterns/components/contracts to reuse
5. Smallest viable design and relevant data/control flow
6. Security, correctness, performance, UX, migration, reliability, recovery, and rollback risks only where relevant
7. Ordered vertical work with clear stop/verification points
8. Verification/evaluator strategy, including browser evidence for user-facing behavior
9. Decisions intentionally deferred
10. Handoff-ready current state and smallest first implementation action

Do not over-specify internal implementation details that the evidence does not require. Prefer constraints on deliverables and invariants, leaving reversible implementation choices to the build agent.

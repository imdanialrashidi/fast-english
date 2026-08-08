---
description: Resume complex work from a structured execution plan in a fresh context
argument-hint: "<docs/exec-plans/active/...md>"
---

Resume work from this execution plan:

$ARGUMENTS

1. Read `AGENTS.md`, `docs/HARNESS.md`, `docs/QUALITY.md`, and the specified execution plan.
2. Inspect `git status`, the relevant current diff, and only the source/tests needed to validate the plan's current-state claims.
3. Treat the working tree and current tests/runtime as authoritative. Correct stale plan facts before proceeding.
4. Restate in at most six lines:
   - accepted goal;
   - remaining acceptance criteria;
   - current verified state;
   - smallest next action;
   - material risk/blocker.
5. Recreate/align todo state only when the remaining work has multiple meaningful steps.
6. Continue from the smallest next action. Do not redo completed discovery or verification unless evidence is stale or the code changed.
7. Keep the execution plan updated with decisions, evidence, and next steps as the work progresses.
8. Finish using the normal evaluator and verification rules. Move/mark the plan complete only when all required acceptance criteria are proven.

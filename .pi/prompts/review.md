---
description: Independently evaluate the current change against acceptance and release risk
argument-hint: "[scope or acceptance contract]"
---

Independently review the current working-tree change. Scope/contract hint:

${ARGUMENTS:-derive the accepted scope from the current task and repository evidence}

Do not edit files during review.

1. Read `AGENTS.md`, `docs/QUALITY.md`, and the relevant accepted goal or active execution plan. For visually significant work also read `docs/DESIGN.md` and load `frontend-design`. Reconstruct the smallest explicit acceptance contract if one is not already written.
2. Inspect the actual diff and the narrow surrounding contracts/tests needed to understand it.
3. Load `risk-review`. Delegate to `reviewer`; also use `security-auditor` when a trust boundary, money, access, migration, secret, upload, callback, deployment, or data-integrity behavior changed.
4. Evaluate each required acceptance criterion as `PASS`, `FAIL`, `UNPROVEN`, or `BLOCKED`. A visually present but non-functional/stubbed accepted feature is `FAIL`.
5. For user-facing behavior, load `browser-qa` and exercise the critical journey through the real browser when the local application can be run safely. For a material visual change, grade the hard gates and craft rubric from rendered desktop/mobile evidence. Browser evidence is preferred over visual inference alone.
6. Report only evidence-backed acceptance failures or actionable regression/risk findings. Do not invent adjacent requirements or stylistic preferences outside `docs/QUALITY.md` and existing project conventions.

For each finding include severity, `file:line` or symbol evidence, failure scenario, smallest safe fix, and the proof test/evidence that would close it.

Then include:

- **Acceptance:** criterion → PASS/FAIL/UNPROVEN/BLOCKED + evidence
- **Strengths:** only verified strengths that matter to release confidence
- **Verdict:** exactly one of `PASS`, `PASS WITH FIXES`, or `BLOCK`

`PASS` requires every required acceptance criterion to be proven and no unresolved BLOCKER/MAJOR finding.

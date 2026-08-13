---
description: Run final acceptance and complete reversible repository delivery without deploying
argument-hint: "[release scope or execution plan]"
---

Prepare and autonomously deliver the current change. Scope:

${ARGUMENTS:-current working-tree change}

Do not add features, merge, release, deploy, publish packages, mutate production, push directly to a protected branch, or rewrite unrelated code. A scoped task-branch commit/push and PR create/update are allowed delivery steps.

1. Read `AGENTS.md`, `docs/QUALITY.md`, and the accepted goal/active execution plan when one exists. For a visually significant release also read `docs/DESIGN.md` and load `frontend-design`.
2. Inspect the full working-tree diff and reconstruct the required acceptance criteria.
3. Reject release readiness if accepted functionality is stubbed, display-only, backed by fake persistence, or lacks required proof.
4. Confirm no secret, private specification, generated artifact, debug bypass, unrelated change, or accidental workflow-policy modification is included.
5. For meaningful user-facing changes, require real-browser evidence for the critical journey when the application can be run safely. For a material visual change, require named desktop/mobile/demanding-state evidence, all visual hard gates, and the accepted craft threshold.
6. Require independent review for non-trivial user-facing, cross-module, production-bug, or material-regression work; require security review for High-risk work. No unresolved BLOCKER/MAJOR finding may remain.
7. Load `verification-routing` and run the canonical full verification gate once when final delivery or the task class requires it.
8. Map every required acceptance criterion to `PASS`, `FAIL`, `UNPROVEN`, or `BLOCKED` with exact evidence. `UNPROVEN` is not release-ready.
9. If an active execution plan exists, update its final evidence/status. Mark/move it complete only when all required criteria are proven.
10. When the verdict is release-ready and repository delivery is in scope, commit the scoped diff, push the task branch, and create or update the PR without requesting another confirmation. If credentials are unavailable, keep the local result complete and report the exact continuation command.

Return:

- release verdict: `READY`, `READY WITH KNOWN LIMITATIONS`, or `NOT READY`;
- acceptance criterion → evidence/status;
- exact checks/tools and outcomes;
- independent review status;
- task-branch commit/push/PR delivery status;
- known limitations and remaining risks;
- rollback/recovery note where relevant;
- remaining non-automated evidence that still matters, without blocking reversible repository delivery.

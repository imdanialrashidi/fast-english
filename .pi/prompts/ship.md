---
description: Run final acceptance and complete reversible repository delivery without deploying
argument-hint: "[release scope or execution plan]"
---

Prepare and autonomously deliver the current change. Scope:

${ARGUMENTS:-current working-tree change}

Do not add features, merge, release, deploy, publish packages, mutate production, push directly to a protected branch, or rewrite unrelated code. A scoped task-branch commit/push and PR create/update are allowed delivery steps.

1. Read `AGENTS.md`, `docs/QUALITY.md`, and the accepted goal/active execution plan when one exists. For a visually significant release also read `docs/DESIGN.md` and load `frontend-design`.
2. Inspect the current branch, `git status -sb`, and the full working-tree diff. Reconstruct the required acceptance criteria and confirm the diff contains only scoped work.
3. Reject release readiness if accepted functionality is stubbed, display-only, backed by fake persistence, or lacks required proof.
4. Confirm no secret, private specification, generated artifact, debug bypass, unrelated change, or accidental workflow-policy modification is included.
5. For meaningful user-facing changes, require real-browser evidence for the critical journey when the application can be run safely. For a material visual change, require named desktop/mobile/demanding-state evidence, all visual hard gates, and the accepted craft threshold.
6. Require independent review for non-trivial user-facing, cross-module, production-bug, or material-regression work; require security review for High-risk work. No unresolved BLOCKER/MAJOR finding may remain.
7. Load `verification-routing`. During finalization, run only the missing evidence: targeted/affected checks as needed and feature verification once. For an ordinary PR, GitHub CI is the authoritative full gate; do not duplicate it with a local full gate unless the task is High-risk, release/deployment/workflow-sensitive, explicitly requires local full proof, or CI is unavailable.
8. Map every required acceptance criterion to `PASS`, `FAIL`, `UNPROVEN`, or `BLOCKED` with exact evidence. `UNPROVEN` is not release-ready.
9. If an active execution plan exists, update its final evidence/status. Mark/move it complete only when all required criteria are proven.
10. Deliver with the simplest Git flow:
   - Reuse the current non-protected task branch. Do not create stacked/replacement branches, temporary worktrees, or extra PRs.
   - If currently on the protected/default branch, fetch `origin` and create one task branch from the current `origin/main` before committing.
   - Default to one meaningful final commit for Localized/Standard work. Do not make commits for every repair, formatting pass, test run, or CI retry.
   - Before the first push, fetch `origin`; if the unpublished branch needs the latest base, rebase it onto `origin/main`, then commit/push normally.
   - After a branch is already pushed or has a PR, never rewrite published history. If the branch actually must be synchronized, merge `origin/main` into the task branch normally, resolve once, rerun affected evidence, and push normally.
   - Do not sync merely because the branch is cosmetically behind. Do it only for a real conflict, mergeability/branch-protection requirement, or CI requirement.
   - Never force-push routine work and never use low-level Git/ref plumbing (`update-ref`, `commit-tree`, `write-tree`, manual ref surgery, synthetic commit graphs) when normal `switch/add/commit/fetch/rebase-or-merge/push` operations work.
   - Push the same branch and create or update exactly one PR. If credentials are unavailable, keep the local result complete and report the exact continuation command.
11. After push, use the GitHub quality workflow as the canonical full-gate result for ordinary PRs. If it fails, inspect the failing job, fix the actual cause, rerun only affected local evidence, and rerun failed CI jobs when supported instead of restarting all green lanes.

Return:

- release verdict: `READY`, `READY WITH KNOWN LIMITATIONS`, or `NOT READY`;
- acceptance criterion → evidence/status;
- exact checks/tools and outcomes;
- independent review status;
- task branch, commit, push, PR, and CI status;
- known limitations and remaining risks;
- rollback/recovery note where relevant;
- remaining non-automated evidence that still matters, without blocking reversible repository delivery.

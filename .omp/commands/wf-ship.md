---
description: Verify the accepted change and deliver its scoped ai-changes pull request without merging or deploying
argument-hint: "[release scope or execution plan]"
---

Assess the current change and prepare a verified handoff. Scope:

$ARGUMENTS

If no scope is supplied: current working-tree change.

Use only the standing PR-delivery scope in `docs/GIT_POLICY.md`. Do not add features, create per-task branches, write to main, merge a PR, release, deploy, publish packages, change production, or rewrite unrelated code. Respect explicit local-only or review-only requests.

1. Read `AGENTS.md`, `docs/QUALITY.md`, `docs/GIT_POLICY.md`, and the accepted goal/active execution plan when one exists. For a visually significant release also read `docs/DESIGN.md` and `docs/VISUAL_REVIEW.md`.
2. Inspect the full working-tree diff and reconstruct the required acceptance criteria.
3. Reject readiness if accepted functionality is stubbed, display-only, backed by fake persistence, or lacks required proof.
4. Confirm no secret, private specification, generated artifact, debug bypass, unrelated change, or accidental workflow-policy modification is included.
5. For product/UI/public-route work, run `node scripts/validate-project-context.mjs --require-ready`; an unbootstrapped or generic contract is not evidence for a release decision.
6. For meaningful user-facing changes, require real-browser evidence for the critical journey when the application can run safely. For material visual work, require named desktop/mobile/demanding-state evidence, all hard gates, and the accepted craft threshold; if the active model cannot inspect appearance, mark that criterion `UNPROVEN`.
7. Require an independent evidence-focused pass for non-trivial user-facing, cross-module, production-bug, or material-regression work and a security pass for High-risk work. Use read-only subagents only when available and justified. No unresolved BLOCKER/MAJOR finding may remain.
8. Load `verification-routing` and run the canonical full gate once when the task class or final readiness requires it.
9. Map every required criterion to `PASS`, `FAIL`, `UNPROVEN`, or `BLOCKED` with exact evidence. `UNPROVEN` is not ready.
10. If an active execution plan exists, update its final evidence/status. Mark/move it complete only when all required criteria are proven.
11. Deliver the verified change through `scripts/ai-pr.mjs` on the existing `ai-changes` branch; create its PR or update the related PR by exact number. Verify remote SHA/PR and report CI separately. If blocked, preserve the diff/commit and state the exact recovery step; never force or reset.

Return:

- verdict: `READY`, `READY WITH KNOWN LIMITATIONS`, or `NOT READY`;
- acceptance criterion → evidence/status;
- exact checks/tools and outcomes;
- independent review status;
- changed files and verified PR/commit status;
- known limitations and remaining risks;
- rollback/recovery note where relevant;
- remaining owner action: review and merge only when approved.

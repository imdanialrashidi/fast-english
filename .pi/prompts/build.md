---
description: Implement one accepted bounded vertical slice end to end
argument-hint: "<task>"
---

Implement this accepted task:

$ARGUMENTS

Follow `AGENTS.md` and the project execution policy.

1. Classify the task as Localized, Standard, Complex, or High risk. Before editing, prepare the persistent `ai-changes` lane using `docs/GIT_POLICY.md`, unless the user requested local-only work.
2. For Standard or larger work, read `docs/HARNESS.md` and `docs/QUALITY.md`; for visually significant work also read `docs/DESIGN.md` and load `frontend-design`. Then state a compact acceptance contract: goal, non-goals, 3–7 observable criteria, and proof expected for each.
3. For a bug, reproduce/characterize the failure first when practical. For performance work, capture a baseline. For browser-visible work, include the critical real-browser journey.
4. Localize before editing: map accepted behavior → entry symbols/contracts → dependent surfaces → nearest existing tests → cheapest commands. If the `subagent` capability is available, use `scout` only when this impact map remains genuinely unclear; otherwise investigate directly. Do not broaden discovery after the relevant path is known.
5. When adding or materially changing tests, load `test-design` and pass its Test Value Gate. For a bug, prefer a regression that demonstrably fails on pre-fix behavior before implementing the fix. Extend existing evidence when it adds the needed signal; add no test when the suite already proves the failure. Do not write implementation-mirroring or coverage-only tests after the fact merely to make the diff green.
6. Implement the smallest coherent vertical slice. Reuse current boundaries and remove no valid guard/test. Do not satisfy accepted behavior with stubs, placeholder handlers, fake persistence, or display-only controls.
7. Load `verification-routing`. Run the exact new/affected test first, then the configured affected-change route where available. Treat unmatched files conservatively; do not infer safety from an absent adjacent test.
8. After the slice is functionally complete, inspect the diff and independently evaluate it against the acceptance contract. For non-trivial or High-risk work, use a read-only `reviewer`/`security-auditor` only when subagents are available and the independent context justifies its cost; otherwise perform a separate evidence-focused pass yourself.
9. For browser-visible behavior, use `browser-qa` and exercise the accepted journey in the real application. For visually significant work, run the product and studio passes, capturing desktop/mobile/demanding-state evidence and the visual-quality score.
10. Fix confirmed findings and rerun only the affected evidence. Default to at most two evaluator/repair rounds; after that, reassess/root-cause or report a real blocker instead of looping blindly.
11. Run feature verification once after the bounded slice; run the full gate only when required by the task class or final delivery.
12. Inspect the final diff for unrelated changes and report criterion → evidence exactly, including pre-fix/red evidence for regression tests where obtained. Complete the automatic scoped commit/push/PR handoff through `scripts/ai-pr.mjs` under `docs/GIT_POLICY.md`; report the verified PR URL/SHA and CI status or precise blocker. No per-task branch or automatic merge.

If the same approach fails twice without new evidence, follow the failure-recovery ladder in `docs/HARNESS.md`.

Do not add adjacent features, speculative abstractions, unrelated refactors, direct protected-branch mutations, merges, releases, deployments, or production actions outside the accepted outcome.

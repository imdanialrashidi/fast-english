---
description: Implement one accepted bounded vertical slice end to end
argument-hint: "<task>"
---

Implement this accepted task:

$ARGUMENTS

Follow `AGENTS.md` and the project execution policy.

1. Classify the task as Localized, Standard, Complex, or High risk.
2. For Standard or larger work, read `docs/HARNESS.md` and `docs/QUALITY.md`; for visually significant work also read `docs/DESIGN.md` and load `frontend-design`. Then state a compact acceptance contract: goal, non-goals, 3–7 observable criteria, and proof expected for each.
3. For a bug, reproduce/characterize the failure first when practical. For performance work, capture a baseline. For browser-visible work, include the critical real-browser journey.
4. Localize before editing: map accepted behavior → entry symbols/contracts → dependent surfaces → nearest existing tests → cheapest commands. Use `scout` only when this impact map remains genuinely unclear; do not broaden discovery after the relevant path is known.
5. When adding or materially changing tests, load `test-design`. For a bug, prefer a regression that demonstrably fails on pre-fix behavior before implementing the fix. Do not write implementation-mirroring tests after the fact merely to make the diff green.
6. Implement the smallest coherent vertical slice. Reuse current boundaries and remove no valid guard/test. Do not satisfy accepted behavior with stubs, placeholder handlers, fake persistence, or display-only controls.
7. Load `verification-routing`. Run the exact new/affected test first, then the configured affected-change route where available. Treat unmatched files conservatively; do not infer safety from an absent adjacent test.
8. After the slice is functionally complete, inspect the diff yourself and independently evaluate it against the acceptance contract. Use `reviewer` for non-trivial user-facing, cross-module, production-bug, or material-regression work; use `security-auditor` for High-risk work.
9. For browser-visible behavior, use `browser-qa` and exercise the accepted journey in the real application. For visually significant work, run the product and studio passes, capturing desktop/mobile/demanding-state evidence and the visual-quality score.
10. Fix confirmed findings and rerun only the affected evidence. Default to at most two evaluator/repair rounds; after that, reassess/root-cause or report a real blocker instead of looping blindly.
11. Run feature verification once after the bounded slice; run the full gate only when required by the task class or final delivery.
12. Inspect the final diff for unrelated changes and report criterion → evidence exactly, including pre-fix/red evidence for regression tests where obtained. If repository delivery is part of the accepted outcome and credentials exist, commit the scoped diff, push the task branch, and create/update the PR without another confirmation.

If the same approach fails twice without new evidence, follow the failure-recovery ladder in `docs/HARNESS.md`.

Do not add adjacent features, speculative abstractions, unrelated refactors, direct protected-branch mutations, merges, releases, deployments, or production actions outside the accepted outcome.

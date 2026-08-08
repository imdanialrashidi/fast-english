---
description: Implement one accepted bounded vertical slice end to end
argument-hint: "<task>"
---

Implement this accepted task:

$ARGUMENTS

Follow `AGENTS.md` and the project execution policy.

1. Classify the task as Localized, Standard, Complex, or High risk.
2. For Standard or larger work, read `docs/HARNESS.md` and `docs/QUALITY.md`, then state a compact acceptance contract: goal, non-goals, 3–7 observable criteria, and proof expected for each.
3. For a bug, reproduce/characterize the failure first when practical. For performance work, capture a baseline. For browser-visible work, include the critical real-browser journey.
4. Use `scout` automatically when discovery is genuinely unclear; otherwise inspect the smallest relevant surface yourself.
5. Implement the smallest coherent vertical slice. Do not satisfy accepted behavior with stubs, placeholder handlers, fake persistence, or display-only controls.
6. Load `verification-routing` and run the narrowest reliable checks during implementation.
7. After the slice is functionally complete, inspect the diff yourself and independently evaluate it against the acceptance contract. Use `reviewer` for non-trivial user-facing, cross-module, production-bug, or material-regression work; use `security-auditor` for High-risk work.
8. For browser-visible behavior, use `browser-qa` and exercise the accepted journey in the real application. Add/update deterministic regression coverage when practical.
9. Fix confirmed findings and rerun only the affected evidence. Default to at most two evaluator/repair rounds; after that, reassess/root-cause or report a real blocker instead of looping blindly.
10. Run feature verification once after the bounded slice; run the full gate only when required by the task class or final delivery.
11. Inspect the final diff for unrelated changes and report criterion → evidence exactly.

If the same approach fails twice without new evidence, follow the failure-recovery ladder in `docs/HARNESS.md`.

Do not add adjacent features, speculative abstractions, deployments, commits, pushes, or unrelated refactors.

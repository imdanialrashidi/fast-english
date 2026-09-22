---
description: Decide whether one accepted behavior or defect needs new regression coverage, then add or extend only the smallest meaningful proof
argument-hint: "<behavior, defect, or risk to test>"
---

Design and implement regression coverage for:

$ARGUMENTS

1. Read the accepted contract, relevant implementation, nearest existing tests, `docs/QUALITY.md`, and only the framework configuration needed to run the test.
2. Load `test-design` and `verification-routing`.
3. Apply the Test Value Gate: state the observable contract, plausible failure model, gap in existing evidence, cheapest faithful layer, independent oracle, and exact proof that the candidate can detect the defect or missing capability.
4. Reuse the existing test framework, fixtures, builders, and naming conventions. Do not add a second framework or speculative test infrastructure.
5. For a bug, demonstrate red-before-green or safe equivalent defect sensitivity when practical. Do not overwrite user work to recreate the defect.
6. Add or extend only the smallest behavior-oriented test that contributes a distinct failure signal. `No new test` is valid when existing tests/checks already prove the behavior or the change is behavior-neutral; report that decision and run the relevant existing check.
7. Choose representative equivalence classes and exact material boundaries. Use pairwise/property/decision-table cases when interactions matter; do not generate a Cartesian matrix or coverage-only cases.
8. Run the exact new or extended test first. If nondeterminism is plausible, repeat only that selector enough to assess reliability. Then run affected verification; run the feature lane once only if the accepted scope requires it.
9. Inspect the diff for production-code changes. Do not change production behavior unless the request explicitly includes the fix; report a newly exposed defect instead.

Return decision, value thesis, contract → test/existing evidence, defect-sensitivity evidence, exact commands/results, files changed, and remaining untested risk.

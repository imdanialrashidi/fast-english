---
description: Add the smallest meaningful automated regression coverage for one accepted behavior or defect
argument-hint: "<behavior, defect, or risk to test>"
---

Design and implement regression coverage for:

$ARGUMENTS

1. Read the accepted contract, relevant implementation, nearest existing tests, `docs/QUALITY.md`, and only the framework configuration needed to run the test.
2. Load `test-design` and `verification-routing`.
3. State the observable behavior, likely counterexample/boundary, smallest faithful test layer, and exact proof that the test can detect the defect or missing capability.
4. Reuse the existing test framework, fixtures, builders, and naming conventions. Do not add a second framework or speculative test infrastructure.
5. For a bug, demonstrate red-before-green or safe equivalent defect sensitivity when practical. Do not overwrite user work to recreate the defect.
6. Add the smallest behavior-oriented test. Do not mirror private implementation, over-mock the subject, or keep a test merely because it raises line coverage.
7. Run the exact new test first. If nondeterminism is plausible, repeat only that selector enough to assess reliability. Then run affected verification; run the feature lane once only if the accepted scope requires it.
8. Inspect the diff for production-code changes. Do not change production behavior unless the request explicitly includes the fix; report a newly exposed defect instead.

Return contract → test, defect-sensitivity evidence, exact commands/results, files changed, and remaining untested risk.

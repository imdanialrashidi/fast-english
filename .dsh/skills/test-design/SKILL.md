---
name: test-design
description: "Design focused tests that fail on incorrect behavior and provide meaningful regression evidence."
whenToUse: "A change needs new or updated coverage, a failure is not reproducible, or existing tests assert too little or too much."
---

# Test design

Start from behavior and failure modes, not from file structure or coverage percentage.

## Procedure

1. State the behavior under test and the acceptance criterion it supports.
2. List the failure modes that matter: invalid input, boundary values, state transitions, permissions, cancellation, concurrency, retries, persistence, compatibility, and error propagation.
3. Choose the lowest-cost test layer that can detect each failure: unit, integration, contract, end-to-end, or manual runtime.
4. For each proposed test, name the incorrect implementation it would catch. If it would pass against a plausible wrong implementation, the assertion is too weak.
5. Add the minimum set of cases that covers distinct failure modes. Do not duplicate the same assertion at several layers.
6. Use real dependencies where the behavior depends on them. Mock only what is slow, nondeterministic, external, or unsafe, and verify the interaction that matters.
7. Prefer observable outcomes: returned values, persisted state, emitted events, HTTP responses, files, logs, exit codes, and UI state. Avoid asserting private implementation details.
8. Make the test deterministic. Control time, randomness, ordering, concurrency, and environment. Set explicit timeouts rather than relying on a global default when the operation can hang.
9. Include at least one negative control for a changed acceptance rule: a case that must fail when the rule is violated.
10. Where practical, confirm the test fails for the intended reason against the wrong behavior, for example with a temporary mutation in a scratch copy. Never leave the source modified.

## Test quality rules

- One behavior per test. A test name should describe the expected outcome, not the method called.
- Assertions must distinguish the intended behavior from the bug. A test that only checks "no exception" or a non-null value rarely does.
- Do not add a test that restates an implementation detail and breaks on a harmless refactor.
- Do not add excessive setup or broad mocks that hide the integration boundary being changed.
- Do not fix a failing test by weakening its assertion unless the original assertion was demonstrably wrong.
- Keep fixtures small and local. Do not share mutable global state between tests.
- If a failure cannot be reproduced deterministically, report it as a limitation instead of writing a flaky test and calling it evidence.

## High-risk coverage

For security, data, migration, authorization, payment, or destructive-operation changes, require:

- an unauthorized or denied path;
- a boundary or malformed-input path;
- a failure/rollback path that proves state is not left inconsistent;
- a regression test for the specific bug or contract, where one exists.

## Report

```text
Behavior:
Failure modes covered:
Tests added/changed:
Layer and why:
Negative control:
Commands run and results:
Gaps or unproven risks:
```

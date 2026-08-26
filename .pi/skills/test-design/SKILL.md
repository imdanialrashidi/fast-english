---
name: test-design
description: Decide whether to add, extend, or skip automated tests, then design the smallest behavior-sensitive proof for a bug, feature, boundary, flaky test, or coverage request. Use whenever tests are added or materially changed.
---

# Test Value Gate

Use this procedure when adding or materially changing automated tests for application behavior. Keep the project's existing framework unless it is unusable.

## 1. Decide whether a test earns its maintenance cost

Search the nearest existing tests, types, schemas, and deterministic checks first. Before writing a candidate, state:

- **Contract:** the externally observable behavior or invariant;
- **Failure model:** one plausible regression or counterexample it should catch;
- **Evidence gap:** why existing tests or mechanical checks do not already catch that failure;
- **Layer:** the cheapest faithful boundary that can observe it;
- **Oracle:** an expected result derived independently from the implementation under test;
- **Sensitivity:** how the candidate will be shown to fail for the missing or incorrect behavior.

Keep the candidate only when every line has a meaningful answer. If it adds no distinct failure mode, extend a nearby test or do not add it. **No new test is a valid outcome** for behavior-neutral documentation/copy/configuration, refactors already proved by existing tests, compiler/type/schema guarantees, or a request whose exact behavior is already covered. Run the relevant existing checks and explain the decision.

Do not create tests to hit a count, percentage, uncovered line, trivial getter/constant, framework behavior, third-party contract, or unreachable defensive branch.

## 2. Choose the cheapest faithful layer

Prefer, in order:

1. unit/property test for a deterministic business rule;
2. component or service integration test for an owned boundary;
3. focused API/database test for persistence, authorization, or state transitions;
4. one narrow browser journey for browser-only behavior;
5. full E2E only when lower layers cannot represent the failure.

For UI, follow user-visible behavior with accessible roles/labels and real interaction. Do not assert CSS classes, handler wiring, or private component state unless they are the accepted public contract.

Mock only an owned boundary that is expensive, nondeterministic, or unsafe. Never mock the subject or the authority whose behavior is being proved, and avoid tautological mocks that merely replay the setup.

## 3. Establish defect sensitivity

For a bug, prefer this sequence:

1. run the nearest existing test to establish the baseline;
2. add the smallest regression case before changing production code;
3. capture the expected failure and confirm it fails for the intended behavior;
4. implement the fix;
5. rerun the exact new test.

If production code was already changed, prove sensitivity safely with one of:

- the pre-fix revision in an isolated worktree/eval copy;
- a controlled focused mutation that restores the defect and is immediately restored;
- an independent failing characterization from logs/API/browser evidence.

Never revert or overwrite user work to manufacture red-before-green evidence. If sensitivity cannot be demonstrated economically, say so and explain the next-best evidence; do not present a passing test as proof that it can catch the defect.

For new behavior without a prior defect, a test should fail because the accepted capability is absent—not because of a temporary syntax error, missing fixture, or deliberately broken setup.

## 4. Keep the oracle independent

Derive expected results from the accepted contract, invariant, protocol example, or an independently calculated value. Do not copy production constants, call the implementation's helper to calculate its own expected value, or assert only that mocked collaborators received implementation-shaped calls.

Avoid private call counts/order, broad snapshots, timing sleeps, and retries that hide nondeterminism. A snapshot is acceptable only for a stable intentional contract; inspect its semantic diff and never blind-update it to obtain green status.

## 5. Select high-information cases

- Use one representative per equivalence class plus exact lower/upper and off-by-one boundaries.
- Use a decision table, pairwise cases, or properties when interactions matter; do not enumerate a Cartesian product without a distinct risk per combination.
- Add invalid, duplicate, reordered, retried, concurrent, partial-failure, tampering, or recovery cases only when the changed behavior makes them plausible.
- Multiple assertions are appropriate when they prove one coherent behavior; do not split tests merely to satisfy one-assertion style.
- Reuse deterministic fixtures/builders and isolate state, time, randomness, network, and cleanup.

For authorization, payment, callback, upload, migration, or concurrency logic, derive negative cases from the actual threat/failure model rather than a generic checklist.

## 6. Apply the evidence filter

A generated or edited test is worth keeping only when it builds/parses normally, detects the missing or incorrect behavior when practical, passes after the change, adds a distinct behavioral signal, is deterministic under relevant repeats, isolates its state, and produces a failure that points to the violated contract.

Coverage identifies surfaces to inspect; it does not prove assertion quality. Prefer boundaries, properties, and focused mutation evidence over testing getters or incidental lines.

## 7. Execute economically

During the edit loop:

1. run the exact new test or smallest selector;
2. rerun it after the fix;
3. run affected tests through `node scripts/verify-affected.mjs --file <path>` when configured;
4. run the feature lane once after the slice;
5. leave the full gate for final delivery or a risk class that requires it.

If the same test command fails twice without new evidence, use the failure-recovery ladder; do not repeat it blindly. Treat nondeterminism as a defect to localize, not a reason to add retries immediately.

## Report

Return:

- decision (`added`, `extended`, or `no new test`);
- value thesis (contract + failure model + evidence gap);
- why this layer, oracle, and case are sufficient;
- red/pre-fix or equivalent sensitivity evidence;
- exact green command;
- affected/feature verification status;
- remaining untested risk.

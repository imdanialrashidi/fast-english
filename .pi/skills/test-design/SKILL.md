---
name: test-design
description: Design, write, and validate regression tests that detect accepted behavior rather than merely increasing test count or line coverage.
---

# Test Design

Use this procedure when adding or materially changing automated tests for application behavior. Keep the project's existing framework unless it is unusable.

## 1. Define the signal

Before writing a test, state:

- the observable contract or defect;
- the smallest layer that can detect it reliably;
- the boundary or counterexample most likely to distinguish correct from plausible-but-wrong behavior;
- the evidence that the test is capable of failing for the intended reason.

Do not derive the expected result from the implementation under test. Use the product/public contract, accepted example, invariant, or independently calculated oracle.

## 2. Choose the cheapest faithful layer

Prefer, in order:

1. pure unit/property test for a deterministic business rule;
2. component or service integration test for a real boundary/contract;
3. focused API/database test for persistence, authorization, or state transitions;
4. one narrow browser journey for browser-only behavior;
5. full E2E only when lower layers cannot represent the failure.

Mock only owned boundaries that are expensive, nondeterministic, or unsafe. Do not mock the behavior being proved, and do not replace an available real in-memory/local boundary with a chain of implementation-shaped mocks.

## 3. Establish defect sensitivity

For a bug, prefer this sequence:

1. run the nearest existing test to establish the baseline;
2. add the smallest regression case before changing production code;
3. capture the expected failure and confirm it fails for the intended behavior;
4. implement the fix;
5. rerun the exact new test.

If production code was already changed, prove sensitivity safely with one of:

- the pre-fix revision in an isolated worktree/eval copy;
- a focused mutation that restores the defect and is immediately restored;
- an independent failing characterization from logs/API/browser evidence.

Never revert or overwrite user work to manufacture red-before-green evidence. If sensitivity cannot be demonstrated economically, say so and explain the next-best evidence.

For new behavior without a prior defect, a test should fail because the accepted capability is absent—not because of a temporary syntax error, missing fixture, or deliberately broken setup.

## 4. Keep only tests that pass the evidence filter

A generated or edited test is worth keeping only when it:

- builds/parses in the normal test environment;
- fails for the missing/incorrect behavior and passes after the change when that proof is practical;
- is deterministic under relevant repeat runs when flake risk exists;
- asserts externally meaningful behavior or an accepted invariant;
- adds signal not already supplied by an existing test;
- isolates its state, time, randomness, network, and cleanup requirements;
- has a failure message that points to the violated contract.

Coverage identifies untested surfaces; it does not prove assertion quality. For critical logic, prefer boundary/property cases or focused mutation evidence over line coverage alone. Do not chase a percentage by testing getters, framework internals, or unreachable defensive branches.

## 5. Select cases deliberately

Include only relevant classes:

- exact lower/upper thresholds and off-by-one boundaries;
- invalid, empty, duplicate, reordered, retried, concurrent, or partial-failure inputs;
- ownership/permission tampering at server boundaries;
- time zone, rounding, precision, locale/RTL, or long-content behavior;
- persistence across the lifecycle promised by the product;
- keyboard/focus/semantic behavior for browser-visible accessibility defects.

Avoid snapshot bulk, random example lists, and assertions coupled to private call order unless that order is itself a contract.

## 6. Execute economically

During the edit loop:

1. run the exact new test or smallest selector;
2. rerun it after the fix;
3. run affected tests through `node scripts/verify-affected.mjs --file <path>` when configured;
4. run the feature lane once after the slice;
5. leave the full gate for final delivery or a risk class that requires it.

If the same test command fails twice without new evidence, use the failure-recovery ladder; do not repeat it blindly. Treat nondeterminism as a defect to localize, not a reason to add retries immediately.

## Report

Return:

- contract/defect tested;
- why this layer and case are sufficient;
- red/pre-fix or equivalent sensitivity evidence;
- exact green command;
- affected/feature verification status;
- remaining untested risk.

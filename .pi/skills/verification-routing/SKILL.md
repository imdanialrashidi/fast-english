---
name: verification-routing
description: Select the cheapest reliable verification lane before running tests, builds, browser checks, CI, or release gates. Prevents repeated full-suite execution.
---

# Verification Routing

Use the narrowest reliable check that can detect regressions caused by the current change.

## Lane 1: targeted

Use repeatedly during implementation.

Prefer:

1. exact affected test;
2. exact affected test file;
3. the configured affected-change plan (`node scripts/verify-affected.mjs --file <changed-path> --plan`);
4. changed or dependency-related unit tests;
5. affected workspace typecheck or static check;
6. repository fast-verification script.

Recognize common interfaces when they exist:

- `scripts/verify-fast.sh`
- `node scripts/verify-affected.mjs --file <changed-path>`
- `pnpm verify:fast`
- `npm run verify:fast`
- `yarn verify:fast`
- `bun run verify:fast`
- `pnpm test:e2e:fast -- <spec>`
- `pnpm test:e2e:failed`

Rules:

- never set `CI=1`;
- avoid full builds unless necessary;
- avoid browser tests for backend-only or pure-logic changes;
- rerun only failed browser tests while debugging;
- prefer unit tests for pure logic;
- never claim unexecuted checks passed.
- review the affected plan before first use when a route changed; command arrays come from repository code and must be code-reviewed;
- if a changed file matches no configured route, use the router's full-gate fallback rather than silently skipping it;
- treat route maps as conservative dependency evidence, not proof that unlisted runtime dependencies do not exist.

## Lane 2: feature

Run once after a bounded feature or bug fix is functionally complete.

Include available:

- typecheck;
- lint/static checks;
- full unit and integration tests;
- relevant production build;
- small E2E smoke set.

Recognize:

- `scripts/verify-feature.sh`
- package-manager `verify:feature`

Generated tests must also satisfy `test-design`: parsing/passing is insufficient when the test cannot detect the pre-fix or missing behavior.

## Lane 3: full

Run once only:

- before merge or release;
- after deployment or release changes;
- after auth, authorization, payment, subscription, migration, or schema changes;
- when explicitly requested;
- when the canonical repository gate is required.

Recognize:

- `scripts/verify.sh`
- `scripts/verify-full.sh`
- package-manager `verify:full`

## Playwright policy

For routine local execution:

- do not set `CI=1`;
- use one relevant Chromium-based project;
- use one worker on low-resource machines;
- use zero retries and stop after first failure;
- use a lightweight reporter;
- disable video, trace, and automatic screenshots;
- reuse existing local servers;
- avoid production builds and unrelated applications;
- pass a specific spec or grep whenever possible.

Full CI may use production builds, required projects, at most one retry, screenshots on failure, and trace on first retry. Keep video disabled unless explicitly justified.

## Visual evidence adjunct

For a material UI change, visual proof supplements rather than replaces the normal lane:

- during implementation, rerun only the affected journey/state/viewport;
- at feature completion, exercise the critical journey and capture named desktop/mobile/demanding-state evidence;
- run accessibility structure/interaction checks before aesthetic screenshot review;
- use deterministic fixtures or seeded state for comparisons;
- record lab performance separately from field/RUM performance;
- do not approve from static source, a component story, or a single happy-path screenshot when the acceptance contract covers responsive behavior or other states.

Load `frontend-design` for the final hard-gate and craft verdict.

## Evidence

Final reports must distinguish:

- executed and passed;
- executed and failed;
- skipped;
- blocked by prerequisites;
- not executed.

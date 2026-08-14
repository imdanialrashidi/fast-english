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

- never set `CI=1` for routine local debugging;
- avoid full builds unless necessary;
- avoid browser tests for backend-only or pure-logic changes;
- rerun only failed browser tests while debugging;
- prefer unit tests for pure logic;
- never claim unexecuted checks passed;
- review the affected plan before first use when a route changed; command arrays come from repository code and must be code-reviewed;
- if a changed file matches no configured route, use the router's conservative fallback rather than silently skipping it;
- treat route maps as dependency evidence, not proof that unlisted runtime dependencies do not exist.

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

Use one authoritative full gate, not several copies of the same proof.

For an ordinary task delivered by PR:

1. run targeted checks while editing;
2. run feature verification once when the slice is complete;
3. commit/push the task branch;
4. treat the GitHub `quality` workflow as the authoritative full gate.

Do **not** also run the local full gate by default when GitHub CI will run the same canonical contracts. Run a local full gate before push only when one of these applies:

- authentication, authorization, payment, subscription, migration, schema, deployment, release, or similarly High-risk work;
- the verification/workflow harness itself changed and local proof is needed before sending it to CI;
- CI is unavailable;
- the user explicitly requested a local full run;
- a specific repository contract says local full proof is mandatory.

Recognize full interfaces:

- `scripts/verify.sh`
- `scripts/verify-full.sh`
- package-manager `verify:full`

Rules:

- a green full gate is evidence for the exact code SHA it tested; PR metadata or commit-message changes do not require rerunning it;
- after a code change, rerun the smallest affected local evidence first, then let CI establish the new full-gate result;
- if CI fails, inspect the failed job before changing code;
- after a repair, rerun failed CI jobs only when the platform supports it; do not restart already-green lanes without a concrete reason;
- do not weaken assertions, add broad retries, or inflate timeouts merely to obtain green status.

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

# Plan 004: Repair two vacuous smoke assertions (placement score→level mapping, duplicate topic+level rejection)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**:
> `git diff --stat f64288e..HEAD -- scripts/smoke-placement-levels.mjs scripts/smoke-lessons.mjs scripts/smoke-common.mjs`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: tests
- **Planned at**: commit `f64288e`, 2026-08-14

## Why this matters

The repo's core promise is its verification gate: 16 real-PocketBase smoke
suites are the authoritative proof for backend contracts. Two scenarios in
that gate are vacuous — they can never fail, so regressions in two critical
paths sail through green:

1. **Placement score→level mapping.** `server/pb_hooks/placement_level_routes.pb.js:70`
   (`scoreToLevel()`) is "the single authoritative source" for the suggested
   CEFR level — the placement result that picks each real user's starting
   level. Its 12 threshold rows (0→A1 … 20→C2) are asserted by a loop that
   only checks `mt.score >= 0 && mt.score <= 20` on its own fixture literals
   (a tautology) and never exercises the server. Only score 20→C2 is
   genuinely tested elsewhere. A boundary regression (e.g. 13/14 between B2
   and C1) passes the entire gate.
2. **Duplicate (topic, level) rejection in `smoke-lessons`.** The scenario
   swallows the duplicate-attempt error in an empty `catch {}` and then
   asserts `assert(true)`. If the unique index is ever dropped or the create
   flow regresses, the scenario still "passes".

## Current state

`scripts/smoke-placement-levels.mjs:257-292` (S0 block):

```js
  // S0: Score-to-level mapping
  const mappingTests = [
    { score: 0, expected: 'A1' },
    { score: 3, expected: 'A1' },
    { score: 4, expected: 'A2' },
    { score: 6, expected: 'A2' },
    { score: 7, expected: 'B1' },
    { score: 10, expected: 'B1' },
    { score: 11, expected: 'B2' },
    { score: 13, expected: 'B2' },
    { score: 14, expected: 'C1' },
    { score: 16, expected: 'C1' },
    { score: 17, expected: 'C2' },
    { score: 20, expected: 'C2' },
  ];

  for (const mt of mappingTests) {
    start(`S0-score-${mt.score}-maps-to-${mt.expected}`);
    check(mt.score >= 0 && mt.score <= 20, `score ${mt.score} should be valid`);
    // We test the mapping implicitly via the submit flow
    pass();
  }
```

Helpers in the same file (read them before editing): `seedQuestions(suToken)`
seeds 20 questions where the correct option is always `opt0`
(`:56-78`); `startAttempt(token)` (`:79-86`); `answerAll(token, attemptId,
startRev, questions)` answers every question with `q.options[0].id`
(correct) (`:88-101`); `submitAttempt(token, attemptId, rev)` (`:103+`);
`fetchLevelContext(token)` + `createActiveStudent(API_URL, suToken)` exist
(look at the S2 block at `:294-310` for the level-context assertion pattern:
`ctx.body.kind === 'level_selection_required'` and
`ctx.body.suggestedLevel === 'C2'`).

`scripts/smoke-lessons.mjs:596-604`:

```js
  // Duplicate (topic, level) rejection
  try {
    await makeLesson(su, topicId, { level: 'B1', title: 'Dup' });
    assert(false, 'dup allowed');
  } catch {}
  scenario('duplicate topic+level rejected', () => assert(true));
```

`makeLesson(su, topicId, {...})` is a local helper in that file — read its
signature and what it returns/throws before editing. The scenario runner is
`scenario(name, fn)` with `assert(cond, msg)` and `check(cond, msg)` helpers.

- **Repo conventions**: smoke suites are plain Node ESM (`.mjs`) hitting a
  disposable real PocketBase; each suite must be self-contained and
  deterministic; fixtures use unique slugs/phones per run (`randomId()`,
  `nextPhone()`); no sleeps for correctness. `scripts/smoke-common.mjs`
  holds shared helpers (`createActiveStudent` etc.) — put new shared helpers
  there only if used by 2+ suites.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| The two suites | `pnpm smoke:placement-levels` and `pnpm smoke:lessons` | all scenarios pass |
| Sibling suites (regression) | `pnpm smoke:placement && pnpm smoke:episode && pnpm smoke:progress && pnpm smoke:library && pnpm smoke:podcast-domain` | all pass |
| Fast gate | `pnpm verify:fast` | exit 0 |

## Scope

**In scope** (the only files you should modify):
- `scripts/smoke-placement-levels.mjs`
- `scripts/smoke-lessons.mjs`
- `scripts/smoke-common.mjs` (only if you extract a shared helper — see
  Step 1; otherwise leave it)

**Out of scope** (do NOT touch):
- `server/pb_hooks/placement_level_routes.pb.js` and any other server code —
  this plan only adds test coverage; if a test FAILS, that is a real finding
  to report (the mapping may be wrong), not a license to change the server
  in this plan.
- The threshold values themselves (0/3/4/6/7/10/11/13/14/16/17/20 → A1…C2) —
  these are the contract under test; they come from the server's
  `scoreToLevel()` and must match it. If your run shows a mismatch, report
  it (with the server's actual rows) as a BLOCKER.
- Any assertion weakening, `.skip`, or retry addition.

## Git workflow

- Branch: `advisor/004-smoke-assertion-integrity` (repo convention: `topic-slug`).
- Commit style: conventional (`test(placement): assert real score→level mapping against server`).
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Make the placement score→level mapping a real server test

In `scripts/smoke-placement-levels.mjs`, replace the S0 loop with a per-row
real flow:

1. Add a local helper next to `answerAll` that answers exactly `correctCount`
   questions correctly and the rest with a wrong option:

```js
async function answerPattern(token, attemptId, startRev, questions, correctCount) {
  let rev = startRev;
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    const optionId = i < correctCount ? q.options[0].id : q.options[1].id;
    const ans = await jsonFetch(`/api/fast-english/placement/attempts/${attemptId}/answer`, {
      method: 'PUT',
      headers: { authorization: token, 'content-type': 'application/json' },
      body: JSON.stringify({ questionId: q.id, optionId, expectedRevision: rev }),
    });
    if (ans.status !== 200) throw new Error(`answer ${i + 1} failed: ${JSON.stringify(ans.body)}`);
    rev = ans.body.attempt.revision;
  }
  return rev;
}
```

   (Verify `q.options[1]` exists — the seeded questions have 4 options,
   `:60-66`; if a live check disagrees, STOP and report.)

2. For each row of `mappingTests`: `start(...)` a scenario named
   `S0-score-${score}-maps-to-${expected}`; inside it create a fresh student
   (`createActiveStudent(API_URL, suToken)` — one per row, never reused),
   `startAttempt`, `answerPattern(..., score, ...)` (correctCount = the
   row's score; score 0 answers all wrong), `submitAttempt`, then
   `fetchLevelContext` and assert `kind === 'level_selection_required'` and
   `suggestedLevel === expected`. Each row is one scenario with its own
   student so a mid-loop failure is attributable.

3. Delete the old tautological `check(mt.score >= 0 && mt.score <= 20, ...)`
   line and the "implicitly via the submit flow" comment (that claim is what
   made the loop vacuous).

Runtime note: 12 extra students × (start + 20 answers + submit + context)
against the disposable PB adds a few seconds; the suite previously had
pacing sleeps removed, so this is acceptable. Keep `seedQuestions` called
once before S0 (already done at the top of the suite).

**Verify**: `pnpm smoke:placement-levels` → all scenarios pass, including
the 12 S0 rows. Then deliberately break one expectation ONCE (e.g. set
`{ score: 13, expected: 'B1' }` temporarily), confirm the scenario fails
(proving it is no longer vacuous), then restore the correct row.

### Step 2: Fix the swallowed duplicate-topic+level assertion

In `scripts/smoke-lessons.mjs`, capture the outcome of the duplicate attempt
instead of swallowing it:

```js
  // Duplicate (topic, level) rejection
  let dupStatus = 0;
  try {
    await makeLesson(su, topicId, { level: 'B1', title: 'Dup' });
  } catch (e2) {
    dupStatus = Number(e2 && e2.status ? e2.status : 0) || 0;
  }
  scenario('duplicate topic+level rejected', () => {
    assert(dupStatus >= 400, `expected >= 400, got ${dupStatus}`);
  });
```

Read the local `makeLesson` helper first: it must throw an error carrying an
`.status` (most repo helpers do — verify; if it throws a bare Error without
status, extract the status from the JSON response inside the helper instead,
or adjust the catch to read whatever the helper exposes). The scenario must
fail both when the duplicate is wrongly allowed (dupStatus 0/2xx) AND when
the rejection comes from an unrelated cause such as an auth failure — so
also assert `dupStatus !== 401 && dupStatus !== 403` (or, if the helper
cannot distinguish, assert the specific 4xx the server actually returns for
the unique-index violation — run the suite once and read the value before
finalizing the assertion).

**Verify**: `pnpm smoke:lessons` → all scenarios pass. Then temporarily
remove the `level: 'B1'` from the dup call (making it a non-duplicate),
confirm the scenario now FAILS, and restore.

### Step 3: Regression sweep

Run the sibling suites (see Commands) to confirm the edits broke nothing
else — in particular that `smoke-placement-levels` S1/S2 blocks (score 20→C2)
still pass and `smoke-lessons` fixture counts are unchanged.

## Test plan

- This plan IS a test plan: the two repaired scenarios are the product.
- Red-green proof required for both (Steps 1 and 2's temporary-break checks)
  — record the failing output in your report.
- Existing suites that must stay green: `smoke-placement`,
  `smoke-episode`, `smoke-progress`, `smoke-library`, `smoke-podcast-domain`.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `pnpm smoke:placement-levels` exits 0 with the 12 real per-threshold
      S0 scenarios passing against the server
- [ ] `pnpm smoke:lessons` exits 0 with the duplicate-topic+level scenario
      asserting a real `>= 400` status
- [ ] Red-green proven: each repaired scenario fails under its deliberately
      broken variant (evidence recorded in the report)
- [ ] `pnpm smoke:placement && pnpm smoke:episode && pnpm smoke:progress && pnpm smoke:library && pnpm smoke:podcast-domain` all exit 0
- [ ] `pnpm verify:fast` exits 0
- [ ] `git status` shows only in-scope files (plus `plans/README.md`)
- [ ] `plans/README.md` status row updated to DONE

## STOP conditions

Stop and report back (do not improvise) if:

- A per-threshold assertion FAILS against the real server (the threshold
  table in `scoreToLevel` disagrees with `mappingTests`). This is a genuine
  product finding: report the server's actual rows and the mismatch — do not
  "fix" by changing expected values.
- `makeLesson`'s error shape cannot provide a status (read the helper; if
  truly impossible, report — do not fall back to `assert(true)`).
- The suites drift from the excerpts above.
- A sibling suite breaks in a way that indicates the shared fixture
  functions were affected (e.g. `seedQuestions` ordering) — report.

## Maintenance notes

- When placement thresholds change, `mappingTests` in this suite is the
  contract — update both together (the suite will force it).
- The `smoke-common.mjs` consolidation backlog (placement question seeding is
  duplicated in ~10 suites) is a separate finding; if you extract
  `answerPattern`/seeding into `smoke-common.mjs` while here, keep the
  change purely additive so other suites can adopt it later without
  behavior change.

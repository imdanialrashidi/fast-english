# Plan 018: Centralize placement-question seeding in smoke-common

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**:
> `git diff --stat f64288e..HEAD -- scripts/smoke-common.mjs scripts/smoke-placement.mjs scripts/smoke-episode.mjs scripts/smoke-lessons.mjs scripts/smoke-progress.mjs scripts/smoke-library.mjs scripts/smoke-podcast-domain.mjs scripts/smoke-placement-levels.mjs scripts/smoke-placement-capacity.mjs scripts/smoke-placement-race.mjs scripts/measure-app-perf-seed.mjs`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P3
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none
- **Category**: tech-debt (test-fixture duplication)
- **Planned at**: commit `f64288e`, 2026-08-14

## Why this matters

The 20-question placement seeding loop is re-implemented in ~10 suites,
each with its own keys/prompts/options and its own check-then-seed
idempotency workaround:

- `scripts/smoke-placement.mjs` (`seedQuestions`, q00..q19 + count verify)
- `scripts/smoke-episode.mjs` (~:293, Q1..Q20)
- `scripts/smoke-lessons.mjs` (~:365)
- `scripts/smoke-progress.mjs` (~:384)
- `scripts/smoke-library.mjs` (~:312)
- `scripts/smoke-podcast-domain.mjs` (~:364)
- `scripts/smoke-placement-levels.mjs` (~:62, q1..q20, opt0 correct)
- `scripts/smoke-placement-capacity.mjs` (~:99)
- `scripts/smoke-placement-race.mjs` (~:66)
- `scripts/measure-app-perf-seed.mjs` (~:107)

Question content therefore diverges per suite (e.g. correct-option
conventions differ), and adding a 21st question touches ~10 files. The
e2e side already solved this class of problem with shared owned fixtures
(`e2e/fixtures.ts`); the smoke side has `smoke-common.mjs` but never
moved the placement seeding there.

**Non-goal**: changing WHAT the questions are (keys, prompts) beyond
standardizing on one seed shape — see the shape decision in Step 1. No
change to any server behavior.

## Current state

`scripts/smoke-common.mjs` exports shared stateless helpers
(`fetchJson`, `nextPhone`, `createActiveStudent`, `getStaffToken`,
`login`, `randomId`). It does NOT seed placement questions.

Representative inline loop (smoke-placement-levels.mjs:56-78):

```js
async function seedQuestions(suToken) {
  for (let i = 1; i <= 20; i++) {
    const opts = [];
    for (let j = 0; j < 4; j++) {
      opts.push({ id: `opt${j}`, text: `Option ${String.fromCharCode(65 + j)}` });
    }
    await jsonFetch('/api/collections/placement_questions/records', {
      method: 'POST',
      headers: { authorization: suToken },
      body: JSON.stringify({
        question_key: `q${i}`, version: 1, position: i,
        prompt: `Question ${i}?`, options: opts,
        options_text: JSON.stringify(opts), correct_option_id: 'opt0',
        is_active: true,
      }),
    });
  }
}
```

Suites rely on `correct_option_id` being the FIRST option (`opt0`) so
`q.options[0]` is the correct answer when they answer via the API. The
disposable PocketBase is fresh per suite, so the loops POST unconditionally;
idempotency only matters for retry/restart scenarios.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| All migrated suites | `pnpm smoke:placement && pnpm smoke:placement-levels && pnpm smoke:placement-race && pnpm smoke:placement-capacity && pnpm smoke:episode && pnpm smoke:lessons && pnpm smoke:progress && pnpm smoke:library && pnpm smoke:podcast-domain` | all green |
| Fast gate | `pnpm verify:fast` | exit 0 |

## Scope

**In scope** (the only files you should modify):
- `scripts/smoke-common.mjs` (new `seedPlacementQuestions` helper)
- The nine smoke suites listed above (replace inline loops with the helper)
- `scripts/measure-app-perf-seed.mjs` (same replacement, if it runs before
  a suite that seeds — check its call order; if the perf harness starts a
  fresh PB, keep its local call)

**Out of scope** (do NOT touch):
- Server placement hooks, migrations, or question schema.
- `e2e/` seeding (different runtime, already centralized in `e2e/fixtures.ts`).
- The question CONTENT itself (see the shape decision — changing keys is
  part of consolidation, changing prompts/options is not).

## Git workflow

- Branch: `advisor/018-placement-seeding` (repo convention: `topic-slug`).
- Commit per logical group (common helper first, then suites), conventional
  style (`test(smoke): centralize placement question seeding in smoke-common`).
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: The shared helper

In `scripts/smoke-common.mjs`, add:

```js
// Seeds the 20 active placement questions (question_key q01..q20,
// four options opt0..opt3, correct = opt0 — suites answer via
// q.options[0]). Idempotent: tolerates an existing active set (the
// unique (question_key, version) index rejects duplicates) and verifies
// the final count.
export async function seedPlacementQuestions(base, suToken, { count = 20 } = {}) {
  const created = [];
  for (let i = 1; i <= count; i++) {
    const key = `q${String(i).padStart(2, '0')}`;
    const opts = [];
    for (let j = 0; j < 4; j++) {
      opts.push({ id: `opt${j}`, text: `Option ${String.fromCharCode(65 + j)}` });
    }
    const r = await fetchJson(base, '/api/collections/placement_questions/records', {
      method: 'POST',
      headers: { authorization: suToken },
      body: JSON.stringify({
        question_key: key,
        version: 1,
        position: i,
        prompt: `Question ${i}?`,
        options: opts,
        options_text: JSON.stringify(opts),
        correct_option_id: 'opt0',
        is_active: true,
      }),
    });
    // 400 = duplicate (already seeded) — acceptable; anything else is fatal.
    if (r.status !== 200 && r.status !== 201 && r.status !== 400) {
      throw new Error(`seed question ${key}: ${r.status} ${JSON.stringify(r.body).slice(0, 200)}`);
    }
    created.push(r.body?.id);
  }
  const check = await fetchJson(
    base,
    `/api/collections/placement_questions/records?perPage=50`,
    { headers: { authorization: suToken } },
  );
  const active = (check.body?.items || []).filter((q) => q.is_active === true);
  if (active.length !== count) {
    throw new Error(`placement seeding: expected ${count} active questions, got ${active.length}`);
  }
  return created;
}
```

**Shape decision**: standardize on `q01..q20` (zero-padded), 4 options,
`opt0` correct. Suites that currently use `q1..q20` or `Q1..Q20` must not
depend on the exact KEY strings — verify before deleting their loops
(grep for `question_key`/`q.options[` usages in each suite; the answer
paths use `q.options[0]` which is shape-independent).

**Verify**: `node --test`-style syntax check: `node -e "import('./scripts/smoke-common.mjs')"` (or the cheapest existing smoke that imports it) loads without error.

### Step 2: Migrate the suites

For each suite: delete the local `seedQuestions` loop, import
`seedPlacementQuestions` from `./smoke-common.mjs`, and call it at the
same point the loop ran (right after the superuser token is obtained, in
the same place the suite verified the count). Keep each suite's
post-seed count assertion where one exists (now redundant with the
helper's own verify — remove the redundant re-fetch or keep it; prefer
removing it and relying on the helper).

Also migrate `scripts/measure-app-perf-seed.mjs` if it seeds (check; if
its seed shape differs for a reason — e.g. fixed prompts for perf
stability — keep its local loop and note why in the commit).

**Verify**: each migrated suite passes individually
(`pnpm smoke:<name>`), then the full battery in Commands.

### Step 3: Regression sweep

**Verify**: all nine suites + perf-seed (if migrated) green;
`pnpm verify:fast` exit 0; `grep -rn "placement_questions/records" scripts/*.mjs` shows only `smoke-common.mjs` (plus any intentionally kept local seed).

## Test plan

- The suites ARE the tests: every suite exercises start/answer/submit
  against the seeded questions. The helper's count-verify makes silent
  seeding failures impossible (previously a failed POST was often
  swallowed).
- Red-green: temporarily break the helper's POST (e.g. wrong collection
  name) and confirm `smoke:placement` fails; restore.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `seedPlacementQuestions` exists in `smoke-common.mjs` and is imported by all nine suites
- [ ] `grep -rn "function seedQuestions" scripts/` → no matches (all local loops gone)
- [ ] All nine suites green + `pnpm verify:fast` exit 0
- [ ] Red-green proven for the helper
- [ ] `git status` shows only in-scope files (plus `plans/README.md`)
- [ ] `plans/README.md` status row updated to DONE

## STOP conditions

Stop and report back (do not improvise) if:

- A suite's answer logic depends on its LOCAL question keys or option ids
  beyond `q.options[0]` (e.g. asserts `question_key === 'Q12'`) — then the
  shape decision breaks it; report the dependency instead of preserving
  per-suite shapes.
- A suite seeds questions with DIFFERENT semantics (e.g. capacity/race
  suites that need N>20 or inactive questions) — those keep their own
  seeding; report which and why.
- The perf seed's prompts matter for measurement stability — keep it local
  and say so.

## Maintenance notes

- Future question-content changes (the "20 reviewed questions" open
  product decision) land in ONE place: the helper — suites follow.
- If the question bank becomes versioned content (seed migration), the
  helper becomes a thin no-op that verifies the migration's set; keep the
  verify step.
- The e2e fixtures (`e2e/fixtures.ts`) remain separate by design (browser
  runtime) — a future plan may align the two shapes (same keys/options).

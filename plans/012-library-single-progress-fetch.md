# Plan 012: Fetch the library user's progress once per request

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**:
> `git diff --stat f64288e..HEAD -- server/pb_hooks/library_routes.pb.js scripts/smoke-library.mjs`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: perf
- **Planned at**: commit `f64288e`, 2026-08-14

## Why this matters

`GET /api/fast-english/library` reads the requesting user's FULL progress
collection twice in one request: once to merge per-Variant progress into
the discovery results (`progresses`, unsorted full scan at
`library_routes.pb.js:318`) and once for the Continue rail
(`continueRows`, `-last_played_at`-ordered full scan at `:493`). Progress
rows persist even for archived lessons, so the duplicate scan doubles the
cost of the biggest read on the most-visited student surface for no
benefit — one ordered fetch can feed both uses.

**Non-goal**: no behavior change to ordering, the Continue rail cap (≤3),
or the progress merge — verified byte-identical by `smoke-library`.

## Current state

`server/pb_hooks/library_routes.pb.js`:

```js
// :318 — first scan (unsorted), used to build the per-Variant progress map
        progresses = $app.findRecordsByFilter(PROGRESS_C, "user = {:uid}", "", 0, 0, { uid: uid });

// :493 — second scan (ordered), used for the Continue rail
        continueRows = $app.findRecordsByFilter(PROGRESS_C, "user = {:uid}", "-last_played_at", 0, 0, { uid: uid });
```

The first result is indexed into a map (find the `progressByLesson` /
equivalent construction); the second is iterated in order for the rail
(loop caps at `MAX_CONTINUE` = 3, skips completed / zero-furthest, and
validates publication through the already-built `lessonById`/`topicById`
maps). Both fetches happen inside the same handler; the map construction
and the rail loop are independent consumers of the same predicate.

- **Repo conventions**: ES5 hooks; bulk-map pattern from this same file
  (topics/categories/lessons fetched once into byId maps).

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Library smoke | `pnpm smoke:library` | all pass (27 scenarios) |
| Fast gate | `pnpm verify:fast` | exit 0 |
| Browser lane | `pnpm test:e2e:fast e2e/podcast-library.spec.ts` | all pass |

## Scope

**In scope** (the only files you should modify):
- `server/pb_hooks/library_routes.pb.js`

**Out of scope** (do NOT touch):
- Anything else in the handler (filters, pagination, publication logic).
- Other routes with similar patterns (lesson list batching was plan 002).

## Git workflow

- Branch: `advisor/012-library-single-progress-fetch` (repo convention: `topic-slug`).
- Commit style: conventional (`perf(server): fetch library progress once per request`).
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Single ordered fetch, two consumers

Replace the two fetches with one:

```js
        // One ordered full scan feeds both the per-Variant progress map
        // and the Continue rail (plan 012) — never fetch twice.
        progresses = $app.findRecordsByFilter(PROGRESS_C, "user = {:uid}", "-last_played_at", 0, 0, { uid: uid });
```

Then delete the second fetch (`:493` block) and make the rail loop iterate
`progresses` in place (it is already `-last_played_at`-ordered, which is
exactly what `continueRows` was). Keep the map construction untouched.
Read the code between `:318` and `:530` carefully first: if the map
construction or the rail loop MUTATES the array (e.g. splice/sort), adjust
the order of operations so the rail still sees the full ordered set (the
rail loop only reads, per the excerpt — verify).

**Verify**: `pnpm smoke:library` 27/27 (continue rail order, cap,
progress merge, filters unchanged).

### Step 2: Regression sweep

**Verify**: `pnpm verify:fast` exits 0; `pnpm test:e2e:fast e2e/podcast-library.spec.ts` all pass (the browser surface pins rail order + per-Variant progress labels).

## Test plan

- No new tests: `smoke-library` pins the exact behavior (Continue rail ≤3
  ordered by `-last_played_at`, completed/archived exclusion, per-Variant
  progress states) and the e2e spec pins the rendered labels. If a smoke
  scenario currently relies on the two fetches being independent (it does
  not — same data, same predicate), report rather than adjust.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `grep -n "findRecordsByFilter(PROGRESS_C" server/pb_hooks/library_routes.pb.js` returns exactly ONE match
- [ ] `pnpm smoke:library` exits 0 (27/27)
- [ ] `pnpm verify:fast` exits 0
- [ ] `pnpm test:e2e:fast e2e/podcast-library.spec.ts` all pass
- [ ] `git status` shows only in-scope files (plus `plans/README.md`)
- [ ] `plans/README.md` status row updated to DONE

## STOP conditions

Stop and report back (do not improvise) if:

- The code between the two fetches differs from the excerpt (drift) or
  mutates `progresses` before the rail loop.
- A smoke assertion pins the two-fetch behavior (it cannot — same data).

## Maintenance notes

- If progress gets paginated or partitioned (e.g. per-level scans), the
  single-fetch contract must be revisited — the rail needs the ordered
  global view, the map needs the full set.
- `MAX_CONTINUE` (3) and the rail's publication re-validation live in the
  loop — keep them when refactoring the loop body.

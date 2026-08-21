# Plan 033: Compute progress percent from authoritative lesson duration (fix stale `duration_seconds`)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 1062bb0..HEAD -- server/pb_hooks/progress_routes.pb.js server/pb_hooks/content_import_core.pb.js server/pb_migrations/1700000015_create_lesson_progress.js scripts/smoke-progress.mjs`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW (migration + read path change, completion threshold preserved)
- **Depends on**: none
- **Category**: bug (stale denominator after re-import)
- **Planned at**: commit `1062bb0`, 2026-08-21

## Why this matters

`lesson_progress.duration_seconds` is written once on create (`authoritativeDuration` at that time) and thereafter kept as `storedDuration`. `content_import_core.pb.js` can change `lessons.audio_duration_seconds` on re-import without backfilling existing `lesson_progress` rows. Then `percent = furthest / storedDuration *100` and completion `furthest >= storedDuration*0.9` use the stale denominator: a 312s→445s re-import shows 95% on the old basis while the new lesson is 67%, or completion never/prematurely reached; `lessonDetail.audioDurationSeconds` (authoritative) and `progress.durationSeconds` (stale) disagree in the Deck timeline.

## Current state

- **Progress write — `server/pb_hooks/progress_routes.pb.js:PUT` (~380–520):**
```js
var storedDuration = Number(existing.get("duration_seconds") || 0);
if (!(storedDuration > 0)) storedDuration = authoritativeDuration; // fallback
// later:
var newFurthest = Math.max(currentFurthest, positionSeconds);
existing.set("furthest_seconds", newFurthest);
var wasCompleted = Boolean(existing.get("completed"));
var isCompletedNow = wasCompleted || (storedDuration > 0 && newFurthest >= storedDuration * COMPLETION_THRESHOLD);
existing.set("completed", isCompletedNow);
// save: existing.set("duration_seconds", storedDuration);
```
  And create path (`!existing`): `newRec.set("duration_seconds", authoritativeDuration)` — fresh rows are correct, old rows stale after re-import.

- **Progress read — `server/pb_hooks/progress_routes.pb.js:GET` (~40–120, summary/continue ~690–920):**
```js
var dur = Number(progress.get("duration_seconds") || 0);
if (!(dur > 0)) dur = authoritativeDuration;
var percent = dur > 0 ? Math.round((furthest / dur) * 100) : 0;
```

- **Lesson authoritative:** `lesson.get("audio_duration_seconds")` (enforced by publish hook, `lessons.audio_duration_seconds >0`). `content_import` can mutate it in place (`content_import_core.pb.js:applyImport` updates lesson rows with new `audio_duration_seconds`).

- **No backfill exists:** migration `1700000015_create_lesson_progress.js` creates `lesson_progress` with `duration_seconds NumberField` (no trigger on lesson update).

- **Conventions:** Hooks ES5, `runInTransaction`, `COMPLETION_THRESHOLD=0.9`, `POSITION_TOLERANCE=2` (today). Smokes: `scripts/smoke-progress.mjs` 57 scenarios (concurrent same-revision race, first-save race, revision guard).

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Fast gate | `pnpm verify:fast` | exit 0 |
| Progress smoke | `bash scripts/smoke-progress.sh node scripts/smoke-progress.mjs` | all pass (reuse existing revision/completion scenarios) |
| Lessons smoke | `bash scripts/smoke-lessons.sh node scripts/smoke-lessons.mjs` | pass (entitlement unaffected) |
| Content import | `bash scripts/smoke-content-import.sh node scripts/smoke-content-import.mjs` | pass if run (optional) |

## Scope

**In scope** (the only files you should modify):
- `server/pb_hooks/progress_routes.pb.js` (read + write handlers)
- `server/pb_migrations/1700000032_backfill_progress_duration.js` (new)
- `scripts/smoke-progress.mjs` (add one re-import staleness scenario)

**Out of scope** (do NOT touch, even though they look related):
- `server/pb_hooks/lesson_routes.pb.js` / `library_routes.pb.js` — different read paths.
- `server/pb_hooks/content_import_core.pb.js` — do not add backfill there; migration handles it.
- Any client `app/**` progress UI (Deck timeline) — reads already display authoritative as `audioDurationSeconds`; no client change.

## Git workflow

- Branch: `advisor/033-progress-duration-authoritative`
- Commit: `fix(progress): use authoritative lesson duration for percent/completion`
- Do NOT push unless instructed.

## Steps

### Step 1: Change progress reads to use authoritative lesson duration for `percent`/`completed` derivation

Edit `server/pb_hooks/progress_routes.pb.js` in three places:

**1a. `GET /api/fast-english/lessons/{lessonId}/progress` (single lesson read):** After loading `lesson` and `authoritativeDuration`, when building the response from an existing `progress` row, compute `percent` from `authoritativeDuration`, not `dur`:

```js
var dur = Number(progress.get("duration_seconds") || 0);
if (!(dur > 0)) dur = authoritativeDuration;
// keep `durationSeconds: dur` in response for backward compat (what's stored), but:
var percent = authoritativeDuration > 0 ? Math.round((furthest / authoritativeDuration) * 100) : 0;
// and also ensure completion reflected from authoritative:
// var completedNow = Boolean(progress.get("completed")) || (authoritativeDuration > 0 && furthest >= authoritativeDuration * 0.9);
// but do NOT persist `completed` change on a GET — just derive for response.
```

Decision: **DO persist authority on next PUT**, but GET should derive without writing (keep GET side-effect free). So compute response field `percent` and optionally `completed` derivation from authoritative, but do not call `txApp.save`. Document choice in code comment.

**1b. `PUT` handler (update path, ~around `storedDuration`):** Change denominator to `authoritativeDuration` directly:

```js
// Before:
var storedDuration = Number(existing.get("duration_seconds") || 0);
if (!(storedDuration > 0)) storedDuration = authoritativeDuration;
// After:
var authoritativeDuration = /* already loaded above */;
var effectiveDuration = authoritativeDuration; // single source of truth
// keep storedDuration field update: existing.set("duration_seconds", authoritativeDuration);
existing.set("duration_seconds", authoritativeDuration);
var newFurthest = Math.max(currentFurthest, positionSeconds);
existing.set("furthest_seconds", newFurthest);
var isCompletedNow = wasCompleted || (effectiveDuration > 0 && newFurthest >= effectiveDuration * COMPLETION_THRESHOLD);
```

So `duration_seconds` is overwritten with authoritative on every PUT (lazy backfill) and completion uses authoritative.

**1c. `GET /api/fast-english/progress/summary` and `/continue` (if they derive percent):** Same — where they already load `authoritativeDuration` per lesson (`lesson.get("audio_duration_seconds")`), ensure summary's `completionPercent` and continue's progress `percent` use authoritative, not stored.

Keep `POSITION_TOLERANCE` clamping as is (against authoritative).

**Verify**: `npx tsc --noEmit` (main) still exits 0; `npx tsc --project tsconfig.server.json --noEmit` if plan 030 landed.

### Step 2: Add migration `1700000032_backfill_progress_duration.js`

Create `server/pb_migrations/1700000032_backfill_progress_duration.js`:

```js
// Backfill lesson_progress.duration_seconds to authoritative lesson duration
// where lesson's audio_duration_seconds differs. Safe monotonic update.
migrate(
  (app) => {
    const lessons = app.findRecordsByFilter("lessons", "audio_duration_seconds > 0", "", 0, 0);
    const byId = {};
    for (let l of lessons) byId[String(l.id)] = Number(l.get("audio_duration_seconds"));
    const progresses = app.findRecordsByFilter("lesson_progress", "duration_seconds > 0", "", 0, 0);
    for (let p of progresses) {
      const lid = String(p.get("lesson")||"");
      const auth = byId[lid];
      if (!auth || !(auth>0)) continue;
      const stored = Number(p.get("duration_seconds")||0);
      if (stored !== auth) {
        p.set("duration_seconds", auth);
        // recompute completed if furthest now >= auth*0.9
        const furthest = Number(p.get("furthest_seconds")||0);
        const wasCompleted = Boolean(p.get("completed"));
        const shouldComplete = furthest >= auth * 0.9;
        if (shouldComplete && !wasCompleted) {
          p.set("completed", true);
          if (!p.get("completed_at")) p.set("completed_at", new Date().toISOString());
        }
        // If stored was longer and row is completed but furthest < auth*0.9, keep completed monotonic (never unset)
        app.save(p);
      }
    }
  },
  (app) => {
    // No reverse — stale values are not recoverable precisely; best-effort is to do nothing.
  }
);
```

- Use `app.findRecordsByFilter` pagination if row count may exceed PB default limit (unlikely for MVP, but loop with offset if needed).
- Keep `completed` monotonic: never clear `completed=true` on backfill even if new duration would make it incomplete.

**Verify**: run against disposable PB: `bash scripts/smoke-progress.sh node -e "/* open PB, create lesson 312s, create progress 95%, re-import lesson 445s, run migration up, assert duration_seconds==445 and percent recomputed */"` is optional. At minimum ensure migration file parses (`node --check` or `npx tsc` no error on the file) and `pnpm verify:fast` still green (migrations are not typechecked by main `tsconfig`).

### Step 3: Add smoke scenario for stale-duration regression

Edit `scripts/smoke-progress.mjs`:

Scenario steps:

1. Create entitled student (reuse helper `ensureEntitledStudent`).
2. Create topic+lesson with `audio_duration_seconds=120` (via superuser).
3. PUT progress `positionSeconds=108` (90% → completed true, `furthest=108`, `duration_seconds` stored 120, `percent` 90).
4. Update the same lesson via superuser to `audio_duration_seconds=200` (simulate re-import).
5. GET progress → assert `durationSeconds` still 120? After Step 1 the GET `percent` should be `Math.round(108/200*100)=54` (authoritative) not 90. If you implemented GET deriving, assert `percent===54` and `audioDurationSeconds===200`. After a subsequent PUT (any non-zero position), `duration_seconds` is overwritten to 200.
6. PUT `positionSeconds=180` (90% of 200) with correct `expectedRevision` → assert `completed` remains true and `durationSeconds` now 200.

Alternative simpler: just assert after re-import and before PUT, `GET` reports `percent` based on 200, not stored 120. Keep the smoke deterministic — no sleep.

If the suite's superuser helpers do not allow direct `lessons.update` of `audio_duration_seconds`, use `app.save(lessonRecord.set("audio_duration_seconds",200))` via `$app` in smoke's `pb-test-helper` context (find how other smokes mutate lessons — search `lesson_progress` mutation pattern).

**Verify**: `bash scripts/smoke-progress.sh node scripts/smoke-progress.mjs` → new scenario passes; existing 57 scenarios still pass. The migration backfill correctness is also proven by re-running smoke after migration up (the migration runs on fresh PB at startup, so subsequent PUT sees authoritative).

### Step 4: Regression sweep

Run `bash scripts/smoke-progress.sh`, `bash scripts/smoke-lessons.sh`, `bash scripts/smoke-podcast-domain.sh`.

**Verify**: all three green; `pnpm verify:fast` green.

## Test plan

- **New smoke scenario:** re-import lesson duration change → GET percent derives from authoritative (54 not 90), next PUT backfills `duration_seconds`, completion threshold re-evaluated against authoritative.
- **Migration up:** backfill covers existing rows (monotonic completed, `completed_at` set once).
- **Regression:** all progress/lesson/podcast-domain smokes green; fast gate green.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `grep -n "effectiveDuration = authoritativeDuration" server/pb_hooks/progress_routes.pb.js` or equivalent authoritative-denominator assignment exists in the PUT handler
- [ ] `grep -n "authoritativeDuration.*percent" server/pb_hooks/progress_routes.pb.js` shows percent computed from `authoritativeDuration` in the GET handler
- [ ] `test -f server/pb_migrations/1700000032_backfill_progress_duration.js`
- [ ] `bash scripts/smoke-progress.sh node scripts/smoke-progress.mjs` exits 0 and new re-import scenario is counted as passing
- [ ] `pnpm verify:fast` exits 0
- [ ] `git status` only touches files in Scope + `plans/README.md`

## STOP conditions

Stop and report back if:

- `authoritativeDuration` is not reliably available in the GET handler (lesson not loaded in that path) — report actual control flow.
- Migration `findRecordsByFilter("lesson_progress", ...)` with `0,0` hits PB pagination limit and would need batched offset iteration — report actual row count handling.
- The current `completed` column is not boolean in PB schema (requires `new Date` vs string) — report type.
- You need to change any client `app/**` file or any hook besides `progress_routes.pb.js`.

## Maintenance notes

- Future imports that change `audio_duration_seconds` no longer need a manual backfill step — the next PUT overwrites stale rows, and GET derives correctly. The migration is a one-time catch-up for rows predating this fix.
- Keep `COMPLETION_THRESHOLD=0.9` as the single source; do not lower it per surface.
- Reviewers: verify `percent` is clamped 0–100 and `Math.round` preserved (client renders `percent` as chip + timeline).


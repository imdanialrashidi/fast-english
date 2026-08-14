# Plan 002: Batch student read-path queries (remove N+1 in lesson list/detail/summary/continue/prev-next)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**:
> `git diff --stat f64288e..HEAD -- server/pb_hooks/lesson_routes.pb.js server/pb_hooks/progress_routes.pb.js scripts/smoke-lessons.mjs scripts/smoke-progress.mjs scripts/smoke-episode.mjs scripts/smoke-library.mjs`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: none (independent of plan 001 — both touch
  `lesson_routes.pb.js` but in disjoint regions; land them in separate
  commits)
- **Category**: perf
- **Planned at**: commit `f64288e`, 2026-08-14

## Why this matters

The student read paths are the highest-frequency surface of the product, and
they pay the worst query complexity. `/api/fast-english/lessons` does a full
collection scan plus ~2–4 DB lookups **per lesson** (topic lookup + category
lookup, twice — once in the visibility filter, once again inside the shape
function). The lesson detail page re-does a full level scan plus per-sibling
lookups just to compute prev/next neighbors. `GET /progress/summary` and
`GET /progress/continue` repeat the same per-lesson pattern, and the Home
route fires the lesson list + continue + summary + dashboard endpoints in
parallel on every visit (`app/src/features/home/api.ts:78-92`).

With ~300 lessons this means ~1,200+ extra SQL round-trips per Home paint, on
the low-end Android devices that are the product's primary audience. The repo
already contains the correct pattern: `server/pb_hooks/library_routes.pb.js`
fetches each collection once into `byId` maps and never queries per item —
"no N+1" is the documented standard there. This plan applies that same
pattern to the older routes.

**Non-goal**: this plan does NOT change response shapes, ordering, pagination
semantics, entitlement behavior, or the full-scan query itself (a single
collection scan stays — the fix is the per-item lookups). No client changes.

## Current state

- **Lesson list** — `server/pb_hooks/lesson_routes.pb.js`:
  - Full scan at `:269-282`:
    `var allMatching = $app.findRecordsByFilter(LESSONS_C, "level = {:lvl} && status = 'published'", "-published_at", 0, 0, { lvl: requestedLevel });`
  - Visibility loop `:285-309` — per lesson:
    `var tRec = $app.findRecordById(TOPICS_C, tId);` then
    `var catRes = pd.requirePublishedCategory($app, tRec.get("category"));`
    (which itself does a `findRecordById("categories")`).
  - Shape function `shapeLessonListItem(rec, pd)` at `:64-150` — per lesson,
    again: topic lookup + `pd.requirePublishedCategory(...)` for
    category/title fields.
- **Prev/next neighbors** in the lesson detail handler `:533-620` — full level
  scan `findRecordsByFilter(LESSONS_C, "level = {:lvl} && status='published'", "", 0, 0)` then per sibling `findRecordById(TOPICS_C, sibTid)` + category lookup. There is a `sibTopicCache` that rarely helps (one lesson per topic per level).
- **Progress summary** — `server/pb_hooks/progress_routes.pb.js:728-762`:
  full lessons scan + per-lesson topic/category `findRecordById`, plus a full
  progress scan for the user.
- **Progress continue** — `progress_routes.pb.js:930-965`: same pattern.
- **The reference pattern to copy** — `server/pb_hooks/library_routes.pb.js:264-330`:

```js
  var categories = [];
  try { categories = $app.findRecordsByFilter(CATS_C, "publication_status = 'published'", "", 0, 0); } catch (_) {}
  var categoryById = {};
  ...for each: categoryById[String(cat.id || "")] = cat;...
  var topics = [];
  try { topics = $app.findRecordsByFilter(TOPICS_C, "status = 'published'", "", 0, 0, topicParams); } catch (_) {}
  var topicById = {};
  ...for each: topicById[String(t.id || "")] = t;...
  // then everything indexes into the maps — zero per-item queries
```

- **Repo conventions**: ES5-only JS in hooks (`var`, `function`, no arrows/
  template literals) — PB 0.39 goja JSVM. Hooks are excluded from Biome; match
  the file's existing style. `pd` is loaded per handler via
  `try { pd = require(__hooks + '/podcast_domain.pb.js'); } catch (_) { pd = null; }`.
  `pd.requirePublishedCategory($app, categoryId)` returns `{ ok: true }` or
  `{ ok: false }`; `pd` also exposes `CEFR_ORDER`, `normalizeLevel`,
  `getPreferredLevel`, `resolveEpisodeArtwork` etc. — read
  `server/pb_hooks/podcast_domain.pb.js` before editing.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Fast gate | `pnpm verify:fast` | exit 0 |
| Lessons behavior | `pnpm smoke:lessons` | all pass (63 scenarios) |
| Progress behavior | `pnpm smoke:progress` | all pass (57 scenarios) |
| Episode behavior | `pnpm smoke:episode` | all pass (prev/next + detail scenarios) |
| Library regression | `pnpm smoke:library` | all pass |
| Browser regression (fast lane) | `pnpm test:e2e:fast e2e/p3-s1.spec.ts e2e/p3-s2.spec.ts e2e/podcast-episode.spec.ts e2e/podcast-home.spec.ts` | all pass |

## Scope

**In scope** (the only files you should modify):
- `server/pb_hooks/lesson_routes.pb.js`
- `server/pb_hooks/progress_routes.pb.js`

**Out of scope** (do NOT touch):
- `server/pb_hooks/library_routes.pb.js` — reference only; it is already correct.
- `server/pb_hooks/staff_routes.pb.js` and `content_admin_*.pb.js` — the
  staff/admin N+1s (operator queue per-row user lookups, admin episode list)
  are a separate finding; not this plan.
- The audio proxy full-file reads (`lesson_routes.pb.js:~1223-1340`) — a
  separate finding; not this plan.
- Rate-limit code (plan 001 territory) — if you touch a region where plan 001
  also lands, keep the changes disjoint (different functions).
- Any client code (`app/`), response field, ordering, or pagination behavior.

## Git workflow

- Branch: `advisor/002-read-path-batching` (repo convention: `topic-slug`).
- Commit per step, conventional style (e.g. `perf(server): batch topic/category lookups in lesson list`).
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Batch the lesson-list route

In `server/pb_hooks/lesson_routes.pb.js`, the `GET /api/fast-english/lessons`
handler (`:60`-`:330`):

1. Keep the existing lessons full scan (`:269-282`) unchanged.
2. After the scan, load all topics and all published categories ONCE:

```js
      var topics = [];
      try { topics = $app.findRecordsByFilter(TOPICS_C, "status = 'published'", "", 0, 0); } catch (_) {}
      var topicById = {};
      if (topics && topics.length > 0) {
        for (var ti2 = 0; ti2 < topics.length; ti2++) {
          var t2 = topics[ti2];
          if (!t2) continue;
          topicById[String(t2.id || "")] = t2;
        }
      }
      var cats = [];
      try { cats = $app.findRecordsByFilter("categories", "publication_status = 'published'", "", 0, 0); } catch (_) {}
      var catById = {};
      if (cats && cats.length > 0) {
        for (var ci2 = 0; ci2 < cats.length; ci2++) {
          var c2 = cats[ci2];
          if (!c2) continue;
          catById[String(c2.id || "")] = c2;
        }
      }
```

   Verify the `categories` collection name and the field name
   `publication_status` against `library_routes.pb.js:264-272` before using
   them (they are the same in this repo; if a live-file check disagrees,
   STOP and report).
3. Replace the per-lesson `$app.findRecordById(TOPICS_C, tId)` in the
   visibility loop (`:285-309`) with `topicById[tId]` and the per-lesson
   `pd.requirePublishedCategory($app, tRec.get("category"))` with a map
   lookup: topic published AND `catById[String(tRec.get("category") || "")]`
   exists (published). Semantics must stay identical: a lesson is visible
   only when its topic record exists with `status === "published"` AND its
   category exists in the published set.
4. Update `shapeLessonListItem(rec, pd)` so it no longer queries: change its
   signature to accept the maps (e.g. `shapeLessonListItem(rec, pd, topicById, catById)`)
   and replace its internal `findRecordById` calls with map lookups. Keep the
   exact output shape (all fields, including fallbacks like the deterministic
   branded SVG artwork fallback) — the smoke suite pins the shape.

**Verify**: `pnpm smoke:lessons` all green, then `pnpm smoke:episode`.

### Step 2: Batch the prev/next neighbor computation

In the lesson detail handler (`:533-620`), replace the per-sibling topic and
category lookups with the same two maps: after the sibling lessons scan, load
topics + published categories once (reuse the Step-1 snippet), then resolve
each sibling's topic/category from the maps. Preserve the deterministic
ordering (`sort_order` → `published_at` → `content_key`) and the rule that
only real published neighbors are returned.

**Verify**: `pnpm smoke:episode` (has prev/next scenarios) and
`pnpm smoke:lessons` green.

### Step 3: Batch progress summary and continue

In `server/pb_hooks/progress_routes.pb.js`:
- `GET /progress/summary` (`:728-762`): after the lessons scan, load the same
  two maps once; replace per-lesson `findRecordById` calls with map lookups.
  `totalListeningSeconds` and `completionPercent` must be byte-identical.
- `GET /progress/continue` (`:930-965`): same treatment; the deterministic
  Continue ordering must be preserved.

**Verify**: `pnpm smoke:progress` all green (its scenarios assert exact
counts/ordering), `pnpm smoke:library` green.

### Step 4: Browser regression

Run the affected browser specs (see Commands). These pin the user-visible
behavior: lesson list rendering, resume positions, episode detail with
prev/next, and Home composition.

**Verify**: `pnpm test:e2e:fast e2e/p3-s1.spec.ts e2e/p3-s2.spec.ts e2e/podcast-episode.spec.ts e2e/podcast-home.spec.ts` — all pass.

### Step 5 (optional, only if a baseline exists): perf sanity

If `.artifacts/perf/final-run1.json` exists, you may re-run
`bash scripts/measure-app-perf.sh` and compare the `home`/`library`/`episode`
LCP/TBT rows in your report. This is LABELED lab evidence — do not claim
field performance. If the harness errors, skip this step and say so; it is
not a gate.

## Test plan

- No new test files. The regression net is the existing suites, which assert
  exact response shapes and ordering:
  - `scripts/smoke-lessons.mjs` — list shape, visibility (draft/archived
    topics and categories hidden BEFORE pagination), totalItems, artwork
    fallback.
  - `scripts/smoke-progress.mjs` — summary counts, continue ordering,
    completion semantics.
  - `scripts/smoke-episode.mjs` — detail shape, prev/next refs, level
    switching.
  - `e2e/p3-s1.spec.ts`, `e2e/p3-s2.spec.ts`, `e2e/podcast-episode.spec.ts`,
    `e2e/podcast-home.spec.ts` — browser behavior.
- If you find a smoke scenario that does NOT assert the visibility-before-
  pagination rule (per-lesson category/topic hiding), add one assertion to
  `smoke-lessons` for it (e.g. one lesson whose topic is draft must not
  appear and must not consume a page slot). Only add; never weaken.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `pnpm verify:fast` exits 0
- [ ] `pnpm smoke:lessons`, `pnpm smoke:progress`, `pnpm smoke:episode`,
      `pnpm smoke:library` all exit 0
- [ ] `pnpm test:e2e:fast e2e/p3-s1.spec.ts e2e/p3-s2.spec.ts e2e/podcast-episode.spec.ts e2e/podcast-home.spec.ts` all pass
- [ ] `grep -n "findRecordById(TOPICS_C" server/pb_hooks/lesson_routes.pb.js`
      returns no matches inside the list/detail/prev-next handlers (audio and
      other handlers may keep theirs) — verify by reading the grep output
- [ ] `grep -n "findRecordById" server/pb_hooks/progress_routes.pb.js`
      shows no topic/category lookups inside the summary/continue handlers
- [ ] `git status` shows only in-scope files (plus `plans/README.md`)
- [ ] `plans/README.md` status row updated to DONE

## STOP conditions

Stop and report back (do not improvise) if:

- The live code at the cited locations differs materially from the excerpts
  (drift).
- A smoke suite fails twice after a reasonable fix attempt — do NOT "fix" it
  by changing response shapes, ordering, or totalItems semantics; the smoke
  contract is authoritative.
- You find that the visibility rule is more subtle than "topic published &&
  category published" (e.g. additional conditions in `pd.requirePublishedCategory`)
  — read `podcast_domain.pb.js` first; if semantics differ, report.
- `smoke-progress` ordering assertions fail because the continue ordering
  depended on the per-item query results (e.g. topic sort_order) — if the
  in-memory sort must change to preserve it, that is a behavior change;
  report the conflict instead of improvising.

## Maintenance notes

- When adding a new read route, copy the library route's bulk-map pattern,
  not the lesson route's per-item queries — the smoke suites do not catch
  performance regressions, only behavior.
- If pagination or filtering is later added to these endpoints, the maps
  must be built from the same pre-pagination filter to keep totalItems
  correct.
- Plan 001 touches `lesson_routes.pb.js` too (rate-limit closures). Keep the
  two branches' edits in separate commits; if both land in one session, run
  the union of both plans' verification suites.

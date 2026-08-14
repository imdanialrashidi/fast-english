# Plan 007: Batch per-row lookups in the staff queue and the admin episode list

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**:
> `git diff --stat f64288e..HEAD -- server/pb_hooks/staff_routes.pb.js server/pb_hooks/content_admin_core.pb.js server/pb_hooks/content_admin_routes.pb.js scripts/smoke-staff.mjs scripts/smoke-operator.mjs scripts/smoke-content-admin.mjs`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S-M
- **Risk**: MED
- **Depends on**: none
- **Category**: perf (staff surfaces)
- **Planned at**: commit `f64288e`, 2026-08-14

## Why this matters

The operator's two primary working surfaces pay per-row DB lookups:

1. **Operator queue** (`GET /api/fast-english/operator/payment-requests` in
   `server/pb_hooks/staff_routes.pb.js`): after loading ALL matching payment
   requests, it paginates in memory and then issues one
   `$app.findRecordById(USERS_COLLECTION, userId)` PER ROW to derive the
   student name + masked phone. With a growing request table (which keeps
   rejected/cancelled rows for audit), every queue page pays one query per
   row on top of the full scan.
2. **Admin episode list** (`GET /api/fast-english/staff/episodes` in
   `server/pb_hooks/content_admin_routes.pb.js`): for each topic row it
   calls `core.episodeListItem($app, rec)` which runs `loadLessons` — a
   FULL `lessons` collection scan filtered by topic — per topic. The list
   is O(topics × lessons) with a scan per row.

Staff-only blast radius, but these are the screens the operator stares at
all day; latency grows linearly with content/volume.

**Non-goal**: the full-collection scans themselves stay (the queue cannot
sort by `created` via SQL on `payment_requests` in PB 0.39 — documented
quirk — and the admin list filters client-side). Only the per-row lookups
become batch map lookups, following the repo's `library_routes.pb.js`
pattern.

## Current state

- **Queue** — `server/pb_hooks/staff_routes.pb.js`, shape-items loop (the
  page slice is `pageItems`; per-row lookup at `:157-168`):

```js
      // 8. Shape items
      var items = [];
      for (var ii = 0; ii < pageItems.length; ii++) {
        var rec = pageItems[ii];
        if (!rec) continue;
        var userId = String(rec.get("user") || "");
        var studentName = "";
        var maskedPhone = "";
        if (userId) {
          try {
            var userRec = $app.findRecordById(USERS_COLLECTION, userId);
            ...
```

- **Admin episode list** — `server/pb_hooks/content_admin_routes.pb.js`
  `GET /api/fast-english/staff/episodes` loops `hits` (topics) and calls
  `core.episodeListItem($app, rec)` per topic (`:398`); `episodeListItem`
  (`content_admin_core.pb.js:671-672`) calls `loadLessons(app, topicId)`
  (`:177-195`) which does `app.findRecordsByFilter("lessons", "topic = {:tid}", "", 0, 0, ...)`
  — a full scan per topic.

- **Repo conventions**: ES5 hooks, modules via
  `require(__hooks + '/x.pb.js')`, `core.rateLimit(...)` for admin routes,
  smokes are the behavior net. `USERS_COLLECTION` is `"fep_users"` (defined
  at the top of the queue handler). `fep_users` is small (students are a
  bounded set), so a single bulk fetch of the whole collection for the page
  is the cheapest correct fix — same approach `library_routes.pb.js` uses
  for topics/categories.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Staff smokes | `pnpm smoke:staff && pnpm smoke:operator` | all pass |
| Admin smoke | `pnpm smoke:content-admin` | all pass (28 scenarios) |
| Fast gate | `pnpm verify:fast` | exit 0 |
| Browser lane | `pnpm test:e2e:fast e2e/operator-redesign.spec.ts e2e/content-studio.spec.ts` | all pass |

## Scope

**In scope** (the only files you should modify):
- `server/pb_hooks/staff_routes.pb.js` (queue shape-items loop)
- `server/pb_hooks/content_admin_core.pb.js` (`episodeListItem`/`loadLessons`)
- `server/pb_hooks/content_admin_routes.pb.js` (episodes list call sites)

**Out of scope** (do NOT touch):
- The queue's full scan + in-memory sort + `slice(0, 5000)` cap (documented
  PB sort quirk; a real SQL-pagination plan is a separate finding).
- The admin detail/variant/vocabulary routes' single-record loads.
- `scripts/smoke-*.mjs` — no new scenarios needed (behavior is unchanged);
  only add assertions if a suite's existing shape assertions need the exact
  same fields (they don't).

## Git workflow

- Branch: `advisor/007-staff-batching` (repo convention: `topic-slug`).
- Commit per step, conventional style (`perf(server): batch queue student lookups`).
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Batch the queue's student lookups

In `server/pb_hooks/staff_routes.pb.js`, in the queue handler, BEFORE the
`// 8. Shape items` loop:

```js
      // Batch student lookups: one bulk fep_users fetch + byId map instead
      // of a findRecordById per row (library_routes pattern).
      var usersById = {};
      try {
        var allUsers = $app.findRecordsByFilter(USERS_COLLECTION, "", "", 0, 0);
        if (allUsers) {
          for (var ui = 0; ui < allUsers.length; ui++) {
            var uRec = allUsers[ui];
            if (!uRec) continue;
            usersById[String(uRec.id || "")] = uRec;
          }
        }
      } catch (_) {}
```

Then replace the per-row `var userRec = $app.findRecordById(USERS_COLLECTION, userId);`
with `var userRec = usersById[userId];`. Keep the fallback behavior
identical: if `userRec` is falsy, `studentName` stays `""` and
`maskedPhone` stays `""` (the current code's `catch (_) {}` already
tolerates missing users).

Verify the empty-string filter `""` is accepted by
`findRecordsByFilter` — check how other handlers fetch full collections
(`library_routes.pb.js` uses `"status = 'published'"`; the queue handler
itself fetches all payment requests with a `"1=1"`-style filter — match
the live file's convention; if `""` misbehaves in the pinned PB binary,
use `"id != ''"`). The smoke suites prove the resolution.

**Verify**: `pnpm smoke:staff && pnpm smoke:operator` all green (queue
shape: name, maskedPhone, pagination, search, filters unchanged).

### Step 2: Batch the admin episode list's lessons

In `server/pb_hooks/content_admin_core.pb.js`, add a bulk loader and make
`episodeListItem` accept an optional prebuilt map:

```js
  // Bulk variant loader for LIST endpoints: one lessons scan, indexed by
  // topic id (list shape). Detail endpoints keep loadLessons per topic.
  function loadAllLessonsByTopic(app) {
    var byTopic = {};
    var hits = [];
    try {
      hits = app.findRecordsByFilter("lessons", "", "", 0, 0);
    } catch (_) { hits = []; }
    if (hits && hits.length > 0) {
      for (var i = 0; i < hits.length; i++) {
        var rec = hits[i];
        if (!rec) continue;
        var tid = String(rec.get("topic") || "");
        if (!tid) continue;
        if (!byTopic[tid]) byTopic[tid] = {};
        var level = String(rec.get("level") || "");
        if (!byTopic[tid][level]) byTopic[tid][level] = rec;
      }
    }
    return byTopic;
  }
```

And in `episodeListItem(app, rec, lessonsByTopic)`, replace
`var lessons = loadLessons(app, String(rec.id || ""));` with
`var lessons = (lessonsByTopic && lessonsByTopic[String(rec.id || "")]) ? lessonsByTopic[String(rec.id || "")] : (lessonsByTopic ? {} : loadLessons(app, String(rec.id || "")));`
— i.e., when a map is provided use it (missing topic → empty object, same
as loadLessons returns for unknown topics); when absent, keep the existing
per-topic load for the detail routes. Export `loadAllLessonsByTopic` in the
module object.

In `server/pb_hooks/content_admin_routes.pb.js`, the episodes LIST route:
load `var lessonsByTopic = core.loadAllLessonsByTopic($app);` once after
the rate limit, and change the per-topic call to
`core.episodeListItem($app, rec, lessonsByTopic)`. The other call sites
(detail/variant routes) keep their single-record loads.

**Verify**: `pnpm smoke:content-admin` 28/28 (list shape: variantCounts,
levels, readiness, search, sort, filters identical).

### Step 3: Regression sweep

**Verify**: `pnpm verify:fast` exits 0; `pnpm test:e2e:fast e2e/operator-redesign.spec.ts e2e/content-studio.spec.ts` all pass (the browser surfaces that consume the queue + episode list).

## Test plan

- No new tests: behavior is byte-identical (same fields, same fallbacks),
  and the suites pin the shapes: `smoke-staff` (queue authz/sanitization),
  `smoke-operator` (queue pagination/search/filter/masking),
  `smoke-content-admin` (episode list/variantCounts/readiness), plus the
  operator/content-studio browser specs.
- If you find a smoke scenario asserting per-row name/phone resolution on a
  page with >1 row, it doubles as the batch regression net (the suites
  already do this — verify by reading).

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `grep -n "findRecordById(USERS_COLLECTION" server/pb_hooks/staff_routes.pb.js`
      returns no matches inside the queue shape-items loop (other handlers
      may keep theirs)
- [ ] The episodes list route passes a prebuilt `lessonsByTopic` map and
      `episodeListItem` uses it (grep the call site)
- [ ] `pnpm smoke:staff && pnpm smoke:operator && pnpm smoke:content-admin` all exit 0
- [ ] `pnpm verify:fast` exits 0
- [ ] `pnpm test:e2e:fast e2e/operator-redesign.spec.ts e2e/content-studio.spec.ts` all pass
- [ ] `git status` shows only in-scope files (plus `plans/README.md`)
- [ ] `plans/README.md` status row updated to DONE

## STOP conditions

Stop and report back (do not improvise) if:

- The queue handler's structure differs from the excerpt (drift).
- The empty-string filter in Step 1/2 misbehaves in the pinned PB binary
  (observe via a failing smoke; try `"id != ''"` once, then report if it
  still fails).
- A smoke assertion pins exact query counts or ordering that the batch
  changes (report the conflict; do not weaken the assertion).
- `episodeListItem` is called from other modules with a different shape
  (search all call sites first).

## Maintenance notes

- When the queue gains real SQL pagination (the deferred finding), the
  batch map must be built from the page's ids only — keep the map-building
  right above the shape loop so the change is local.
- `loadAllLessonsByTopic` and `loadLessons` now coexist: detail routes use
  the per-topic load, list routes the bulk map. A future "add a column to
  the item shape" change must touch both loaders.

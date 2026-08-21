# Plan 025: Push pagination & page-scoped users into staff queue and library (remove full-table loads)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 1062bb0..HEAD -- server/pb_hooks/staff_routes.pb.js server/pb_hooks/library_routes.pb.js server/pb_hooks/lesson_routes.pb.js server/pb_hooks/progress_routes.pb.js`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED (PB filter/sort quirks + sort-order contract)
- **Depends on**: 022 (rate-limit cap — separate file but same process heap concern; no code conflict, just ordering)
- **Category**: perf (read-path full scans)
- **Planned at**: commit `1062bb0`, 2026-08-21

## Why this matters

Two read paths load **100% of a table per request** and paginate in JS:

- **Staff queue** (`staff_routes.pb.js`): `allHits = findRecordsByFilter(COLLECTION, filterExpr, "", 0, 0)` (unbounded, capped only at 5000 after load) + `allUsers = findRecordsByFilter("fep_users","1=1","",0,0)` (every user) then `sort` + `slice`. At 20k users/requests this OOMs the PB process; a leaked staff token (60/5min) can drive repeated 5k+allUsers loads.
- **Library** (`library_routes.pb.js`): `categories/topics/lessons` each `findRecordsByFilter(..., "", 0, 0)` (every published row) then `visible` build + `sort` + `slice` — per plan claim "server-paginated" but pagination is in-memory. At 500 topics/2000 variants each page loads the whole catalog.

Plan 002 batched per-row `findRecordById` → bulk maps, and 007 batched queue `usersById`, but the full-scan + JS slice remains. Pushing `limit/offset` + filter into PB and scoping user fetches to page IDs removes the O(N) heap per request.

## Current state

- **Staff queue — full scan + full users + JS sort (`server/pb_hooks/staff_routes.pb.js:GET /api/fast-english/operator/payment-requests`):**
```js
var MAX_QUEUE_LOAD = 5000;
var allHits = [];
try {
  allHits = $app.findRecordsByFilter(COLLECTION, filterExpr, "", 0, 0, filterParams);
  if (allHits.length > MAX_QUEUE_LOAD) { allHits = allHits.slice(0, MAX_QUEUE_LOAD); }
} catch (qe) { allHits = []; }
allHits.sort(function (a,b){
  var aIsPending = String(a.get("status")||"")==="pending"?0:1;
  // pending: oldest-first (created asc), else: updated desc, tie-break id
});
var totalItems = allHits.length;
var totalPages = Math.max(1, Math.ceil(totalItems / perPage));
if (page > totalPages) page = totalPages;
var startIdx = (page - 1) * perPage;
var pageItems = allHits.slice(startIdx, startIdx + perPage);
var usersById = {};
try {
  var allUsers = $app.findRecordsByFilter(USERS_COLLECTION, "1=1", "", 0, 0);
  for (var ui=0; ui<allUsers.length; ui++) usersById[String(allUsers[ui].id||"")] = allUsers[ui];
} catch (_) {}
// shape pageItems via usersById
```
  Filter `filterExpr` is already pushed (status + `bank_reference ~ {:search} || id = {:searchId}`), but sort + pagination are not. Plan 007 fixed per-row N+1 inside `usersById` map but kept `1=1` full load.

- **Library — full catalog load then slice (`server/pb_hooks/library_routes.pb.js:250-320`):**
```js
categories = $app.findRecordsByFilter(CATS_C, "publication_status='published'", "", 0, 0);
topics = $app.findRecordsByFilter(TOPICS_C, "status='published'" + (q?" && (...)":""), "", 0, 0);
lessons = $app.findRecordsByFilter(LESSONS_C, "status='published'", "", 0, 0);
// build visible[] + sort + slice((page-1)*perPage, perPage)
progresses = $app.findRecordsByFilter(PROGRESS_C, "user={:uid}", "-last_played_at", 0, 0, {uid}); // single fetch (plan 012)
```
  Same pattern in `lesson_routes.pb.js` list/continue/summary (two bulk `topics`/`categories` loads per handler).

- **PB filter quirk:** `payment_requests` sort on DB with `created/updated` was historically reported as unavailable (hence JS sort + `-plan_name_snapshot` hack in payment current — plan 021). Verify whether `findRecordsByFilter` accepts `"-created"` / `"-updated"` on `payment_requests` in this build; if not, an alternative is needed (hybrid: fetch `page+1` window in JS with bounded limit).

- **Conventions:** Hook files ES5 only, inlined helpers, `biome.json` excludes `server/pb_hooks`. Smokes are authoritative: `scripts/smoke-staff.mjs` (queue pagination, search, detail masking), `scripts/smoke-library.mjs` (27 scenarios), `scripts/smoke-lessons.mjs`/`smoke-progress.mjs` for read-path batching.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Fast gate | `pnpm verify:fast` | exit 0 |
| Staff smoke | `bash scripts/smoke-staff.sh node scripts/smoke-staff.mjs` or `bash scripts/smoke-operator.sh node scripts/smoke-operator.mjs` (repo uses `smoke-operator` alias) | all pass — pagination, search, age, snapshot |
| Library smoke | `bash scripts/smoke-library.sh node scripts/smoke-library.mjs` | 27 scenarios pass (category/level/progress filters, sort, pagination) |
| Lessons/progress | `bash scripts/smoke-lessons.sh node scripts/smoke-lessons.mjs && bash scripts/smoke-progress.sh node scripts/smoke-progress.mjs` | all pass |
| Manual helper | `npx vitest run --passWithNoTests` | included in verify:fast |

## Scope

**In scope** (the only files you should modify):
- `server/pb_hooks/staff_routes.pb.js` — queue handler only (GET queue)
- `server/pb_hooks/library_routes.pb.js` — list handler only

**Out of scope** (do NOT touch, even though they look related):
- Detail/receipt/approve/reject handlers in `staff_routes.pb.js` — different routes.
- Audio proxy streaming (plan 032) — HIGH-risk, separate.
- `server/pb_hooks/progress_routes.pb.js` summary/continue bulk maps — already batched in plan 002; only touch if library proves generalizable (report first).
- PB schema migrations / indexes — do not add DB migrations here (out-of-scope for S/M plan); if DB sorting unavailable, use bounded hybrid (document).
- Any client (`app/**`, `admin/**`) changes.

## Git workflow

- Branch: `advisor/025-staff-queue-library-full-scan`
- Commit: `perf(queue,library): page-scoped queries, avoid full-table loads`
- Do NOT push unless instructed.

## Steps

### Step 1: Scope staff queue user fetch to page IDs and push pagination/sort toward PB

Edit `server/pb_hooks/staff_routes.pb.js` GET queue handler:

**1a. Scope `usersById` to page IDs only (required regardless of pagination strategy):**
Replace:
```js
var allUsers = $app.findRecordsByFilter(USERS_COLLECTION, "1=1", "", 0, 0);
```
With:
```js
// Page-scoped users: fetch only IDs for the current page (not all users).
var pageUserIds = [];
for (var pi2 = 0; pi2 < pageItems.length; pi2++) {
  var uid2 = String(pageItems[pi2].get("user")||"");
  if (uid2) pageUserIds.push(uid2);
}
var usersById = {};
if (pageUserIds.length > 0) {
  try {
    // PB 0.39: use filter with `id = {:id0} || id = {:id1} ...` if `id in` not supported.
    // Prefer `id ?= {:ids}` batch path if available — try `id = {:uid}` per id with small N (perPage ≤ 50)
    // and assemble map. Measure which PB build supports what; report non-support.
    var filterIds = pageUserIds.join("' || id='"); // build OR chain if needed
    // Attempt batch first via multiple filters if supported; fallback to per-id loop (N ≤ 50 is fine).
    var uHits = [];
    try {
      // Try IN-style if PB supports JSON array param (report if it actually works on this build)
      uHits = $app.findRecordsByFilter(USERS_COLLECTION, "id = {:uid0} || id = {:uid1} || id = {:uid2} || id = {:uid3} || id = {:uid4}", "", 0, 0, {uid0: pageUserIds[0] || "", uid1: pageUserIds[1] || "", /* ... */});
      // If not, loop per-id
    } catch (_) { uHits = []; }
    // Simpler correct fallback (keep for executor): loop per-id when batch uncertain
    if (!uHits || uHits.length === 0) {
      for (var ui2 = 0; ui2 < pageUserIds.length; ui2++) {
        try {
          var uRec = $app.findRecordById(USERS_COLLECTION, pageUserIds[ui2]);
          if (uRec) usersById[String(uRec.id||"")] = uRec;
        } catch (_) {}
      }
    } else {
      for (var uh = 0; uh < uHits.length; uh++) usersById[String(uHits[uh].id||"")] = uHits[uh];
    }
  } catch (_) {}
}
```
The exact PB `findRecordsByFilter` batch syntax varies by build — executor must probe. If batch `id in`/`id ?=` fails on this PB 0.39.9 build, the per-id loop with `perPage ≤ 50` is acceptable (≤50 indexed point lookups vs scanning 20k). Document which path you landed on.

**1b. Push queue sort/pagination toward PB (best-effort hybrid if needed):**
Attempt to use PB `limit/offset` + `sort` for the common case `filterExpr = "1=1"` or `status = {:status}` (indexed). Two pending-first semantics require two buckets:

- If `rawStatus === "all"` (mixed): pending-first, pending oldest-first, else updated-desc. PB cannot do this natively → keep hybrid: fetch at most `MAX_QUEUE_LOAD` but with `limit MAX_QUEUE_LOAD` and `sort ""` then JS sort only over that bounded set — but do NOT also fetch 20k users (1a already fixed). So even hybrid wins via 1a.
- If `rawStatus === "pending"` (pure): `findRecordsByFilter(COLLECTION, "status = 'pending'", "created", perPage, (page-1)*perPage, ...)` — DB sort + pagination. No JS sort.
- If `rawStatus !== "pending" && rawStatus !== "all"` (e.g. `rejected`): `findRecordsByFilter(COLLECTION, "status = {:status}", "-updated", perPage, offset, ...)`.

Implement the branched path above; preserve `totalItems` via a count query: run `findRecordsByFilter(COLLECTION, filterExpr, "", 0, 0, filterParams).length` only when you cannot get total from PB count API — note that this is still a full-scan for total; mitigate by caching total when `page*perPage < total` is not needed to be exact? Keep simple: keep existing `allHits.length` as `totalItems` for `rawStatus==="all"` hybrid; for filtered single-status, a count scan is cheaper (smaller set).

If PB rejects `sort` on `created/updated` for this collection (like payment current did), fall back to hybrid (bounded fetch + JS sort) and note in commit message — behavior stays correct, just less pushed.

**Verify**: `bash scripts/smoke-staff.sh node scripts/smoke-staff.mjs` (or `smoke-operator`) → pending-first still holds, pagination, search, totalItems/totalPages correct. Run queue with `?status=pending&page=2` and `?status=rejected` to exercise branched paths.

### Step 2: Move library pagination into PB (or bounded hybrid) and keep enrichment maps page-scoped

Edit `server/pb_hooks/library_routes.pb.js` list handler:

- Keep the `progresses` single fetch (plan 012) — unchanged.
- For `categories/topics/lessons`, attempt PB-native pagination:

Preferred (if PB supports filter on indexed fields with sort/limit):
```js
// Pseudocode — executor must verify PB 0.39.9 behavior on this build
var filteredCount = $app.findRecordsByFilter(TOPICS_C, topicFilter, "", 0, 0, filterParams).length; // or count API if exists
categories = $app.findRecordsByFilter(CATS_C, "publication_status='published'", "key", 0, 0);
topics = $app.findRecordsByFilter(TOPICS_C, topicFilter, "key", perPage, (page-1)*perPage, qParams);
lessons = $app.findRecordsByFilter(LESSONS_C, "status='published'", "", 0, 0); // still needed for enrichment? scope to page topics only
```

If PB cannot sort/filter with `limit/offset` reliably (known gap per audit), implement bounded hybrid: fetch at most `perPage * maxPages` (e.g. capped at 200) + JS filter/sort/slice, but **scope enrichment** (topic/category/artwork resolution) to the page slice only, not the full table. I.e. build `topicById`/`catById` via batch for page `visible` slice IDs only (similar to staff 1a), rather than `topicsAll` for 2000 rows.

Executor decision: probe with a 10-row build. If `findRecordsByFilter(TOPICS_C, "status='published'", "key", 5, 0)` returns 5, PB pagination works — use DB path. If it throws/returns 0 or ignores limit, use hybrid and document.

Preserve existing sort orders: library sorts by `key`/`published_at`/`sort_order` — keep them JS-sorted when using hybrid. Do not change client-visible sort.

**Verify**: `bash scripts/smoke-library.sh node scripts/smoke-library.mjs` → 27 scenarios green (filters, sorts, pagination, `totalItems`, continue rail capped 3). `bash scripts/smoke-lessons.sh`/`smoke-progress` unchanged.

### Step 3: Regression sweep

Run `pnpm verify:fast` plus the three smokes above. If library PB pagination changes `totalItems` semantics (e.g. count after vs before publication filter), adjust count fetch to be `filteredCount` before pagination (not page slice length).

**Verify**: `pnpm verify:fast` exit 0; staff + library smokes green.

## Test plan

- **Staff queue**: existing scenarios must still assert pending-first, oldest-first within pending, updated-desc for others, `totalItems/totalPages`, `perPage` cap 50, search by `bank_reference` + `id`. Add one assertion via existing suite or manual helper: `GET ?status=pending&page=2` returns distinct IDs from page 1 and same `totalItems`.
- **Library**: existing 27 scenarios cover `q` substring ≤60, `category/level/progress` filters, `sort` (`suggested|latest`), `perPage` clamp, `totalItems`, publication gating (draft never appears).
- **Regression**: lessons/progress smokes — valid lessons counts per level unchanged.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `grep -n "findRecordsByFilter(USERS_COLLECTION, \"1=1\"" server/pb_hooks/staff_routes.pb.js` returns no hit (full user scan removed)
- [ ] `grep -n "findRecordsByFilter(CATS_C.*0, 0)" server/pb_hooks/library_routes.pb.js` no longer has three unbounded `0,0` loads covering full tables without scoping (at least categories loop capped or page-scoped; document hybrid if PB sort unavailable)
- [ ] `bash scripts/smoke-staff.sh node scripts/smoke-staff.mjs` exits 0 and queue pagination/search still correct
- [ ] `bash scripts/smoke-library.sh node scripts/smoke-library.mjs` exits 0 (27 scenarios)
- [ ] `pnpm verify:fast` exits 0
- [ ] `git status` only touches files in Scope + `plans/README.md`

## STOP conditions

Stop and report back if:

- PB 0.39.9 build rejects `sort`/`limit`/`offset` on `payment_requests.topics/lessons` so DB pagination is impossible and hybrid would need >200 row window for correct `totalItems` — report hybrid window size decision.
- `findRecordsByFilter` with `id in {:ids}`/`OR` chain throws for >20 IDs — then fallback to per-id `findRecordById` loop is acceptable, but report which path you used.
- The existing library sort order is `-last_played_at` via progress table (not topics) — do not change that contract; report confusion.
- Any `status` filter change from executor breaks `ALLOWED_STATUS_FILTERS` validation (out of scope).

## Maintenance notes

- If `payment_requests` eventually gets a DB index on `(status, created)` / `(status, updated)`, re-evaluate pushing queue `all` bucket into two DB queries (pending oldest asc + non-pending updated desc) with JS merge of the two page slices.
- Staff queue `totalItems` via full count scan is still O(N) for `status=all`; acceptable for MVP (<5k rows). When rejected rows are retained forever, consider a capped total (e.g. `totalItems = min(count, 5000)` mirrors `MAX_QUEUE_LOAD`) and document in operator HelpRoute.
- Library `categories` is small (tens) — full load is fine; the win is stopping `topics/lessons` full loads per page.


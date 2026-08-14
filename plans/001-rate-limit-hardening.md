# Plan 001: Harden custom-route rate limiting (bounded windows, per-IP sample, payment GET limits)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**:
> `git diff --stat f64288e..HEAD -- server/pb_hooks/lesson_routes.pb.js server/pb_hooks/progress_routes.pb.js server/pb_hooks/library_routes.pb.js server/pb_hooks/placement_routes.pb.js server/pb_hooks/placement_level_routes.pb.js server/pb_hooks/payment_routes.pb.js server/pb_hooks/staff_routes.pb.js server/pb_hooks/content_import_routes.pb.js scripts/smoke-payment.mjs scripts/smoke-lessons.mjs`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none
- **Category**: security (defensive hardening)
- **Planned at**: commit `f64288e`, 2026-08-14

## Why this matters

Every custom route in `server/pb_hooks/*.pb.js` implements its own in-memory
sliding-window rate limiter. Three defects exist in this family:

1. **Unbounded per-user maps (memory leak).** ~20 limiter maps (`__fepLessonsList`,
   `__fepProgRead`, `__fepPlStart`, …) keyed by user id **never delete other
   users' keys** — each bucket is pruned only when that same user returns. The
   PB process is long-running (systemd, `ProtectSystem=strict`, restarts only
   on deploy), so memory grows O(distinct users ever seen). The bounded
   eviction pattern already exists in the same files (artwork/hero/vocab/pron
   routes, `lesson_routes.pb.js:1408-1430`); the older maps just don't use it.
2. **Public sample routes use one GLOBAL array** mislabeled "per-IP"
   (`__fepPublicSample`, `__fepSampleAudio`). Any anonymous caller firing ~30
   requests in 5 minutes exhausts the shared budget and **429s every visitor**
   to the landing sample — a self-inflicted global DoS.
3. **Payment GET routes have no rate limit at all.** `GET
   /payment-requests/current` and `GET /payment-requests/{id}/receipt` only
   run the `requireStudent` guard; each receipt request reads up to 5 MB from
   disk. An entitled account can amplify cheap requests into unbounded
   bandwidth/IO on the single PB process.

What improves when this lands: memory stays bounded on a process that never
restarts cleanly; the landing sample can no longer be taken down by one
caller; and receipt/current reads are throttled like every other route.

## Current state

- **The unbounded pattern** (per-user map, no eviction) — representative site
  `server/pb_hooks/lesson_routes.pb.js:60-77` (list route):

```js
  // Inline rate limit
  if (typeof globalThis.__fepLessonsList === "undefined") { globalThis.__fepLessonsList = {}; }
  var RATE_WIN = globalThis.__fepLessonsList;
  var RATE_MAX = 30;
  var RATE_MS = 300000;

  function checkRate(uid) {
    if (!uid) return null;
    var now = Date.now(); var ws = now - RATE_MS;
    var b = RATE_WIN[uid]; if (!b || !Array.isArray(b)) { b = []; RATE_WIN[uid] = b; }
    var keep = []; for (var wi = 0; wi < b.length; wi++) { if (b[wi] > ws) keep.push(b[wi]); }
    b.length = 0; for (var wj = 0; wj < keep.length; wj++) b.push(keep[wj]);
    if (b.length >= RATE_MAX) { var retry = Math.ceil((b[0] + RATE_MS - now) / 1000); if (retry < 1) retry = 1; return { status: 429, body: { code: "rate_limited", message: "Too many requests." } }; }
    b.push(now);
    return null;
  }
```

- **The bounded pattern to copy** (same file, artwork route, `:1404-1430`):

```js
  function checkRate() {
    var key = (pd && pd.clientIp) ? pd.clientIp(e) : "unknown";
    var now = Date.now(); var ws = now - RATE_MS;
    try {
      if (Object.keys(RATE_WIN).length >= 2048) {
        var keys = Object.keys(RATE_WIN);
        for (var ki = 0; ki < keys.length; ki++) {
          var w2 = RATE_WIN[keys[ki]];
          if (!w2 || !w2.length || w2[w2.length - 1] <= ws) delete RATE_WIN[keys[ki]];
        }
      }
    } catch (_) {}
    var win = RATE_WIN[key]; ...
```

- **The public-sample global array** (`lesson_routes.pb.js:699-710`):

```js
  // Rate limit (per-IP)
  if (typeof globalThis.__fepPublicSample === "undefined") { globalThis.__fepPublicSample = []; }
  var RATE_WIN = globalThis.__fepPublicSample;
  var RATE_MAX = 30;
  var RATE_MS = 300000;

  function checkRate() { /* operates on RATE_WIN.length — GLOBAL, not per-IP */ }
```

  Same for `__fepSampleAudio` at `:835`. The `clientIp` helper already exists:
  `pd.clientIp(e)` where `var pd = require(__hooks + '/podcast_domain.pb.js')`
  (see the artwork route `:1402-1406` for the require pattern).

- **The unthrottled payment GET routes**: `server/pb_hooks/payment_routes.pb.js`
  — `GET /api/fast-english/payment-requests/current` handler starts at `:679`
  (`$apis.requireAuth("fep_users")` at `:679`, `requireStudent` at `:700-701`),
  `GET /api/fast-english/payment-requests/{requestId}/receipt` at `:777`
  (`requireAuth` `:777`, `requireStudent` `:906-907`). The POST route's limiter
  (`__fepPostRateWindow`, `:104-140`) is the pattern to mirror. The receipt
  handler reads the file from disk via `$os.readFile` (around `:1015`).

- **Module pattern for shared hook code** (proven in this repo):
  `server/pb_hooks/guards.pb.js` ends with
  `if (typeof module !== 'undefined' && module.exports) { module.exports = __guardsModule; }`
  plus `globalThis.__fepGuards = __guardsModule;`, and handlers load it via
  `var g = require(__hooks + '/guards.pb.js')` inside the routerAdd closure.
  `server/pb_hooks/podcast_domain.pb.js` uses the identical pattern.

- **Repo conventions for hook files**: ES5-style JS (no arrow functions,
  no `let`/`const`, no template literals) — the PB 0.39 goja JSVM runs these;
  `var` + `function` only. Hook files are **excluded from Biome** (see
  `biome.json` `files.excludes`) — do not run `biome check --write` on them;
  match the existing 2-space indent and brace style by eye. Behavior parity is
  guarded by the real-PocketBase smoke suites, which are the authoritative
  verification for hook changes.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Fast gate | `pnpm verify:fast` | exit 0 (typecheck + biome + vitest incl. the new static test) |
| Payment smokes | `pnpm smoke:payment && pnpm smoke:payment-preview` | all scenarios pass (payment 61, preview 16) |
| Lessons/progress/library | `pnpm smoke:lessons && pnpm smoke:progress && pnpm smoke:library` | all pass |
| Placement smokes | `pnpm smoke:placement && pnpm smoke:placement-levels && pnpm smoke:placement-race && pnpm smoke:placement-capacity` | all pass |
| Episode/podcast-domain | `pnpm smoke:episode && pnpm smoke:podcast-domain` | all pass |
| Staff | `pnpm smoke:staff` | all pass |
| Static test alone | `npx vitest run tests/hook-rate-limit.test.mjs` | 1 test file passes |

## Scope

**In scope** (the only files you should modify):
- `server/pb_hooks/rate_limit.pb.js` (new shared module)
- `server/pb_hooks/lesson_routes.pb.js`
- `server/pb_hooks/progress_routes.pb.js`
- `server/pb_hooks/library_routes.pb.js`
- `server/pb_hooks/placement_routes.pb.js`
- `server/pb_hooks/placement_level_routes.pb.js`
- `server/pb_hooks/payment_routes.pb.js`
- `server/pb_hooks/staff_routes.pb.js`
- `server/pb_hooks/content_import_routes.pb.js`
- `tests/hook-rate-limit.test.mjs` (new static test; follow the pattern of
  `tests/launcher.test.mjs` — `node:test`, `node:assert/strict`, read files
  via `fs` relative to `import.meta.dirname`)

**Out of scope** (do NOT touch, even though they look related):
- `server/pb_hooks/content_admin_core.pb.js` — its `__fepAdminRate` map
  (around `:584-602`) already has the eviction branch; leave it alone.
- PB transport-level rate limits (migrations `1700000001` / `1700000005`) —
  they are correct as-is; no migration changes.
- The per-route RATE_MAX/RATE_MS values — preserve every existing
  max/window exactly (30/5min for lessons list, 120/5min library, 10/5min
  placement, etc.). Only the memory behavior and the sample-routes keying
  change.
- Entitlement-check refactoring, query batching, or any other cleanup in
  these files (other plans cover those).
- No client (`app/`, `admin/`, `landing/`) changes.

## Git workflow

- Branch: `advisor/001-rate-limit-hardening` (repo convention is
  `topic-slug` branches e.g. `perf-observability`, `fix/student-auth-persistence`).
- Commit per step; message style follows the repo's conventional commits
  (`fix(auth): ...`, `build(ci): ...`, e.g. `fix(server): bound per-user rate-limit windows`).
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Create the shared bounded rate-limit module

Create `server/pb_hooks/rate_limit.pb.js`:

```js
// server/pb_hooks/rate_limit.pb.js
// Shared sliding-window rate limiter for custom routes.
//
// Windows live on globalThis (survive across hook reloads/requires, like
// guards.pb.js / podcast_domain.pb.js). Maps are bounded: when a window
// map exceeds EVICT_AT keys, stale buckets (whose newest entry is already
// outside the window) are deleted, so memory stays O(active users) instead
// of O(distinct users ever seen).
//
// Usage inside a routerAdd closure:
//   var rl = require(__hooks + '/rate_limit.pb.js');
//   var err = rl.checkRate(rl.window("__fepMyRoute"), uid, 30, 300000);
//   if (err) return e.json(err.status, err.body);

if (typeof globalThis.__fepRateLimit === "undefined") {
  var EVICT_AT = 2048;

  function window(name) {
    if (typeof globalThis[name] === "undefined") { globalThis[name] = {}; }
    return globalThis[name];
  }

  function checkRate(win, key, max, ms) {
    if (!win || !key) return null;
    var now = Date.now(); var ws = now - ms;
    try {
      if (Object.keys(win).length >= EVICT_AT) {
        var keys = Object.keys(win);
        for (var ki = 0; ki < keys.length; ki++) {
          var w2 = win[keys[ki]];
          if (!w2 || !w2.length || w2[w2.length - 1] <= ws) delete win[keys[ki]];
        }
      }
    } catch (_) {}
    var b = win[key]; if (!b || !Array.isArray(b)) { b = []; win[key] = b; }
    var keep = []; for (var wi = 0; wi < b.length; wi++) { if (b[wi] > ws) keep.push(b[wi]); }
    b.length = 0; for (var wj = 0; wj < keep.length; wj++) b.push(keep[wj]);
    if (b.length >= max) { var retry = Math.ceil((b[0] + ms - now) / 1000); if (retry < 1) retry = 1; return { status: 429, body: { code: "rate_limited", message: "Too many requests." } }; }
    b.push(now);
    return null;
  }

  var __fepRateLimitModule = { window: window, checkRate: checkRate, EVICT_AT: EVICT_AT };
} else {
  var __fepRateLimitModule = globalThis.__fepRateLimit;
}
if (typeof module !== 'undefined' && module.exports) { module.exports = __fepRateLimitModule; }
globalThis.__fepRateLimit = __fepRateLimitModule;
```

Note: the `window`-name globalThis install must be idempotent — the module may
be loaded repeatedly (`require` caching is not guaranteed in this JSVM); the
`globalThis.__fepRateLimit` guard above makes the factory state survive
reloads.

**Verify**: `node -e "require('node:vm'); "` is not applicable (goja syntax is
plain ES5 — verify by reading). Run `pnpm smoke:auth` — it must stay green
(proves hook files still load without syntax errors at PB startup).

### Step 2: Convert the unbounded per-user maps to the shared limiter

In each of these files, replace the inlined limiter with the shared one. Two inlined shapes exist:

- **Shape A — `function checkRate(uid)` closure** (most routes): replace the whole `if (typeof globalThis.__fepX === "undefined") { ... } var RATE_WIN = ...; function checkRate(uid) {...}` block with the snippet below, and replace the existing `var rateErr = checkRate(...)` call site with the same call against the shared module.
- **Shape B — inline bucket** (`__fepPostRateWindow` in payment_routes, `__fepImportPlanRate`/`__fepImportExecRate` in content_import_routes): there is no `checkRate` function; the window init + prune + 429 check are inlined at the call site (payment POST: `:308-337`, constants `RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000` and `RATE_LIMIT_MAX = 5` at `:97-98`; import plan/execute: `:50-59` and `:324-333`, inline `30` / `300000` with the 429 return at `:59`/`:333`). Replace the init + prune + limit-check lines with one `rl.checkRate(rl.window("__fepPostRateWindow"), userIdKey, 5, 600000)` call (payment) or `rl.checkRate(rl.window("__fepImportPlanRate"), staffId, 30, 300000)` (imports), preserving the existing 429 body/Retry-After behavior (the shared limiter returns the same `rate_limited` body; the payment POST handler additionally sets a `Retry-After` header — if you want to keep that header, set it right after the shared call returns an error, before `return e.json(...)`).

The shared-call snippet for both shapes:

```js
  var rl = require(__hooks + '/rate_limit.pb.js');
  ...
  var rateErr = rl.checkRate(rl.window("__fepLessonsList"), uid, 30, 300000);
  if (rateErr) return e.json(rateErr.status, rateErr.body);
```

placed at the same point where `checkRate(...)` was originally invoked. Keep
the original RATE_MAX/RATE_MS numbers per route (read them from the existing
block before deleting it). The `uid` used today is the argument already passed
to the old `checkRate(uid)` — use the identical expression (usually
`String(e.auth.id || "")`, sometimes a composite like `uid + ":" + lessonId`
for per-lesson windows — preserve composites exactly).

Exact sites (map name, file, current line, max/ms — verify against the live
file before editing):

| Map | File | Max/ms |
|---|---|---|
| `__fepLessonsList` | lesson_routes.pb.js ~62 | 30 / 300000 |
| `__fepLessonsDetail` | lesson_routes.pb.js ~341 | 30 / 300000 |
| `__fepPremiumAudio` | lesson_routes.pb.js ~1069 | 30 / 300000 |
| `__fepLibraryList` | library_routes.pb.js ~60 | 120 / 300000 |
| `__fepPostRateWindow` | payment_routes.pb.js ~104 (inline bucket, Shape B; constants `:97-98`) | 5 / 600000 |
| `__fepPlStart` | placement_routes.pb.js ~39 | 10 / 300000 |
| `__fepPlAnswer` | placement_routes.pb.js ~305 | 60 / 300000 |
| `__fepPlSubmit` | placement_routes.pb.js ~511 | 5 / 300000 |
| `__fepLevelCtx` | placement_level_routes.pb.js ~53 | 30 / 300000 |
| `__fepSelLevel` | placement_level_routes.pb.js ~278 | 5 / 300000 |
| `__fepDash` | placement_level_routes.pb.js ~473 | 30 / 300000 |
| `__fepProgRead` | progress_routes.pb.js ~43 | 30 / 300000 |
| `__fepProgWrite` | progress_routes.pb.js ~258 | 60 / 300000 |
| `__fepProgSummary` | progress_routes.pb.js ~652 | 30 / 300000 |
| `__fepProgCont` | progress_routes.pb.js ~852 | 30 / 300000 |
| `__fepApproveLimit` | staff_routes.pb.js ~446 | 10 / 600000 |
| `__fepRejectLimit` | staff_routes.pb.js ~644 | 10 / 600000 |
| `__fepImportPlanRate` | content_import_routes.pb.js ~50 (inline bucket, Shape B) | 30 / 300000 |
| `__fepImportExecRate` | content_import_routes.pb.js ~324 (inline bucket, Shape B) | 30 / 300000 |

Behavior must be byte-identical for all normal paths: same 429 body
(`{ code: "rate_limited", message: "Too many requests." }`), same Retry-After
math, same window semantics. The ONLY behavioral difference: stale buckets of
other users may be evicted once a map exceeds 2048 keys.

Do NOT convert the four already-bounded artwork/hero/vocab/pron maps
(`lesson_routes.pb.js:1408/1486/1577/1773`) — they are already correct; you
may convert them too if you prefer uniformity, but it is not required.

**Verify**: `pnpm smoke:payment` (its scenario 23 fires 6 rapid attempts and
asserts a real 429 — proves the POST limiter still works), then
`pnpm smoke:lessons && pnpm smoke:progress && pnpm smoke:library && pnpm smoke:placement && pnpm smoke:placement-levels && pnpm smoke:placement-race && pnpm smoke:staff` — all green.

### Step 3: Make the public sample routes per-IP with bounded windows

In `server/pb_hooks/lesson_routes.pb.js`, the `GET /api/fast-english/public/sample`
handler (map `__fepPublicSample`, ~:699) and `GET /api/fast-english/public/sample/audio`
(map `__fepSampleAudio`, ~:835) currently declare a global ARRAY and a
`checkRate()` with no key. Replace with the shared limiter keyed by client IP:

```js
  var pd = null;
  try { pd = require(__hooks + '/podcast_domain.pb.js'); } catch (_) { pd = null; }
  var rl = require(__hooks + '/rate_limit.pb.js');
  ...
  var key = (pd && pd.clientIp) ? pd.clientIp(e) : "unknown";
  var rateErr = rl.checkRate(rl.window("__fepPublicSample"), key, 30, 300000);
  if (rateErr) return e.json(rateErr.status, rateErr.body);
```

Delete the old array-initialization and `function checkRate()` from both
handlers. Keep each route's own budget: sample route 30/300000,
sample-audio route 60/300000 (read the live `RATE_MAX`/`RATE_MS` before
deleting).

**Verify**: `pnpm smoke:lessons` (its public-sample scenarios fire several
requests and assert 200) and `pnpm smoke:podcast-domain` stay green.

### Step 4: Add per-user limits to the payment GET routes

In `server/pb_hooks/payment_routes.pb.js`:
- `GET /api/fast-english/payment-requests/current` (handler at ~:679): after
  the `requireStudent` guard (which returns early on error), add
  `var rl = require(__hooks + '/rate_limit.pb.js');` (top of handler) and a
  30/300000 per-user check keyed on `String(e.auth.id || "")`, returning the
  `rateErr` json as the other routes do.
- `GET /api/fast-english/payment-requests/{requestId}/receipt` (handler at
  ~:777): same addition after its `requireStudent` guard (~:906-907).

The receipt route streams up to 5 MB; keep its limit at 30/300000 (same as the
audio proxy) so normal review sessions are unaffected.

**Verify**: `pnpm smoke:payment && pnpm smoke:payment-preview` — both green
(preview suite fetches receipts repeatedly; if any scenario exceeds 30 within
5 min for one student, raise the preview-suite check — do NOT lower the
limit; first re-read the scenario count per student).

### Step 5: Add the static invariant test

Create `tests/hook-rate-limit.test.mjs` (node:test style, mirroring
`tests/launcher.test.mjs`). It must:

1. Read every `server/pb_hooks/*.pb.js` file.
2. Count occurrences of `var RATE_WIN = globalThis.__fep` and of
   `Object.keys(RATE_WIN).length >= 2048` per file; assert they are EQUAL in
   every file EXCEPT `content_admin_core.pb.js` (whose map uses a different
   variable name `all`) — for that file, assert the `>= 2048` eviction branch
   exists at least once.
3. Assert no file contains `globalThis.__fepPublicSample = []` or
   `globalThis.__fepSampleAudio = []` (array initialization gone) and that
   each of these two names is declared via `rl.window("__fepPublicSample")`
   / `rl.window("__fepSampleAudio")` (string search).
4. Assert every converted site passes a window name that starts with `__fep`
   (grep for `rl.window("` occurrences — sanity that no raw non-prefixed name
   slipped in).

Keep the test readable and strictly structural (string/regex counting), like
the existing `shared/theme-settings.test.ts`-style scans. Do not make it
parse JS.

**Verify**: `npx vitest run tests/hook-rate-limit.test.mjs` → passes, and
`pnpm verify:fast` → exit 0.

### Step 6: Regression check on the throttle behavior

Add NO new smoke scenarios in this plan (the 429 behavior is already proven by
`smoke-payment` scenario 23). Instead, run the affected suites listed below
and confirm the numbers in your final report.

## Test plan

- New static test `tests/hook-rate-limit.test.mjs` (Step 5) — structural
  invariants: every per-user map has the eviction branch; public-sample maps
  are per-IP objects; window names are `__fep`-prefixed.
- Existing behavior tests that must stay green (the real regression net):
  `smoke-payment` (429 scenario), `smoke-payment-preview`, `smoke-lessons`,
  `smoke-progress`, `smoke-library`, `smoke-placement`,
  `smoke-placement-levels`, `smoke-placement-race`, `smoke-placement-capacity`,
  `smoke-staff`, `smoke-episode`, `smoke-podcast-domain`, `smoke-content-import`.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `pnpm verify:fast` exits 0 (includes the new `tests/hook-rate-limit.test.mjs`)
- [ ] `pnpm smoke:payment`, `pnpm smoke:payment-preview`, `pnpm smoke:lessons`,
      `pnpm smoke:progress`, `pnpm smoke:library`, `pnpm smoke:placement`,
      `pnpm smoke:placement-levels`, `pnpm smoke:placement-race`,
      `pnpm smoke:placement-capacity`, `pnpm smoke:staff`, `pnpm smoke:episode`,
      `pnpm smoke:podcast-domain` all exit 0
- [ ] `grep -rn "var RATE_WIN = globalThis.__fep" server/pb_hooks/` — the only
      remaining hits are the four already-bounded artwork-family maps and
      `content_admin_core.pb.js` (verify by running the new test)
- [ ] No occurrences of `globalThis.__fepPublicSample = []` /
      `globalThis.__fepSampleAudio = []` remain
- [ ] `git status` shows only files listed in Scope (plus `plans/README.md`)
- [ ] `plans/README.md` status row updated to DONE

## STOP conditions

Stop and report back (do not improvise) if:

- The code at the "Current state" locations doesn't match the excerpts
  (the codebase has drifted since this plan was written).
- A smoke suite fails twice after a reasonable fix attempt — especially
  `smoke-payment` scenario 23 (429) or any 429-related scenario; a changed
  rate window (not just eviction) is a behavior change outside this plan's
  scope.
- You discover a per-route RATE_MAX/RATE_MS value that the table above
  guessed wrong and the live file's value is materially different (e.g. not
  in the 5–120 / 300000–600000 range) — report instead of guessing.
- Converting a map to the shared limiter requires changing the call site
  semantics (e.g. a composite key that the old code derived lazily).
- You find yourself needing to touch an out-of-scope file.

## Maintenance notes

- When a NEW custom route is added, use `rl.window(...)`/`rl.checkRate(...)`
  from `rate_limit.pb.js` — do not inline a new unbounded map. The static
  test will NOT catch a brand-new inlined map that also copies the eviction
  branch (counts stay equal), so review should still look for inlined
  limiters.
- `smoke-payment-preview` per-student request counts are the constraint on
  the receipt route's RATE_MAX; if that suite grows scenarios for one
  student, re-check the budget.
- The per-IP key uses `pd.clientIp(e)` — the same helper the artwork routes
  use; if the proxy topology ever changes (Caddy → other), re-verify what
  `clientIp` sees (X-Forwarded-For trust).
- Follow-up (out of scope): SEC-03's staff-route GETs
  (`staff_routes.pb.js` queue/detail/receipt) still have no limits; consider
  a later plan using the same module.

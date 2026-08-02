# 003 — Renewal entitlement selection ("any currently valid subscription")

- **Written against:** commit `4b7caba` (branch `main`, clean tree)
- **Status:** DRAFT
- **Effort:** M · **Fix risk:** Medium · **Finding:** #3 (MAJOR — users can lose access after renewal; rejection can mis-classify accounts)

## Why this matters

Renewals are modeled as **multiple subscription rows** — the migration comment
is explicit (`server/pb_migrations/1700000006_create_subscriptions.js:9-11`):
"A 'renewal' is represented as a later Subscription whose starts_at begins at
the max of approval time and the latest unexpired Subscription's expires_at."
So a user who renews while still active ends up with **two** rows with
`status='active'`: the old one (currently valid) and the new one (starts in the
future).

Every protected route currently does `findFirstRecordByFilter(SUBS, "user=...
&& status='active'", ...)` and validates **only that one row**. If the DB
returns the expired or not-yet-started row first, the user is denied premium
content even though another row grants them access right now. `operator
reject` has the same flaw in reverse: it may downgrade a user to
`payment_rejected` while a valid subscription exists. Operator detail's
"current active subscription" display is likewise arbitrary. This is a
correctness + entitlement bug on the money path; it must be fixed server-side,
not papered over in the UI.

## Current state (evidence)

The flawed pattern appears in these files (all inside `routerAdd` closures —
**PocketBase 0.39 JSVM cannot see top-level declarations, so the fix must stay
inline in each closure**; the files document this constraint in their headers):

- `server/pb_hooks/placement_routes.pb.js`: lines 54–67 (`attempts/start`), 302–312 (`answer`), 499–509 (`submit`)
- `server/pb_hooks/placement_level_routes.pb.js`: lines 100–115 (`level-context`), 329–344 (`selected-level`), 501–517 (`dashboard`)
- `server/pb_hooks/lesson_routes.pb.js`: lines 142–160 (list), 314–332 (detail), 867–886 (premium audio)
- `server/pb_hooks/progress_routes.pb.js`: lines 87–105 (GET progress), 368–386 (PUT progress), 666–684 (summary), 849–867 (continue)
- `server/pb_hooks/operator_routes.pb.js`: lines 715–733 (reject: `findFirstRecordByFilter(... "user = {:uid} && status = 'active'", "", 1, 0, ...)` then checks only `activeSubs[0]`); lines 246–273 (detail: loops rows but only for display — see step 4 below)

Representative snippet (`lesson_routes.pb.js:145-156`):
```js
var sub = $app.findFirstRecordByFilter(SUBS_C, "user = {:uid} && status = 'active'", { uid: uid });
if (sub) {
  var expStr = String(sub.get("expires_at") || "");
  var startStr = String(sub.get("starts_at") || "");
  if (expStr && startStr) {
    var expMs = new Date(expStr).getTime();
    var startMs = new Date(startStr).getTime();
    if (!isNaN(expMs) && !isNaN(startMs) && startMs <= nowMs && expMs > nowMs) { hasSub = true; }
  }
}
```
`findFirstRecordByFilter` with no sort returns an arbitrary row; nothing scans for a **valid** row among several.

Renewal creation (`operator_routes.pb.js:533-546`) keeps `status='active'` on both old and new rows (the old row is never flipped), and `docs/PRODUCT.md:51` ("Renewal: new subscription starts at approval; renewal starts from later of current expiry and approval time") confirms overlapping active rows are expected.

## Scope

**In scope (server hooks only):**

- `server/pb_hooks/placement_routes.pb.js`
- `server/pb_hooks/placement_level_routes.pb.js`
- `server/pb_hooks/lesson_routes.pb.js`
- `server/pb_hooks/progress_routes.pb.js`
- `server/pb_hooks/operator_routes.pb.js` (reject check + detail display selection)
- Backend smoke suites: `scripts/smoke-lessons.mjs`, `scripts/smoke-progress.mjs`, `scripts/smoke-placement-levels.mjs`, `scripts/smoke-operator.mjs`

**Out of scope:**

- Schema/migration changes (`subscriptions` collection stays as-is)
- Automatically flipping old rows to `status='expired'` (out-of-band state change; not needed for correctness)
- Renewal arithmetic (starts_at/expires_at computation in approve) — keep as-is
- Any client/UI change
- Introducing a shared/helper module (JSVM constraint prohibits it)

## Design

**Rule:** a user is entitled if ANY `subscriptions` row satisfies
`status = 'active' && starts_at <= now && expires_at > now`.

Implementation shape (must be repeated inline in each closure, matching the
existing style — the hooks already inline ~10 copies of similar logic; keep
the same pattern and wording so future diffs stay greppable):

```js
// Replace the single-row check with a scan (inline in the closure):
var hasValidSub = false;
try {
  var subs = $app.findRecordsByFilter(SUBS_C, "user = {:uid} && status = 'active'", "", 0, 0, { uid: uid });
  for (var si = 0; si < subs.length; si++) {
    var s = subs[si];
    var expStr = String(s.get("expires_at") || "");
    var startStr = String(s.get("starts_at") || "");
    if (!expStr || !startStr) continue;
    var expMs = new Date(expStr).getTime();
    var startMs = new Date(startStr).getTime();
    if (!isNaN(expMs) && !isNaN(startMs) && startMs <= nowMs && expMs > nowMs) { hasValidSub = true; break; }
  }
} catch (_) {}
```
Use the existing per-route variable names (`hasSub`, `hasValid`) to keep the
diff minimal. Keep the surrounding gates (role, account_status, suspended,
placement) byte-for-byte unchanged.

## Steps (ordered)

1. **Placement routes** (`placement_routes.pb.js`): replace the single-row subscription check in `checkEligibility` (3 copies: start/answer/submit) with the scan above. Response codes and messages stay identical (`placement_subscription_required` 403).
2. **Level routes** (`placement_level_routes.pb.js`): same replacement in `level-context`, `selected-level`, and `dashboard`. For the dashboard, also keep the displayed subscription summary consistent: when a valid row exists, show the valid row with the greatest `expires_at` (not the arbitrary first row). If only future rows exist, keep current behavior (403 + `subscription_required`) and do not display a future row as current.
3. **Lesson routes** (`lesson_routes.pb.js`): same replacement in list, detail, and premium audio. Codes/messages unchanged.
4. **Progress routes** (`progress_routes.pb.js`): same replacement in GET, PUT (inside the transaction, using `txApp`), summary, and continue.
5. **Operator reject** (`operator_routes.pb.js:715-733`): replace the `findFirstRecordByFilter(..., "", 1, 0, ...)` + `activeSubs[0]` check with the scan; set `account_status = 'payment_rejected'` **only if no valid row exists**.
6. **Operator detail** (`operator_routes.pb.js:246-273`): select `currentActiveSubscription` as the valid row with the greatest `expires_at` (it already loops; make the selection deterministic by tracking max expiry, not first match).
7. Run the smoke suites (below); add the renewal-overlap scenarios described in the test plan.

## Test plan

Extend the existing smoke suites (no new harness). The suites already create
fully-entitled students and mutate subscriptions directly via the superuser
(`scripts/smoke-lessons.mjs:396-425` shows the `expireUserSubscription` /
`futureUserSubscription` helper pattern to copy).

**New scenarios (choose the suite where the endpoint lives):**

1. **Renewal overlap — access maintained:** for one student create (via the real approve flow) a second subscription whose `starts_at` is in the future while the first is still valid; assert ALL protected endpoints return 200 (placement start, level-context, dashboard, lessons list/detail/audio, progress read/write/summary/continue). This is the core regression: it fails today whenever the DB returns the old row first.
2. **Transition:** expire the old row; the future row is now valid; assert access is still granted (200).
3. **All expired:** expire every row; assert 403 on the same endpoints.
4. **Only future:** only a future row exists; assert 403 (existing behavior preserved).
5. **Reject with valid subscription:** student has one valid subscription and a second pending request; reject the second; assert the student remains `account_status='active'` (today this can wrongly flip to `payment_rejected`).
6. **Reject without valid subscription:** no valid row; reject; assert `payment_rejected` (existing scenario 44 in `smoke-operator.mjs` must stay green).
7. **Renewal arithmetic unchanged:** scenario 36/37 in `smoke-operator.mjs` (renewal during active period starts at current expiry; after expiration starts at approval) must still pass unchanged.

Run, in order:

```bash
bash scripts/smoke-placement.sh node scripts/smoke-lessons.mjs
bash scripts/smoke-placement.sh node scripts/smoke-progress.mjs
bash scripts/smoke-placement.sh node scripts/smoke-placement-levels.mjs
PB_SMOKE_PAY_PORT=18092 bash scripts/smoke-payment.sh node scripts/smoke-operator.mjs
pnpm typecheck
pnpm check
pnpm test
bash scripts/verify.sh
```

## Verification gates (machine-checkable)

- All smoke suites print their final `All checks passed.` (lessons/progress) or `smoke-operator: OK` line.
- `bash scripts/verify.sh` ends with `All project verification checks passed.`
- New scenarios 1 and 2 fail on the pre-change code (prove the regression by running them once before the fix, or reason from the arbitrary-first-row behavior and record the observation in the PR description).

## Maintenance note

- The invariant is now: **entitlement = scan, not first row**. Any new protected endpoint must copy the scan pattern; grep for `findFirstRecordByFilter(SUBS_C` after this change — only approve's idempotency lookups (`payment_request = {:rid}`) and the pre-approval check should remain `findFirst`.
- The JSVM constraint means this logic is duplicated per closure; that is the repo's accepted pattern (documented in each hook header). Do not attempt to extract a shared function.
- Watch in review: a future "optimization" that flips old rows to `expired` server-side must be a deliberate, reviewed change — it is NOT required by this plan and would change history/audit semantics.

## Escape hatches

- If direct superuser fixture mutation cannot reliably create the two-row overlap state (e.g. PB validation rejects `starts_at` in the future on PATCH), STOP and adapt the fixture (create the second row through the real approve flow, then PATCH only its dates). Do not relax production validation to make the test pass.
- If a smoke suite fails in a way unrelated to this change (pre-existing), report it separately; do not fix unrelated code in this plan.

## Done criteria

- [x] All protected routes scan `status='active'` rows and grant when ANY row covers `now`
- [x] Reject sets `payment_rejected` only when no valid row exists
- [x] Operator detail shows the deterministic max-expiry valid row
- [x] New overlap/transition scenarios added and green; arithmetic scenarios unchanged
- [x] `scripts/verify.sh` green end-to-end

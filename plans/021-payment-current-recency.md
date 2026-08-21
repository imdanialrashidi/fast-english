# Plan 021: Fix payment `current` to return most-recently-updated request per priority

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 1062bb0..HEAD -- server/pb_hooks/payment_routes.pb.js server/pb_migrations/1700000004_create_payment_requests.js app/src/features/payment/api.ts scripts/smoke-payment.mjs`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug (correctness, payment UX contract)
- **Planned at**: commit `1062bb0`, 2026-08-21

## Why this matters

`GET /api/fast-english/payment-requests/current` is the Student's single source for "what is my payment state". The product contract requires selection order `pending > most-recently-updated rejected > approved > cancelled > none`. The implementation sorts by `-plan_name_snapshot` (lexicographic plan name, descending) so a student with two rejected requests (e.g. monthly then quarterly) sees the alphabetically-last plan, not the newest. This yields wrong amount/age, wrong resubmit gating, and support confusion. Fixing it is a small in-memory sort with no schema change.

## Current state

- **Relevant files:**
  - `server/pb_hooks/payment_routes.pb.js` — defines `GET /api/fast-english/payment-requests/current` handler (priority loop over `CURRENT_PRIORITY = ["pending","rejected","approved","cancelled"]`).
  - `server/pb_migrations/1700000004_create_payment_requests.js` — creates `payment_requests` with partial unique index `idx_payment_requests_one_pending_per_user` on `user WHERE status='pending'` (only pending is indexed, rejected/approved/cancelled rely on sort).
  - `app/src/features/payment/api.ts` — `loadCurrentRequest()` parses `{kind:"none"|"request", request:...}`; display does not assume order beyond server.
  - `scripts/smoke-payment.mjs` — 23-scenario suite (covers 409 pending, invalid receipt, etc.) but has no two-rejected recency assertion.

- **Excerpt — current buggy sort (`server/pb_hooks/payment_routes.pb.js` GET current, ~inside priority loop):**
```js
var hits = $app.findRecordsByFilter(
  REQUESTS_COLLECTION,
  "user = {:uid} && status = {:st}",
  "-plan_name_snapshot",
  1,
  0,
  { uid: userId, st: status }
);
rec = hits && hits.length > 0 ? hits[0] : null;
```
  Comment above it: `PB 0.39.9's filter resolver does not expose the system "created"/"updated" columns for sort in this collection.` The comment is stale — `updated` is readable via `rec.get("updated")` (the `shapeRequestForClient` already does it).

- **Excerpt — shape (`server/pb_hooks/payment_routes.pb.js`):**
```js
function shapeRequestForClient(rec) {
  return {
    id: String(rec.id),
    status: String(rec.get("status") || ""),
    planId: String(rec.get("plan") || ""),
    planName: String(rec.get("plan_name_snapshot") || ""),
    amountToman: Number(rec.get("amount_snapshot") || 0),
    durationDays: Number(rec.get("duration_days_snapshot") || 0),
    created: rec.get("created") || null,
    updated: rec.get("updated") || null,
  };
}
```

- **Conventions to follow:**
  - Hook files are ES5 `var`/`function` only, inlined helpers per closure (goja JSVM recompiles handler scope — cannot see top-level vars). Match existing 2-space indent, `try { } catch (_) {}` patterns.
  - `biome.json` excludes `server/pb_hooks/**` — do not run `biome check --write` on hook files.
  - Smoke suites are authoritative verification for hook changes (`scripts/smoke-payment.sh` disposable PB).

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Fast gate | `pnpm verify:fast` | exit 0 |
| Payment smokes | `bash scripts/smoke-payment.sh node scripts/smoke-payment.mjs` | 23 existing + 1 new scenario pass |
| Payment preview | `bash scripts/smoke-payment.sh node scripts/smoke-payment-preview.mjs` | all pass (unchanged) |
| Typecheck | `pnpm typecheck` | exit 0 |

## Scope

**In scope** (the only files you should modify):
- `server/pb_hooks/payment_routes.pb.js`
- `scripts/smoke-payment.mjs` (add one scenario)
- `app/src/features/payment/api.ts` (only if parsing needs adjustment — expected none; if touched, keep it minimal)

**Out of scope** (do NOT touch, even though they look related):
- `server/pb_migrations/1700000004_create_payment_requests.js` — no migration needed; index unchanged.
- `server/pb_hooks/staff_routes.pb.js` / `lesson_routes.pb.js` — different routes.
- `server/pb_hooks/rate_limit.pb.js` — different concern (plan 022).
- Any client resubmit UI — the server ordering is the fix; client already handles `kind` correctly.

## Git workflow

- Branch: `advisor/021-payment-current-recency` (or reuse current task branch if operator instructs).
- Commit: `fix(payment): return most-recently-updated current request per priority`
- Do NOT push or open a PR unless instructed.

## Steps

### Step 1: Fix the sort — fetch then JS-sort by `updated`/`created`

In `server/pb_hooks/payment_routes.pb.js` GET current handler, replace the `findRecordsByFilter(..., "-plan_name_snapshot", 1, 0, ...)` call with a bounded fetch + JS sort:

1. For each `status` in `CURRENT_PRIORITY`, fetch up to a bounded N (e.g. `20` or `50` — not `0` unbounded; 1 is insufficient because stale ordering would still win). Use `""` (no DB sort) or any stable sort that PB accepts.
   ```js
   var hits = $app.findRecordsByFilter(
     REQUESTS_COLLECTION,
     "user = {:uid} && status = {:st}",
     "",
     20,
     0,
     { uid: userId, st: status }
   );
   ```
2. JS-sort hits descending by `updated` then `created` (ISO strings → `new Date(...).getTime()`), tie-break by `id` lexical. Take `hits[0]` after sort as `rec`.
3. Keep the outer priority loop (`pending` first, then `rejected`, etc.) — the sort is per-status, not across statuses. `pending` still wins over any `rejected` even if rejected is newer (per contract: `pending > rejected > approved > cancelled`).
4. Remove/replace the stale comment about `plan_name_snapshot` sort.

Preserve the per-route rate-limit call (`rl.checkRate(rl.window("__fepPaymentCurrent"), ...)`) unchanged.

**Verify**: `bash scripts/smoke-payment.sh node scripts/smoke-payment.mjs` still exits 0 for existing 23 scenarios (no regression).

### Step 2: Add a two-rejected recency smoke scenario

In `scripts/smoke-payment.mjs`, add a new scenario after the existing `pending_request_exists` / resubmit block:

- Steps: create student A, submit rejected request R1 (via helper that creates a payment request then mark rejected via direct DB or via staff reject flow — use the cheapest existing pattern: create `payment_requests` with `status='rejected'` via superuser if the suite already does direct setup, or drive `POST /api/fast-english/payment-requests` then `POST /api/fast-english/operator/payment-requests/{id}/reject` using a bootstrapped `staff_admins` record). Then create a second rejected request R2 with same user (ensure `pending` is cleared between them). Call `GET /api/fast-english/payment-requests/current` as that student and assert `request.id === R2.id` (most recent `updated`). Also assert `request.planName` equals R2's plan name, not R1's.

If the suite does not yet bootstrap `staff_admins`, use the existing `scripts/pb-test-helper.sh` superuser + direct record update to set `status='rejected'` and bump `updated` via an update call (PB sets `updated` automatically on save — do two saves with a small delay or explicit `updated` overwrite if PB permits; otherwise create R2 after R1 so its `created/updated` is later).

Keep the scenario deterministic (no sleeps > 1s; use sequential creation order — later `updated` is guarantee if created later).

**Verify**: `bash scripts/smoke-payment.sh node scripts/smoke-payment.mjs` → the new scenario passes; rerun `pnpm verify:fast` → exit 0.

### Step 3: Confirm client parsing still correct

Open `app/src/features/payment/api.ts` `loadCurrentRequest`. Confirm it does not assume `plan_name_snapshot` ordering. No change should be needed; if a comment mentions `plan_name_snapshot` as sort key, correct it.

**Verify**: `pnpm typecheck` and `pnpm verify:fast` exit 0.

## Test plan

- **New smoke scenario** (in `scripts/smoke-payment.mjs`): `two rejected requests → current is most recent rejected` (assert id equality, planName, status=rejected, 200 kind=request).
- **Regression**: existing 23 scenarios + `smoke-payment-preview` suite (no behavioral change for pending/none cases).
- **Manual spot-check** (optional, no new E2E): if you can, drive via `curl` against disposable PB to confirm pending still outranks newer rejected.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `grep -rn "plan_name_snapshot" server/pb_hooks/payment_routes.pb.js` shows no hit inside the GET current handler (the `-plan_name_snapshot` sort string is gone)
- [ ] `bash scripts/smoke-payment.sh node scripts/smoke-payment.mjs` exits 0 and output mentions the new recency scenario as passing
- [ ] `bash scripts/smoke-payment.sh node scripts/smoke-payment-preview.mjs` exits 0
- [ ] `pnpm typecheck` exits 0 and `pnpm verify:fast` exits 0
- [ ] `git status` shows only files in Scope (plus `plans/README.md`)
- [ ] `plans/README.md` row for this plan updated to DONE

## STOP conditions

Stop and report back (do not improvise) if:

- The GET current handler excerpt does not match the snippet above (drift).
- `findRecordsByFilter` with `updated` sort actually works on this PB 0.39.9 build (if it does, you may switch to `"-updated"` DB sort instead of JS sort — report which you chose).
- PB does not update `updated` on status change (then recency must use `created`; report).
- The smoke helper cannot create a second `rejected` without a pending block — report instead of weakening the pending constraint.
- You need to touch a migration or any out-of-scope file.

## Maintenance notes

- Future changes to `CURRENT_PRIORITY` (e.g. adding a new status) must be reflected in both the handler array and the smoke recency test.
- The pending uniqueness is DB-enforced (`idx_payment_requests_one_pending_per_user`); the `current` read is non-transactional and intentionally best-effort. A tiny race between concurrent approve/reject and a `current` read is acceptable.
- Reviewers: verify the per-status fetch limit (20) is sufficient given expected rejected history (audit suggests <10 per user lifetime; 20 is safe, 50 is also fine but keep it bounded).


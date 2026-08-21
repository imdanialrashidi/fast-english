# Plan 022: Cap rate-limit maps when all keys are active (prevent OOM)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 1062bb0..HEAD -- server/pb_hooks/rate_limit.pb.js server/pb_hooks/payment_routes.pb.js server/pb_hooks/placement_routes.pb.js server/pb_hooks/staff_routes.pb.js server/pb_hooks/lesson_routes.pb.js`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: security (DoS, resource exhaustion)
- **Planned at**: commit `1062bb0`, 2026-08-21

## Why this matters

`server/pb_hooks/rate_limit.pb.js` is the shared sliding-window limiter for every custom route (~15–20 windows on `globalThis.__fep*`). Plan 001 introduced bounded eviction (`EVICT_AT=2048`) but the eviction only deletes **stale** buckets (newest timestamp `<= windowStart`). If an attacker cycles 2048 distinct user IDs or IPs within one window (5–10 min) each bucket stays "active", eviction deletes zero, then the next request unconditionally adds a 2049th key. Repeated cycling grows heap without bound and OOMs the long-lived PB process — a DoS without auth bypass. Fix is a hard cap with LRU/random eviction per window.

## Current state

- **File:** `server/pb_hooks/rate_limit.pb.js` (current at `1062bb0` — wired via plan 001):
```js
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
    if (b.length >= max) { /* 429 */ }
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
- **Call sites:** `server/pb_hooks/payment_routes.pb.js` (`__fepPostRateWindow`, `__fepPaymentCurrent`, `__fepPaymentReceipt`), `placement_routes.pb.js`, `staff_routes.pb.js`, `lesson_routes.pb.js`, etc. — all via `rl.window(name)` + `rl.checkRate(win, key, max, ms)`.
- **Windows:** ~20 maps (`__fepLessonsList`, `__fepPaymentCurrent`, `__fepPaymentReceipt`, `__fepOperatorQueue`, `__fepApproveLimit`, etc.) each on `globalThis.__fep*`. Each map is an object `key -> timestamp[]`.
- **Existing test:** `tests/hook-rate-limit.test.mjs` (plan 001) asserts eviction branch exists and `globalThis` prefix, but does not assert active-key cap beyond 2048.

- **Conventions:** Hook files ES5 only, `var`/`function`, `require(__hooks + '/rate_limit.pb.js')` inside closures. `biome.json` excludes `server/pb_hooks`. Rate limits are defensive — must not change `max`/`ms` budgets.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Fast gate | `pnpm verify:fast` | exit 0 (includes `tests/hook-rate-limit.test.mjs`) |
| Unit standalone | `npx vitest run tests/hook-rate-limit.test.mjs` | 1 file pass |
| Payment smokes | `bash scripts/smoke-payment.sh node scripts/smoke-payment.mjs` | all pass (429 scenario still green) |
| Placement | `bash scripts/smoke-placement.sh node scripts/smoke-placement.mjs` | pass |
| Staff | `bash scripts/smoke-staff.mjs` variant or `pnpm smoke:staff` if exists | pass |

## Scope

**In scope** (the only files you should modify):
- `server/pb_hooks/rate_limit.pb.js`
- `tests/hook-rate-limit.test.mjs` (extend)

**Out of scope** (do NOT touch, even though they look related):
- Any per-route `max`/`ms` values, `window` names, or call sites — budgets stay identical.
- `server/pb_migrations/*` — no migration.
- Entitlement logic, payment routes, etc.

## Git workflow

- Branch: `advisor/022-rate-limit-active-key-cap`
- Commit: `fix(rate-limit): cap active keys beyond EVICT_AT`
- Do NOT push unless instructed.

## Steps

### Step 1: Harden `checkRate` to enforce a hard cap when eviction deletes nothing

Edit `server/pb_hooks/rate_limit.pb.js` `checkRate` so that after the stale-bucket sweep, if `Object.keys(win).length >= EVICT_AT` still holds (all keys active), evict **one** oldest key before inserting the new one. Deterministic oldest-by-newest-timestamp is preferred (lowest `w[w.length-1]`). Keep it ES5.

Skeleton (inside the existing `try { if (Object.keys(win).length >= EVICT_AT) { ... } } catch (_){}` block, after the stale loop):

```js
if (Object.keys(win).length >= EVICT_AT) {
  // Hard cap: evict the oldest active bucket deterministically.
  var oldestKey = null;
  var oldestTs = Infinity;
  var allKeys = Object.keys(win);
  for (var k2 = 0; k2 < allKeys.length; k2++) {
    var w3 = win[allKeys[k2]];
    var last = (w3 && w3.length) ? w3[w3.length - 1] : 0;
    if (last < oldestTs) { oldestTs = last; oldestKey = allKeys[k2]; }
  }
  if (oldestKey !== null) { try { delete win[oldestKey]; } catch (_) {} }
}
```

Place this **after** the stale-delete loop but **still inside** the `if (Object.keys(win).length >= EVICT_AT)` guard. Ensure the `try/catch` wrapping is preserved. Do not change `EVICT_AT` value.

Alternative allowed: if you prefer, do a single random eviction (`var r = keys[Math.floor(Math.random()*keys.length)]`) — either is acceptable; oldest is more deterministic for tests. Document which you chose in the commit message.

**Verify**: `npx vitest run tests/hook-rate-limit.test.mjs` still passes (eviction branch still counted). `bash scripts/smoke-payment.sh node scripts/smoke-payment.mjs` still green (single user still 429s correctly).

### Step 2: Extend the static test to prove the cap

Extend `tests/hook-rate-limit.test.mjs` with a behavioral unit test for the module (not just structural string counts). The module is Node-requireable (`if (typeof module !== 'undefined')` branch) — so you can `require` it in `node:test`.

Add a test case (using `node:test` + `node:assert/strict`, like `tests/hook-rate-limit.test.mjs` already does):

```js
test('rate-limit active-key cap stays at EVICT_AT under distinct-key cycling', () => {
  const rl = require('../../server/pb_hooks/rate_limit.pb.js');
  const win = {}; // isolated window, not globalThis
  const max = 1000; const ms = 60 * 1000;
  for (let i = 0; i < 3000; i++) {
    rl.checkRate(win, 'k' + i, max, ms);
  }
  assert.ok(Object.keys(win).length <= rl.EVICT_AT, `expected <= ${rl.EVICT_AT}, got ${Object.keys(win).length}`);
});
```

Also add a second assertion that after filling 2048 active keys all within window, a new distinct key does **not** push count to 2049 (it stays 2048, oldest evicted). Keep the window isolated (not `globalThis`) so the test is side-effect free.

If the test file today only does string-count checks, add `node:test` behavioral tests after the structural ones — keep both.

**Verify**: `npx vitest run tests/hook-rate-limit.test.mjs` → all tests pass. `pnpm verify:fast` → exit 0.

### Step 3: Run the limited smoke regression

Run the cheapest smoke that hits the limiter per-user path: `bash scripts/smoke-payment.sh node scripts/smoke-payment.mjs` (its scenario 23 fires 6 rapid POSTs for one user and asserts 429). This proves per-user budget still enforced after cap change. Do not add new smoke scenarios here.

**Verify**: payment smoke passes; `pnpm verify:fast` passes.

## Test plan

- **New behavioral unit test** in `tests/hook-rate-limit.test.mjs`: 3000 distinct keys → cap at `EVICT_AT` (2048). Oldest eviction deterministic.
- **Existing structural test**: still green (eviction branch counts, `__fep*` prefix).
- **Regression smokes**: payment (429) + placement + staff (no 429 regressions).

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `grep -n "EVICT_AT" server/pb_hooks/rate_limit.pb.js` shows `EVICT_AT = 2048` and a second guard `if (Object.keys(win).length >= EVICT_AT)` that contains the hard-cap eviction (oldest or random)
- [ ] `npx vitest run tests/hook-rate-limit.test.mjs` exits 0 and reports the new cap test as passing
- [ ] `pnpm verify:fast` exits 0
- [ ] `bash scripts/smoke-payment.sh node scripts/smoke-payment.mjs` exits 0
- [ ] `git status` only touches files in Scope (plus `plans/README.md`)
- [ ] `plans/README.md` row updated to DONE

## STOP conditions

Stop and report back if:

- The excerpts in "Current state" do not match live code (drift since `1062bb0`).
- `server/pb_hooks/rate_limit.pb.js` no longer exists as a shared module (plan 001 not landed) — report instead of re-creating divergent logic.
- The behavioral test cannot `require` the hook module in Node (goja globals like `$app` leak) — report; do not add `$app` stubs.
- Fixing requires touching per-route `max`/`ms` or adding a new dependency.

## Maintenance notes

- New routes must continue to use `rl.window("__fep*")` + `rl.checkRate`. The static test now pins both the eviction branch and the active-key cap.
- The cap is per-window, not global — each `__fep*` window is independently 2048. With ~20 windows worst-case is ~40k keys, acceptable for PB's heap. If windows grow to >50, revisit a global budget.
- Watch for: attacker rotating keys across many windows (cost multiplied) — still bounded per-window, still O(active) not O(history).


# Plan 011: Reuse the middleware entitlement decision on Today

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**:
> `git status --short -- app/Http/Middleware/RequireSubscription.php app/Http/Controllers/TodayController.php app/Support/DailyPlan.php tests/Feature/P004QueryBudgetsTest.php`
> and `git diff -- app/Http/Controllers/TodayController.php app/Support/DailyPlan.php`.
> The working tree contains uncommitted public-SEO work; read live files and
> never revert or stash them. If an excerpt below does not match, STOP.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: perf
- **Planned at**: commit `dcc3f6c` plus the uncommitted public-SEO working tree, 2026-11-14
- **Issue**: omit

## Why this matters

The paid-only gate `subscribed` resolves eligibility once per request in
`RequireSubscription`, and then `TodayController` asks `DailyPlan::build()` to
resolve it **again**. `Entitlement::eligible()` is deliberately fresh: it calls
`$user->fresh()` (one query) and then lazily loads `subscription` (a second
query). Today therefore pays four entitlement queries instead of two, and its
pinned query budget is 15. The middleware already knows the answer for this
exact request and user; passing that boolean to the planner removes two queries
without caching eligibility across requests. The security semantics stay
identical: the middleware still computes fresh eligibility on every request,
the planner uses only the value that gate just computed, and money paths keep
using `windowActive()` unchanged.

## Current state

- `app/Http/Middleware/RequireSubscription.php:26-35`:

```php
public function handle(Request $request, Closure $next): Response
{
    if (Entitlement::eligible($request->user())) {
        return $next($request);
    }

    if ($request->expectsJson()) {
        return response()->json([
            'message' => 'اشتراک فعالی وجود ندارد.',
        ], 403, NoStore::headers());
    }

    return LockedResponse::forbidden($request, $request->user());
}
```

- `app/Http/Controllers/TodayController.php:29-31`:

```php
$plan = DailyPlan::build($user);
$recommendations = DailyPlan::recommendations($user, 3, $plan['eligible'] ?? null);
```

- `app/Support/DailyPlan.php:35-45`:

```php
public static function build(User $user): array
{
    $goal = in_array((int) $user->daily_goal_minutes, self::GOALS, true)
        ? (int) $user->daily_goal_minutes
        : 10;

    $eligible = Entitlement::eligible($user);
    $today = now()->startOfDay();
```

- `app/Support/Entitlement.php:72-88` is the fresh path: `eligible()` checks
  null/disabled/staff, then `$user->fresh()` (query 1) and `active()` reads
  `$user->subscription` (query 2). This plan does **not** change `eligible()`,
  `active()`, or `windowActive()`.
- Budget test: `tests/Feature/P004QueryBudgetsTest.php` pins Today at 15
  (`toHaveCount(15)` at line 108) with the comment at lines 100–107 explaining
  “the fresh user + subscription lookup is paid once per request”. After this
  plan the middleware still pays it once; the planner pays zero, so the count
  is 13. Reader (8) and Words (8) are unchanged.
- Route wiring: `/app/today` uses `['auth', 'reject.disabled', 'subscribed']`
  (`routes/web.php:198-200`), so `RequireSubscription` always runs before
  `TodayController`.

## Commands you will need

Host PHP is absent. The verified Docker lane (2026-11-14) with the project
image and `fe_test`:

```bash
DB_USER=$(docker exec fast-english-new-app-1 printenv DB_USERNAME)
DB_PASS=$(docker exec fast-english-new-app-1 printenv DB_PASSWORD)
docker run --rm --network fast-english-new_default \
  -v "$PWD":/repo -w /repo --user "$(id -u):$(id -g)" \
  -e APP_ENV=testing -e DB_CONNECTION=pgsql -e DB_HOST=db -e DB_PORT=5432 \
  -e DB_DATABASE=fe_test -e DB_USERNAME="$DB_USER" -e DB_PASSWORD="$DB_PASS" \
  --entrypoint php fast-english-new-app -d memory_limit=1G \
  vendor/bin/pest tests/Feature/P004QueryBudgetsTest.php tests/Feature/S6EntitlementTest.php \
  tests/Feature/D5EntitlementGateTest.php tests/Feature/S6SubscriptionTablesTest.php
```

| Purpose | Command | Expected on success |
|---|---|---|
| Focused budget + access tests | Pest lane above | all pass |
| Full PHP regression (optional) | same lane, `vendor/bin/pest` | all pass |
| Typecheck | `npm run typecheck` | exit 0 (no TS change expected) |

If the lane is unavailable, report `BLOCKED`, not pass. Never substitute SQLite.

## Scope

**In scope**:
- `app/Http/Middleware/RequireSubscription.php`
- `app/Http/Controllers/TodayController.php`
- `app/Support/DailyPlan.php`
- `tests/Feature/P004QueryBudgetsTest.php`

**Out of scope**:
- `app/Support/Entitlement.php` — do not add a static/request cache, do not
  remove `fresh()`, and do not touch `windowActive()` (money paths).
- `app/Policies/LessonPolicy.php` and `TopicReaderController` — the reader path
  may resolve eligibility twice for a public sample, but it is not the Today
  path; leave it for a separate decision.
- `app/Http/Middleware/HandleInertiaRequests.php` `due_words` — its count is a
  separate one-query concern; do not couple it to the planner.
- Any change to subscription/payment semantics or locked-page copy.

## Git workflow

No branch, no commit, no push, no PR. Leave the change in the working tree and
preserve the existing uncommitted SEO work.

## Steps

### Step 1: Name the request attribute and set it in the middleware

In `RequireSubscription`, add one public constant and set the attribute for
both the allowed and refused paths:

```php
public const ELIGIBLE_ATTRIBUTE = 'fe.subscription_eligible';

public function handle(Request $request, Closure $next): Response
{
    $eligible = Entitlement::eligible($request->user());
    $request->attributes->set(self::ELIGIBLE_ATTRIBUTE, $eligible);

    if ($eligible) {
        return $next($request);
    }

    // existing JSON / LockedResponse branches unchanged
}
```

Do not set the attribute before `eligible()` runs; the value must be the fresh
result. Do not return a cached value from a previous request; the request
object is new per request.

**Verify**:
`grep -n "ELIGIBLE_ATTRIBUTE" app/Http/Middleware/RequireSubscription.php`
prints the constant and the `set()` call.

### Step 2: Let the planner accept the gate’s decision

Change `DailyPlan::build()`’s signature and first lookup:

```php
public static function build(User $user, ?bool $eligible = null): array
{
    $goal = in_array((int) $user->daily_goal_minutes, self::GOALS, true)
        ? (int) $user->daily_goal_minutes
        : 10;

    // The subscribed gate already resolved this for the current request;
    // callers outside that gate (tests, future commands) pass null and keep
    // the original fresh lookup.
    $eligible ??= Entitlement::eligible($user);

    $today = now()->startOfDay();
```

Now Today must pass the middleware result:

```php
use App\Http\Middleware\RequireSubscription;

$eligible = $request->attributes->get(RequireSubscription::ELIGIBLE_ATTRIBUTE);

$plan = DailyPlan::build($user, is_bool($eligible) ? $eligible : null);
$recommendations = DailyPlan::recommendations($user, 3, $plan['eligible'] ?? null);
```

`is_bool()` matters: `$request->attributes->get(...)` returns `null` when the
controller is invoked without the gate (for example a direct controller test),
and `null` must fall back to the fresh lookup. `false` must **not** fall back.

**Verify**:
`grep -n "build(User \$user" app/Support/DailyPlan.php` shows the nullable
second parameter; `grep -n "RequireSubscription::ELIGIBLE_ATTRIBUTE" app/Http/Controllers/TodayController.php`
prints one line.

### Step 3: Update the pinned Today budget

In `tests/Feature/P004QueryBudgetsTest.php`:

- change `->and($small)->toHaveCount(15);` (line 108) to `toHaveCount(13);`
- update the comment at lines 100–107 to say: the subscribed gate pays the
  fresh user + subscription lookup once; the planner reuses the request
  attribute, so the duplicate pair is gone.
- leave the Reader (`8`) and Words (`8`) assertions untouched.

**Verify**: Pest lane → `P004QueryBudgetsTest` passes with 13; if it reports a
different number, STOP and report the exact count rather than adjusting the
assertion to fit.

### Step 4: Re-run the access regressions

Run the four focused tests listed in “Commands you will need”. They cover:
no subscription/pending/expired/revoked/suspended access, staff bypass, direct
`Entitlement::eligible()` freshness after a grant, and the subscription tables.
No behavior change is expected; any failure is a regression.

**Verify**: all four test classes pass.

## Test plan

- Updated: `tests/Feature/P004QueryBudgetsTest.php` Today count 15 → 13.
- Existing regression tests that must stay green:
  - `S6EntitlementTest` — no subscription / pending / expired / revoked /
    suspended / staff isolation over HTTP.
  - `D5EntitlementGateTest` — window predicate and the direct
    `eligible()`-after-grant freshness test. This plan does not touch
    `eligible()`, so the direct calls still re-query.
  - `S6SubscriptionTablesTest` — subscription/event integrity.
  - `P004QueryBudgetsTest` — Today constant as words/completions grow.
- No new test is required: the budget test is the regression, and the access
  tests prove semantics.

## Done criteria

- [ ] `RequireSubscription` sets `ELIGIBLE_ATTRIBUTE` on the request.
- [ ] `TodayController` passes the attribute to `DailyPlan::build()`; a
  non-boolean value falls back to `null`.
- [ ] `DailyPlan::build()` accepts `?bool $eligible = null` and uses `??=`.
- [ ] `P004QueryBudgetsTest` passes with Today = 13, Reader = 8, Words = 8.
- [ ] The four access test classes pass.
- [ ] `git status --short` lists only scope files.
- [ ] `plans/README.md` row 011 is updated truthfully.

## STOP conditions

Stop and report if:

- Today’s budget after the change is not 13 (the entitlement cost may differ
  from the two-query assumption; report the measured count and the SQL).
- `RequireSubscription` is not on the `/app/today` route anymore, or another
  middleware produces the page before it.
- A test calls `TodayController` directly without a request attribute and
  expects the old double lookup; do not add a static cache to satisfy it.
- A direct `Entitlement::eligible()` freshness test fails; that means the change
  accidentally memoized across requests — revert the memo, not the test.
- A step’s verification fails twice after a reasonable fix attempt.

## Maintenance notes

- The attribute is an internal request contract between one middleware and one
  controller. If another controller starts consuming it, promote it to a small
  value object or a documented request key; do not duplicate the string.
- Do not extend this pattern to `windowActive()` or to approval/revocation
  actions: money paths must keep the locked predicate.
- If Today later moves off the `subscribed` gate, `DailyPlan::build()` falls
  back to fresh eligibility by design (null).
- Reviewer should confirm the planner still returns the correct `eligible`
  value to `recommendations()` and that a locked user never reaches the
  controller.

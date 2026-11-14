# Plan 009: Read the settings table once per request

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**:
> `git status --short -- app/Models/Setting.php tests/Feature/S8SeoTest.php`
> and `git diff -- app/Models/Setting.php`.
> The working tree contains uncommitted public-SEO work; read live files and
> never revert or stash them. If an excerpt below does not match, STOP.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: perf
- **Planned at**: commit `dcc3f6c` plus the uncommitted public-SEO working tree, 2026-11-14
- **Issue**: omit

## Why this matters

Every public trust page reads the same few `settings` keys through separate
queries. On 2026-11-14 the working tree issued **15 queries on `/faq`**, of which
**13 were the same `select "value" from "settings" where "key" = ?`** with
different bindings; `/about` and `/support` issued 14 (13 settings), the
landing 9 (5 settings), and `/login`/`/register` 5 (4 settings). A single
settings lookup measured **0.213 ms** on the local PostgreSQL connection, so the
duplicate work is about **2.6 ms of the 5.8 ms `/faq` server render** — roughly
half of that page's PHP time. The class comment says reads are uncached on
purpose so staff changes land on the next request; this plan preserves that
contract by caching **only within one HTTP request**, not across requests. The
result is one `select * from settings` per request instead of 4–13 point reads.

## Current state

- `app/Models/Setting.php` is the single accessor. Its docblock says:

```php
/**
 * ...
 * Reads are uncached on purpose: staff changes must take effect on the
 * next request, and the volume is one small row per key.
 */
class Setting extends Model
{
    public static function read(string $key, ?string $default = null): ?string
    {
        $value = static::query()->where('key', $key)->value('value');

        return $value === null ? $default : (string) $value;
    }

    public static function put(string $key, ?string $value): void
    {
        static::query()->updateOrCreate(
            ['key' => $key],
            ['value' => $value === null || $value === '' ? null : $value],
        );
    }
}
```

- `app/Support/SiteSettings.php:29-77` calls `Setting::read` for five keys and
  `supportContacts()` composes four of them. `app/Http/Middleware/HandleInertiaRequests.php`
  shares `support` on many routes; `TrustController` reads the same keys again;
  `PublicSeo::organization()` reads the support email on the landing. That is
  the 13-query duplication.
- Staff writes go through `Setting::put` — `app/Filament/Pages/BusinessSettings.php:126-133`
  calls it eight times in one Livewire save. Tests use `Setting::put` in
  `tests/Feature/SettingsCatalogTest.php` and then read the value in the same
  process, so `put` must update or invalidate the request cache.
- Repo convention: `app/Support` modules own reads; tests are Pest feature tests
  and use `DB::enableQueryLog()`/`DB::getQueryLog()` for query budgets (see
  `tests/Feature/P004QueryBudgetsTest.php`).

## Commands you will need

Host PHP is absent. Use the verified Docker lane (2026-11-14) with the running
project image and `fe_test`:

```bash
DB_USER=$(docker exec fast-english-new-app-1 printenv DB_USERNAME)
DB_PASS=$(docker exec fast-english-new-app-1 printenv DB_PASSWORD)
docker run --rm --network fast-english-new_default \
  -v "$PWD":/repo -w /repo --user "$(id -u):$(id -g)" \
  -e APP_ENV=testing -e DB_CONNECTION=pgsql -e DB_HOST=db -e DB_PORT=5432 \
  -e DB_DATABASE=fe_test -e DB_USERNAME="$DB_USER" -e DB_PASSWORD="$DB_PASS" \
  --entrypoint php fast-english-new-app -d memory_limit=1G \
  vendor/bin/pest tests/Feature/SettingsCatalogTest.php tests/Feature/S8SeoTest.php
```

| Purpose | Command | Expected on success |
|---|---|---|
| Focused settings/SEO tests | Pest lane above | all pass |
| Full PHP regression (optional) | same lane, `vendor/bin/pest` | all pass |
| Typecheck | `npm run typecheck` | exit 0 (no TS change expected) |

If the lane is unavailable, report `BLOCKED`, not pass. Never substitute SQLite.

## Scope

**In scope**:
- `app/Models/Setting.php`
- `tests/Feature/S8SeoTest.php` (currently **untracked** user work; add one test,
  keep existing tests)

**Out of scope**:
- `app/Support/SiteSettings.php` — its public API and defaults stay unchanged.
- `app/Http/Middleware/HandleInertiaRequests.php`, `TrustController`,
  `PublicSeo` — no call-site changes; the model is the seam.
- Cross-request caching (`Cache::remember`), Redis, config caching, or
  invalidation events. The contract stays “fresh on the next request”.
- `app/Filament/Pages/BusinessSettings.php` — `put` remains the write seam.

## Git workflow

No branch, no commit, no push, no PR. Leave the change in the working tree and
preserve the existing uncommitted SEO work.

## Steps

### Step 1: Add a request-scoped settings map

Replace `Setting::read()` with the following shape. Keep the existing
`query()`/`value()` behavior for console/queue processes; only HTTP requests
with a bound request object are memoized.

```php
public static function read(string $key, ?string $default = null): ?string
{
    $request = app()->bound('request') ? app('request') : null;
    // Do not keep a process-wide cache in queue workers or artisan commands.
    // Tests are allowed to use the request-bound cache so the HTTP budget is
    // measurable; each test request has its own Request instance.
    $memoize = $request !== null
        && (! app()->runningInConsole() || app()->runningUnitTests());

    if ($memoize) {
        if (! $request->attributes->has('fe.settings')) {
            $request->attributes->set(
                'fe.settings',
                static::query()->pluck('value', 'key')->all(),
            );
        }

        $value = $request->attributes->get('fe.settings')[$key] ?? null;
    } else {
        $value = static::query()->where('key', $key)->value('value');
    }

    return $value === null ? $default : (string) $value;
}
```

Update the class docblock: reads are **request-cached**, not cross-request
cached; staff changes take effect on the next request; console/queue reads
bypass the request cache.

**Verify**: `grep -n 'fe.settings' app/Models/Setting.php` prints the three
attribute accesses; the file still has one `read()` and one `put()`.

### Step 2: Keep `put()` consistent with the map

After the existing `updateOrCreate`, update the current request’s map when it
has already been loaded. Do not preload it on a write:

```php
public static function put(string $key, ?string $value): void
{
    static::query()->updateOrCreate(
        ['key' => $key],
        ['value' => $value === null || $value === '' ? null : $value],
    );

    if (! app()->bound('request')) {
        return;
    }

    $request = app('request');

    if (! $request->attributes->has('fe.settings')) {
        return;
    }

    $values = $request->attributes->get('fe.settings');
    $values[$key] = $value === null || $value === '' ? null : $value;
    $request->attributes->set('fe.settings', $values);
}
```

This is what keeps `SettingsCatalogTest` (Livewire save then `Setting::read` in
the same process) truthful. If the request map was not loaded, the next `read`
loads the updated row from the database.

**Verify**: `vendor/bin/pest tests/Feature/SettingsCatalogTest.php` (Pest lane)
→ all pass, especially `staff can save contact channels and a real card
destination`.

### Step 3: Add a query-count regression test

In `tests/Feature/S8SeoTest.php`, add `use Illuminate\Support\Facades\DB;` at
the top (if not already imported) and append:

```php
test('a public page reads the settings table once', function () {
    DB::enableQueryLog();

    try {
        $this->get(route('trust.faq'))->assertOk();
    } finally {
        $queries = DB::getQueryLog();
        DB::disableQueryLog();
    }

    $settingsQueries = collect($queries)
        ->pluck('query')
        ->filter(fn (string $sql) => str_contains($sql, 'from "settings"'))
        ->count();

    expect($settingsQueries)->toBe(1);
});
```

Why `/faq`: it is the heaviest public settings consumer (11–13 point reads in
the current tree) and it is already covered by `S8SeoTest`. Do not assert the
whole query count of the page; other middleware may add session queries in a
non-array environment. The assertion is deliberately about the settings table.

**Verify**: Pest lane → `S8SeoTest` passes, including the new test. The previous
behavior fails this test with 13; the new behavior must show 1.

## Test plan

- New test: one query-count assertion in `tests/Feature/S8SeoTest.php`.
- Existing pattern: `P004QueryBudgetsTest.php` uses `DB::enableQueryLog()`,
  `DB::getQueryLog()`, and filters session noise; match that style, but filter
  for the settings table instead of excluding sessions.
- Regression tests that must stay green: `SettingsCatalogTest` (write/read in
  one process), `S8SeoTest` (public metadata), `S8HeadersTest` (public/private
  cache headers), and `S8LandingTest` (landing copy/props).
- Optional: run the full Pest suite on `fe_test`; report the totals.

## Done criteria

- [ ] `Setting::read()` is request-scoped and `Setting::put()` updates a loaded
  map.
- [ ] `/faq` issues exactly **1** `settings` query in the test above.
- [ ] `SettingsCatalogTest` passes (8 `put` calls then a same-process read).
- [ ] `S8SeoTest` passes, including the new test.
- [ ] `git status --short` shows no out-of-scope file.
- [ ] `plans/README.md` row 009 is updated truthfully.

## STOP conditions

Stop and report if:

- A test reads a setting after changing the row with a raw `DB::table(...)`
  update (not `Setting::put`) and expects the new value; the request cache would
  be stale by design. Name the test and the code path instead of adding a
  cross-request cache.
- `app('request')` is not bound in a context that produces public HTML, or a
  queue worker reads settings across jobs and the console guard is not enough.
- The settings query count on `/faq` is not 1 after the change; do not relax the
  assertion to a range.
- A step's verification fails twice after a reasonable fix attempt.

## Maintenance notes

- This is a per-request cache, not a Laravel cache-store entry. Do not add a TTL
  or `Cache::forget` “just in case”; `put` is the invalidation seam.
- If a long-lived Octane worker is introduced later, the request attribute is
  still per request; do not move this to a static property.
- The `settings` table is tiny. If it ever grows beyond operational copy, switch
  to reading the specific keys and keep the one-query contract explicit.
- Reviewer should scrutinize the console/test branch: queue workers must not
  retain a settings snapshot across jobs.

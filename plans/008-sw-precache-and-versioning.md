# Plan 008: Trim the service-worker precache and auto-version the cache

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**:
> `git status --short -- resources/public-assets.json app/Http/Controllers/PwaController.php config/pwa.php tests/Feature/S2PwaTest.php`
> and `git diff -- resources/public-assets.json app/Http/Controllers/PwaController.php config/pwa.php`.
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

The service worker installs a 553,597-byte precache on the first visit and keeps
it across releases. The public offline page is fully self-contained (inline
CSS, system fonts, one icon), and the service worker never serves the app shell
offline: every navigation goes to the network and falls back to `/offline`.
So the React bundle, the Inertia stylesheet, the PWA registration script, and
both Vazirmatn fonts are stored for offline use that cannot happen. Keeping only
the offline page, the four icons, and the web manifest cuts the precache to
about 64 KB. In addition, the cache name is currently a manual constant
(`2026-10-28-2`); if nobody bumps `SW_VERSION`, every deploy adds new hashed
entries to the same cache and old entries are never evicted. Deriving the cache
name from the built manifest makes each build rotate the cache automatically.

## Current state

- `resources/public-assets.json` (the single allowlist shared by Vite and
  `App\Support\PublicAssets`):

```json
"viteInputs": [
    { "path": "resources/css/app.css", "precache": false },
    { "path": "resources/js/pwa.js", "precache": true },
    { "path": "resources/css/inertia.css", "precache": true },
    { "path": "resources/js/app.tsx", "precache": true }
],
"staticPrecache": [
    "/offline",
    "/manifest.webmanifest",
    "/icons/icon-192.png",
    "/icons/icon-512.png",
    "/icons/icon-maskable-512.png",
    "/icons/apple-touch-180.png",
    "/fonts/vazirmatn/vazirmatn-arabic-variable.woff2",
    "/fonts/vazirmatn/vazirmatn-latin-variable.woff2"
]
```

- `app/Support/PublicAssets.php` `precache()` appends `/build/<file>` (and its
  CSS) for every `precache:true` input, then the static entries. It throws if a
  `precache:true` input is missing from the manifest.
- `app/Http/Controllers/PwaController.php:116-130`:

```php
public function swVersion(): string
{
    if (! app()->environment('testing')) {
        $override = storage_path('app/sw-version');
        if (is_file($override)) {
            $value = trim((string) File::get($override));
            if ($value !== '') { return $value; }
        }
    }

    $version = trim((string) config('pwa.sw_version', ''));

    return $version !== '' ? $version : '2026-10-28-2';
}
```

- `config/pwa.php:19`: `'sw_version' => env('SW_VERSION') ?: '2026-10-28-2'`.
  `.env.production.example:99` leaves `SW_VERSION=` empty, so production always
  uses the constant unless the owner edits the file.
- `resources/views/pwa/service-worker.blade.php`:

```js
const FE_CACHE = 'fe-public-{{ $version }}';
const FE_PRECACHE = {!! json_encode($precache) !!};
const FE_OFFLINE = '/offline';
...
caches.open(FE_CACHE).then((cache) =>
  cache.addAll(FE_PRECACHE.map((url) => new Request(url, { credentials: 'omit' })))
)
...
caches.keys().then((keys) => Promise.all(
  keys.filter((key) => key.startsWith('fe-') && key !== FE_CACHE).map((key) => caches.delete(key))
))
...
if (FE_PRECACHE.includes(url.pathname)) { /* cache-first */ }
if (request.mode === 'navigate') { /* network, else /offline */ }
```

- `resources/views/pwa/offline.blade.php:1-45` is self-contained: inline
  `<style>`, `font-family: system-ui, Tahoma, sans-serif`, and only
  `/icons/icon-192.png` as an external asset. It does not use the app CSS, the
  React bundle, `pwa.js`, or Vazirmatn.
- Measured current precache (2026-11-14, host `public/build`):
  - `app.js` 354,913 B
  - `inertia.css` 54,638 B
  - fonts 80,832 B
  - icons 61,852 B
  - `pwa.js` 1,366 B
  - `/offline` 2,106 B (route, no public file)
  - manifest 334 B (route, no public file)
  - **total 553,597 B**. After this plan only `/offline`, the four icons, and
    the manifest remain (~64 KB, roughly 88% less).

## Commands you will need

Host PHP is absent on this machine. The canonical gate is
`bash scripts/project-verify.sh`, but its `fe-php`/`s0-pg` lane can be BLOCKED.
The verified fallback (2026-11-14) is:

```bash
DB_USER=$(docker exec fast-english-new-app-1 printenv DB_USERNAME)
DB_PASS=$(docker exec fast-english-new-app-1 printenv DB_PASSWORD)
docker run --rm --network fast-english-new_default \
  -v "$PWD":/repo -w /repo --user "$(id -u):$(id -g)" \
  -e APP_ENV=testing -e DB_CONNECTION=pgsql -e DB_HOST=db -e DB_PORT=5432 \
  -e DB_DATABASE=fe_test -e DB_USERNAME="$DB_USER" -e DB_PASSWORD="$DB_PASS" \
  --entrypoint php fast-english-new-app -d memory_limit=1G \
  vendor/bin/pest tests/Feature/S2PwaTest.php
```

| Purpose | Command | Expected on success |
|---|---|---|
| Build assets (needed by `precache()` completeness) | `npm run build` | exit 0, `public/build/manifest.json` updated |
| Focused PWA tests | Pest lane above | all pass |
| Privacy regression | `vendor/bin/pest tests/Feature/D5ShellPrivacyTest.php` (same lane) | all pass |
| Browser PWA proof (optional) | `npx playwright test s2-pwa --project=chromium` | pass when the lane answers on `:8112` |

If no Pest lane is available, report `BLOCKED`, not pass. Never substitute
SQLite or weaken the tests.

## Scope

**In scope**:
- `resources/public-assets.json`
- `app/Http/Controllers/PwaController.php`
- `config/pwa.php`
- `tests/Feature/S2PwaTest.php`

**Out of scope**:
- `resources/views/pwa/service-worker.blade.php` — the cache name, fetch
  strategy, offline fallback, and `FE_SKIP_WAITING` behavior stay unchanged.
- `resources/views/pwa/offline.blade.php` — already self-contained.
- `app/Support/PublicAssets.php` — the allowlist logic is correct; only its
  input changes.
- `public/build/**` — generated; never edit.
- Any private-cache rule, auth, media, or Filament route.

## Git workflow

No branch, no commit, no push, no PR. Leave the change in the working tree and
do not revert the existing uncommitted SEO work.

## Steps

### Step 1: Shrink the allowlist to what `/offline` actually uses

Edit `resources/public-assets.json`:

```json
"viteInputs": [
    { "path": "resources/css/app.css", "precache": false },
    { "path": "resources/js/pwa.js", "precache": false },
    { "path": "resources/css/inertia.css", "precache": false },
    { "path": "resources/js/app.tsx", "precache": false }
],
"staticPrecache": [
    "/offline",
    "/manifest.webmanifest",
    "/icons/icon-192.png",
    "/icons/icon-512.png",
    "/icons/icon-maskable-512.png",
    "/icons/apple-touch-180.png"
]
```

Update the adjacent comment to say the precache is the **offline page only**;
the app shell is network-only by design. Do not remove `/manifest.webmanifest`
or any icon: the offline page uses `icon-192`, and install/splash metadata uses
the others.

**Verify**: `node -e "JSON.parse(require('fs').readFileSync('resources/public-assets.json','utf8'))"`
exits 0 and
`grep -n 'vazirmatn\|app.tsx\|inertia.css\|pwa.js' resources/public-assets.json`
shows `app.tsx`, `inertia.css`, and `pwa.js` only as `precache:false` entries;
no Vazirmatn line remains.

### Step 2: Derive the cache version when no explicit version is set

Edit `config/pwa.php:19` to:

```php
'sw_version' => env('SW_VERSION'),
```

Update its comment: empty means the built manifest hash is used; set
`SW_VERSION` only to force a cache rotation without a build. Do **not** delete
the storage override behavior: browser tests write `storage/app/sw-version`.

Edit `PwaController::swVersion()` so the fallback is the manifest hash instead
of the hardcoded date:

```php
$version = trim((string) config('pwa.sw_version', ''));
if ($version !== '') {
    return $version;
}

$manifest = public_path('build/manifest.json');
if (is_file($manifest)) {
    return substr((string) hash_file('xxh128', $manifest), 0, 12);
}

return 'dev';
```

Keep the existing `storage/app/sw-version` override block above it. The
manifest changes on every `npm run build`, so `FE_CACHE` changes and the
`activate` handler evicts the previous `fe-*` cache. `hash_file` reads a 21 KB
file per `/sw.js` request; `/sw.js` is already `no-store`, so this is not a
cache concern.

**Verify**: with a built manifest, a PHP one-liner through the Pest lane or
`php -r` prints a 12-character hash:
`php -r "echo substr(hash_file('xxh128','public/build/manifest.json'),0,12);"`
(host PHP absent: run it through `--entrypoint php fast-english-new-app` with
the repo mounted).

### Step 3: Update the PHPUnit expectations

In `tests/Feature/S2PwaTest.php`:

1. The test `service worker is versioned, uncacheable, and allowlist-only`
   currently asserts:

```php
expect($body)->toContain('fe-public-'.config('pwa.sw_version'))
```

Replace it with the value the controller resolves, so the test does not depend
on the config default:

```php
$version = app(\App\Http\Controllers\PwaController::class)->swVersion();
expect($body)->toContain('fe-public-'.$version);
```

2. Add one test after `precache is complete for the shared public-asset
   allowlist`:

```php
test('precache carries only offline shell bytes', function () {
    $paths = PublicAssets::precache();

    expect($paths)->toContain('/offline')
        ->and(collect($paths)->filter(fn ($p) => str_starts_with($p, '/build/')))->toBeEmpty()
        ->and(collect($paths)->filter(fn ($p) => str_starts_with($p, '/fonts/')))->toBeEmpty();

    $bytes = collect($paths)->sum(function (string $path): int {
        $file = public_path(ltrim($path, '/'));
        return is_file($file) ? (int) filesize($file) : 0;
    });

    expect($bytes)->toBeLessThan(100_000);
});
```

Do not change the existing `precache allowlist contains only public entries`,
`precache is complete`, offline page, manifest, assetlinks, or robots tests.

**Verify**: Pest lane → all tests pass; the new test reports a byte total below
100,000. (The four icons are 61,852 B; the two routes have no public files.)

### Step 4: Rebuild and inspect the served worker

Run `npm run build`, then request `/sw.js` through a local server or the Pest
test. The body must contain the new resolved `fe-public-<hash>` and must **not**
contain `/build/assets/app-` or `/fonts/vazirmatn/`. The offline test must still
show the Persian message and `id="fe-offline-retry"`.

**Verify**:
`vendor/bin/pest tests/Feature/S2PwaTest.php` → pass;
`vendor/bin/pest tests/Feature/D5ShellPrivacyTest.php` → pass.

## Test plan

- Updated: `tests/Feature/S2PwaTest.php` — version assertion and one new
  precache-size test.
- Existing patterns to follow: the same file's `PublicAssets::precache()`
  assertions and its use of `public_path()`/`File`.
- Regression tests that must stay green: `D5ShellPrivacyTest` (no private paths,
  no dead `app.css`), `S2PwaTest` (manifest/offline/robots), and the browser
  `s2-pwa` spec when the lane is available.
- The browser spec writes `storage/app/sw-version`; the override still takes
  precedence, so `S2-4` keeps working.

## Done criteria

- [ ] `PublicAssets::precache()` contains no `/build/` and no `/fonts/` entry.
- [ ] `node -e` parse of `resources/public-assets.json` exits 0.
- [ ] `PwaController::swVersion()` returns a 12-character manifest hash when
  `SW_VERSION` is empty and a manifest exists.
- [ ] `tests/Feature/S2PwaTest.php` passes with the new test.
- [ ] `tests/Feature/D5ShellPrivacyTest.php` passes.
- [ ] `npm run build` exits 0.
- [ ] `git status --short` shows no out-of-scope files.
- [ ] `plans/README.md` row 008 is updated truthfully.

## STOP conditions

Stop and report if:

- The offline page starts using the app CSS, React bundle, `pwa.js`, or
  Vazirmatn (for example a redesign landed) — then the trim is wrong.
- A `precache:true` entry cannot be removed because a test or the offline page
  genuinely needs it; do not delete the test to force a green result.
- `SW_VERSION` is set in the environment or the storage override exists and you
  cannot tell which value should win; report the observed values.
- The manifest is missing after `npm run build`, or the hash is empty.
- A step's verification fails twice after a reasonable fix attempt.

## Maintenance notes

- If a real offline app shell is added later (cached navigation or data), the
  app JS/CSS must return to the precache and this plan's size assertion must be
  revisited. Today the offline contract is the static `/offline` page only.
- `FE_CACHE` is now build-derived. A deploy that only changes PHP without a new
  Vite build keeps the same cache name; that is correct because the precache
  content did not change.
- Browser tests that need a deterministic version should keep writing
  `storage/app/sw-version`; the storage override remains the test seam.
- Do not add private paths, API responses, audio, or receipt URLs to the
  allowlist, even temporarily.

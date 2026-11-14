# Plan 007: Preload the LCP font/cover and shrink the header lockup

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**:
> `git status --short -- resources/views/app.blade.php public/images/brand tests/Feature/S8SeoTest.php`
> and `git diff -- resources/views/app.blade.php tests/Feature/S8SeoTest.php`.
> This repository has **uncommitted public-SEO work** in the working tree.
> Read the live files; never `git checkout`, `git stash`, or revert them.
> If an excerpt below does not match the live file, STOP and report.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: perf
- **Planned at**: commit `dcc3f6c` plus the uncommitted public-SEO working tree, 2026-11-14
- **Issue**: omit

## Why this matters

The Persian UI font is 46 KB and the page hero cover is a ~30 KB image. Both are
discovered late: the font only after the render-blocking CSS is parsed, and the
hero image only after React hydrates because Inertia renders the `<img>` on the
client. On a mobile connection that is one to three extra round trips before the
largest contentful paint. The header lockup is also oversized: the only rendered
size is 92×26, 113×32, or 120×34 CSS pixels, but the shipped PNG is 697×197 and
41 KB. Preloading the two above-the-fold assets and resizing the lockup to 2×
display size is a small, reversible first-paint win. The same change is also a
prerequisite for measuring LCP honestly in Lighthouse.

## Current state

- `resources/views/app.blade.php` is the only Inertia root template. It already
  extracts `$seo`, a title, and a favicon version in the head:
  - lines 6–17: `@php $seo = ...; $seoTitle = ...; $faviconVersion = ...; @endphp`
  - line 38: `@include('partials.seo', ['seo' => $seo])`
  - lines 58–59: `@viteReactRefresh` and
    `@vite(['resources/css/inertia.css', 'resources/js/app.tsx', 'resources/js/pwa.js'])`
- `resources/css/inertia.css:34-48` declares the two self-hosted Vazirmatn
  `@font-face` blocks (Arabic `vazirmatn-arabic-variable.woff2`, 46,308 B, and
  Latin `vazirmatn-latin-variable.woff2`, 34,524 B). `font-display: swap` is
  already set.
- `resources/js/pages/Landing/Index.tsx:119-148` owns `CoverImage`: it renders
  `width={800} height={450}`, `loading={eager ? 'eager' : 'lazy'}`,
  `fetchPriority={eager ? 'high' : undefined}`, and `decoding="async"`. The
  landing hero, `/sample`, and the reader use `eager`; the browser still cannot
  discover the URL until React runs.
- `resources/js/pages/Sample/Show.tsx:75-81` and
  `resources/js/pages/Reader/Show.tsx:286-292` render the same cover with
  `loading="eager"` and `fetchPriority="high"`.
- The lockup is used at these display sizes:
  - `resources/js/layouts/AppLayout.tsx:142-149` — 92×26
  - `resources/js/layouts/PublicLayout.tsx:51-57` — 113×32
  - `resources/js/pages/Auth/Frame.tsx:44-50` — 120×34
  - `resources/js/pages/ErrorPage.tsx:102` — 113×32
  The largest display size is 120×34; a 2× asset is 240×68.
- Current files:
  - `public/images/brand/fastenglish-header-logo.png` — 41,204 B (697×197 RGBA)
  - `public/images/brand/fastenglish-header-logo-dark.png` — 11 KB (697×197 RGBA)
- ImageMagick is available on this host as `magick` (and deprecated `convert`).
  A resized 240×68 PNG measured **10,367 B** with
  `magick Logo/fastenglish_header_logo.png -resize 240x68 -strip -define png:compression-level=9`.
- Repo convention: the first-paint head is owned by the Blade root template
  (`resources/views/app.blade.php`); client-side tag replacement is owned by
  `resources/js/components/SeoHead.tsx`. Do not add React-side `<link>` tags for
  the first paint.

## Commands you will need

Host PHP is not installed on this machine (verified 2026-11-14). The canonical
gate is `bash scripts/project-verify.sh`, but its `fe-php:8.4.26`/`s0-pg` lane
can be BLOCKED here. The verified fallback lane is the running project image on
the compose network with the existing `fe_test` database. Do not edit
`.env.testing`; pass the connection as environment variables.

```bash
# Focused Pest lane (verified 2026-11-14, S2PwaTest: 11 passed)
DB_USER=$(docker exec fast-english-new-app-1 printenv DB_USERNAME)
DB_PASS=$(docker exec fast-english-new-app-1 printenv DB_PASSWORD)
docker run --rm --network fast-english-new_default \
  -v "$PWD":/repo -w /repo --user "$(id -u):$(id -g)" \
  -e APP_ENV=testing -e DB_CONNECTION=pgsql -e DB_HOST=db -e DB_PORT=5432 \
  -e DB_DATABASE=fe_test -e DB_USERNAME="$DB_USER" -e DB_PASSWORD="$DB_PASS" \
  --entrypoint php fast-english-new-app -d memory_limit=1G \
  vendor/bin/pest tests/Feature/S8SeoTest.php
```

| Purpose | Command | Expected on success |
|---|---|---|
| Typecheck | `npm run typecheck` | exit 0, no errors |
| Build | `npm run build` | exit 0 |
| Focused SEO test | the Pest lane above | all tests pass |
| Browser proof (if lane is up) | `npx playwright test s8-seo --project=chromium` | pass; `BASE_URL` must answer |

If both the host and Docker Pest lanes are unavailable, report `BLOCKED`, not
pass. Never substitute SQLite.

## Scope

**In scope** (the only files you should modify):
- `resources/views/app.blade.php`
- `public/images/brand/fastenglish-header-logo.png`
- `public/images/brand/fastenglish-header-logo-dark.png`
- `tests/Feature/S8SeoTest.php` (currently **untracked** user work; add one test,
  do not rewrite the file)

**Out of scope** (do NOT touch):
- `resources/js/pages/Landing/Index.tsx`, `Sample/Show.tsx`, `Reader/Show.tsx`,
  and all React markup — the preload is a server-head concern; changing the
  client image components is a separate plan.
- `resources/css/inertia.css` — the font faces stay as they are.
- `public/images/og/fast-english-1200x630.png` and the favicons — crawler- or
  cache-only; not this plan.
- `docker/`, `vite.config.js`, any CSP/security-header work.

## Git workflow

- Match the repo's current solo workflow: **no branch, no commit, no push, no
  PR**. Leave the change in the working tree.
- Do not revert or stash the existing uncommitted SEO files. If `git status`
  shows a file you did not touch, leave it alone.

## Steps

### Step 1: Add a server-side hero URL variable

In `resources/views/app.blade.php`, extend the existing `@php` block (lines
6–17) with one variable. Use `data_get` so a missing/null `sample` or `topic`
prop cannot raise a warning:

```php
$hero = data_get($page, 'props.sample.cover_url')
    ?? data_get($page, 'props.topic.cover_url');
```

Do not add any other data lookups. `TopicCover::url()` already returns
`/storage/...` or `null`; never build a storage path here.

**Verify**: `sed -n '6,22p' resources/views/app.blade.php` shows `$hero` inside
the existing block and the file still starts with `@php`.

### Step 2: Preload the font and, when present, the hero image

Insert these two tags immediately after the existing
`@include('partials.seo', ['seo' => $seo])` line (line 38) and before the Google
verification block:

```blade
    {{-- First-paint hints: the Persian UI font is otherwise discovered only
         after the blocking CSS parses, and the React-rendered hero cover is
         otherwise discovered only after hydration. One image only. --}}
    <link rel="preload" as="font" type="font/woff2"
          href="/fonts/vazirmatn/vazirmatn-arabic-variable.woff2" crossorigin>
    @if (is_string($hero) && $hero !== '')
        <link rel="preload" as="image" href="{{ $hero }}" fetchpriority="high">
    @endif
```

Rules:
- `crossorigin` is required on the font preload or the browser will fetch the
  font twice.
- Preload **one** image per page. If both a sample and a topic cover exist, the
  sample wins (`??` order).
- Do not preload the Latin font, the OG image, or the logo. The Latin font is
  only used for English body text; the OG image is not rendered; the logo is
  below the hero in priority.

**Verify**:
`grep -n 'rel="preload"' resources/views/app.blade.php` prints exactly two
occurrences (one font, one image), and
`grep -n 'vazirmatn-arabic-variable.woff2' resources/views/app.blade.php` prints
one.

### Step 3: Resize the header lockups to 2× display size

Use the light lockup source from `Logo/`; for the dark lockup use the current
public file as its own source (there is no separate dark source in `Logo/`).
Write through a temporary file so a failed command never truncates the asset:

```bash
magick Logo/fastenglish_header_logo.png -resize 240x68 -strip \
  -define png:compression-level=9 /tmp/fe-logo-light-240.png
magick public/images/brand/fastenglish-header-logo-dark.png -resize 240x68 -strip \
  -define png:compression-level=9 /tmp/fe-logo-dark-240.png
magick identify -format '%f %wx%h %b\n' /tmp/fe-logo-light-240.png /tmp/fe-logo-dark-240.png
mv /tmp/fe-logo-light-240.png public/images/brand/fastenglish-header-logo.png
mv /tmp/fe-logo-dark-240.png public/images/brand/fastenglish-header-logo-dark.png
```

Expected: both identify as `240x68`; the light file is ~10 KB (measured
10,367 B) and the dark file is smaller than its current 11 KB. If the output is
larger than 15 KB, STOP and report the measured size — do not degrade the
source further.

**Verify**:
`magick identify -format '%f %wx%h %b\n' public/images/brand/fastenglish-header-logo*.png`
prints `240x68` for both; `stat -c '%n %s' public/images/brand/*.png` shows the
light file well below 41,204 B.

### Step 4: Add one regression test

Append one test to `tests/Feature/S8SeoTest.php` (keep every existing test
unchanged). Seed the real sample seeder so the sample page has a cover:

```php
test('the root template preloads the LCP font and the hero cover', function () {
    $this->seed(\Database\Seeders\S1SampleSeeder::class);

    $html = $this->get(route('sample'))->assertOk()->getContent();

    expect($html)->toContain('rel="preload" as="font"')
        ->and($html)->toContain('vazirmatn-arabic-variable.woff2')
        ->and($html)->toContain('rel="preload" as="image"')
        ->and($html)->toContain('fetchpriority="high"');

    // A page with no hero must not preload an unrelated image.
    expect($this->get(route('trust.faq'))->assertOk()->getContent())
        ->not->toContain('rel="preload" as="image"');
});
```

If `S1SampleSeeder` fails in the test environment because GD cannot write to
`storage/app/public`, STOP and report; do not change the seeder (out of scope).

**Verify**: the Pest lane above → `Tests: 6 passed` (5 existing + 1 new), with no
failures.

## Test plan

- New test: the one in Step 4, in `tests/Feature/S8SeoTest.php`.
- Structural pattern: the existing `S8SeoTest` tests use
  `$this->get(route(...))->assertOk()->getContent()` and exact string
  assertions; match that style.
- Existing tests that must stay green: all six tests in `S8SeoTest`.
- Browser proof is optional but preferred: `npx playwright test s8-seo
  --project=chromium` when the local browser lane answers on `:8112` (the gate
  prints `SKIP: browser lane` when it does not).

## Done criteria

All must hold:

- [ ] `grep -c 'rel="preload"' resources/views/app.blade.php` returns `2`.
- [ ] `grep -n 'vazirmatn-arabic-variable.woff2' resources/views/app.blade.php`
  returns exactly one line.
- [ ] `magick identify -format '%wx%h' public/images/brand/fastenglish-header-logo.png`
  prints `240x68`; `stat -c %s` is below 15,000.
- [ ] The focused Pest lane passes, including the new test.
- [ ] `npm run typecheck` exits 0 and `npm run build` exits 0.
- [ ] `git status --short` shows no modified files outside the scope list.
- [ ] `plans/README.md` row 007 is updated to the truthful status
  (`DONE`, `PARTIAL`, or `BLOCKED` with a one-line reason).

## STOP conditions

Stop and report (do not improvise) if:

- The live `resources/views/app.blade.php` does not contain the `$seo` block and
  the `@include('partials.seo')` line described above (the codebase drifted).
- `S1SampleSeeder` cannot create the sample cover in the test environment, or
  `/sample` returns 404 after seeding.
- The resized lockup is unreadable or its colors/alpha change in a visual check.
- A step's verification fails twice after a reasonable fix attempt.
- The change appears to require touching a React page or `inertia.css`.

## Maintenance notes

- If the LCP element changes (for example a full-width photo replaces the cover
  card), remove or retarget the image preload; a preload for an off-screen image
  competes with the real LCP.
- If the sample is removed, `$hero` becomes null and the image preload
  disappears by design; the font preload stays.
- `fetchpriority` on a `<link rel=preload>` is a hint; do not assume it in tests
  beyond the attribute string.
- The logo assets are brand-owned. A future brand update must re-run Step 3 at
  2× the largest display size, and should be visually reviewed at 390 px and
  1440 px before merge.

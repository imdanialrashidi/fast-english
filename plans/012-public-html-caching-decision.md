# Plan 012: Decide the public HTML caching posture before changing `no-store`

> **Executor instructions**: This is a **decision/spike plan**, not an
> implementation plan. Its output is a recorded decision plus the measurements
> that justify it. Do not change application code, middleware, session
> configuration, or headers while executing it. If the owner has already
> chosen an option, jump to “If option A is chosen” or record “option B needs
> its own plan” and stop. When done, update the status row for this plan in
> `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**:
> `git status --short` and `git diff -- app/Http/Middleware/PrivateNoStore.php`.
> The working tree contains uncommitted public-SEO work; do not revert it. If
> `PrivateNoStore` no longer sets `no-store` on public HTML, re-read this plan
> before proceeding.

## Status

- **Priority**: P2
- **Effort**: M (the decision and measurement are S; option B is L)
- **Risk**: MED
- **Depends on**: plans/009-settings-single-query.md and
  plans/010-public-cache-headers-and-php-version.md for clean measurements
- **Category**: direction
- **Planned at**: commit `dcc3f6c` plus the uncommitted public-SEO working tree, 2026-11-14
- **Issue**: omit
- **Decision**: **C — keep `no-store` for now** (2026-11-14). Revisit when a
  CDN/reverse-proxy cache is introduced or marketing traffic makes the origin
  cost material.

## Measured (2026-11-14)

- Live `https://fastenglishpodcast.ir/` and `/faq` both return
  `cache-control: no-store, private`; `/faq` also sets `fast-english-session`
  and `XSRF-TOKEN` cookies.
- `/faq` on the working tree, local PostgreSQL: **15 queries** with
  `SESSION_DRIVER=array` and **19 queries** with `SESSION_DRIVER=database`
  (13 settings reads, 2 sample lookups, the rest session/connection work).
  Laravel persists the database session on request termination.
- Local server render was ~5.8 ms p50 for `/faq` with array sessions; the live
  TTFB from the audit network was ~300 ms and was dominated by the network, not
  the render. The marketing traffic level and CDN plan are not available in
  this checkout, so option C is the only decision that does not invent a
  product requirement.

## Why this matters

Every public HTML page is currently uncacheable:

- `app/Http/Middleware/PrivateNoStore.php:49-50` sets
  `Cache-Control: private, no-store` whenever the response is HTML, an Inertia
  JSON response, or a Livewire update — including the landing, trust pages,
  download, install, and sample.
- Live production on 2026-11-14 confirmed `cache-control: no-store, private` on
  `/` and `/faq`, and `set-cookie` for both the session and `XSRF-TOKEN` on
  `/faq` (the landing also sets cookies through the root template’s CSRF token).
- With `SESSION_DRIVER=database`, a guest `/faq` request measured **19
  queries**; the same page with `SESSION_DRIVER=array` measured **15** (both
  include 13 settings reads and 2 sample lookups). Laravel also writes the
  database session row on request termination.

This is a deliberate privacy boundary, and it is correct for account, payment,
reader, and admin HTML. It is broader than the documented contract:
`docs/ARCHITECTURE.md:66` requires `private, no-store` for *private media and
account HTML*, while the middleware applies it to all HTML. The middleware’s
own docblock names “account, admin, and Livewire” responses, not marketing
pages. The consequence is that no browser cache, bfcache, reverse proxy, or CDN
can absorb a marketing visit, and every guest view creates a database session.
That is acceptable at the current traffic level; it becomes the dominant cost
when paid/organic traffic arrives. This plan forces an explicit choice instead
of leaving the current behavior accidental.

## Current state

- `PrivateNoStore::handle()`:

```php
$response = $next($request);
$contentType = (string) $response->headers->get('Content-Type', '');
$isHtml = str_contains($contentType, 'text/html');
$isInertia = $request->headers->has('X-Inertia') || $request->headers->has('X-Inertia-Version');

if ($isHtml || $isInertia || $isLivewireUpdate) {
    $response->headers->set('Cache-Control', 'private, no-store');
}

if ($isHtml && ! app()->environment('production')) {
    $response->headers->set('X-Robots-Tag', 'noindex, nofollow');
} elseif ($isHtml && self::isPrivateSurface($request)) {
    $response->headers->set('X-Robots-Tag', 'noindex, nofollow');
}
```

- `PrivateNoStore::isPrivateSurface()` already distinguishes `/app`, `/admin`,
  `/login`, `/register`, `/media`, `/staff`, `/account`; `/`, trust pages,
  `/download`, `/install`, `/sitemap.xml`, and `/offline` are public.
- `routes/web.php:80-96` puts the landing and trust pages inside
  `marketing.guest`; `RedirectAuthenticatedToApp` sends a signed-in learner to
  `/app/today`. `/download` and `/install` are public for both guests and
  learners (`routes/web.php:98-106`).
- `resources/views/app.blade.php:26` emits
  `<meta name="csrf-token" content="{{ csrf_token() }}">`, so every Inertia
  page starts a session even when it has no form. Auth pages genuinely need
  that token; the landing and trust pages do not have a POST form.
- Tests: `tests/Feature/S8HeadersTest.php` asserts private surfaces keep
  `private, no-store` and public paths are not “private surfaces”; it does not
  currently assert that public HTML is cacheable or uncacheable. Any change here
  must keep the private assertions intact.
- Scope doc: `docs/FAST_ENGLISH_BUILD_SCOPE_FA.md:488-490` requires private
  media/account HTML no-store and allows long caching for public fingerprinted
  assets; it does not require public HTML to be uncacheable.

## Decision criteria

Choose based on these recorded facts, not preference:

1. **Traffic shape:** how many monthly sessions hit `/`, `/faq`, `/about`,
   `/download`, `/install`, and `/sample`; are they paid/organic/search or
   mostly signed-in redirects?
2. **Origin cost:** the measured PHP render (5–6 ms locally with array session;
   ~19 queries with DB session) and the session row write per guest.
3. **Delivery plan:** is a CDN/reverse proxy (Cloudflare, ArvanCloud, Coolify
   Traefik cache, etc.) planned in the next two quarters? Without a shared
   cache, option A only helps browser back/forward.
4. **Product behavior:** must a signed-in learner who opens `/` still be
   redirected to `/app/today`? That is `marketing.guest` today and it requires
   session/auth state.
5. **Security:** no private data may ever enter a shared cache; CSRF tokens in
   cached HTML must never be reused across sessions.

## Options

### Option A — numeric small step: browser-cache the static public pages

Keep `no-store` for private surfaces and Inertia JSON. For the public
`text/html` responses with no POST form (`landing`, `trust.*`, `download`,
`install`, `sample`, `offline`), set:

```http
Cache-Control: private, max-age=60
```

Do **not** include `/login`, `/register`, `/password/*`, `/verification/*`,
`/phone/*`, or any Inertia JSON response: those carry a CSRF/session token and
form state, and a stale cached form would fail with 419.

- Gain: repeat/back-forward visits within 60 s skip PHP; bfcache eligibility
  improves in browsers that honor it.
- Cost: up to 60 s stale prices/sample availability; still no CDN because the
  response sets cookies; session still starts because the root template emits
  the CSRF meta and `marketing.guest` runs.
- Risk: a cached landing shown briefly after login is harmless marketing
  chrome, but a cached auth page would be a real bug — the allowlist must be
  route-name based, not “all public paths”.
- Effort: S; tests: extend `S8HeadersTest` with the allowlist and leave private
  assertions untouched.

### Option B — structural: stateless guest marketing + shared cache

Move the guest marketing routes out of the session/CSRF stack (a separate route
group without `StartSession`, `ShareErrorsFromSession`, and the Inertia shared
props that require a session), remove the CSRF meta token from pages that have
no form, and let a CDN/reverse proxy cache them:

```http
Cache-Control: public, max-age=0, s-maxage=300, stale-while-revalidate=60
```

- Gain: real origin offload; no DB session write per guest; marketing TTFB
  decoupled from PHP/DB.
- Cost: the signed-in redirect (`marketing.guest`) must be re-solved (a signed
  cookie check or a client-side redirect), and the public layout’s auth-aware
  header/footer must become guest-only. This is a product/architecture change,
  not a middleware toggle.
- Risk: MED–HIGH; requires a threat review for CSRF/session and a cache-key
  review for `Vary`/cookies. It must never cache an Inertia JSON response or a
  page with a CSRF meta tag.
- Effort: L; write a separate plan if chosen.

### Option C — do nothing now

Keep `no-store` on all HTML, accept a PHP+DB request per marketing visit, and
revisit when traffic or a CDN makes the cost visible. This is the current
behavior and is safe.

- Gain: zero risk; no tests change.
- Cost: no browser/CDN caching; every guest visit starts a session and renders
  PHP.
- Choose this if monthly marketing traffic is small and no CDN is planned.

## Recommendation

At the measured traffic and single-origin topology, **option C is defensible
for now**, but record the decision and the trigger for revisiting it (for
example “more than 50k marketing sessions/month” or “a CDN is added”). If a CDN
is planned, jump to **option B** rather than A: option A does not remove the
cookie/session, so it cannot unlock shared caching and adds staleness without
the main payoff. Option A is only worth it if the owner wants faster
back/forward and repeat visits and accepts a 60-second stale marketing page.

## Steps (decision and measurement only)

1. Record the current baseline in this plan (append a short “Measured” block):

   ```bash
   curl -sI https://fastenglishpodcast.ir/ | grep -iE 'cache-control|set-cookie'
   curl -sI https://fastenglishpodcast.ir/faq | grep -iE 'cache-control|set-cookie'
   ```

   Expected today: `cache-control: no-store, private`; a session/XSRF
   `set-cookie` on `/faq`.

2. Capture a query count for `/faq` with database sessions. Use a throwaway
   read-only script/container as in the audit, or enable the query log in a
   local request. Do not change `.env` in the repo; pass `SESSION_DRIVER` in the
   process environment. Expected: ~19 queries and one session write on
   termination; with array sessions ~15 queries.

3. Record traffic/plan answers for criteria 1–3 in the “Measured” block. If the
   owner is not available, leave the decision as `DECISION REQUIRED`; do not
   guess.

4. If the owner chooses **C**: write one paragraph in `docs/ARCHITECTURE.md`
   next to the HTTP contract saying public HTML is intentionally `no-store`
   until a CDN/stateless-marketing decision lands, and mark this plan `DONE`
   (decision recorded). Do not change code.

5. If the owner chooses **A**: open a separate implementation plan with an
   explicit route-name allowlist and tests. Do not implement it in this plan.

6. If the owner chooses **B**: stop and write a separate architecture plan
   covering the route group, session removal, cookie/auth behavior, cache keys,
   and a two-account/logout privacy proof. Do not implement it in this plan.

## Done criteria

- [ ] A “Measured” block exists with the live headers and the query count.
- [ ] The owner’s choice (A, B, or C) is recorded with the date.
- [ ] If C: `docs/ARCHITECTURE.md` records the intentional posture, and no code
  changed.
- [ ] If A or B: this plan is marked `DONE (decision)` and a follow-up plan is
  named; no application code is changed here.
- [ ] `plans/README.md` row 012 is updated truthfully.

## STOP conditions

Stop and report if:

- `PrivateNoStore` no longer sets `no-store` on private HTML, or the live
  headers already differ from the baseline.
- A proposed option would cache any HTML containing a CSRF token, a session
  cookie, an Inertia JSON response, or a private path. Do not “test it and see”.
- The owner cannot decide; leave `DECISION REQUIRED` rather than silently
  implementing option A.
- A measurement requires changing `.env`, a production secret, or application
  code; use process env/throwaway tooling instead.

## Maintenance notes

- Revisit when a CDN/reverse-proxy cache is introduced, when marketing traffic
  grows enough that origin cost matters, or when `marketing.guest` is
  redesigned.
- If option A lands later, the allowlist must be route-name based and must
  exclude every page that renders a form or reads flash/session state.
- If option B lands later, the privacy proof must cover two accounts, logout,
  back/forward, and a shared cache; `no-store` alone was never the full proof.
- This plan intentionally does not cover private media, account pages, or
  Inertia JSON: those stay `no-store` in every option.

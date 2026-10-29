# Fast English — launch readiness review

Date: 2026-10-26. Scope: whole repository at the current working tree
(uncommitted S0–S9/R1–R5/M0–M6 work included). Environment: host PHP absent,
so PHP ran in the pinned `fe-php:8.4.26` container against PostgreSQL 17
(`s0-pg`); Node 26.11.1 on the host (project pin 22.23.2; CI pins 22.23.2).

Verdict: **not launch-ready, but deploy-ready.** The application, its test
suite, and the production image runtime are sound. What blocks a real launch
is owner data (card destination, SMTP, real content, APK, support handles),
not application code.

## 1. Evidence executed in this pass

| Check | Command | Result |
|---|---|---|
| PHP style | `vendor/bin/pint --test` | PASS — 297 files |
| PHP suite on PostgreSQL 17 | `php artisan test` (pinned `fe-php:8.4.26`, `s0-pg`) | PASS — 351 tests, 4,327 assertions |
| TypeScript | `npm run typecheck` | PASS |
| Assets | `npm run build` | PASS |
| Browser lane (local Chromium, whole suite) | `BASE_URL=http://127.0.0.1:8111 npx playwright test --project=chromium` | PASS — 89 tests |
| Placement catalog | `php artisan test tests/Feature/PlacementCatalogTest.php` | PASS — 20 items, 4 per CEFR band, balanced key, idempotent publish |
| Install guide | `npx playwright test s9-install-guide` | PASS — 3 tests (360/1440 + download link) |
| Production image build | `docker build --network=host --build-arg HTTP_PROXY=… -t fe-prod:readiness .` | PASS — 2026-10-26, after the assets-stage fix; cache-proof lines emitted |
| Compose stack (app + PostgreSQL 17 + volumes) | `docker compose -f compose.prod.yml … up -d` | PASS — both services healthy |
| Release on a brand-new database | `sh /var/www/html/docker/release.sh` | PASS — 21 migrations + `ops:status` |
| Post-deploy probes | `scripts/coolify-smoke.sh http://127.0.0.1:8088` | PASS — 25 checks |
| Build-time cache steps (the risky `RUN` in the image) | `package:discover`, `config:cache`, `route:cache`, `view:cache`, `event:cache`, `filament:optimize` | PASS — exit 0, both caches written |
| Production runtime (`fe-prod:readiness` + current `docker/nginx.conf`) | curl probes, `/proc` inspection | PASS — see §2 |
| `nginx -t` with the shipped config | `nginx -t` in a clean container | PASS |
| Scheduler wiring | `php artisan schedule:list` (in the running container) | PASS — 3 commands: `receipts:retain-reviewed`, `receipts:cleanup`, `subscriptions:remind-expiring` |
| CI PostgreSQL major | `.github/workflows/quality.yml` | changed 16 → 17; NOT EXECUTED locally (CI-only) |
| CI image build job | `.github/workflows/quality.yml` | added; NOT EXECUTED locally (CI-only) |

## 2. Production runtime probes (image, `APP_ENV=production`)

| Probe | Result |
|---|---|
| `GET /up` | 200, minimal body, no env/version/trace |
| `GET /`, `GET /login` | 200 |
| `GET /_private/...` from outside | 404 |
| `GET /media/lessons/{id}/audio` (public sample) | 200, 160,539 B byte-identical to the fixture, `Content-Type: audio/mpeg`, `Accept-Ranges: bytes`, `Cache-Control: no-store, private` |
| `Range: bytes=0-99` / out-of-range | 206 with 100 B / 416 |
| 404 page | no stack trace, no vendor path |
| `/login`, `/app/*` | `X-Robots-Tag: noindex`, `Cache-Control: no-store` |
| dotfiles (`/.env`, `/.git`) | 404 |
| container user | `uid=33(www-data)` |
| supervisord programs | `nginx`, `php-fpm`, `queue`, `schedule` RUNNING (verified via `/proc` after migrations). On a fresh database the two workers exhaust their retries before `release.sh` runs; one app restart after the release starts them cleanly (documented pitfall, not a crash loop). |
| `php artisan ops:status` | counts/ages/bytes only, no secret; `recent_errors_24h=unavailable` because production has no file log |
| Security headers on `/` | `nosniff`, `SAMEORIGIN`, referrer policy, permissions policy, COOP; no HSTS over plain HTTP |
| gzip | `Content-Encoding: gzip` on HTML |
| Vite asset cache | `/build/assets/*` → `public, max-age=31536000, immutable` |
| Named volumes | marker files in `storage/app/private` + `storage/app/public` survived `docker compose restart app` |
| Fresh-database release | `release.sh` ran all 21 migrations on an empty database, then `ops:status` |
| `migrate:status` after release | all 21 migrations `Ran`, nothing pending |
| `GET /install`, `GET /download` in production mode | 200 (smoke suite; `/install` is a real page, not a redirect) |
| Placement + plan catalogs on the production stack | `placement-2026-10-v1` current with 20 questions; 3 plans; both seeders exit 0 on a second run |

## 3. Fixed in this pass

1. `docker/entrypoint.sh` — the unconditional `storage:link --force` logged
   `symlink(): File exists` at ERROR level on every boot (`public/` is
   root-owned in the image). It now links only when the link is missing.
2. `docker/supervisord.conf` — `startsecs=5`, `startretries=10` on the queue
   and scheduler. With the defaults, a database that is still starting puts
   both workers in FATAL for the container's whole lifetime while `/up`
   keeps reporting healthy.
3. `docker/nginx.conf` — gzip for text assets (measured 25,052 B → 5,782 B
   CSS; 3,353 B → 1,080 B HTML), long-lived caching for `/build/` and
   stable static files, and browser-hardening headers on every response
   (`nosniff`, `SAMEORIGIN`, referrer policy, permissions policy, COOP,
   HSTS only behind the TLS proxy).
4. `docker/release.sh` — the one explicit migration step, refusing
   non-production and `APP_DEBUG=true`, with `--check`.
5. `.env.production.example` — complete Coolify env checklist.
6. `.dockerignore` — internal docs/workflow files no longer ship in the image.
7. `docs/ops/COOLIFY.md` — ordered bring-up, mounts, pitfalls, post-deploy
   probes, rollback.
8. Test isolation was silently broken: Pest never ran the hooks declared
   in `tests/Pest.php` (and `beforeEach(...)->in()` is not a supported
   Pest API), so `Storage::fake` never applied and every seeding test wrote
   fixture MP3s into the real storage tree — and the redundant
   browser-database guard was dead too. Both now live in
   `Tests\TestCase::setUp()`; a full suite run leaves the real disk
   untouched. **[tested: 325 passing, 0 new files under storage/app]**
9. Panel import/export replaces the stored-archive backup/restore:
   `App\Support\DataTransfer`, `DataTransferController`,
   `/admin/data-transfer`, a `drop_backups_table` migration, and a
   12-test suite. Archives now carry only referenced files (a full local
   export is a few MB instead of 2.2 GB), and the test suite no longer
   writes fixture MP3s into the real storage tree.

### Second pass, 2026-10-26 pm — Coolify bring-up

10. **The production image could not build.** The Vite `assets` stage did
    not have `vendor/` (the Filament admin theme is a Vite input that
    `@import`s `vendor/filament/filament/resources/css/theme.css`) or
    `app/` (its Tailwind `@source` root), so `npm run build` failed with
    `Can't resolve '../../../../vendor/…/theme.css'`. The stage now runs
    after the `vendor` stage and copies both. This had been misread as a
    network block: with the assets fix the rest of the build was fine.
11. **`docker/release.sh` aborted on a fresh database.** `migrate:status`
    exits 1 when the `migrations` table does not exist, and `set -e`
    stopped the first release before it migrated anything. The status call
    is now tolerant; `migrate --force` still fails loudly.
12. **Unreadable source files crashed the runtime.** A working tree made
    under `umask 077` carried 0600 files; `COPY` preserved the mode and
    `www-data` hit `Failed to open stream: Permission denied` on
    `app/Filament/Pages/DataTransfer.php` (restart loop, health still
    green). The image now normalizes read access (`chmod -R a+rX`) on
    application directories. A clean git checkout is 0644, so this only
    bit the dirty tree — but the image should not depend on the umask.
13. **`ops:status` claimed `recent_errors_24h=0` in production.** With
    `LOG_CHANNEL=stderr` there is no file to read, so the only error signal
    was a false zero. It now prints `unavailable` and points at the
    container log; a regression test covers the no-file branch.
14. **Deploy package:** `compose.prod.yml` (app + PostgreSQL 17 + named
    volumes, `${NAME:?}` guards), `scripts/coolify-install.sh` (host
    preflight + official installer), `scripts/coolify-env.sh` (APP_KEY/DB
    password outside the repo), `scripts/coolify-smoke.sh` (25 post-deploy
    probes), and the updated COOLIFY/README/STAGING_CHECKLIST text.
15. **CI:** PostgreSQL service 16 → 17 in both jobs, and a new `image` job
    builds the production Dockerfile so this class of deploy-time failure
    fails the PR instead.

### Third pass, 2026-10-26 evening — launch content

16. **Placement test replaced with real content.** `PlacementCatalogSeeder`
    publishes `placement-2026-10-v1`: 20 four-option fill-in-the-blank
    items, four per CEFR band (A1–C1), ordered easy to hard, one
    unambiguous answer each, correct option balanced five times per
    position. `PlacementLevel` now documents the cut scores (0–3 A1, 4–7
    A2, 8–11 B1, 12–15 B2, 16–20 C1) and the deliberate C1 ceiling; the
    result page shows the Persian band label and says C2 needs a
    productive assessment. The fixture version string is no longer shown
    to learners. Seeded in the production stack (current, 20 questions) and
    idempotent on a second run.
17. **iPhone/PWA install guide.** `/install` is a real public page (it used
    to redirect to `/download`): Safari «Add to Home Screen», Chrome
    Android install, desktop install, post-install behaviour, and the
    Telegram/Instagram in-app-browser note. Linked from the download page,
    Account, and the public footer, and added to the sitemap. Verified at
    360 and 1440 with 44px actions, no horizontal scroll, no console
    errors.
18. **No `@test` on the public surface.** Support/cooperation and the
    legal copy now reference `info@fastenglishpodcast.ir`; the owner can
    change the address in Business settings without a deploy.

## 4. Open findings

### P0 — blocks a real launch (owner inputs, not code)

| # | Finding | Next action |
|---|---|---|
| 1 | ~~`config/site.php` ships `@test` support/cooperation handles~~ **fixed 2026-10-26 pm** | Support and cooperation now default to `info@fastenglishpodcast.ir` (product domain), and the three legal-copy mentions point at the support page instead of a handle. Staff can change the address in `/admin/business-settings`; the owner should confirm the mailbox exists. |
| 2 | No SMTP: password reset and the renewal reminder never deliver | Coolify env `MAIL_*`, then one real send/receive |
| 3 | Content is fixture-only. **Placement questions are no longer the blocker** (20 real items, A1–C1, `PlacementCatalogSeeder`); lessons and audio still are | Owner content (scope §25 item 4) |
| 4 | No real card destination; `SALES_ENABLED=false`, checkout closed | Save destination, review legal copy, then enable sales |
| 5 | No signed APK / TWA metadata; `/download` says «هنوز منتشر نشده» | Keystore, package id, measured SHA-256 |
| 6 | No staging host, no real iPhone/Android proof (AC-19/20/21/22) | Deploy staging, run the device matrix |
| 7 | No LICENSE file | Owner decision |

### P1 — production hardening worth doing before traffic

| # | Finding | Why it matters | Suggested fix |
|---|---|---|---|
| 8 | ~~`ops:status` `recent_errors_24h` is always 0 in production~~ **fixed 2026-10-26 pm** | `LOG_CHANNEL=stderr` means `storage/logs/laravel.log` never exists, so a numeric 0 claimed "no errors" without reading anything | Now prints `recent_errors_24h=unavailable` and points at the container log; read errors in Coolify runtime logs (or add Coolify log alerts). A real in-app counter would need a log file/volume. |
| 9 | No error tracker / alerting | A 500 storm is invisible until someone opens the panel | Add Sentry (or Coolify log alerts) with PII scrubbing; keep receipts/tokens out |
| 10 | No copy of the export lives off the server | A disk failure would still take the library and the one pre-import safety copy together | Download the panel export (`/admin/data-transfer`) to an encrypted off-site location after each release; a nightly `pg_dump` stays the low-level fallback |
| 11 | Approval/rejection emails do not exist | The learner only sees the state by re-opening the payment page; staff notifications are panel-only | Add a `PaymentApproved` / `PaymentRejected` notification (same guarded content as `SubscriptionExpiring`) |
| 12 | No e-mail verification (`MustVerifyEmail` is commented out) | A typo'd address loses access and cannot be recovered without SMTP | Enable verification once SMTP exists, or require confirmation on the first password change |
| 13 | No Content-Security-Policy | Defence in depth against injected scripts | Needs a nonce pipeline for Inertia + Filament inline bootstraps; do not ship a report-only `unsafe-inline` placeholder |
| 14 | ~~CI runs PostgreSQL 16, production is 17~~ **fixed 2026-10-26 pm** | Race/feature behaviour was proven on a different major version | Both jobs now use `postgres:17`; a new `image` job builds the production Dockerfile (CI-only, not executed locally) |
| 15 | Health check is liveness only | A database outage looks healthy | Keep `/up` as liveness, add a separate readiness probe (DB ping) for Coolify/monitoring |
| 16 | No deploy/rollback automation | Rollback is a manual redeploy | Add a Coolify deploy hook + release note; keep `release.sh --check` in the loop |
| 17 | `trustProxies('*')` trusts any `X-Forwarded-*` | Only safe while port 8080 stays behind Coolify's proxy. If it were ever published directly, a spoofed `X-Forwarded-For` would let a client dodge the per-IP login/upload throttles | Keep 8080 internal (Coolify default); if a direct port is ever needed, restrict `trustProxies` to the proxy address |

### P2 — product depth (after launch is unblocked)

1. **Learner email loop** — welcome, payment received, approved, expiring,
   expired. One notification class per event, same content rules.
2. **Gateway** — `PaymentMethods` already resolves a driver map; implement
   the first provider's callback + idempotency once the owner picks one.
3. **Offline premium audio** for active subscribers (PWA cache with
   entitlement check) — currently only the public shell is cached.
4. **Account deletion self-service** — the privacy page promises a support
   request; a real delete/anonymize flow is cheaper to operate.
5. **Usage analytics** (privacy-respecting) — today there is no product
   signal at all: no activation, no completion, no churn.
6. **Search** across topics and lessons (library search exists; the reader
   has none).
7. **Accessibility audit with a real screen reader**, not only contrast and
   keyboard checks.
8. **Staff onboarding runbook** — TOTP enrollment, recovery, roster.

### P3 — engineering papercuts

1. ~~`scripts/browser-lane.sh` runs the container as root, so a browser run
   leaves root-owned files in the worktree (it broke two test runs here).~~
   Fixed 2026-10-26 pm: the lane runs with `--user "$(id -u):$(id -g)"`,
   existing root-owned storage files were re-owned once, and a 9-spec run
   left zero root-owned files.
2. ~~Local `storage/app/private` carries ~16k generated MP3s and 32 GB of
   backup ZIPs.~~ Fixed 2026-10-26: the test suite now fakes both disks
   (`tests/Pest.php`), the orphans and all prior archives were deleted, and
   the panel backup/restore subsystem was replaced by a stateless
   import/export that only carries referenced files.
3. ~~`Dockerfile` repeats `chown -R www-data storage bootstrap/cache
   public/build` twice; one line is enough.~~ Fixed 2026-10-26 pm.
4. `composer.json` still says `"name": "laravel/laravel"` and MIT while the
   repository has no license; align both.
5. BuildKit warns `SecretsUsedInArgOrEnv` on the dummy `APP_KEY` /
   `DB_PASSWORD` build env — the values are placeholders by design; a build
   comment or `# check=skip` keeps CI logs clean.
6. `storage/inertia-devtools` accumulates dev payloads; it is gitignored but
   grows unbounded.

## 5. What would move the needle most

1. Give the owner the three inputs that unblock money: card destination,
   SMTP, approved legal copy. Then `SALES_ENABLED=true` is a setting, not a
   code change.
2. Deploy staging with real SMTP and one real device run (AC-19/21).
3. Add learner email notifications (#11) and a real error signal (#8/#9) —
   the two gaps that make the product feel unmonitored and unresponsive.
4. Only then spend on depth (gateway, offline audio, analytics).

# Fast English — Coolify deployment (S9a/S9b)

Owner performs the Coolify deploy. This file lists names, steps, and
purpose only; no values, no secrets, no real payment data. All fixtures
are labelled TEST/FIXTURE and refuse production (S1/S3/S4/S5/S7 seeders
throw when `APP_ENV=production`; staging may run them).

Scope: sections 16 (private delivery), 19 (deploy/ops), 23 (AC-21, AC-22),
25 (launch inputs). S0–S8 accepted; S9a proves the production image
locally. The owner runs S9b (staging deploy + device run).

Environment template: [`.env.production.example`](../../.env.production.example)
(names and safe defaults only — paste real values into the Coolify secret
store).

## Quick start — two deploy paths (same image, same env)

| Path | What Coolify creates | Status |
|---|---|---|
| **Compose stack** (recommended): [`compose.prod.yml`](../../compose.prod.yml) | One Docker Compose resource: app + PostgreSQL 17 + named volumes. Coolify turns every `${NAME}` into an editable variable and refuses to deploy while a `:?` value is empty. | Tested locally 2026-10-26 end to end: image build → boot → release → §8 probes |
| **Dockerfile application + database resource** (§1–§7) | One application + one PostgreSQL resource; mounts, DB wiring, and the pre-deployment command are UI steps | Image runtime tested locally; UI steps untested |

The Compose path is fewer UI decisions and encodes the database, volumes,
and health checks in a reviewed file. Use §1–§7 when the owner prefers the
UI-managed database resource.

### Bring-up with Compose (owner, in order)

```sh
# 1. Host preflight (no changes). Needs root only for the install step.
scripts/coolify-install.sh --check
sudo scripts/coolify-install.sh --install      # official installer, prints next steps

# 2. Generate APP_KEY + DB password outside the repository.
scripts/coolify-env.sh --domain https://<domain> --out /tmp/fe.env

# 3. Coolify UI: Project → New → Docker Compose (Git repository)
#    Base Directory: /            Docker Compose Location: /compose.prod.yml
#    Domains: Add domain → service `app` → https://<domain>:8080
#    Environment: paste /tmp/fe.env, then add any MAIL_*/SALES_* values.
#    Deploy and wait for the app health check.
```

Then the one explicit release step, in the Coolify app-service terminal:

```sh
sh /var/www/html/docker/release.sh      # migrate --force + ops:status
```

On a **fresh database** the queue and scheduler had no tables during the
first boot, so they exhaust their retries before the release runs. After
the release, restart the app service once (Coolify → Restart). The
workers then start against the migrated schema and stay RUNNING.

Then install the two owner catalogs (idempotent, safe to re-run; they never
overwrite a real card destination or user data):

```sh
php artisan db:seed --class=PlanCatalogSeeder --force
php artisan db:seed --class=PlacementCatalogSeeder --force   # public placement test
```

The placement seeder publishes one current version with 20 items (four per
CEFR band, A1–C1) and retires the previous version. Published versions stay
immutable for attempts pinned to them.

Finally, from the owner machine:

```sh
scripts/coolify-smoke.sh https://<domain>
```

`compose.prod.yml` keeps port 8080 internal, mounts
`storage/app/private` + `storage/app/public` as named volumes (Docker seeds
their ownership from the image), and never runs migrations on boot. The
`${NAME:?}` variables block a deploy instead of silently booting with a
dummy key or password.

### Build network (npm registry)

The image build runs `npm ci` and needs the npm registry. On a host whose
container egress cannot reach `registry.npmjs.org` (this checkout: blocked
2026-10-26), give the build a proxy or a mirror. Local proof used BuildKit's
proxy arguments with host networking:

```sh
docker build --network=host \
  --build-arg HTTP_PROXY=http://127.0.0.1:10808 \
  --build-arg HTTPS_PROXY=http://127.0.0.1:10808 \
  -t fe-prod:local .
```

Coolify passes build arguments from the application settings; `HTTP_PROXY`
and `HTTPS_PROXY` are honoured by BuildKit during `RUN`. Without either,
the deploy fails at the assets stage — that is a network limit, not an
application defect.

## 0. Topology (one app, one database, one origin)

```
Coolify proxy (TLS) → app container :8080 → php-fpm → PostgreSQL 17 (internal)
```

- One application built from the repository `Dockerfile`.
- One PostgreSQL 17 resource on the internal network, no public port.
- Two persistent mounts on the app (section 4). No Redis.
- Processes inside the app container: `nginx`, `php-fpm`,
  `php artisan schedule:work`, `php artisan queue:work` (supervisord).
- Port `8080` must stay internal. The app trusts every proxy header
  (`trustProxies('*')`), so publishing 8080 publicly would let a client
  spoof `X-Forwarded-For` and sidestep the per-IP throttles.

## 1. PostgreSQL 17 resource [untested — Coolify UI only; automatic in the Compose path]

- Compose path: `compose.prod.yml` creates `postgres:17` with a named data
  volume and `pg_isready` health check; nothing to wire in the UI.
- UI path: create a PostgreSQL 17 database resource; Coolify generates the
  password and exposes internal host/port/user/database.
- No public port. Only the application reaches it on the internal
  network. Keep SCRAM auth; `DB_SSLMODE=prefer`.
- Copy the four `DB_*` values plus the internal host into the app env.
- Local emulation [tested]: `postgres:17` container on a private Docker
  network with no published port; `pg_dump` 17.11 drill in S9a-7.

## 2. Application from the Dockerfile [tested — local build + runtime]

- Coolify application type: **Dockerfile**, repository root, file
  `Dockerfile`. Port `8080`.
- Build stages (pinned, in this order):
  - `php:8.4.26-cli-bookworm` installs `vendor/`
    (`composer install --no-dev --optimize-autoloader`).
  - `node:22.23.2` builds the Vite assets (`npm ci --ignore-scripts`,
    `npm run build`). It copies `vendor/` from the previous stage, plus
    `app/`: the Filament admin theme is a Vite input that `@import`s the
    framework's shipped CSS and scans `app/Filament` through Tailwind
    `@source`. **2026-10-26 fix:** without both, the image build failed at
    `Can't resolve '../../../../vendor/filament/filament/resources/css/theme.css'`
    (or silently shipped an admin theme missing app classes). The working
    tree build now passes.
  - Runtime `php:8.4.26-fpm-bookworm` with
    `pdo_pgsql, gd, exif, intl, opcache, zip`, plus `nginx`,
    `supervisord`, `postgresql-client-17`, `curl`.
- Build-time caches (dummy env, no secrets in the image):
  `package:discover`, `config:cache`, `route:cache`, `view:cache`,
  `event:cache`, `filament:optimize`, `storage:link`.
  Verified locally 2026-10-26: every one of those commands exits 0 on the
  current tree, `bootstrap/cache/config.php` and `routes-v7.php` are
  written.
- Runtime user is non-root `www-data` (uid 33), port `8080` [tested].
- `HEALTHCHECK` calls `/up` every 30 s [tested: 200, minimal body].
- Migrations NEVER run on container start. The release runs
  `docker/release.sh` (section 7) once after a fresh export (RUNBOOK §3).
- The entrypoint re-caches config with the real env and only creates
  `public/storage` when it is missing (2026-10-26: the previous
  unconditional `storage:link --force` logged `symlink(): File exists`
  at ERROR level on every boot because `public/` is root-owned in the
  image).

### Known pitfall: workers start before the database

If the container starts while PostgreSQL is still initialising, the
queue worker and the scheduler exit 1. Supervisord defaults to 3 rapid
retries, then puts them in FATAL **for the container's whole lifetime** —
pages keep working, queued jobs and the nightly scheduler do not, and the
health check still says healthy.

- Mitigation in the image: `startsecs=5`, `startretries=10` on both
  programs (about 50 s of tolerance).
- Recovery: restart the application container after the database is up,
  then confirm with `ops:status` and `schedule:list`.
- Order the first deploy DB-first (section 6).

### Edge behavior in `docker/nginx.conf` [tested 2026-10-26]

- `gzip` for HTML/JSON/CSS/JS/SVG/manifest. Measured on the image:
  25,052 B CSS → 5,782 B, 3,353 B HTML → 1,080 B.
- `Cache-Control` split by asset class: `/build/` (Vite content hashes)
  `public, max-age=31536000, immutable`; other static files
  `public, max-age=2592000`; `/storage/` covers immutable; `/sw.js` and
  the manifest stay `no-store` from Laravel.
- Browser-hardening headers on every response (`always`, so 403/404/419
  keep them too): `X-Content-Type-Options: nosniff`,
  `X-Frame-Options: SAMEORIGIN`,
  `Referrer-Policy: strict-origin-when-cross-origin`,
  `Permissions-Policy: camera=(), microphone=(), geolocation=()`,
  `Cross-Origin-Opener-Policy: same-origin`. `Strict-Transport-Security`
  is emitted only when `X-Forwarded-Proto: https` (map `$fe_hsts`), so the
  header never appears over plain HTTP.
- No CSP yet: Inertia hydration and the Filament panel rely on inline
  bootstrap scripts, so a policy needs a nonce pipeline first.

## 3. Environment variables (names, purpose, secret?) [tested — local containers]

Use [`.env.production.example`](../../.env.production.example) as the
checklist. Required/meaningful names:

| Name | Purpose | Secret? |
|---|---|---|
| `APP_ENV` | `production` enables X-Accel delivery + refuses fixtures; `staging` may run labelled fixtures | no |
| `APP_DEBUG` | Must be `false` in production (no trace) | no |
| `APP_URL` | Owner HTTPS origin; canonical/storage URL generation | no |
| `APP_KEY` | Laravel encryption key. **Generate once, never rotate on redeploy** (rotation logs everyone out and breaks encrypted columns) | YES |
| `APP_FALLBACK_LOCALE` | `en` fallback for keys missing from `lang/fa` | no |
| `APP_LOCALE` | Ignored for HTTP (locale is fixed to `fa` in `config/app.php`; staff panel pins `en` per request) | no |
| `BCRYPT_ROUNDS` | Hash cost (12 locally) | no |
| `LOG_CHANNEL`, `LOG_STACK` | `stderr` in production (never file) | no |
| `LOG_LEVEL` | `warning`/`error` prod typical | no |
| `DB_CONNECTION` | `pgsql` only; no SQLite | no |
| `DB_HOST`, `DB_PORT`, `DB_DATABASE`, `DB_USERNAME`, `DB_PASSWORD` | Internal PG17 host/db/user; password secret | password YES |
| `DB_SSLMODE` | `prefer` default | no |
| `SESSION_DRIVER`, `CACHE_STORE`, `QUEUE_CONNECTION` | `database` (no Redis) | no |
| `SESSION_LIFETIME`, `SESSION_ENCRYPT`, `SESSION_PATH`, `SESSION_DOMAIN` | Session behaviour | no |
| `SESSION_SECURE_COOKIE` | `true` in production (HTTPS-only cookie) | no |
| `SESSION_HTTP_ONLY`, `SESSION_SAME_SITE` | `true`/`lax` defaults | no |
| `FILESYSTEM_DISK` | `local` (private `storage/app/private`) | no |
| `MAIL_MAILER` | `smtp` when configured; else `log` (reset disabled in prod) | no |
| `MAIL_HOST`, `MAIL_PORT` | SMTP host/port | no |
| `MAIL_USERNAME`, `MAIL_PASSWORD` | SMTP credentials | YES |
| `MAIL_FROM_ADDRESS`, `MAIL_FROM_NAME` | Sender identity | no |
| `SALES_ENABLED` | Off by default; on only with real prices/destination/terms | no |
| `STAFF_2FA_ENFORCE`, `STAFF_2FA_IDLE_MINUTES` | Staff TOTP enforcement (on in prod) | no |
| `RELEASE_*` | Empty falls back to the measured 1.0.0 values in `config/release.php` when `APP_ENV=production`; set only to override a newer build | no |
| `SW_VERSION`, `TWA_PACKAGE_NAME`, `TWA_SHA256_FINGERPRINT` | Empty production values fall back to the released package + certificate fingerprint; override only when the signing identity changes | no |

Trusted proxies: code trusts `*` (`bootstrap/app.php`) so Laravel sees
HTTPS via `X-Forwarded-Proto` from Coolify's proxy. No env name needed.

Private delivery: `APP_ENV=production` serves audio/receipts via nginx
`X-Accel-Redirect` from internal `/_private/` backed by
`storage/app/private` after the Laravel policy check. External
`/_private/` returns 404 [tested 2026-10-26: 404; audio 200 with exact
bytes, `Cache-Control: no-store, private`, 206 on a byte range, 416
out-of-range]. Covers only come from the public disk
(`/storage` → `storage/app/public`).

Password reset: when `MAIL_MAILER` is not `smtp` or `MAIL_HOST` is empty
in production, `POST /forgot-password` and `POST /reset-password`
short-circuit with the neutral Persian message, send nothing, and log no
token. Staging/dev keep the standard flow.

Logs: `stderr` only; never contain receipts, tokens, or secrets
(`ops:status` prints counts/ages/bytes only). Because there is no file
log, `ops:status` reports `recent_errors_24h=unavailable` rather than a
false `0`; use the Coolify runtime logs (or a Coolify log alert) as the
error signal.

## 4. Persistent mounts [compose: automatic; UI path untested — paths tested locally]

Compose path: two named volumes (`app-private`, `app-public`). Docker seeds
a fresh named volume from the image directory and keeps the `www-data`
ownership the image ships, so the chown below is not needed. Do not replace
them with bind mounts — a host directory arrives root-owned and the app
cannot write.

UI path:

| Container path | Contents | Notes |
|---|---|---|
| `/var/www/html/storage/app/private` | audio `lessons/*.mp3`, receipts `receipts/*`, one `backups/pre-import-*.zip` safety copy | private disk, never public |
| `/var/www/html/storage/app/public` | covers `covers/*` | served read-only via `/storage` |

- Logs go to `stderr` (Docker/Coolify log driver); no file mount needed.
- **Capacity:** the panel export carries only the rows and the files
  those rows reference (lesson audio, receipts, covers), so a normal
  library is a few MB. The volume still holds the library itself plus one
  pre-import safety copy. Download exports off the server; nothing rotates
  them for you.
- After attaching mounts, the first boot must see them owned by
  `www-data` (uid 33). Coolify creates empty volumes as root; run once:
  `docker exec -u root <container> chown -R www-data:www-data storage/app/private storage/app/public`.

## 5. Health check [tested]

- Coolify health check: `GET http://<host>:8080/up` expects 200.
  Body is minimal (status only, no version/env/secret/trace).
  Local proof: `curl -f http://127.0.0.1:8080/up` 200, no `APP_KEY`,
  `DB_PASSWORD`, version, or trace. Forced 500 page shows no stack.
- `/up` is a liveness check: it does not query the database, so a DB
  outage does not restart-loop the container (but it also does not alert).

## 6. First deploy — exact order

1. Create the PostgreSQL resource; wait until it reports healthy.
2. Create the application from the `Dockerfile`; set the port to `8080`.
3. Paste every value from [`.env.production.example`](../../.env.production.example)
   into the app env (Coolify secret store) with the real host, DB, and
   `APP_KEY`.
4. Attach the two mounts (section 4) and fix ownership once (section 4).
5. Set the domain, enable HTTPS, and confirm `APP_URL` matches it exactly.
6. Set the pre-deployment command to `sh /var/www/html/docker/release.sh`
   (section 7). Do not add `migrate` to the entrypoint.
7. Deploy. Confirm the log has no `production.ERROR` and that
   supervisord reports `nginx`, `php-fpm`, `queue`, `schedule` RUNNING.
8. Run the post-deploy checks (section 8). Only then point real traffic
   and only then consider `SALES_ENABLED=true` (section 9).

## 7. Release / migration step [tested locally]

`docker/release.sh` is the one explicit migration step:

```sh
sh /var/www/html/docker/release.sh --check   # show migrate:status + ops:status, change nothing
sh /var/www/html/docker/release.sh           # migrate --force + ops:status
```

It refuses to run unless `APP_ENV=production` and `APP_DEBUG` is off
[tested: staging refused, `APP_DEBUG=true` refused]. Run it after a fresh
backup (RUNBOOK section 3) and before switching traffic.

## 8. Post-deploy verification [tested locally against the image runtime]

Run the packaged probe suite from the owner machine first — it checks the
status codes, hardening headers, gzip, `/_private/` 404, dotfile 404s,
`noindex` on `/login`, `/sw.js` caching, and the immutable asset cache:

```sh
scripts/coolify-smoke.sh https://<domain>
```

Then the same probes by hand, plus the two in-container commands:

```sh
curl -fsS -o /dev/null -w '%{http_code}\n' https://<domain>/up          # 200
curl -fsS -o /dev/null -w '%{http_code}\n' https://<domain>/            # 200
curl -s -o /dev/null -w '%{http_code}\n' https://<domain>/_private/     # 404
curl -fsS -D - -o /dev/null https://<domain>/login | grep -i x-robots   # noindex
docker exec <container> php artisan ops:status                          # counts/ages/bytes only
docker exec <container> php artisan migrate:status                      # nothing pending
```

Then the real checks that only staging/real data can prove: one login,
one audio byte-size match, one receipt row+file, and an export→import
round-trip on a scratch install (RUNBOOK sections 3–4).

## 9. Domain, HTTPS, and launch gates

- Coolify owns the domain, TLS certificate, and HTTPS redirect.
  `APP_URL` must match the public HTTPS origin.
  `SESSION_SECURE_COOKIE=true` requires this; Laravel sees HTTPS because
  the proxy is trusted. No cert files in the repo.
- Keep `SALES_ENABLED=false` until the blocked launch inputs are real:
  card destination (card/holder/bank), approved terms/privacy/refund
  copy, SMTP credentials, real content, owner/teacher sign-off on the
  supplied placement test, brand/domain, APK signing identity, backup
  destination, staff roster. No commercial placeholder ships in public sale.
- Public-surface placeholder check before launch: `/support`,
  `/cooperation`, `/terms`, `/privacy`, `/refund`, and the FAQ must not
  show `@test` or other fixture handles. Since 2026-10-26 the default is
  `info@fastenglishpodcast.ir`; confirm the mailbox exists (or change it in
  Business settings) — see `docs/LAUNCH_INPUTS_FA.md`.

## 10. Export, import, and retention [tested — local suite]

- Owner-facing transfer is the staff panel at `/admin/data-transfer`:
  one ZIP out, one ZIP in. Export covers every domain table (content,
  settings, users, subscriptions, payment records) plus only referenced
  files; import validates format, migration set, paths, and checksums,
  writes one pre-import safety copy, then replaces data in a single
  transaction. [tested: 12-test data-transfer suite]
- Keep one encrypted export off the VPS; rotate ≤30 days (proposal).
- Retention (scheduler, [tested] locally via `schedule:list` + dry run):
  `receipts:retain-reviewed` daily (90-day reviewed/cancelled file delete,
  row kept; pending never touched) + `receipts:cleanup` daily (orphans) +
  `subscriptions:remind-expiring` daily 09:00.
- Raw-DB fallback drill [tested locally]: `pg_dump -Fc` / `pg_restore`
  into an empty PG17 database, verify login (302→200), one audio byte
  size, one receipt row+file. Lab RPO/RTO recorded in the S9 plan entry
  (not a guarantee).
- After restoring, run `receipts:retain-reviewed` before reopening.

## 11. Rollback

1. Redeploy the previous image/tag in Coolify. Never `migrate:rollback`
   financial or progress tables; each sensitive migration ships its own
   forward-compatible path (RUNBOOK section 2).
2. After the rollback, run `docker exec <container> php artisan ops:status`
   and re-run the section 8 probes before reopening traffic.
3. A revoked subscription is never revived by replaying an old approval.

## 12. What is still unproven

- 2026-10-26: `docker build` now **passes locally** (BuildKit + host proxy)
  after the assets-stage fix in §2; the built image boots with PostgreSQL 17,
  runs `release.sh`, and passes the §8 probes. The remaining unproven part
  is the Coolify execution of that same build on the owner's server.
- Coolify UI steps marked [untested]: domain/TLS, scheduled tasks, proxy
  headers. Database and mounts are covered by `compose.prod.yml` locally;
  the UI-resource variants of §1/§4 are still untested.
- Real SMTP, real devices, real APK, real restore destination (launch
  inputs, section 9).

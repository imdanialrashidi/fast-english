# Fast English — Operations Runbook (S9a)

Scope: release, rollback, backup, restore, receipt retention, incidents.
Each step is marked **[tested]** (proven in S8) or **[untested]** (needs a
staging/production rehearsal). Real hosts, credentials, prices, bank
details, SMTP, and signing keys are launch inputs (scope §25) and live
outside this document — never paste them here.

Conventions: one Laravel app, one PostgreSQL database, one origin.
Timestamps UTC in storage, Asia/Tehran on display. Money is integer toman.
Untracked env files hold the real values; `.env.example` lists names only.

## 1. Release

1. Confirm the working tree is the reviewed scope and `composer.lock` +
   `package-lock.json` match the deployed revision. **[untested]**
2. `npm run build` with the pinned Node (22.23.2); confirm
   `public/build/manifest.json` is fresh. **[tested]** (S8 lane)
3. `vendor/bin/pint --test` and the Pest suite on PostgreSQL.
   **[tested]** (223 passed in S8)
4. `php artisan migrate --force` only AFTER a fresh backup (§3).
   **[tested]** (dev-lane migrations, incl. the fe_dev catch-up)
   S9a: this is the ONE explicit migrate command per release, wrapped as
   `sh /var/www/html/docker/release.sh` (refuses non-production and
   `APP_DEBUG=true`; `--check` prints `migrate:status` + `ops:status` and
   changes nothing). Migrations NEVER run on container start (Docker
   ENTRYPOINT runs `config:cache` + `storage:link` only when the public
   link is missing; supervisord starts nginx/php-fpm/schedule/queue).
   **[tested]** (release script: `--check` on the production image,
   staging and debug refusals; entrypoint guard).
5. Set production env: `APP_ENV=production`, `APP_DEBUG=false`,
   `SESSION_SECURE_COOKIE=true`, `SALES_ENABLED` stays `false` until the
   commercial inputs (§25) are in, `STAFF_2FA_ENFORCE` defaults ON in
   production. **[untested]**
6. Point `/download` metadata (`RELEASE_*`) at the real signed build only
   after the APK, versionCode, and SHA-256 are measured — never before.
   **[untested]**

## 2. Rollback

1. Code rollback never reverses data migrations blindly: `migrate:rollback`
   is forbidden on financial/progress tables; each sensitive migration
   ships its own forward-compatible path. **[untested]**
2. To roll back code, redeploy the previous revision + rebuilt assets,
   then run `ops:status` to confirm the queue, disk, jobs, and error log
   are sane before reopening traffic. **[untested]**
3. A revoked subscription is never revived by replaying an old approval
   (S6 race proof); re-approving after a rollback creates no second event.
   **[tested]** (S6 suite, reused)

## 3. Export and off-site copy

The staff panel (`/admin/data-transfer`) is the owner-facing path: one ZIP
out, one ZIP in.

- **Export** carries every domain table (content, plans, settings, users,
  subscriptions, payment records) plus only the files those rows
  reference (lesson audio, receipts, covers). Orphan files on disk are
  excluded, so a normal library produces a few MB — the old archive grew
  to 2.2 GB because it copied every file in `lessons/`. **[tested]**
- **Import** validates format, Laravel major, migration set, allowlisted
  paths, and every checksum before touching data; it then writes one
  automatic pre-import safety copy (only the newest is kept), replaces the
  rows in a single transaction, and rewrites the managed file directories.
  **[tested]** (12-test data-transfer suite)
- Keep one encrypted export copy off the VPS; rotate at most 30 days
  (scope §19.3 proposal). RPO 24h / RTO 4h are proposals until measured.
  **[untested]**
- A raw database dump is still the low-level fallback for disaster
  recovery: `pg_dump -Fc fe_prod`. Drill reference (S8, postgres:17
  image, `pg_dump 17.11`): `pg_dump -U <role> -Fc fe_dev -f
  /tmp/s8-fe-dev.dump` → 78,602 bytes for 2 users + 8 audio lessons.
  **[tested]**
- `APP_KEY` and the Android keystore are recoverable, stored separately
  from source with limited access and a named owner. An export never
  contains either. **[untested]**

## 4. Restore

1. Preferred: import the panel export ZIP on the target install (staff
   panel, `/admin/data-transfer`, with the confirmation checkbox). The
   pre-import safety copy is the undo point. **[tested]**
   Low-level fallback: create an empty database (e.g. `fe_restore`) and
   `pg_restore -U <superuser> -d fe_restore <dump>`. **[tested]**
2. Verify, in order: user count matches, one user logs in over HTTP
   (login POST 302 → account 200), one audio file exists with its byte
   size, one receipt row + file exist. **[tested]** (S8-7 drill:
   login 302→200, audio 160,539 B, receipt 17,735 B)
3. Run `receipts:retain-reviewed` BEFORE reopening a restored copy so
   expired receipt files do not linger (scope §19.3). **[tested]**
   (command proven; restores always run it — the ordering is **[untested]**
   outside the drill)
4. Never widen `pg_hba`; use the existing SCRAM roles. Drill-only access
   uses container-local trust lines that are removed + reloaded
   immediately after, verified back to `scram-sha-256`. **[tested]**

## 5. Receipt retention

- `php artisan receipts:retain-reviewed [--dry-run]` deletes the FILE of a
  receipt reviewed (or cancelled) more than 90 days ago, sets
  `receipt_deleted_at`, and keeps the financial row. Pending receipts are
  never touched (status filter). **[tested]** (S8-8)
- `php artisan receipts:cleanup [--dry-run]` reclaims orphaned files with
  no row. **[tested]** (S5 suite, reused)
- The receipt route 404s once `receipt_deleted_at` is set. **[tested]**

## 6. Monitoring and incidents

- `php artisan ops:status` reports pending-payment count + oldest age +
  stale flag (> 48 h), free disk bytes, failed-jobs count, and the last
  24 h of error-log lines. Production logs to stderr, so when no file log
  exists the error line says `recent_errors_24h=unavailable` instead of a
  misleading `0` — read the container log (Coolify runtime logs) in that
  case. Prints counts/ages/bytes only — never secrets. **[tested]**
  (S8-6; unavailable line 2026-10-26)
- `/up` is the framework health page: up/down status only, no secrets,
  versions, or traces. **[tested]** (S8 health assertion)
- Incident triage: correlate `ops:status` with the log (`LOG_LEVEL`,
  no receipt/bank/answer-key/cookie/token content in logs), pause
  approvals via the staff panel if money looks wrong, restore from §4 if
  data looks wrong. Pager/alerting integration is out of scope (no
  external alerting service in S8). **[untested]**
- Staff session trouble: idle timeout is 30 minutes (config
  `staff2fa.idle_minutes`); TOTP recovery codes are single-use hashes —
  lost codes mean re-setup by the account owner, never a stored-code
  lookup. **[tested]** (S8-3)

## 7. Staff administration

- **Users:** `/admin/users` is the staff support surface (ADM-02). It lists
  learners and staff with their current subscription window, recent payment
  requests and subscription events. Staff never edit a profile, password,
  role or expiry by hand.
- **Suspend/activate:** the user record has explicit actions with a required
  reason. They set/clear `disabled_at` and append `staff.user.suspend` /
  `staff.user.activate` to the application log. Suspension does not rewrite
  the subscription; reactivation restores the same window. Staff cannot
  suspend themselves. **[tested]** (admin users suite)
- **Grant/revoke:** use the same actions on the user record or a payment
  request. Both go through `ApprovePayment` with the same lock order, reason
  and event audit. **[tested]**
- **Staff bootstrap:** `staff:bootstrap {email} --by="<owner>" --password="<one-time>"`
  now requires an explicit password; it never generates an unprintable
  random secret. The creator is logged. **[tested]**
- **Lost 2FA:** `staff:2fa-reset {email} --by="<owner>" --reason="<why>"`
  clears only the TOTP secret/recovery codes/confirm timestamp and logs the
  recovery (`staff.2fa.reset`); the password is untouched. The account
  re-enrols on its next panel visit. **[tested]**
- **Step-up boundary:** `/admin/*` (including Livewire updates), staff
  placement publish, `/staff/transfer/*`, the staff audio-preview route and
  the staff branch of the receipt route all require a passed TOTP session.
  The owner receipt path remains challenge-free. **[tested]**
- **Times:** the panel displays stored UTC timestamps in Asia/Tehran. Do not
  add `dateTime()` columns without the global `FilamentTimezone` setting;
  the regression suite asserts the payment record shows `22:44:23` for a
  `19:14:23` UTC row. **[tested]**
- **Retention:** a retained receipt row is still visible in the payment
  queue, but the panel says the file was removed by the 90-day policy (and
  the learner status page has no dead link) instead of rendering a broken
  image. **[tested]**

# Production Launch Readiness — Fast English Podcast

Status: active (planning only; no deployment performed)
Updated: 2026-08-15

## Goal

Produce an executable production release plan for Fast English Podcast from the current
release candidate on `main`, classifying every launch item as READY / BLOCKED / UNPROVEN /
HUMAN INPUT REQUIRED, with exact deployment, backup/rollback, smoke, and Android
device procedures. No deployment, DNS change, production mutation, or privileged
credential creation was performed during this audit.

## Non-goals

- No application code changes (version bump and seeding scripts are *planned*, not
  implemented, here).
- No advisor plans, historical exec plans, CI optimization, visual polish, or unrelated
  repo debt unless they block launch.
- No fabrication: no invented DNS values, prices, credentials, legal copy, contact
  info, or signing secrets.

## Acceptance contract

- [x] A1 — Exact release candidate pinned with authoritative CI evidence — proof:
      commit SHA `a7fd8e2` on `main`; GitHub run 31875991797: static ✓, backend ✓,
      e2e 1–5/5 ✓, verify ✓ (2026-08-15).
- [x] A2 — Every launch item classified exactly once (READY/BLOCKED/UNPROVEN/HUMAN
      INPUT REQUIRED) — proof: classification table in this plan and final report.
- [x] A3 — Deployment procedure verified against the real scripts, not just docs —
      proof: `deploy/install.sh`, `configure.sh`, `deploy.sh`, `backup.sh`,
      `restore-drill.sh`, `smoke-prod.sh`, `ops-check.sh`, Caddyfile, systemd units
      all read and cross-checked against `docs/DEPLOYMENT.md` (consistent; gaps
      listed in Risks).
- [x] A4 — Backup/rollback procedures exact and non-destructive to user data — proof:
      procedure below; `pb_data` untouched by rollback; migration non-reversibility
      documented with pre-deploy backup as the fallback.
- [x] A5 — Production smoke journey covers the required path (Landing → signup →
      durable record → logout/login → receipt → staff approval → activation →
      placement → Home → Library → playback → progress → Account → reload → logout)
      plus Admin isolation, published-content access, assets, PWA, API health,
      no critical errors — proof: smoke procedure below (API-level via
      `deploy/smoke-prod.sh` + real-browser journey).
- [x] A6 — Next execution task defined with stop points — proof: "Next execution task"
      section.

## Confirmed current state (2026-08-15, audited from repo + GitHub)

- **Release candidate:** `main` @ `a7fd8e2` (merge of PR #8 = `fix/ci-fast-uri-audit`
  tree `caed987`; includes fast-uri 3.1.5 advisory fix). Local checkout
  `fix/ci-fast-uri-audit` == RC tree, worktree clean. Local `origin/main` fetched to
  `a7fd8e2`.
- **CI on the exact RC:** run 31875991797 ALL LANES SUCCESS (static incl. `pnpm audit
  --prod --audit-level high`, backend = `scripts/project-verify.sh` with 16 parallel
  real-PocketBase smoke suites + deterministic builds + topology/PWA/Android/deploy
  checks, e2e 5/5 shards, verify). The immediately preceding `main` run at `11a549f`
  FAILED; the 3-commit fix branch is now merged and green.
- **Version identity:** Android 1.0.0 / versionCode 1 / `com.fastenglishpodcast.app`
  (gradle ↔ capacitor ↔ APK filename ↔ `releases/release-metadata.json` consistent).
  Web surfaces embed version from `package.json` = **0.0.0** (`data-app-version` on
  `#root`, telemetry `appVersion`) → MISMATCH vs APK 1.0.0. Admin has no version
  define. Server: PocketBase 0.39.9 pinned (`server/VERSION`).
- **APK:** `releases/fast-english-podcast-v1.0.0.apk` (gitignored, local only) —
  apksigner v2 (RSA 4096), zipalign 4, sha256 `e358b5c4…fdc2c5`; RELEASE-NOTES and
  metadata consistent. Signing key custody = open (see HUMAN INPUT).
- **Server layout / units / Caddy:** `deploy/` package complete and audited:
  `/opt/fast-english/{releases,current,shared/{pb_data,backups,releases,logs,secrets,scripts},bin}`;
  `fastenglish` non-root service user; hardened `fast-english-pocketbase.service`
  (loopback 127.0.0.1:8090, ProtectSystem=strict, ReadWritePaths=pb_data,
  UMask=0077, `--origins` app+admin+`https://localhost` for the APK WebView);
  `fast-english-backup-copy.{service,timer}` 02:40 UTC; Caddyfile: 4 domains,
  www→308, `/releases/*` APK hosting (immutable cache), `/api/*` → 8090 (6MB bodies;
  64MB on content-import paths), `/_/` → 404 on public domains, security headers
  (X-Content-Type-Options, Referrer-Policy, X-Frame-Options, HSTS, `-Server`),
  token-redacted rotated access logs, **no CSP (documented deferral)**.
- **Backups:** PB cron 02:30 UTC keep 14 (`configure.sh`) + copy to `shared/backups`
  keep 14; `backup.sh` verifies size + storage tree; `restore-drill.sh` restores into
  a disposable instance, fail-closed (superuser auth + every collection of
  the current contract: 16 product collections + `_superusers` — fep_users,
  plans, payment_destination, payment_requests, subscriptions,
  placement_questions, placement_attempts, topics, lessons, lesson_progress,
  staff_admins, categories, lesson_vocabulary, content_imports,
  content_operations, site_settings. NOTE: `rate_limits` is NOT a collection —
  migrations 1700000001/0005 only tune PB settings). The stale-list defect
  found by the audit was fixed in this slice, and
  `tests/restore-drill-collections.test.mjs` re-derives the list from the
  migrations so it cannot silently go stale again.
  **Off-VPS destination is a documented Gate requirement** (S3 via `FEP_BACKUP_S3_*`
  or approved equivalent) — not configured.
- **Migrations:** 26 committed JS migrations (1700000000-1700000026, incl.
  the new `site_settings` collection); applied on normal startup; **not
  automatically reversible**; rollback restores the previous static release only;
  pre-deploy backup (`deploy.sh` step 4) is the migration-rollback fallback.
- **DNS:** none of `fastenglishpodcast.com`, `www`, `app`, `admin` resolve
  (verified 2026-08-15) → no public domains, no certificates yet.
- **Business data in repo:** owner-approved launch plans are committed in
  `seeds/business/plans.json` (monthly 299,000 toman/30 days; quarterly 807,300
  toman/90 days = 10% off 3x monthly; NO yearly plan) and seeded via
  `pnpm seed:plans`. `payment_destination` schema (no card values yet) and a
  DEMO placement bank (`seeds/placement/demo-bank.v1.json`, kind=demo, 20
  questions) with a guarded seeding tool (`pnpm seed:placement` — demo to
  production requires --confirm-production + --allow-demo). `site_settings`
  singleton holds the canonical support/collaboration contact. Content pipeline:
  demo public-sample package `content-packages/typical-workday-sample/` matches
  the Landing promise (deterministic test); `content-packages/` still contains
  only example/sample packages. Smoke/e2e seed disposable data only;
  `server/pb_data/` is local dev data, gitignored, never shipped (bundle gate
  scans for dev addresses).
- **Staff bootstrap:** `pnpm staff:bootstrap` (script `staff-bootstrap.mjs`) exists;
  requires running PB + `FEP_PB_SUPERUSER_*`/`FEP_STAFF_*`. First staff admin not yet
  created (no production PB exists).
- **Landing:** 9 routes, canonical/sitemap/robots, APK CTA (honest "coming soon"
  until `VITE_ANDROID_APK_URL` set), app CTA → `VITE_WEB_APP_URL` (default
  `https://app.fastenglishpodcast.com`), privacy/terms marked `needs-review`.
  Business Configuration slice: real plan prices + support/collaboration contact
  are fetched at RUNTIME from `/api/fast-english/public/settings` (scoped Caddy
  handle on the landing domain; `VITE_SUPPORT_URL` removed); iOS install section
  (`/install#ios`) with honest Safari flow — no App Store/direct-install claim.
- **Telemetry:** OFF by default (in-memory ring buffer only); beacon sink only when
  `VITE_TELEMETRY_ENDPOINT` set at build time. No RUM → field Web Vitals unproven
  (lab baseline exists).
- **Known doc drift (minor):** `deploy/env.production.example` documents
  `FEP_SMOKE_STUDENT_*` but `smoke-prod.sh` generates its own disposable users
  (only `FEP_SMOKE_STAFF_*` used); ARCHITECTURE.md CORS list mentions the landing
  origin but the unit's `--origins` (authoritative) intentionally omits it (landing
  is static, makes no API calls).

## Launch-item classification

| # | Item | Class | Evidence / requirement |
|---|---|---|---|
| 1 | Authoritative full CI on exact RC | READY | Run 31875991797 all green on `a7fd8e2` |
| 2 | Version identity (Landing/App/Admin/server/Android) | BLOCKED | `package.json` 0.0.0 vs APK 1.0.0; bump to 1.0.0 + rerun `check-android-version.mjs` + CI; admin version optional |
| 3 | Server layout, service user, systemd, Caddy, health checks, disk | READY (tooling) | `deploy/` audited; execution needs VPS (below) |
| 4 | VPS / SSH access + ports 80/443 | BLOCKED | No credentials/access in this environment. Owner expects the VPS to be purchased in Iran; NO provider/server selected yet (HUMAN INPUT REQUIRED — tooling must not choose one) |
| 5 | DNS records (root, www, app, admin) | BLOCKED | None resolve today; create A/AAAA + CNAMEs per docs §1 |
| 6 | HTTPS / canonical redirects / cert renewal | READY (config) | Caddy auto-HTTPS + www 308 + HSTS; **ACME contact email is `ops@example.com` placeholder — replace** (HUMAN INPUT REQUIRED) |
| 7 | Security headers | READY | nosniff/Referrer-Policy/XFO/HSTS set; CSP intentionally absent (documented deferral — decision: accept or add later) |
| 8 | Production env-var inventory / secrets vs config | READY | `deploy/env.production.example` + `.env.example` (names only, complete) |
| 9 | First production Staff Admin bootstrap | READY (tooling) / HUMAN INPUT | `pnpm staff:bootstrap`; operator picks staff identity/credentials |
| 10 | Superuser creation + `PB_ENCRYPTION_KEY` | READY (tooling) / HUMAN INPUT | `install.sh` from secrets file; key must be set before first `configure.sh` |
| 11 | SMTP | READY (default) | Honest disabled state (`smtp.enabled=false`); enable only with approved provider |
| 12 | Plans + prices | READY (decision + tooling) / HUMAN INPUT for seeding | Owner decision 2026-08-15: TWO plans — monthly 299,000 toman/30 days, quarterly 807,300 toman/90 days (=10% discount); NO yearly plan anywhere. `seeds/business/plans.json` + `pnpm seed:plans` (explicit target guards); editable anytime via Admin Business Settings |
| 13 | Card-to-card destination (card number, holder, bank, instructions, review ETA, support contact) | READY (Admin Business Settings surface) / HUMAN INPUT for values | Edit in Admin → تنظیمات → تنظیمات کسبوکار (staff-guarded routes); review ETA defaults to «حداکثر تا ۲۴ ساعت»; no card data in repo |
| 14 | Placement questions | READY (tooling + demo data) / HUMAN INPUT for reviewed bank | `seeds/placement/demo-bank.v1.json` (kind=demo, 20Q) + `pnpm seed:placement` with demo→production guards; the FINAL REVIEWED bank remains HUMAN INPUT REQUIRED (commit as kind=reviewed and seed with --replace) |
| 15 | Minimum launch content (published Episodes/Variants + artwork/audio) | READY (pipeline + demo sample) / HUMAN INPUT for library | Demo public-sample package `content-packages/typical-workday-sample/` matches the Landing promise (deterministic test); import via `pnpm content:import`; FINAL library quantity remains HUMAN INPUT REQUIRED |
| 16 | Support/contact URL | READY (configurable) / HUMAN INPUT for value | Canonical `site_settings.support_contact` edited in Admin Business Settings; consumed at runtime by Landing support+collaboration pages; unset = honest «هنوز اعلام نشده»; `VITE_SUPPORT_URL` removed |
| 17 | Privacy & Terms final copy | HUMAN INPUT REQUIRED | Pages keep `data-legal-status="needs-review"` until approved copy replaces placeholders |
| 17b | Student payment simplification | READY | Form = plan → destination → receipt → submit; no bank-reference/last-4/transfer-time fields, no confirmation checkbox; receipt validation/duplicate-submit/approval server contracts unchanged (smoke-payment green) |
| 17c | iOS install experience | READY | «نصب روی iPhone / iPad» CTA → /install#ios; honest Safari flow; no fake App Store/direct-install claim |
| 18 | Telemetry endpoint decision | READY (default OFF) | Deferred; safe launch posture; beacon + RUM later |
| 19 | Pre-deploy backup + retention + restore proof | READY (tooling); execution UNPROVEN | `backup.sh`/`restore-drill.sh`; must run on the real server; off-VPS destination required (Gate) |
| 20 | Off-VPS backup destination (S3 or approved) | BLOCKED | `FEP_BACKUP_S3_*` credentials/approval |
| 21 | Failure-injection rollback drill (staging twin) | UNPROVEN | Gate requirement; not run |
| 22 | Android release config (versionCode/versionName, signing gate, prod API origin, download URL) | READY | gradle 1/1.0.0, fail-safe signing gate, `resolveApiOrigin` native-prod = `https://app.fastenglishpodcast.com`, Caddy `/releases/*` |
| 23 | Android signing keystore custody + durable backup | HUMAN INPUT REQUIRED | v1.0.0 cert SHA-256 recorded; future updates MUST reuse the same cert; confirm who holds the keystore + backup location |
| 24 | Android physical-device verification | BLOCKED | No device attached (`adb devices` empty); full checklist in procedure below |
| 25 | Production smoke across real domains | READY (tooling); execution BLOCKED | `smoke-prod.sh --full` (58 scenarios) + real-browser journey below |
| 26 | Rollback procedure (non-destructive to user data) | READY | `deploy.sh` auto-rollback + manual §6 procedure below |
| 27 | Removal/exclusion of test users, fixtures, fake content, dev config | READY | Smoke/e2e disposable-only; bundle gate scans dev addresses; `releases/` gitignored; example-episode never auto-imported |
| 28 | Owner placeholders in ops docs + ACME email | HUMAN INPUT REQUIRED | 6 docs `<TODO: operator>` + Caddyfile email |

## Final assessment (5 buckets)

1. **Repository readiness: GO** — RC `a7fd8e2` fully green on the canonical gate;
   deployment/ops/Android tooling complete and audited. One required code change
   before release build: version identity bump (0.0.0 → 1.0.0).
2. **Infrastructure readiness: NO-GO (blocked)** — no VPS access, no DNS records
   (verified non-resolving), no off-VPS backup destination, failure-injection drill
   not run.
3. **Business/configuration readiness: NO-GO (blocked on human inputs)** — prices,
   destination card, 20 placement questions, launch content, support URL, privacy/
   terms copy, first staff admin, ACME contact, operator names.
4. **Android readiness: CONDITIONAL** — artifact + tooling + gates READY and
   verified; physical-device gate BLOCKED (needs a device); keystore custody must be
   confirmed.
5. **Live-production readiness: NO-GO** — nothing has been deployed or exercised
   over the real domains; DNS/server must exist first.

## Verdict

**NO-GO for live launch today.** The repository and tooling are release-ready
(CI green on the exact RC); launch is blocked by infrastructure (VPS/DNS/off-VPS
backup), business data (prices/card/questions/content/legal/support), Android
device verification, and keystore custody confirmation. Every blocker is an
operator action with an exact procedure below — no engineering blocker remains
except the version-identity bump.

## Ordered deployment procedure (exact, from audited scripts)

Pre-flight (all HUMAN):
1. Provide VPS (Debian/Ubuntu/Arch, x86_64, ≥1 GiB RAM, ≥10 GB free), SSH access,
   operator email for ACME, and create DNS: `fastenglishpodcast.com` + `www` +
   `app` + `admin` → server IP (www → canonical root 308 handled by Caddy).
2. Fill server secrets `/opt/fast-english/shared/secrets/pocketbase.env`
   (root:root 0600): `FEP_SUPERUSER_EMAIL`, `FEP_SUPERUSER_PASSWORD`,
   `PB_ENCRYPTION_KEY` (32 chars, BEFORE first configure), optional
   `FEP_BACKUP_S3_*` (off-VPS backup), `FEP_SMOKE_STAFF_EMAIL/PASSWORD`.
3. Replace Caddyfile ACME contact email; replace `<TODO: operator>` in the 6 ops
   docs (docs/DEPLOYMENT, OPERATIONS, BACKUP_RESTORE, INCIDENT_RUNBOOK,
   PRODUCTION_CHECKLIST, ANDROID_RELEASE).
4. Commit the version-identity bump (`package.json` → 1.0.0), let CI go green on
   the new RC, then build the release bundle with production values:
   `VITE_WEB_APP_URL=https://app.fastenglishpodcast.com`,
   `VITE_ANDROID_APK_URL=https://fastenglishpodcast.com/releases/fast-english-podcast-v1.0.0.apk`,
   `VITE_ANDROID_APK_VERSION=1.0.0`; `pnpm build`
   + `bash scripts/verify.sh` + `scripts/check-production-bundle.sh`, stage bundle
   `<id>/{landing,app,admin,server,android}` incl. `RELEASE.json`.

Server (as root, from repo deploy/):
5. `bash deploy/install.sh` → user/topology/binary (PB 0.39.9)/units/Caddyfile/
   superuser; `systemd-analyze verify` the unit.
6. `caddy validate --config /etc/caddy/Caddyfile && caddy fmt --overwrite`.
7. `bash deploy/configure.sh` → settings (backups cron keep 14, trustedProxy,
   smtp off/approved, S3 when approved).
8. `bash deploy/backup.sh` → initial verified backup BEFORE first release.
9. `bash deploy/deploy.sh /path/to/bundle` → bundle+APK checksum verify → disk →
   pre-deploy backup → immutable install → atomic `current` symlink → PB restart
   (migrations on startup) → health → caddy reload → publish APK+metadata → smoke.
10. `systemctl enable --now caddy`; `bash deploy/restore-drill.sh`;
    `bash deploy/smoke-prod.sh --full`; `bash deploy/ops-check.sh`; wire ops-check
    into cron (07:17 daily).
11. Seed production business data: `pnpm seed:plans --target=production
    --confirm-production --yes` (the two owner-approved plans); Admin →
    تنظیمات → تنظیمات کسبوکار for destination card + support contact; placement:
    the reviewed bank (HUMAN INPUT) via `pnpm seed:placement --file … --replace
    --target=production --confirm-production --yes` (demo bank is never seeded
    to production without explicit --allow-demo); staff admin via
    `pnpm staff:bootstrap`; import content packages via `pnpm content:import`
    (incl. the demo public-sample package for /sample), verify
    `is_active`/published flags.

## Backup and rollback procedure (exact)

- Backup: `bash deploy/backup.sh [name]` (authenticates via secrets file; verifies
  size + storage tree; copies to `shared/backups`, keeps 14). Automatic: PB cron
  02:30 UTC (keep 14) + copy timer 02:40 UTC. Pre-deploy backup runs automatically
  in `deploy.sh` (step 4). Off-VPS copy: configure `FEP_BACKUP_S3_*` (approved
  bucket) via `configure.sh` and verify with a restore drill; local-only copies do
  NOT satisfy the Gate.
- Restore proof: `bash deploy/restore-drill.sh [backup]` — restores newest ZIP into
  a disposable temp instance with the same binary + current migrations/hooks;
  fail-closed on health/superuser-auth/collection counts. Never touches live
  `pb_data`.
- Rollback (automatic): any post-switch failure in `deploy.sh` (PB restart, health,
  caddy reload, mandatory smoke) triggers the EXIT-trap rollback to the previous
  release (exit 2; exit 3 if rollback itself fails). Manual: read
  `/opt/fast-english/.current.previous`, `ln -sfn "$OLD" current.tmp && mv -Tf
  current.tmp current`, `systemctl restart fast-english-pocketbase`, health check,
  `systemctl reload caddy`, `smoke-prod.sh --quick`.
- **Rollback never touches `pb_data`** (student data, subscriptions, receipts,
  progress are preserved). Migrations are NOT automatically reversible: rolling
  back past a release that introduced migrations requires hook/migration
  compatibility verification or restoring the pre-deployment backup
  (`docs/BACKUP_RESTORE.md`).

## Production smoke procedure (exact)

1. API/asset/entitlement layer: `bash deploy/smoke-prod.sh --full` against the real
   domains (58 scenarios): landing routes/canonicals/sitemap/robots/APK checksum +
   Content-Length + CTA; app loads + manifest + SW + no localhost; signup/login/
   refresh; pending-denial; receipt upload + protected preview + pending state;
   staff queue/detail/preview/approve → activation; placement; lessons + audio
   200/206/seek + progress save/resume/continue; entitlement (expired/future/
   suspended/wrong-role); admin domain (redirect, operator API, `/_/` 404).
   Disposable accounts deleted by cleanup.
2. Real-browser journey (manual + optionally a Playwright script against prod):
   Landing → open app → signup (phone+name+password) → verify durable Student
   record → logout → login → choose plan → upload receipt (JPEG/PNG ≤5MB) →
   logout; Staff admin on `admin.fastenglishpodcast.com` → queue → review receipt →
   approve → student activates → placement (20 Qs, resume once, submit) → Home
   (continue/featured/progress) → Library (filters/pagination) → Episode playback
   (play/pause/seek/mini-player) → progress persists after reload → Account →
   reload (session restore) → logout. Also: Admin isolation (student cannot reach
   admin routes/API), published-content visibility (pending/expired denied),
   static/media assets load, PWA install + offline shell, `api/health` 200 on app
   and admin, browser console/network free of critical errors (devtools/Playwright
   assertions).
3. Log redaction proof: `bash deploy/test-log-redaction.sh` + live grep
   (`token=FAKE` absent, `[REDACTED]` present).

## Android physical-device release procedure (exact)

1. Human: physical Android device (API ≥24; low-to-mid range preferred) with USB
   debugging; `adb devices` shows it; operator confirms keystore custody + backup
   before any build.
2. Build: export `FEP_ANDROID_KEYSTORE_PATH/KEY_ALIAS/KEYSTORE_PASSWORD/
   KEY_PASSWORD`; `pnpm android:check:version`; `pnpm android:build:release`
   (fails safely without signing material); `pnpm android:verify:release`
   (apksigner v2, zipalign 4, aapt badging, sha256 → metadata).
3. Install: `adb install -r releases/fast-english-podcast-v1.0.0.apk` (or sideload
   from the public `/releases/` URL after deploy; verify sha256).
4. On-device checklist (each with evidence): first launch (no SW interference,
   `isNativePlatform` true), signup → login, receipt upload, pending state,
   placement 20Q, Home/Library, Episode playback: audio plays + seeks; background/
   foreground resume honest (no invented position); lock screen/media controls
   (Media Session — the documented UNPROVEN area); interruptions (call/notification
   pause); progress persists after app relaunch; session restore; upgrade path
   (install v1.0.1 test build over v1.0.0 with same cert, versionCode+1) — only
   after v1.0.0 ships.
5. Record results against `docs/ANDROID_RELEASE.md` §7; gate closes when every
   checklist item passes on hardware.

## Risks / blockers

- Migration rollback limitation (schema may stay newer than rolled-back hooks) —
  mitigate: pre-deploy backup + `restore-drill.sh` before every deploy.
- No CSP on launch (documented) — accepted risk; add post-launch after testing
  against App/PWA/audio flows.
- APK signed with a key whose custody/backup is unconfirmed — if lost, future
  updates cannot install over v1.0.0 (new cert = fresh install only).
- `package.json` 0.0.0 in any artifact that reaches production before the bump
  would make web/telemetry version diagnostics lie vs the APK.
- Field Web Vitals unproven (no RUM); lab baseline only — acceptable at launch,
  revisit with the telemetry decision.
- FEP_SMOKE_STUDENT_* doc drift (unused by smoke-prod.sh) — harmless; clean when
  touching deploy docs.

## Decisions deferred

- Telemetry beacon endpoint / RUM provider.
- CSP policy.
- SMTP provider (stays disabled).
- Receipt retention policy beyond the 90-day proposal (backups keep 14).
- Placement questions, plan prices, destination card, launch content set — all
  operator-owned (HUMAN).
- Admin console version marker (optional polish; not launch-blocking).

## Handoff / next execution task

- State: audit complete; RC CI green; plan written. No code changed, nothing
  deployed. Working tree clean on `fix/ci-fast-uri-audit` (== RC tree).
- Smallest first implementation action (after approval): create
  `feat/release-identity-v1` from `main`; bump `package.json` `version` to
  `1.0.0`; run `pnpm android:check:version` (must pass: metadata 1.0.0 matches),
  `pnpm verify:fast`; push; confirm the full CI gate green on the new commit; then
  build the production bundle per the deployment procedure §4 and stage it.
  Stop after CI is green and the bundle + `release-metadata` are produced —
  deployment itself requires the operator (DNS/VPS/secrets).

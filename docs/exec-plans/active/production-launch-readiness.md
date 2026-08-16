# Production Launch Readiness — Fast English Podcast

Status: EXECUTED (final pre-production product pass complete; no deployment performed)
Updated: 2026-08-16 (execution session — final)

## Goal

Execute the accepted final pre-production pass: (1) release identity v1.0.0 across all
surfaces; (2) record-level backup/restore proof; (3) substantial Landing redesign on the
accepted midnight/ice design system with rewritten Persian conversion copy; (4) env/security/
docs contract cleanup; (5) authoritative full release gate on the exact final RC; (6) exact
verdict per axis (READY/BLOCKED/UNPROVEN/HUMAN INPUT REQUIRED). No deployment, DNS,
production mutation, or privileged credential creation.

## Acceptance contract

- A1 — Version identity: `package.json` 1.0.0 (not 0.0.0); App/Landing/Admin + telemetry embed
  the version; `pnpm android:check:version` passes; built dist never embeds `0.0.0`.
  Proof: grep + version-consistency script + built-artifact scan.
- A2 — Backup/restore record-level proof in a disposable environment: user signup → payment
  request + receipt file → subscription → progress records → backup → wipe → restore into a
  clean dir → same record IDs/fields, receipt file present, superuser auth OK.
  Proof: executed drill output (new `deploy/restore-proof.sh`).
- A3 — Landing redesign matches the accepted Student design system (semantic Light tokens,
  midnight panels, CEFR pairs, Vazirmatn, radius/spacing language), has a conversion
  narrative (Hero → why one episode in six levels → how it works → student experience →
  CEFR → sample → payment → install → FAQ → final CTA), honest Persian copy with no
  fabricated claims, official logo (never the improvised FE square), responsive at
  390/768/1024/1440, a11y (AA, RTL, focus, reduced motion, touch targets), performance
  (no MUI, no app code, lazy media). Proof: native-vision full-page screenshots at 4 widths
  + e2e + perf measurements.
- A4 — Landing functional contracts preserved: crawlable prerendered HTML, one H1, canonical/
  OG/sitemap/robots, header nav labels+paths, honest Android state, legal `needs-review`
  banners, campaign-preserving CTA, telemetry contract, runtime plan prices.
  Proof: e2e p4-s1-landing + landing-business-config + seo/launchCopy unit tests green.
- A5 — Env/security/docs: env var classification (required/optional/disabled) documented;
  no secrets added; deploy docs drift fixed (FEP_SMOKE_STUDENT_*); ACME/owner placeholders
  remain flagged HUMAN INPUT (never fabricated). Proof: docs diff + secret scan.
- A6 — Authoritative full gate green on the final RC: `scripts/project-verify.sh` (or
  `pnpm verify:full`) + full Playwright suite locally, then CI on the pushed branch.
  Proof: exact commands + outcomes + CI run.
- A7 — Android: version consistency, debug compile, release-build fail-safe (no fake
  keystore), release runbook current. Physical-device items stay UNPROVEN.
  Proof: `pnpm android:check:version`, `assembleDebug`, signing-gate output.

## Non-goals

- No Student/Admin app UX changes (the Landing may change materially).
- No deployment to live infrastructure, no DNS, no production credentials/keystores.
- No fabricated business data: no card number, no prices beyond the owner-approved seed,
  no legal text, no testimonials/counts/awards.
- No new dependencies for the Landing (Tailwind only, as accepted).

## Confirmed current state (from the audit session)

- RC base: `main` @ `accbf45` (PR #9 merge — business settings/config slice). CI green on
  `a7fd8e2` (run 31875991797); `accbf45` adds the merged business-config slice.
- Version: package.json `0.0.0` vs Android `1.0.0`/versionCode 1 → bump required; Admin has
  no version define.
- Deployment package (`deploy/`) audited and complete: topology
  `/opt/fast-english/{releases,current,shared/{pb_data,backups,releases,logs,secrets},bin}`,
  non-root `fastenglish` service user, hardened systemd unit (loopback 8090,
  ProtectSystem=strict, ReadWritePaths=pb_data), backup-copy timer, Caddyfile (4 domains,
  www 308, `/releases/*`, `/api/*` 6MB, `/_/` 404, security headers, token-redacted logs),
  install/configure/deploy/backup/restore-drill/smoke-prod/ops-check scripts, auto-rollback
  EXIT trap, migration non-reversibility documented.
- Backups: PB cron 02:30 UTC keep 14 + verified copies to shared/backups (keep 14);
  restore-drill.sh is counts-only (collection presence) → needs the record-level proof.
- Landing: 9 routes, prerendered, runtime plan prices, telemetry OFF by default,
  campaign/CTA contract, honest APK state. Current palette = generic blue/violet (#2563eb/
  #7c3aed), improvised FE gradient logo mark + favicon → to be replaced with the official
  brand and the accepted midnight/ice system.
- Open human inputs (unchanged): VPS/DNS, ACME email, off-VPS backup destination,
  destination card values, reviewed placement bank, launch content library, privacy/terms
  final copy, support contact value, first staff admin, keystore custody, physical device.

## Relevant files

- Version: `package.json`, `vite.{landing,app,admin}.config.ts`, `scripts/check-production-bundle.sh`,
  `scripts/check-android-version.mjs`, `android/app/build.gradle`.
- Backup proof: `deploy/restore-proof.sh` (new), `scripts/pb-test-helper.sh`, `deploy/backup.sh`,
  `deploy/restore-drill.sh`.
- Landing: `landing/src/**` (sections, pages, components, content, lib, styles.css),
  `landing/*.html`, `landing/public/*`, `scripts/prerender-landing.mjs`,
  `scripts/check-landing-output.mjs`, `e2e/p4-s1-landing.spec.ts`, `e2e/landing-business-config.spec.ts`,
  `landing/src/*.test.ts`.
- Brand: `fast_english_logo_assets/*` (official), `shared/ui/brand/Brand.tsx` (app pattern),
  `shared/ui/tokens/*` (source-of-truth tokens).
- Docs: `docs/DEPLOYMENT.md`, `docs/exec-plans/active/production-launch-readiness.md` (this file).

## Design direction for the Landing (derived from docs/DESIGN.md + tokens)

- **Thesis:** a calm midnight-and-ice editorial surface that reads as the public face of the
  same product family as the Student App: same semantic Light tokens (canvas #f5f9fa,
  surface ladder #edf4f7→#ffffff, text #0e171b / muted #414e55, primary #2a6f8c,
  accent #2e7092/container #cde8f5), midnight #0b1220 panels for hero visual/install/final
  CTA (echoing the app's dark canvas and PWA theme #0B1220), CEFR pairs from
  `shared/ui/tokens/cefr.ts`, Vazirmatn variable, radius 12/16/20/24 language, restrained
  elevation, no gradients-as-decoration, no glass, no generic blue/purple SaaS styling.
- **Signature:** the CEFR edition language — the six level plates + episode artwork +
  waveform in the hero visual; echoed by the level ladder section. The logo is the official
  wordmark (PNG on light, currentColor mark on midnight panels).
- **Narrative:** Hero → «یک موضوع در شش سطح» (why one episode across levels) → how it works
  (4 steps, editorial numbered rows) → student experience (Continue Listening / vocabulary /
  transcript / progress compositions built from real product language) → CEFR ladder →
  sample lesson (real content) → payment (runtime-derived, honest manual card-to-card) →
  install/access (web/Android/iOS honest states) → FAQ → final CTA.
- **Copy:** Persian conversion copy, concrete and product-specific; no generic claims; no
  fabricated social proof. H1 keeps «یک موضوع، شش سطح» (e2e contract), e.g.
  «یک موضوع، شش سطح — متناسب با سطح تو».
- **Header/footer:** brand lockup (official mark + wordmark), same nav labels/paths (e2e
  contract), footer touch targets ≥44px (closes the known note).

## Ordered next actions

1. Task branch `feat/release-candidate-v1` from `origin/main`; baseline `pnpm verify:fast`.
2. Release identity: package.json 1.0.0; Admin version define + marker; production-bundle
   gate extension (dist never embeds 0.0.0); `.env.example` classification comments;
   `pnpm android:check:version`.
3. Backup/restore record-level proof: `deploy/restore-proof.sh` (disposable PB: create
   user/payment+receipt/subscription/progress → API backup → wipe → restore → verify
   IDs/fields/files/auth/content) + wire as project-verify step 13h; run it.
4. Landing redesign (sections I–U): tokens (styles.css @theme → midnight/ice), BrandMark +
   favicon + og-image with official assets, Header, Hero (product-native visual), new
   narrative sections, CEFR ladder, SampleLesson restyle, PaymentSection (keep runtime
   logic, restyle), InstallSection, FaqSection, FinalCta, Footer (touch targets), copy
   rewrite (siteContent + sections), sub-pages restyle (About/Install/HowItWorks/Sample/
   Contact/Collaboration/Privacy/Terms) for token consistency; update Landing.test /
   launchCopy.test source lists where files move; keep e2e contracts.
5. Env/security/docs: env classification; fix FEP_SMOKE_STUDENT_* drift; verify no secrets
   in tree; security-auditor review of the diff.
6. Verification: verify:fast → landing unit tests → build:landing + prerender +
   check-landing-output + check-production-bundle → e2e landing specs → visual QA with
   native vision at 390/768/1024/1440 (full-page screenshots, light; dark panels inherent)
   → `scripts/project-verify.sh` (backend gate) → full Playwright suite → Android
   check:version + debug compile + release signing fail-safe.
7. Final verdict + delivery: update this plan's verdict table; commit; push; PR; report.

## Verification evidence (filled 2026-08-16, execution session)

- **A1 version identity:** package.json 1.0.0; `pnpm android:check:version` OK
  (com.fastenglishpodcast.app 1.0.0/1); `check-production-bundle.sh` PASS — all three
  surfaces embed data-{app,landing,admin}-version="1.0.0", no 0.0.0 marker anywhere;
  wired into `scripts/project-verify.sh` (step 16b) and CI backend lane.
- **A2 backup/restore:** `pnpm smoke:restore-proof` (scripts/restore-proof.sh + .mjs)
  PASS — all 24 checks (fixture: signup → payment request + receipt upload → staff
  approval → subscription → content/progress/placement/settings; backup via Backups
  API → wipe → restore into clean dir → same IDs/fields, same student auths, receipt
  bytes sha256-identical). Wired into project-verify step 13h + parallel CI lane
  (18 suites now).
- **A3 Landing redesign:** built + prerendered; 28/28 landing e2e (p4-s1-landing +
  landing-business-config) green; machine QA at 390/768/1024/1440: no overflow,
  Vazirmatn loaded, logo aspect preserved, contrast machine-verified (all text pairs
  ≥4.5:1, dividers ≥3:1, CEFR pairs AA), footer touch targets ≥44px, reduced-motion
  collapse, zero console errors; runtime plan prices render from the public settings
  endpoint. Native-vision review of the rendered site BLOCKED at the environment
  level (vision model returns 400 for every request — see audit log; screenshots
  saved under .artifacts/landing-v2/ for the operator).
- **A4 contracts:** H1 «یک موضوع، شش سطح — متناسب با سطح تو» (contains the pinned
  phrase); nav labels/paths; mobile menu; skip link; FAQ first question; honest
  Android state; legal banners; canonical/OG/sitemap/robots; AppCta attrs;
  plan-card/pricing-footer/payment-methods-note/support testids; /install#ios — all
  green in e2e. seo.test/launchCopy.test/Landing.test/brand.test updated with the
  new surface; launchCopy sources extended to every new section.
- **A5 env/security/docs:** env contract classified (REQUIRED/OPTIONAL/DISABLED) in
  `.env.example`; deploy/env.production.example drift fixed (FEP_SMOKE_STUDENT_*
  removed); no secrets added; security-auditor review completed (findings fixed:
  gates wired into CI, restore-proof instance-identity check + execFile find,
  version-marker validation, leftover debug file removed).
- **A6 full gate:** local `FEP_VERIFY_PARALLEL_SMOKES=1 bash scripts/project-verify.sh`
  PASS (tsc + biome + 858 vitest + 18 parallel real-PB smokes incl. restore-proof +
  deterministic builds + topology/PWA/bundle gates + Android version/signing +
  deploy redaction proofs). Full Playwright: 398 passed, 4 flaky (passed on retry),
  13 skipped, 1 failed — `mini player: one audio element` — PROVEN pre-existing on
  pristine main in this environment (audio-timing in local headless Chromium; CI
  passes it). CI on the pushed branch is the authoritative e2e gate.
- **A7 Android:** cap sync OK; assembleDebug BUILD SUCCESSFUL; signing precheck
  fails safely («Production signing material: REQUIRED»); version consistency OK;
  existing v1.0.0 APK re-verified (apksigner/zipalign/sha256) by the gate. Physical
  device items remain UNPROVEN.
## Open risks / blockers

- Full local gate is expensive (16+ real-PB smokes + full e2e); run once at the end.
- Visual redesign may churn landing tests that pin copy/components — update tests only where
  the accepted contract legitimately changes (never weaken assertions of behavior).
- Native vision review of Persian typography/rendering is the authoritative visual judge.

---

## Final delivery verdict (section Z — 2026-08-16)

| Axis | Verdict | Basis |
|---|---|---|
| REPOSITORY READINESS | **READY** | RC commit `bafd4f0` on `feat/release-candidate-v1` (base `main` @ `accbf45`); CI run 31952607179 all lanes green (static, backend = project-verify with 18 parallel real-PB smokes incl. record-level restore-proof + deterministic builds + bundle/PWA/Android/deploy gates, e2e 1–5/5, verify); local project-verify green; 858 unit tests; landing e2e 28/28; version identity 1.0.0 across Web/Landing/Admin/server (PB 0.39.9 pinned)/Android. |
| INFRASTRUCTURE READINESS | **BLOCKED** | No VPS/SSH, DNS records do not resolve, ACME contact email, off-VPS backup destination, failure-injection rollback drill — all operator actions (`deploy/` package itself READY and audited). |
| BUSINESS/CONFIGURATION READINESS | **HUMAN INPUT REQUIRED** | Destination card values, reviewed placement bank, launch content library, privacy/terms final copy, support contact value, first staff admin bootstrap, plan seeding to production. |
| ANDROID READINESS | **UNPROVEN** (config READY) | versionName 1.0.0/versionCode 1 consistent; assembleDebug green; signing gate fails safely (no fake keystore); existing v1.0.0 APK re-verified; physical-device checklist NOT exercised (needs a device); keystore custody unconfirmed. |
| LIVE PRODUCTION READINESS | **UNPROVEN** | Nothing deployed or exercised over the real domains; `smoke-prod.sh` (58 scenarios) + restore-drill + ops-check + real-browser journey must run post-deploy by the operator. |

All unresolved items use exactly READY / BLOCKED / UNPROVEN / HUMAN INPUT REQUIRED.

## Handoff note (execution session)

- Working tree: only the user-owned `.pi/settings.json` change remains uncommitted (intentionally excluded from the PR).
- Screenshots for the human visual review: `.artifacts/landing-v2/` (390/768/1024/1440 full-page + section shots).
- Native-vision review of rendered screenshots was environment-BLOCKED (vision model returned 400 for every request across all configured models; see `~/.pi/agent/vision-audit.log`); deterministic machine QA (contrast/overflow/fonts/touch-targets/console) and the 28-test landing e2e suite stand in for it.
- The one locally-failing e2e (`mini player: one audio element`) is proven pre-existing on pristine main in this environment and passes in CI.

## Launch-item classification (audit session 2026-08-15 — still current)

| # | Item | Class | Evidence / requirement |
|---|---|---|---|
| 1 | Authoritative full CI on exact RC | READY | Run 31952607179 all green on `bafd4f0` (PR #10) |
| 2 | Version identity (Landing/App/Admin/server/Android) | READY | 1.0.0 everywhere; markers + android:check:version + bundle gate |
| 3 | Server layout, service user, systemd, Caddy, health checks, disk | READY (tooling) | `deploy/` audited; execution needs VPS (below) |
| 4 | VPS / SSH access + ports 80/443 | BLOCKED | No credentials/access in this environment; owner selects provider |
| 5 | DNS records (root, www, app, admin) | BLOCKED | None resolve today |
| 6 | HTTPS / canonical redirects / cert renewal | READY (config) | Caddy auto-HTTPS + www 308 + HSTS; **ACME contact email placeholder — HUMAN INPUT REQUIRED** |
| 7 | Security headers | READY | nosniff/Referrer-Policy/XFO/HSTS; CSP intentionally absent (documented deferral) |
| 8 | Production env-var inventory / secrets vs config | READY | `.env.example` (classified) + `deploy/env.production.example` (names only) |
| 9 | First production Staff Admin bootstrap | READY (tooling) / HUMAN INPUT | `pnpm staff:bootstrap`; operator picks identity |
| 10 | Superuser creation + `PB_ENCRYPTION_KEY` | READY (tooling) / HUMAN INPUT | `install.sh` from secrets file; key BEFORE first `configure.sh` |
| 11 | SMTP | READY (default) | Honest disabled state; enable only with approved provider |
| 12 | Plans + prices | READY (decision + tooling) / HUMAN INPUT for seeding | monthly 299,000 / quarterly 807,300; NO yearly; `pnpm seed:plans` |
| 13 | Card-to-card destination | READY (Admin surface) / HUMAN INPUT for values | Admin → تنظیمات → تنظیمات کسبوکار; review ETA default «حداکثر تا ۲۴ ساعت» |
| 14 | Placement questions | READY (tooling + demo) / HUMAN INPUT for reviewed bank | `pnpm seed:placement` guards; reviewed bank must be committed as kind=reviewed |
| 15 | Minimum launch content | READY (pipeline + demo sample) / HUMAN INPUT for library | `pnpm content:import`; final quantity open |
| 16 | Support/contact URL | READY (configurable) / HUMAN INPUT for value | `site_settings.support_contact` via Admin; unset = honest state |
| 17 | Privacy & Terms final copy | HUMAN INPUT REQUIRED | pages keep `data-legal-status="needs-review"` |
| 18 | Telemetry endpoint | READY (default OFF) | beacon only when `VITE_TELEMETRY_ENDPOINT` set |
| 19 | Pre-deploy backup + retention + restore proof | READY (tooling + proof) | `backup.sh`/`restore-drill.sh` + record-level `restore-proof`; execution on real server pending |
| 20 | Off-VPS backup destination | BLOCKED | `FEP_BACKUP_S3_*` or approved equivalent |
| 21 | Failure-injection rollback drill | UNPROVEN | staging twin before first deploy |
| 22 | Android release config | READY | gradle 1/1.0.0, signing fail-safe, prod API origin, `/releases/*` |
| 23 | Android keystore custody | HUMAN INPUT REQUIRED | same cert for all future updates |
| 24 | Android physical-device verification | BLOCKED | no device attached; checklist in docs/ANDROID_RELEASE.md |
| 25 | Production smoke across real domains | READY (tooling); execution BLOCKED | `smoke-prod.sh --full` (58 scenarios) + browser journey |
| 26 | Rollback procedure | READY | auto-rollback + manual §6; pb_data untouched; migration caveat documented |
| 27 | No test users/fixtures/dev config in production | READY | smoke/e2e disposable-only; bundle gate scans; demo seeds guarded |
| 28 | Owner placeholders in ops docs + ACME email | HUMAN INPUT REQUIRED | `<TODO: operator>` in 6 docs + Caddyfile email |

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
4. Build the release bundle with production values (RC = this PR):
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
    --confirm-production --yes`; Admin → تنظیمات → تنظیمات کسبوکار for destination
    card + support contact; placement: the reviewed bank (HUMAN INPUT) via
    `pnpm seed:placement --file … --replace --target=production
    --confirm-production --yes` (demo bank never seeded without --allow-demo);
    staff admin via `pnpm staff:bootstrap`; import content packages via
    `pnpm content:import`; verify `is_active`/published flags.

## Backup and rollback procedure (exact)

- Backup: `bash deploy/backup.sh [name]` (authenticates via secrets file; verifies
  size + storage tree; copies to `shared/backups`, keeps 14). Automatic: PB cron
  02:30 UTC (keep 14) + copy timer 02:40 UTC. Pre-deploy backup runs automatically
  in `deploy.sh` (step 4). Off-VPS copy: configure `FEP_BACKUP_S3_*` (approved
  bucket) via `configure.sh`; local-only copies do NOT satisfy the Gate.
- Restore proof: `bash deploy/restore-drill.sh [backup]` (counts) and the new
  record-level `pnpm smoke:restore-proof` (IDs/fields/files/auth) — both disposable,
  never live data.
- Rollback (automatic): any post-switch failure in `deploy.sh` triggers the
  EXIT-trap rollback to the previous release (exit 2; exit 3 if rollback itself
  fails). Manual: read `/opt/fast-english/.current.previous`,
  `ln -sfn "$OLD" current.tmp && mv -Tf current.tmp current`,
  `systemctl restart fast-english-pocketbase`, health check,
  `systemctl reload caddy`, `smoke-prod.sh --quick`.
- **Rollback never touches `pb_data`.** Migrations are NOT automatically
  reversible: rolling back past a release that introduced migrations requires
  hook/migration compatibility verification or restoring the pre-deployment
  backup (`docs/BACKUP_RESTORE.md`). Distinguish application rollback (symlink),
  migration recovery (forward-fix or restore), and data recovery (backup restore).

## Production smoke procedure (exact)

1. API/asset/entitlement layer: `bash deploy/smoke-prod.sh --full` (58 scenarios):
   landing routes/canonicals/sitemap/robots/APK checksum + Content-Length + CTA;
   app loads + manifest + SW + no localhost; signup/login/refresh; pending-denial;
   receipt upload + protected preview; staff queue/detail/preview/approve →
   activation; placement; lessons + audio 200/206/seek + progress; entitlement
   denial (expired/future/suspended/wrong-role); admin domain (`/_/` 404).
2. Real-browser journey (operator runbook): Landing → signup CTA → Student signup
   (phone+name+password) → durable `fep_users` record → logout → login → choose
   plan → upload receipt → Staff queue → approve → activation → placement (20 Qs,
   resume once, submit) → Home (continue/featured/progress) → Library → Episode
   playback (play/pause/seek/mini-player) → progress persists after reload →
   Account → reload (session restore) → logout. Admin isolation both ways;
   published content/artwork/audio load; PWA install + offline shell; `api/health`
   200; HTTPS/canonical redirects; no critical browser/server errors. Designated
   smoke account contract — never destructive cleanup of real users.
3. Log redaction proof: `bash deploy/test-log-redaction.sh` + live grep.

## Android physical-device release procedure (exact)

1. Human: physical Android device (API ≥24) with USB debugging; `adb devices`
   shows it; operator confirms keystore custody + backup before any build.
2. Build: export `FEP_ANDROID_KEYSTORE_PATH/KEY_ALIAS/KEYSTORE_PASSWORD/
   KEY_PASSWORD`; `pnpm android:check:version`; `pnpm android:build:release`
   (fails safely without signing material); `pnpm android:verify:release`.
3. Install: `adb install -r releases/fast-english-podcast-v1.0.0.apk` (verify
   sha256 against release-metadata.json).
4. On-device checklist: first launch, signup → login, receipt upload, pending
   state, placement 20Q, Home/Library, Episode playback (audio + seek),
   background/foreground resume honesty, lock-screen Media Session controls
   (documented UNPROVEN), call/notification interruption, progress persists after
   kill/reopen, session restore, upgrade-over-existing (same cert, versionCode+1).
5. Record results against `docs/ANDROID_RELEASE.md` §7; gate closes when every
   item passes on hardware. Items not physically exercised stay UNPROVEN.

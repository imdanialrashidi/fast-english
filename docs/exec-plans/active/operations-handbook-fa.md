# Persian Operations Handbook Package

Status: ACTIVE
Updated: 2026-08-16

## Goal

Ship a complete professional Persian operations, administration, training, and
ownership handbook for Fast English Podcast so a new operator, content manager,
business owner, or technical maintainer can run the platform correctly without
tribal knowledge. Every instruction must match the real implemented product
(audited repo + rendered Admin UI), with exact Persian labels, routes, status
names, and commands.

## Non-goals

- No invented workflows, roles, or permissions that do not exist in the product.
- No Admin redesign, no new product features (one small static Help route is
  explicitly allowed by the task brief).
- No secrets, tokens, test credentials, or fake business values in any document.
- No claims about unverified capabilities (e.g., physical-device Android gate,
  S3 off-VPS copy, reviewed placement bank — all still open).

## Acceptance contract

- A1 — `docs/OPERATOR_MANUAL_FA.md`: roles, operator manual, payment operations
  (statuses + SOP + exception handling), student account ops, placement ops,
  content management training + publishing checklist, content import,
  business settings, landing ops, daily/weekly/monthly routines, support
  templates, escalation matrix, onboarding course.
  Proof: file exists; every UI label/route/status verified against `admin/src`
  and `server/pb_hooks`; verification pass maps each referenced label to a
  source hit.
- A2 — `docs/TECHNICAL_OWNER_RUNBOOK_FA.md`: topology, server layout, first
  install vs normal deployment, rollback, backup/restore, monitoring,
  superuser safety, Android operations.
  Proof: commands match `deploy/*.sh`, `docs/DEPLOYMENT.md`,
  `docs/BACKUP_RESTORE.md`, `docs/OPERATIONS.md`, `docs/ANDROID_RELEASE.md`.
- A3 — `docs/OPERATOR_QUICK_REFERENCE_FA.md` + `docs/LAUNCH_DAY_CHECKLIST_FA.md`
  consistent with the manual.
  Proof: status labels and URLs cross-checked against A1/A2 sources.
- A4 — Static Admin Help surface (`/help` → راهنما) with payment workflow,
  status meanings, publishing checklist, escalation rules, and a pointer to the
  full manual; no API, no new dependencies.
  Proof: `pnpm typecheck`, `pnpm test` (new help test), `pnpm build:admin` pass;
  rendered screenshot of the help route.
- A5 — No secrets/fake values; no instruction referencing a nonexistent
  button/route. Proof: secret-pattern scan over the new files; rendered Admin
  screenshots (sanitized test data only) confirm documented labels.
- A6 — Verification: `pnpm verify:fast` + `pnpm build:admin` locally; affected
  e2e admin specs; GitHub CI `quality` as the authoritative full gate.

## Confirmed current state (audit summary)

- One Staff Admin model: `staff_admins` auth collection (email, password,
  display_name, is_active). `requireStaffAdmin` = collection + `is_active`.
  Legacy `fep_users` role-based operator/content_manager tokens are rejected.
  No role-based permission separation in the product.
- Admin routes: /login, / (داشبورد), /payments(/), /payments/:requestId,
  /content, /content/categories, /content/episodes(+new/:id), .../variants/:level,
  /content/import, /content/preview/:episodeId, /settings. Nav: داشبورد / محتوا /
  ورود محتوا / پرداختها / تنظیمات + خروج.
- Payment statuses: pending=در انتظار, approved=تأیید شده, rejected=رد شده,
  cancelled=لغو شده. Account statuses: pending_payment=در انتظار پرداخت,
  payment_rejected=پرداخت رد شده, active=فعال, expired=منقضی شده,
  suspended=معلق. Subscription: active=فعال, expired=منقضی شده.
- Content statuses: draft=پیشنویس, published=منتشر شده, archived=آرشیو شده.
  Readiness: آماده انتشار / آماده انتشار نیست. Import wizard steps: انتخاب
  بسته / بررسی / برنامه ورود / تأیید.
- Student app: خانه/کتابخانه/پیشرفت/حساب; سطح پیشنهادی vs سطح پیشفرض;
  placement 20 questions; CEFR is not an access boundary.
- Deploy: releases/<id> immutable, `current` symlink, shared/pb_data outside
  releases, deploy.sh exit codes 0/1/2/3, pre-deploy backup
  `fep-backup-predeploy-*`, auto-rollback after symlink switch, migrations not
  auto-reversible. Backups: 02:30 UTC cron keep 14; backup-copy 02:40 UTC;
  backup.sh / restore-drill.sh / restore-proof; S3 off-VPS = gate requirement,
  still open. Monitoring: ops-check.sh (exit 0/1/2), systemd, journald, Caddy
  rotated logs; no monitoring platform. Superuser: `/_/` public 404, SSH
  tunnel only, hideControls=true. Android: v1.0.0, versionCode 1,
  com.fastenglishpodcast.app, FEP_ANDROID_* signing env, physical-device gate
  NOT RUN. Landing reads prices/contact at runtime from
  GET /api/fast-english/public/settings.
- Open/HUMAN INPUT REQUIRED (must be stated honestly, not documented as done):
  VPS+DNS, destination card values, reviewed placement bank, final library,
  privacy/terms copy, keystore custody, S3 credentials, physical-device Android
  check, support contact value, operator identities.

## Relevant files/systems

- Admin: `admin/src/` (shell, routes, features/payments, features/content,
  features/settings)
- Server: `server/pb_hooks/*.pb.js`, `server/pb_migrations/*.js`
- Deploy: `deploy/*.sh`, `deploy/systemd/*`, `deploy/Caddyfile`
- Docs: `docs/PRODUCT.md`, `docs/ARCHITECTURE.md`, `docs/DEPLOYMENT.md`,
  `docs/OPERATIONS.md`, `docs/BACKUP_RESTORE.md`, `docs/INCIDENT_RUNBOOK.md`,
  `docs/ANDROID_RELEASE.md`, `docs/CONTENT_PIPELINE.md`
- Student: `app/src/features/*`, `app/src/app/copy/productCopy.ts`
- Landing: `landing/src/sections/*`, `landing/src/lib/siteConfig.ts`

## Ordered next actions

1. Write `docs/OPERATOR_MANUAL_FA.md` (sections 1–13 + 21 + glossary).
2. Write `docs/TECHNICAL_OWNER_RUNBOOK_FA.md` (sections 14–20).
3. Write `docs/OPERATOR_QUICK_REFERENCE_FA.md` and
   `docs/LAUNCH_DAY_CHECKLIST_FA.md`.
4. Add static Admin Help route (`/help`, nav item راهنما) + drift-guard unit
   test.
5. Render Admin screens (login/dashboard/payments/settings/help) via Playwright
   with sanitized test data; verify documented labels.
6. Verify: `pnpm typecheck`, `pnpm test`, `pnpm build:admin`, `pnpm verify:fast`,
   affected e2e specs; scan new files for secrets.
7. Commit on `feat/release-candidate-v1` (reuse), push, open/update PR; report.

## Verification evidence

- Label/route cross-check list (grep hits per documented label).
- Screenshots of rendered Admin screens (sanitized).
- verify:fast + build:admin + affected e2e results.
- Secret scan of new files.

## Open risks/blockers

- Docs may drift from future code; the Help page is intentionally a short
  pointer, not a duplicate.
- No production server exists; all deploy commands are documented from the
  repo package and labeled as such.

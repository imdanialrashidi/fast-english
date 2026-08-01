# Architecture Decisions

Durable constraints only. Not a diary.

## Current system
- Runtime/platform: Linux dev; Node LTS; pnpm; Vite; React + TypeScript strict; PocketBase (Go, embedded SQLite); Capacitor (no Ionic); Caddy; systemd.
- Main modules: `landing/` (static, Tailwind), `app/` (MUI product app), `server/` (PocketBase migrations + hooks), `android/` (Capacitor), `scripts/`.
- Data stores: PocketBase SQLite (`server/pb_data/`, git-ignored, never committed).
- External services: none required (no payment provider, no SMS, no CDN font).
- Deployment topology: `fastenglishpodcast.com` (static), `app.fastenglishpodcast.com` (app + `/api/*` reverse proxy), `admin.fastenglishpodcast.com` (PocketBase dashboard), PocketBase bound `127.0.0.1:8090`, Caddy HTTPS, systemd, daily backup + off-VPS copy.

## Repository/build topology
- One repo, one root `package.json`, one `pnpm-lock.yaml`. No workspace/monorepo framework.
- Two isolated Vite configs (clearest isolated outputs + separate dep sets):
  - `vite.landing.config.ts` → builds `landing/` → `dist-landing/` (Tailwind allowed here only).
  - `vite.app.config.ts` → builds `app/` → `dist-app/` (MUI only).
- Shared: small `shared/brand.ts` brand constants + CSS variables only. No shared cross-surface component framework.
- Capacitor `webDir = "dist-app"` only.
- Commands (defined at Phase 0): `pnpm dev:landing`, `pnpm dev:app`, `pnpm build:landing`, `pnpm build:app`, `pnpm build` (both), `pnpm typecheck`, `pnpm check` (Biome), `pnpm test` (Vitest), `pnpm smoke` (Playwright + PocketBase), `scripts/verify.sh`.

## API and environment topology
- Browser/PWA production: same-origin `https://app.fastenglishpodcast.com/api/*`; Caddy reverse-proxies `/api/*` → PocketBase `127.0.0.1:8090`.
- Android release: bundled local assets; API base = explicit `https://app.fastenglishpodcast.com` (NOT `window.location.origin` — bundled APK has no shared browser origin).
- Browser dev: Vite `/api` proxy → local PocketBase.
- Android dev: `adb reverse tcp:8090 tcp:8090` + `VITE_ANDROID_API_ORIGIN=http://localhost:8090`.

## Phone as user-facing identity
- PB 0.39 forces `email` into `passwordAuth.identityFields` for any auth collection. Setting `identityFields=["phone"]` via migration is reverted on save. The pragmatic resolution: the user-facing identity is the phone (normalized to `+989XXXXXXXXX` server-side), the hook auto-derives a stable internal email `<canonical_phone>@fep.local`, and the app SDK calls `pb.collection('fep_users').authWithPassword(derivedEmail, password)`. The phone field has a unique index and is the field used in all UI/API input.
- One env-aware API-base resolver; no secrets in env vars or client bundle.
- PocketBase CORS allowlist: only `https://app.fastenglishpodcast.com`, `https://fastenglishpodcast.com`, Capacitor origin. No wildcard CORS in production.
- No Capacitor native HTTP patching unless real-device evidence proves normal HTTPS/upload fails.

## Trust boundaries and critical data flows
1. Client (browser/APK) → Caddy → PocketBase `/api/*`. All authz server-side.
2. Signup: client sends phone/name/password(+optional email) → PB normalizes phone, enforces uniqueness, sets `role=student`, `account_status=pending_payment`.
3. Payment: client sends `plan_id` + transfer fields + receipt image → PB validates, snapshots plan, stores receipt in protected file field, creates `pending` request.
4. Operator approve: PB verifies operator role, compares externally, in one transaction sets request `approved` + creates/extends subscription (idempotent via unique subscription→request link).
5. Premium content: PB hook/endpoint checks authenticated + not suspended + active subscription + published before returning lesson body/audio; never returns correct placement answers.

## Non-negotiable invariants
- Client never sets role/account_status/subscription/payment/review/server-calculated fields.
- Phone canonical `+989XXXXXXXXX` stored; uniqueness enforced server-side.
- One pending payment request per user; resubmit only after rejection.
- Approval + subscription in one transaction; repeated approval idempotent (no double duration).
- Receipt: one image, JPEG/PNG/WebP, ≤5MB, signature/MIME/extension match; protected field, randomized name, no public URL, no URL in logs.
- Correct placement answers never sent to client; grading server-side only.
- Premium body/audio denied to pending/rejected/expired/suspended even via direct API.
- Premium audio is streamed through the lesson audio proxy with a short-lived PB file token passed as a query parameter (an `<audio>` element cannot send custom headers). The proxy re-validates live entitlement on every request, so a leaked token grants nothing beyond the owner's current entitlement; it is never stored in the app.
- Operator endpoints verify operator role server-side; UI guard is not authz.
- PWA SW never caches `/api/` or private/premium data.
- No secrets in source/bundles/logs/fixtures; `server/pb_data/` never committed.

## Chosen patterns
| Area | Decision | Why | Revisit when |
|---|---|---|---|
| Auth identity | PB auth collection, `phone` as `PasswordAuth.IdentityFields` | Native password auth, no custom crypto | PB changes identity field semantics |
| Migrations | `pb_migrations/` JS files committed | Reproducible schema | PB major version bump |
| Server logic | PB hooks (JS) for authz/transaction/grading | Single backend, no custom Node | Logic exceeds PB hook limits |
| Remote state | TanStack Query | Server state only | Local state needs grow |
| Forms | React Hook Form + Zod | Validation at boundaries | — |
| Icons | MUI icons only (no Lucide) | Avoid second icon set | MUI icons insufficient (justify) |
| Routing | React Router declarative SPA | Simple, stable | SSR needs (rejected for MVP) |
| RTL | MUI RTL Stylis plugin + Emotion cache + `dir` on theme/document/portals | Official MUI RTL | — |
| Font | Self-hosted Vazirmatn variable WOFF2 | No runtime CDN | License change |
| Android | Capacitor no Ionic, bundled assets | Single codebase | — |

## Explicitly rejected complexity
- Next.js/SSR/Astro, Docker, GraphQL, microservices, custom Node backend, workspace/monorepo framework, Lucide (unless justified), Capacitor native HTTP patch (unless evidenced), runtime CDN font, public receipt URLs, wildcard production CORS, SMS OTP, email verification.

## Operational baseline
- Configuration/secrets: `.env` git-ignored; `.env.example` documents names only; no secrets in client bundle; production secrets live in `/opt/fast-english/shared/secrets/pocketbase.env` (root:root 0600, names documented in `deploy/env.production.example`).
- Migrations: `pb_migrations/*.js` committed; `server/VERSION` pins PocketBase binary 0.39.9; migrations+hooks are loaded from the selected release (`current` symlink) by the systemd unit; migrations run on normal startup; migrations are NOT automatically reversible (documented rollback limitation).
- Deployment: immutable releases under `/opt/fast-english/releases/<id>`, atomic `current` symlink, `pb_data` outside releases, `deploy/deploy.sh` with pre-deployment backup + health checks + smoke + automatic rollback; previous release never deleted.
- Backup/restore: PocketBase automatic backups daily 02:30 UTC (`backups.cron`), keep 14 (`cronMaxKeep`), verified copies moved off `pb_data` at 02:40 UTC (`fast-english-backup-copy.timer`), S3 backups bucket only when credentials are approved; restore drill on a disposable instance (`deploy/restore-drill.sh`); initial verified backup before every first deploy.
- Logging: non-sensitive logs; no receipt URLs/PII in logs; Caddy access logs rotate (10×10MiB, 30 days) and filter `request>uri` with the official query filter replacing the `token` query parameter with `[REDACTED]` (proven by `deploy/test-log-redaction.sh`); `log_credentials` is never enabled (Authorization/Cookie redacted by Caddy defaults); PocketBase `logs.maxDays=30`, `logAuthId=false`.
- Security: PocketBase binds 127.0.0.1:8090 only (systemd `ProtectSystem=strict`, non-root `fastenglish` user); the superuser Dashboard `/_/` is 404 on public domains and reachable only over an SSH tunnel; Caddy request bodies bounded to 6MB on `/api/*` (5MB receipt + documented margin); CORS restricted to the two public HTTPS origins; superuser IP whitelist recommended once the operator IP is known.
- Rollback: symlink flip + PocketBase restart + Caddy reload; static release rollback never touches `pb_data`; APK rollback = previous versioned APK (immutable filenames, old files never overwritten).
- Production deployment package: `deploy/` (Caddyfile, systemd units, install/configure/deploy/backup/restore-drill/smoke/ops/log-redaction scripts, env template) — validated locally; actual deployment requires DNS + server access (see `docs/DEPLOYMENT.md` §9, Gate open).

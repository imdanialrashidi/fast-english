# Architecture Decisions

Durable constraints only. Not a diary.

## Current system
- Runtime/platform: Linux dev; Node LTS; pnpm; Vite; React + TypeScript strict; PocketBase (Go, embedded SQLite); Capacitor (no Ionic); Coolify (self-hosted) + Traefik + Docker (production); nginx in frontend images.
- Main modules: `landing/` (static, Tailwind), `app/` (MUI product app), `admin/` (Staff console), `server/` (PocketBase migrations + hooks), `android/` (Capacitor), `scripts/`, `docker/`, `infra/`.
- Data stores: PocketBase SQLite (`server/pb_data/` dev, `/opt/fast-english/shared/pb_data` production bind mount, git-ignored, never committed).
- External services: none required (no payment provider, no SMS, no CDN font).
- Deployment topology (self-hosted): `fastenglishpodcast.com` → Landing (nginx 8080, owns root; API only exact public-settings path → PB directly); `app.fastenglishpodcast.com` → Student App (nginx owns root; `/api/*` → PB directly); `admin.fastenglishpodcast.com` → Admin (nginx owns root; `/api/*` → PB directly); PocketBase internal `127.0.0.1:8090` only (no public hostname, no public 8090), Traefik path routing, immutable `sha-<commit>` GHCR images, daily backup + off-VPS copy.
- One repo, one root `package.json`, one `pnpm-lock.yaml`. No workspace/monorepo framework.
- Three isolated Vite configs provide distinct isolated outputs and separate dependency sets — `vite.landing.config.ts` → `dist-landing/` (Tailwind allowed here only), `vite.app.config.ts` → `dist-app/` (MUI only), and `vite.admin.config.ts` → `dist-admin/` (MUI, Staff console, no PWA).
  - `vite.landing.config.ts` → builds `landing/` → `dist-landing/` (Tailwind allowed here only).
  - `vite.app.config.ts` → builds `app/` → `dist-app/` (MUI only).
  - `vite.admin.config.ts` → builds `admin/` → `dist-admin/` (MUI, Staff console, no PWA).

Each uses an isolated `cacheDir` (`node_modules/.vite-*`) so dev servers do not clobber.
- Shared: small `shared/brand.ts` brand constants + CSS variables only. No shared cross-surface component framework.
- Capacitor `webDir = "dist-app"` only.
- Commands (confirmed current set): `pnpm dev:landing|dev:app|dev:admin`, `pnpm build:landing` (incl. prerender) | `build:app` | `build:admin` | `build` (all three), `pnpm typecheck`, `pnpm check` (Biome), `pnpm test` (Vitest), `pnpm verify:fast` / `verify:feature` / `verify:full` (canonical gates, see `docs/QUALITY.md`), `pnpm test:e2e:fast` (PW_FAST low-resource lane) / `test:e2e:full` (CI=1), the `pnpm smoke:*` family (18 real-PocketBase suites), `pnpm setup:pocketbase`, `pnpm staff:bootstrap`, `pnpm content:new|validate|plan|import`. `scripts/verify.sh` is the CI/release compatibility entry that delegates to the full gate.

## API and environment topology
- Browser/PWA production: same-origin API via Traefik path routing DIRECTLY to PocketBase — `https://app.fastenglishpodcast.com/api/*` and `https://admin.fastenglishpodcast.com/api/*` map directly to PB; `https://fastenglishpodcast.com/api/fast-english/public/settings` (exact path only) maps to PB. Frontend nginx intentionally returns 404 for `/api/*` (defence in depth; see `docker/*/nginx.conf` and `infra/edge-router/nginx.conf`).
- Android release: bundled local assets; API base = explicit `https://app.fastenglishpodcast.com` (NOT `window.location.origin` — bundled APK has no shared browser origin).
- Browser dev: Vite `/api` proxy → local PocketBase.
- Android dev: `adb reverse tcp:8090 tcp:8090` + `VITE_ANDROID_API_ORIGIN=http://localhost:8090`.
- One env-aware API-base resolver; no secrets in env vars or client bundle.
- PocketBase CORS allowlist: only `https://app.fastenglishpodcast.com`, `https://fastenglishpodcast.com`, Capacitor origin. No wildcard CORS in production.
- No Capacitor native HTTP patching unless real-device evidence proves normal HTTPS/upload fails.

## Trust boundaries and critical data flows
1. Client (browser/APK) → Traefik (self-hosted Coolify) → frontend nginx for `/` (owns root) OR direct to PocketBase for accepted `*/api/*` paths (owns API). All authz server-side; frontend nginx refuses `/api/*`.
2. Signup: client sends phone/name/password(+optional email) → PB normalizes phone, enforces uniqueness, sets `role=student`, `account_status=pending_payment`.
3. Payment: client sends `plan_id` + transfer fields + receipt image → PB validates, snapshots plan, stores receipt in protected file field, creates `pending` request.
4. Staff approve: PB verifies the `staff_admins` identity (requireStaffAdmin), compares externally, in one transaction sets request `approved` + creates/extends subscription (idempotent via unique subscription→request link).

## Non-negotiable invariants
- Client never sets role/account_status/subscription/payment/review/server-calculated fields.
- Phone canonical `+989XXXXXXXXX` stored; uniqueness enforced server-side.
- One pending payment request per user; resubmit only after rejection.
- Approval + subscription in one transaction; repeated approval idempotent (no double duration).
- Receipt: one image, JPEG/PNG/WebP, ≤5MB, signature/MIME/extension match; protected field, randomized name, no public URL, no URL in logs.
- Correct placement answers never sent to client; grading server-side only.
- Premium body/audio denied to pending/rejected/expired/suspended even via direct API.
- Premium audio is streamed through the lesson audio proxy with a short-lived PB file token passed as a query parameter (an `<audio>` element cannot send custom headers). The proxy re-validates live entitlement on every request, so a leaked token grants nothing beyond the owner's current entitlement; it is never stored in the app.
- Staff endpoints verify the `staff_admins` collection + `is_active` server-side (requireStaffAdmin); UI guard is not authz. Student routes verify the `fep_users` collection + `student` role (requireStudent / requireActiveStudent).
- PWA SW never caches `/api/` or private/premium data.
- No secrets in source/bundles/logs/fixtures; `server/pb_data/` never committed.

## Chosen patterns
| Area | Decision | Why | Revisit when |
|---|---|---|---|
| Auth identity | PB auth collection, `phone` as `PasswordAuth.IdentityFields` | Native password auth, no custom crypto | PB changes identity field semantics |
| Migrations | `pb_migrations/` JS files committed | Reproducible schema | PB major version bump |
| Server logic | PB hooks (JS) for authz/transaction/grading | Single backend, no custom Node | Logic exceeds PB hook limits |
| Remote state | Direct typed wrappers over the PocketBase SDK (`app/src/lib/pocketbase.ts` singleton) + `fetch` for custom routes; React context/local state (e.g. `app/src/lib/auth.tsx`); no query library | Server state only, no hidden cache layer | Server-state complexity exceeds what explicit refetch/context handling can support |
| Forms | React Hook Form + Zod | Validation at boundaries | — |
| Icons | MUI icons only (no Lucide) | Avoid second icon set | MUI icons insufficient (justify) |
| Routing | React Router declarative SPA | Simple, stable | SSR needs (rejected for MVP) |
| RTL | MUI RTL Stylis plugin + Emotion cache + `dir` on theme/document/portals | Official MUI RTL | — |
| Font | Self-hosted Vazirmatn variable WOFF2 | No runtime CDN | License change |
| Android | Capacitor no Ionic, bundled assets | Single codebase | — |

## Explicitly rejected complexity
- Next.js/SSR/Astro, Docker, GraphQL, microservices, custom Node backend, workspace/monorepo framework, Lucide (unless justified), Capacitor native HTTP patch (unless evidenced), runtime CDN font, public receipt URLs, wildcard production CORS, SMS OTP, email verification.

## Operational baseline
- Local development storage: `scripts/dev.sh` runs PocketBase against the **persistent** `server/pb_data` by default so Student accounts survive dev PocketBase/app restarts; disposable data is an explicit opt-in (`PB_DEV_EPHEMERAL=1`, `PB_DATA_DIR` overrides the path). The smoke/e2e wrappers always use their own disposable data dirs and never touch `server/pb_data`.
- Configuration/secrets: `.env` git-ignored; `.env.example` documents names only; no secrets in client bundle; production secrets live in `/opt/fast-english/shared/secrets/pocketbase.env` (root:root 0600, names documented in `deploy/env.production.example`).
- Business Configuration slice: owner-controlled public/payment settings live
  in the existing `plans` + `payment_destination` collections plus the new
  `site_settings` singleton (`support_contact` — the canonical support AND
  collaboration contact). Staff edit them in the Admin Console
  (`/settings` → Business Settings) through staff-guarded routes
  (`/api/fast-english/staff/business-settings*`,
  `server/pb_hooks/business_settings_routes.pb.js`). The static Landing
  consumes active plans + support contact + the card-transfer availability
  BOOLEAN at RUNTIME from `GET /api/fast-english/public/settings`
  (same-origin fetch through a scoped Caddy handle on the landing domain;
  Vite dev/preview proxies in dev/e2e). No secrets are exposed by the
  public payload or the settings surface. Seeding: `pnpm seed:plans`
  (seeds/business/plans.json) and `pnpm seed:placement` (guarded
  demo/reviewed bank promotion, seeds/placement/demo-bank.v1.json).
- Free plans: `price_toman === 0` on the canonical `plans` record is THE
  free-plan signal (PB 0.39 requires the field non-required so `0` is
  storable — migration 1700000029; the staff routes still require an
  explicit integer price). Free activation is a dedicated server route
  `POST /api/fast-english/subscriptions/free-activate`
  (`server/pb_hooks/subscription_routes.pb.js`): it loads the canonical
  plan (exists + active + price 0), creates ONE `source='free'`
  subscription (amount snapshot 0, no payment request, no staff
  approval) and sets `account_status='active'` in a single transaction;
  it is idempotent (repeated → `already_entitled`; the partial unique
  index `idx_subscriptions_one_free_per_user` is the concurrency
  backstop) and never mints a second entitlement over an existing valid
  one. A pending paid payment request blocks the free path (one
  commercial path at a time). Free plans work independently of the
  card-to-card toggle.
- Card-to-card enable/disable: the canonical persisted runtime state is
  the `payment_destination` singleton's `is_active` flag (at most one
  active row, enforced atomically by the staff route). Disabling it
  hides ALL card-transfer UI (Student + Landing), makes paid plans
  temporarily unavailable (server re-checks on every submission:
  `payment_destination_unavailable`), and NEVER deletes the stored card
  config — re-enabling reuses the same values. The public settings
  endpoint exposes only the boolean `payment.cardTransferEnabled`.
  The destination collection's standard read API is student-AUTHENTICATED
  (migration 1700000030: `is_active = true && @request.auth.id != ''`);
  anonymous visitors see no destination rows, so the full pay-to card
  number is never harvestable by unauthenticated clients. The Student App
  reads it through the SDK with the logged-in student session; the
  staff routes read it server-side (rule-free).
- Price-change protection: every paid payment request stores
  `plan_name_snapshot`/`amount_snapshot`/`duration_days_snapshot` at
  submission time, so later operator price edits never rewrite the
  historical meaning of submitted receipts or existing subscriptions
  (renewals/extensions start from the snapshot values).
- Migrations: `pb_migrations/*.js` committed; `server/VERSION` pins PocketBase binary 0.39.9; migrations+hooks are loaded from the selected release (`current` symlink) by the systemd unit; migrations run on normal startup; migrations are NOT automatically reversible (documented rollback limitation).
- Deployment: immutable releases under `/opt/fast-english/releases/<id>`, atomic `current` symlink, `pb_data` outside releases, `deploy/deploy.sh` with pre-deployment backup + health checks + smoke + automatic rollback; previous release never deleted.
- Backup/restore: PocketBase automatic backups daily 02:30 UTC (`backups.cron`), keep 14 (`cronMaxKeep`), verified copies moved off `pb_data` at 02:40 UTC (`fast-english-backup-copy.timer`), S3 backups bucket only when credentials are approved; restore drill on a disposable instance (`deploy/restore-drill.sh`); initial verified backup before every first deploy.
- Logging: non-sensitive logs; no receipt URLs/PII in logs; Caddy access logs rotate (10×10MiB, 30 days) and filter `request>uri` with the official query filter replacing the `token` query parameter with `[REDACTED]` (proven by `deploy/test-log-redaction.sh`); `log_credentials` is never enabled (Authorization/Cookie redacted by Caddy defaults); PocketBase `logs.maxDays=30`, `logAuthId=false`.
- Security: PocketBase binds 127.0.0.1:8090 only (systemd `ProtectSystem=strict`, non-root `fastenglish` user); the superuser Dashboard `/_/` is 404 on public domains and reachable only over an SSH tunnel; Caddy request bodies bounded to 6MB on `/api/*` (5MB receipt + documented margin); CORS restricted to the three public HTTPS origins; superuser IP whitelist recommended once the staff IP is known.
- Rollback: symlink flip + PocketBase restart + Caddy reload; static release rollback never touches `pb_data`; APK rollback = previous versioned APK (immutable filenames, old files never overwritten).
- Production deployment package: `deploy/` (Caddyfile, systemd units, install/configure/deploy/backup/restore-drill/smoke/ops/log-redaction scripts, env template) — validated locally; actual deployment requires DNS + server access (see `docs/DEPLOYMENT.md` §9, Gate open).

## Student App surface (Podcast Slice 5)
- Routes: `/` RootGate (guests → Entry; active+placement+level → Home in the shared shell; otherwise → /payment or /placement), `/login`, `/signup`, shell routes `/payment`, `/payment-status`, `/placement`, `/placement/result`, `/lessons`, `/lessons/:id`, `/lessons/demo`, `/library` (production Podcast discovery, Slice 6), `/progress`, `/account`, `/dashboard` → `/` redirect, `/sample`, Not Found.
- The shared `PlayerProvider` (single `<audio preload="metadata">` element) wraps all routes; it stops playback when the auth session disappears. Home renders via `<AppShell><HomeRoute/></AppShell>`.

### Player lifecycle reliability (Slice 8)

- **One authoritative player.** The app owns exactly ONE `<audio>` element inside `PlayerProvider` (never two simultaneous elements — Mini Player constraint); the Deck (`VariantDeck`) binds a session + callbacks instead of owning an element. Playback survives SPA navigation (the Mini Player keeps control); a Variant switch `stop()`s atomically (synchronous practical-position save, then callback clear); logout clears the session, element, and Media Session.
- **Bind transitions** (`app/src/features/player/lifecycle.ts`): a genuinely new lesson = full reset; the same lesson with a NEW protected URL (token rebuild / retry) = soft refresh — session, practical position (pending seek + retry-restore guard) and playback preferences survive. `decideResumeTarget` keeps an older saved resume point from regressing the practical position after a retry; an explicit user seek/restart always wins.
- **Background/foreground honesty.** On visibility-return (`visibilitychange`/`pageshow`/Capacitor `resume`) the provider reconciles player state from REAL element state only — never auto-plays and never invents a position. The element's own `pause` event is the single pause-save writer (a reconcile can never double-write); `useProgressSave` additionally flushes the newest real pending position on `visibilitychange-hidden`/`pagehide`/`beforeunload`. Element preferences (rate/volume/mute) are re-applied on (re)mount and on visibility return (Android WebView resets them across lifecycle transitions).
- **Retry / token rebuild.** The deck retry always rebuilds the protected URL with a fresh PB file token (`buildProtectedAudioUrl`), sequence-guarded like every load path. Because PB returns a byte-identical file token for calls within the same second (no iat/jti), a rebuilt URL equal to the current one gets a cache-busting `_r` nonce (the audio proxy only reads `token`; entitlement is re-validated on every request, so the nonce is inert to authorization). The CTA is disabled while a (re)load is in flight so a fast click can never `play()` a still-broken element.
- **Media Session (progressive enhancement).** `app/src/features/player/mediaSession.ts` mirrors the authoritative session: metadata (title/artist/public artwork), `playbackState`, throttled clamped `positionState`, and per-action handlers (play/pause/seekto/seekbackward/seekforward/stop) routed to the same controller. Cleared (metadata null + `'none'`) on stop/logout/invalid session; unsupported platforms degrade to no-ops; pronunciation playback never touches it (the Episode pause flips the honest `'paused'` state).
- **Known limitation (labeled):** OS lock-screen controls and background-audio behavior on Android hardware are UNPROVEN (no device attached in CI/local); the Capacitor WebView follows the same web code paths and `cap sync` + `assembleDebug` compile is the current evidence ceiling.
- Home loads four existing endpoints in parallel: preferred-level lesson list, `/progress/continue`, `/progress/summary`, `/dashboard` (subscription line). Continue hero merges the continue payload with the list item (artwork/category/titleFa). Pure composition rules live in `app/src/features/home/logic.ts` (unit-tested).
- Reusable Episode foundations (`app/src/features/podcast/components/`): EpisodeArtwork, EpisodeCard, ContentSection — consumed by Home and by the Library (`/library`, Slice 6).
- Library & Discovery (Slice 6): dedicated Student route `GET /api/fast-english/library` (server/pb_hooks/library_routes.pb.js) returns one canonical Episode result per Topic, the Student's resolved Variant (preferred → recommended → first published CEFR), per-Variant Progress, published Categories, a bounded Continue rail and deterministic pagination; search/Category/Level/Progress filters, sorting and publication filtering all happen server-side before pagination. Discovery state is URL-backed (`/library?q&category&level&progress&sort&page`); browsing never mutates recommended/preferred levels. Contract details in docs/PODCAST_DOMAIN.md.

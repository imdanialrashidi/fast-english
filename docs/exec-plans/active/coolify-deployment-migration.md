# Coolify Deployment Migration — Fast English Podcast

Status: active (architecture decision + plan; NO production changes yet)
Updated: 2026-08-16

## Goal

Replace the native Caddy + systemd + release-symlink deployment layer with a
Coolify-based layer so that ordinary releases become: merge PR → CI green →
manual production approval → Coolify deploy → health verification → production
smoke → DONE — while preserving **every** existing production-safety guarantee
for PocketBase data, backups, migrations, smoke testing, security, and
rollback. This is a deployment-architecture migration task; application code is
out of scope.

## Non-goals

- No application/Product code changes (the app, admin, landing, hooks,
  migrations, Android flows stay as they are).
- No live production mutation now. Prototypes and staging only.
- No dual-stack operation (new Coolify + old Caddy/systemd both running).
- No moving PocketBase media to S3 file storage during this migration.
- No Coolify PR preview deployments in P1–P3 (see Decisions; deferred).
- No feature work (telemetry, payments, content).

## Acceptance contract (proofs to run before Production GO)

- A1 — Provisioning: a fresh production VPS is fully provisioned from the new
  runbook (DNS → provider firewall → Coolify Cloud server connect → 4 apps)
  with **no routine SSH**; all four public HTTPS domains serve with
  auto-issued/renewing Let's Encrypt certs; www → canonical 308.
  Proof: runbook executed on staging first; `smoke-prod.sh --quick` +
  `ops-check.sh` green on real domains; `curl -I` shows the 308 and valid certs.
- A2 — PocketBase persistence: through the REAL stack, deploy a disposable
  record + receipt file via the product flow → redeploy + Coolify image
  rollback of the PocketBase container → the same record ID and file bytes
  survive; `pb_data` proven to live in `/opt/fast-english/shared/pb_data` on
  the host (never in the container image/fs).
  Proof: container create→delete→recreate with the same bind mount (prototype
  result extended to the real stack) + `restore-drill.sh` PASS on the newest
  backup + record-level `pnpm smoke:restore-proof` PASS.
- A3 — Independent frontend deploys: a Landing-only deploy (and Admin-only,
  Student-only) does NOT restart/replace the PocketBase container; PB keeps
  serving and its uptime sequence is unbroken.
  Proof: record PB container start time / Coolify deployment history across a
  frontend-only deploy; API health stays 200 through the whole window.
- A4 — Backup chain: PB automatic cron backup (02:30 UTC, keep 14) → verified
  copies to `shared/backups` (host timer) → off-VPS S3 destination; a restore
  drill from a downloaded S3 object passes; `ops-check.sh` shows backup age
  < 26h and no backup errors.
  Proof: executed drill + `ops-check.sh` exit 0 + first on-demand
  `backup.sh` PASS on the live stack.
- A5 — Release flow: merge → canonical CI green → `workflow_dispatch` on an
  exact commit → GitHub Actions builds/verifies images → Coolify deploys the
  pinned images → health gates pass → `smoke-prod.sh --full` PASS → the
  workflow reports version + commit + deployed time + health + smoke result.
  Proof: one executed end-to-end release on staging, then on production;
  report artifact captured.
- A6 — Rollback invariant: a deliberately bad frontend image and a
  deliberately bad PocketBase image are deployed, fail health/smoke, and are
  rolled back via Coolify to the previous image; `pb_data` content is byte-
  unchanged before/after both rollbacks; the migration-non-reversal rule is
  documented and demonstrated in staging (apply a migration, roll back the
  image, confirm schema stays migrated — then restore the pre-deploy backup
  as the documented recovery).
  Proof: staged failure-injection drill log + sha256 of pb_data files before/
  after + documented runbook entry.
- A7 — Security posture: provider firewall exposes only 22 (Coolify Cloud IPs
  + operator), 80, 443; PocketBase port is NOT public; `/_/` returns 404 on
  app/admin; no secrets in built images, CI logs, or the repo; the
  audio-token log-redaction proof passes against the new logging stack (nginx
  never sees `/api`; Traefik/Coolify logs restricted; PB logs superuser-only).
  Proof: `nmap`/provider firewall screenshot from outside; updated
  `test-log-redaction*` suite (local probes) green; secret scan green.

## Confirmed current state (audit 2026-08-16)

- System today (all verified in `deploy/`, `docs/`, `server/`):
  - Caddy 2.10.x Caddyfile: 4 domains; www 308; `/releases/*` immutable APK
    host; landing `/api/fast-english/public/settings` scoped proxy; app/admin
    `/api/*` → 127.0.0.1:8090 with 6MB body bounds + 64MB content-import
    scope; `/_/` 404; security headers; token `[REDACTED]` access-log filter.
  - systemd `fast-english-pocketbase.service`: non-root `fastenglish`,
    `127.0.0.1:8090` only, `ProtectSystem=strict`,
    `ReadWritePaths=pb_data`, `--migrationsDir/--hooksDir` from the `current`
    release symlink, `--origins=` CORS allowlist, `--encryptionEnv=`.
  - `deploy.sh`: bundle verify (incl. APK sha256, forbidden dev strings,
    no SW in admin) → immutable install → atomic `current` symlink → PB
    restart (migrations on startup) → health → Caddy reload → publish APK →
    mandatory `smoke-prod.sh --quick` → EXIT-trap auto-rollback (exit 2/3).
  - `backup.sh` (PB Backups API via superuser, 0600 temp-file auth),
    `backup-copy.sh` (02:40 UTC timer, keep 14), `restore-drill.sh`
    (disposable instance, counts + auth, fail-closed),
    `smoke-prod.sh` (58 scenarios over real HTTPS), `ops-check.sh`,
    redaction test scripts. Secrets: `/opt/fast-english/shared/secrets/
    pocketbase.env` root:root 0600 (names in `deploy/env.production.example`).
  - Env contract: classified REQUIRED/REQUIRED-SECRET/OPTIONAL/DISABLED in
    `.env.example`; `VITE_*` build-time; server secrets `FEP_*`.
  - App API: browser same-origin `https://app.fastenglishpodcast.com/api/*`
    (`shared/lib/apiOrigin.ts`); Android release hard-coded
    `https://app.fastenglishpodcast.com`; PB CORS: app/admin/`https://
    localhost` (Capacitor).
  - CI: `.github/workflows/quality.yml` (static/backend/e2e/verify lanes) is
    the canonical quality gate; `scripts/project-verify.sh` is the local
    full gate. Docker currently explicit non-goal of the app stack;
    `Dockerfile.pi` is the pi-harness image (unrelated).
  - **Nothing is deployed to production** (Gate OPEN, infra BLOCKED: no VPS/
    DNS). Ideal migration moment — no live data to migrate.
  - PocketBase pinned **0.39.9** (`server/VERSION`); hooks are pure PB JSVM
    (no npm deps); migrations run on normal startup; migrations are NOT
    auto-reversible.
  - Hardened npm audit posture: `pnpm audit --prod --audit-level high` in CI.
- Coolify current facts (official docs + repo, coolify-docs @ v4, latest
  release v4.3.5, 2026-08-16):
  - Coolify Cloud: $5/mo base (2 servers), $3/mo per extra server; same
    codebase as self-hosted; dashboard at app.coolify.io; only ports 22/80/443
    needed on connected servers; Cloud backs up only its own DB, never app
    data; canceling/billing lapse does not stop running apps; staged,
    founder-tested updates.
  - Self-hosted: min 2 CPU/2GB/30GB, needs ports 8000 (dashboard), 6001
    (realtime), 6002 (terminal), 22, 80, 443; installer for Ubuntu LTS;
    /data/coolify layout; upgrade + backup of the Coolify instance is our job.
  - Build packs: Nixpacks, Static, Dockerfile, Docker Compose, Docker Image.
  - Compose: compose file is the single source of truth; coolify-managed
    network (no custom networks — intermittent 504s documented); per-service
    domains/ports incl. `127.0.0.1:3000:3000` loopback host binding;
    `exclude_from_hc`; required env syntax `${VAR:?}`; magic env vars; no
    rolling updates for Compose.
  - Applications: Dockerfile builds on the server; pre/post-deploy commands;
    build args (SOURCE_COMMIT opt-in); env vars with Build/Runtime flags;
    persistent storage (named volume or **bind mount**); health checks (UI or
    Dockerfile HEALTHCHECK; Dockerfile takes precedence; Traefik routes only
    to healthy instances; unhealthy → 404/"No available server");
    **Rollback = redeploy a previously built image, local images only**;
    port mappings incl. IP-bound; path-based routing (multiple resources can
    share a domain by path; most-specific path wins; unhealthy path falls
    back to root); multiple domains per resource; **www redirect is a
    built-in Direction setting** (Allow both / to www / to non-www).
  - Proxy: Traefik (default, mature) or Caddy (experimental); auto HTTPS via
    Let's Encrypt incl. wildcards via DNS challenge; custom middlewares
    (headers, rate limit, IP whitelist, redirectregex, buffering body limit).
  - GitHub integration: GitHub App (auto deploy, previews, PR comments,
    scoped preview env/secrets), Deploy Key, Public repo, or **webhooks
    (auto-deploy + preview)**; GitHub Actions flow documented: build image →
    push GHCR → trigger deploy webhook with Bearer API token.
  - API: Bearer tokens with scoped permissions (read/read:sensitive/write/
    deploy/root), team-scoped, IP allowlist, 200 req/min.
  - Webhook notifications: `deployment_success|failed`, `status_changed`,
    `backup_success|failed`, `task_success|failed`, `server_unreachable`,
    `high_disk_usage`, `container_stopped|restarted` payloads to any webhook.
  - Monitoring: deployment status, container status/restarts, server CPU/RAM/
    disk, notifications; automated Docker cleanup (threshold or schedule).
  - No built-in app migration between hosts (documented manual redeploy).
  - Coolify databases: PostgreSQL/MySQL/MariaDB/MongoDB/Redis/etc. — **SQLite/
    PocketBase not among them**; PB backup stays PocketBase-native.

## Decisions

- D1 — **Operating model: Coolify Cloud ($5/mo) + owned production VPS**
  (Option B). Rationale: management plane leaves the VPS failure domain; only
  22/80/443 ever open; no Coolify upgrade/patch duty; Cloud's own DB backup
  is irrelevant to app data (ours stays off-VPS S3, fully owned — the $5 is
  for the control plane only). Options table in §"Operating model".
- D2 — **One Cloud account, two servers**: production VPS + a small staging
  VPS (+$3/mo). Staging gets its own project, domains, and a completely
  separate `pb_data`; drills/destructive tests run there.
- D3 — **Traefik (Coolify default) as the single reverse proxy.** Caddy's
  nginx/static-serving role moves INTO the frontend containers (nginx:alpine);
  Coolify handles TLS/domains/routing/redirects. No second public proxy
  layer. Caddyfile retired after the mapping table is reproduced.
- D4 — **Four independent Coolify Applications** (Landing, Student App, Admin,
  PocketBase), one per surface, each with its own multi-stage Dockerfile.
  No Compose in production (single deploy unit + no rolling updates for
  Compose violates independent surface deploys). Independent rollback/health
  per surface. Landing/Student/Admin are stateless static containers (nginx)
  with no volumes; PocketBase has the one stateful bind mount.
- D5 — **Images built in GitHub Actions → GHCR; Coolify apps are Docker-Image
  type pulling `:production` (moving) + immutable `:sha-…` tags.** Builds
  never run on the VPS; exact-commit deploy = `workflow_dispatch` on a
  specific ref re-points `production` and fires Coolify deploy webhooks.
  Coolify git-build (builds on server, branch HEAD deploys) rejected: no
  exact-commit semantics, VPS build load, server-side cache churn.
- D6 — **PocketBase persistence = explicit host bind mount**
  `/opt/fast-english/shared/pb_data` → `/pb/pb_data` (prototype-proven;
  named volumes rejected: opaque `/var/lib/docker/volumes`, container-juggling
  backup/restore, and the documented cross-host migration is a plain directory
  copy for bind mounts). PB runs as a fixed non-root UID (e.g. 10001) in the
  image; the host dir is `chown`ed to that UID. **Never keep pb_data in the
  container filesystem; never let Coolify automation delete it.**
- D7 — **PocketBase stays reachable at host `127.0.0.1:8090`** via a
  loopback-only port mapping (`127.0.0.1:8090:8090`). This keeps
  `backup.sh`, `configure.sh`, `restore-drill.sh`, `smoke-prod.sh` local
  checks and `ops-check.sh` operational with minimal changes and preserves
  the "PB not public" invariant (loopback only; firewall untouched).
  Verify Coolify Application supports IP-bound port mappings in P2 (fallback:
  Compose-based PB or `docker exec` wrappers — decide on staging evidence).
- D8 — **Backup layer unchanged in substance**: PB native `backups.cron`
  02:30 keep 14 (inside pb_data) → host `backup-copy.sh` timer 02:40 (host
  cron/systemd timer stays — it is host-level file copying, no Docker needed)
  → off-VPS S3 via PB `backups.s3` (configure.sh). Coolify generic database
  backup is NOT used for PB. `backup.sh`/`backup-copy.sh` KEEP.
- D9 — **Hooks + migrations baked into the PocketBase image at build time**
  from the exact commit; migrations execute on container startup (normal PB
  behavior). A PB deploy that changes hooks/migrations requires a new image;
  a frontend deploy can never touch hooks/migrations. **Invariant preserved:
  application rollback ≠ database rollback.** Coolify rollback swaps images
  only; applied migrations are never auto-reversed; recovery from a bad
  migration release = pre-deploy backup restore (backup runs before every PB
  deploy).
- D10 — **Production smoke runs from GitHub Actions after Coolify reports
  deployment success** (poll Coolify deployment status via API with a
  `deploy`-scoped token; then run `smoke-prod.sh --full` from a runner
  against the real HTTPS domains). Coolify post-deploy container commands are
  not used for smoke (limited env, no dependency tooling). Manual full smoke
  stays available for the first release.
- D11 — **Manual production approval = GitHub Actions `workflow_dispatch`
  (`release-deploy`) on an exact commit/SHA**, with an input selecting the
  surfaces (A–E classification). Coolify manual "Deploy" button remains a
  fallback path documented in the runbook. No auto-deploy on push.
- D12 — **Staging topology**: `staging.fastenglishpodcast.com` /
  `app-staging…` / `admin-staging…` on the staging VPS, completely separate
  PB + bind mount + secrets + S3 bucket path. Production and staging never
  share a database.
- D13 — **Coolify PR preview deployments deferred** (rationale: dynamic
  per-PR subdomains don't fit PocketBase's explicit (non-wildcard) CORS
  allowlist; previews would either break API calls or need constant origin
  churn). Staging is the review vehicle; revisit previews only for the
  fully-static Landing as an optional P4 item.
- D14 — **Secrets**: keep `/opt/fast-english/shared/secrets/pocketbase.env`
  (root:root 0600) as the operator-script store (superuser, S3, SMTP, smoke
  staff creds, PB_ENCRYPTION_KEY) **and** mirror the container-startup-only
  secret (`PB_ENCRYPTION_KEY`) into the PocketBase app env in Coolify (Coolify
  stores it encrypted; access = dashboard + MFA). Both copies must match;
  rotate both together (runbook). `VITE_*` build config lives in GitHub
  Actions secrets/env per surface, never in Coolify. No committed `.env`.
- D15 — **Firewall**: provider-level firewall only (Docker NAT bypasses UFW);
  Cloud mode → open 22 (restricted to Coolify Cloud IPs + operator IP), 80,
  443. Nothing else. PB port never public.

## Target architecture

```text
Internet
  │  80/443 (Traefik — Coolify managed, auto HTTPS, www→root 308)
  ▼
Coolify Proxy (Traefik) on the production VPS
  ├─ https://fastenglishpodcast.com             → Landing nginx:alpine
  │     ├─ /releases/*            → read-only host bind mount (APK artifacts)
  │     └─ /api/fast-english/public/settings → PocketBase (exact-path route)
  ├─ https://www.fastenglishpodcast.com         → 308 → canonical root
  ├─ https://app.fastenglishpodcast.com
  │     ├─ /            → Student App nginx:alpine (SPA fallback, PWA headers)
  │     └─ /api/*       → PocketBase (path route, 6MB buffering middleware)
  ├─ https://admin.fastenglishpodcast.com
  │     ├─ /            → Admin nginx:alpine (SPA fallback, /_/ 404, /→/operator 308)
  │     └─ /api/*       → PocketBase (path route, 6MB; 64MB content-import route)
  └─ PocketBase container (internal service, no public port)
        ├─ /pb/pb_data        ← host bind mount /opt/fast-english/shared/pb_data  (UID 10001)
        ├─ /secrets           ← RO mount pocketbase.env (operator scripts) [P2 verify]
        ├─ 127.0.0.1:8090 host loopback port (backup/configure/ops scripts)
        └─ migrations+hooks+VERSION baked into image at build time

GitHub (canonical quality) ── quality.yml unchanged ──┐
release-deploy workflow_dispatch (exact commit) ──▶ build+verify 4 images
        └─▶ GHCR :production + :sha-<commit> ──▶ Coolify deploy webhook
                └─▶ poll deployment status ──▶ health ──▶ smoke-prod.sh --full
                                                      └─▶ report version/commit/time/health/smoke
```

## Guarantee mapping (current → Coolify-era)

| Current guarantee | Coolify-era equivalent |
|---|---|
| Atomic `current` symlink switch | Coolify deployment (new container replaces old after health); rollback = previous image |
| Immutable releases | Immutable `:sha-<commit>` GHCR images + immutable APK files in shared/releases |
| Pre-deploy backup before any change | `backup.sh` invoked by the release workflow before PB image deploys (TYPE B/C) |
| PB restarts with new hooks/migrations | New PB image (hooks/migrations baked) started by Coolify; migrations run on startup (unchanged) |
| Auto-rollback on post-switch failure | Coolify health gate blocks routing to unhealthy instance; manual/CI rollback to previous image (A6 drill) |
| Rollback never touches pb_data | Rollback = image swap only; pb_data lives outside the container (D6, A2/A6 proof) |
| Migration non-reversibility documented | Same rule; Coolify rollback provably cannot reverse an applied migration (A6) |
| Off-VPS backup (Gate) | Unchanged (PB S3 backups + verified copies); Coolify never the offsite channel |
| Restore drill on disposable instance | Kept; migrations/hooks/binary now come from the repo/image instead of `/opt/fast-english/current` |
| Production smoke mandatory | CI-run `smoke-prod.sh` after Coolify deployment success; first release manual full run |
| `/_/` not public; PB loopback-only | Same: no PB host port beyond 127.0.0.1:8090; nginx 404 for `/_/`; no public PB ports |
| 6MB/64MB body bounds | Traefik buffering middlewares on the API path routes (sizes matched) |
| www 308 to root | Coolify built-in Direction "Redirect to non-www" (R:308) |
| Landing has no generic /api | Landing nginx returns 404 for `/api/*`; only the exact settings path is routed to PB |
| Security headers / cache rules / SPA fallback / SW no-cache | nginx origin config reproduces each block (deliverable: mapping table in COOLIFY_DEPLOYMENT.md) |
| Audio-token `[REDACTED]` in access logs | nginx never sees `/api`; Traefik/Coolify logs access-restricted (MFA dashboard); PB logs superuser-only; updated redaction proof |
| Service worker never caches /api | Unchanged (Traefik paths / nginx headers; SW logic untouched) |
| CORS allowlist | Unchanged (`--origins` flag on PB serve) |
| Same-origin app API + Android origin | Unchanged (`app.fastenglishpodcast.com/api/*` via path routing; `https://app.fastenglishpodcast.com` APK) |
| secrets file root:root 0600 | Kept as operator store + mirror of PB_ENCRYPTION_KEY into Coolify (D14) |

## Script classification (KEEP / ADAPT / REPLACE / RETIRE)

- `deploy/install.sh` — **REPLACE** → Coolify Cloud "Validate Server & Install
  Docker" + first-setup checklist (DNS, provider firewall, secrets file, uid
  ownership of pb_data, RO /releases + /secrets mounts). Some steps survive
  as a new `setup/coolify-provision.sh`.
- `deploy/configure.sh` — **ADAPT** (PB settings via API on 127.0.0.1:8090 —
  works as-is with D7; drop systemd-only prose).
- `deploy/deploy.sh` — **REPLACE** → GitHub Actions build+verify stages (its
  bundle verifications become CI gates: APK sha256, forbidden strings, admin
  no-SW, surface markers) + Coolify deploy + health + smoke orchestration.
  Pre-deploy backup step moves into the release workflow.
- `deploy/backup.sh` — **KEEP** (unchanged behavior; verify loopback port).
- `deploy/backup-copy.sh` — **KEEP** (host paths unchanged; timer stays).
- `deploy/restore-drill.sh` — **ADAPT**: migrations/hooks from the repo
  (`server/pb_migrations`, `server/pb_hooks`) or the built image instead of
  `/opt/fast-english/current/server/…`; binary from `scripts/setup-pocketbase.sh`
  or the image; everything else (disposability, counts, fail-closed) stays.
- `deploy/smoke-prod.sh` — **KEEP** (unchanged; from CI + manually).
- `deploy/ops-check.sh` — **ADAPT**: replace `systemctl is-active` with
  `docker`/Coolify-API container state; cert check unchanged; disk/backup/5xx
  unchanged (5xx source becomes PB docker logs/`/api/logs`); add Coolify
  deployment/container-restart visibility.
- `deploy/Caddyfile` — **RETIRE** (mapping table reproduced in Coolify config +
  nginx origin configs; kept in git history only).
- `deploy/systemd/*` — **RETIRE** (PB unit + Caddy unit); backup-copy timer may
  stay as a host systemd timer (it is host-level, no Docker needed) or move to
  a Coolify scheduled task (verify availability; keep the timer by default).
- `deploy/test-*redaction*.sh` — **ADAPT** to the new logging stack (nginx +
  Traefik + PB) with the same assertion semantics (tokens absent from retained
  logs).

## Containerization strategy

- Four multi-stage Dockerfiles (build stage Node 24.13 + corepack pnpm
  11.17.0 with `--frozen-lockfile`; runtime stage pinned and minimal):
  - `landing.Dockerfile` (or `docker/landing/Dockerfile`): build
    `pnpm build:landing` with `VITE_WEB_APP_URL`/`VITE_ANDROID_APK_URL`/
    `VITE_ANDROID_APK_VERSION` build args; runtime `nginx:1.27-alpine` with
    config: `try_files $uri $uri.html` + `/releases/*` RO alias mount +
    `location /api/ { return 404; }`, exact cache classes, headers, gzip.
  - `app.Dockerfile`: build `pnpm build:app`; runtime nginx SPA fallback
    (`try_files $uri /index.html`), `/_/` 404, `no-cache` for index.html/
    sw.js/manifest, immutable assets, PWA icons cache.
  - `admin.Dockerfile`: build `pnpm build:admin`; runtime nginx SPA fallback,
    `location = / { return 308 /operator; }` (matches the existing smoke
    contract), `/_/` 404, no SW/manifest by design (smoke asserts absence).
  - `pocketbase.Dockerfile`: `alpine:3.20`, copy the **pinned** binary
    `pocketbase_0.39.9_linux_amd64.zip` (verified sha256 from
    `scripts/setup-pocketbase.sh` URL + `server/VERSION`) + `pb_migrations` +
    `pb_hooks` + `VERSION`; non-root UID 10001; HEALTHCHECK
    `/api/health`; CMD `serve --http=0.0.0.0:8090 --dir=/pb/pb_data
    --migrationsDir=… --hooksDir=… --hooksWatch=false --encryptionEnv=
    PB_ENCRYPTION_KEY --origins=…` (unchanged flag set). `latest` never used.
- No runtime Node for static SPAs (nginx only). No dev deps in runtime.
- Images carry version identity (`data-{app,landing,admin}-version`, PB
  `VERSION`/`FEP_PB_VERSION`); smoke asserts markers.

## Work plan (ordered vertical slices with stop points)

- P0 (this plan) — architecture decision, guarantee mapping, acceptance
  contract. STOP: owner confirms Option B + budget ($8/mo incl. staging).
- P1 — Repository artifacts (no servers touched):
  1. 4 Dockerfiles + 3 nginx configs + PB entrypoint; local `docker compose`
     dev twin (disposable): PB + 3 static servers, same-origin `/api` paths.
     STOP: compose twin passes the adapted `restore-drill.sh` +
     `smoke-prod.sh` in local mode (FEP_SMOKE_ROOT=127.0.0.1 twin) +
     redaction tests.
  2. CI: `build-images.yml` (quality already green → build+scan+push 4 images;
     `production` + `sha-` tags) and `release-deploy.yml`
     (`workflow_dispatch` on exact commit → optional pre-deploy backup →
     trigger Coolify webhooks → poll status → health → smoke → report).
     STOP: workflow tested in a dry-run/sandbox repo or stage.
  3. Adapted scripts (`restore-drill.sh`, `ops-check.sh`, redaction tests)
     + script classification changes + `.env.example`/`env.production.example`
     updates. STOP: `scripts/project-verify.sh` green with new drill wiring.
  4. Docs: `docs/COOLIFY_DEPLOYMENT.md` (runbook: server setup, Coolify
     setup, GitHub wiring, environments, domains, PB mount, secrets, backups,
     deploy classes A–E, rollback, restore, smoke, monitoring, DR, upgrade
     path; Persian/bilingual where the technical owner needs it) +
     `docs/DEPLOYMENT.md`/`BACKUP_RESTORE.md`/`OPERATIONS.md`/
     `INCIDENT_RUNBOOK.md` updated so there is ONE authoritative production
     guidance. STOP: no contradictory deployment guidance remains.
- P2 — Disposable vertical proof: run the actual images locally (as the D4
  topology) against a throwaway Coolify self-host or the real Cloud account's
  staging server; verify the open items list (§Open items) — loopback port
  mapping, health gating, path priority, www redirect, image pull on redeploy,
  rollback with GHCR images, env injection, scheduled tasks. Extend the
  persistence prototype (done) to the full stack. STOP: every open item has a
  PASS/FAIL with a fallback chosen.
- P3 — Staging: rent staging VPS (1 vCPU/2GB/30GB), connect to Cloud, deploy
  the 4 apps with staging domains + separate pb_data; seed staging with
  disposable data; failure-injection drills (bad frontend image, failing PB
  startup, broken hook, failed health, proxy misconfig, unavailable PB,
  missing env, interrupted deploy, container deletion/recreation, rollback,
  restore from backup — each with a proven recovery path); restore drill;
  staging smoke. STOP: all A1–A7 criteria demonstrated in staging.
- P4 — Production rollout: DNS, provider firewall, secrets, deploy, health,
  first full smoke, ops-check, DR rehearsal on a fresh throwaway VPS (new VPS
  → connect → deploy → secrets → restore pb_data from S3 → DNS → health →
  smoke). Then runbook polish + optional preview deployments + monitoring
  notifications. STOP (GO/NO-GO gate): owner reviews A1–A7 evidence and the
  risk register.

## Risks

- Introduced by Coolify: platform dependency (mitigate: GHCR images + a
  documented plain-`docker compose` fallback runbook; Coolify Cloud canceling
  keeps apps running per docs), Cloud trust boundary (SSH key to VPS — restrict
  via provider firewall to Coolify Cloud IPs + operator IP; dashboard MFA),
  Docker daemon/root surface on the VPS (keep 22 strict, auto-updates OFF for
  app images), Traefik path-routing/health pitfalls (404/"No available
  server" — covered by P2/P3 probes), Coolify-specific config behavior
  unverified on this exact version (open items list), log-redaction semantics
  change vs Caddy (re-proven, A7), cost $5(+$3)/mo, GHCR pull risk (pin
  images, provenance), loss of Caddy's exact body-limit semantics (Traefik
  buffering middleware — verify).
- Removed: hand-written deploy/orchestration bugs, tooling drift across
  scripts, VPS builds (OOM risk), certificate renewal ops, rollback scripting,
  Caddy/systemd upgrade duty, management-port exposure.
- Correctness/safety: bind-mount UID mismatch (prototype failure observed —
  fixed by chown to fixed UID + P2 re-proof), migration rollback illusion
  (documented + A6 drill), backup chain broken by a Coolify change (host
  timer + PB-native backups independent of Coolify).

## Open items to verify in P2/staging (evidence required)

1. Coolify Application supports `127.0.0.1:8090:8090` IP-bound port mapping
   (else: Compose-based PB or docker-exec script adapters).
2. Docker-Image redeploy re-pulls the updated `:production` tag.
3. Health checks gate Traefik routing AND Coolify marks bad deploys failed.
4. Path priority: landing exact settings path vs `/`; app/admin `/api` vs `/`;
   fallback-to-root behavior when PB unhealthy (must NOT expose generic
   landing /api via fallback).
5. Built-in www Direction produces a 308 and allows later reversibility.
6. Rollback to a previous GHCR-sourced image (local-image constraint).
7. Coolify scheduled tasks (backup-copy alternative) — default stays host
   timer.
8. Env injection for Docker-Image apps: runtime-only variable flags.
9. Traefik buffering middleware for 6MB/64MB bounds.
10. PB CORS `--origins` behavior through Traefik path routes (APK + admin).
11. Secrets mirror sync check (PB_ENCRYPTION_KEY host file == Coolify env).

## Decisions intentionally deferred

- Coolify PR preview deployments (revisit post-launch; Landing-only optionally).
- Moving PocketBase media to S3 file storage (§31 future path — research the
  PB S3 driver/version when disk headroom demands it; not now).
- A monitoring platform beyond Coolify + ops-check (evaluate after go-live).
- CSP (existing documented deferral, unchanged).
- Coolify self-hosted (kept as documented fallback if Cloud ever fails).

## Status — P1 COMPLETE (2026-08-17)

P1 (repository artifacts) is implemented and verified on the
`feat/coolify-migration` branch:

- Four production Dockerfiles + nginx configs + PB entrypoint
  (`docker/{pocketbase,landing,app,admin}/`), all building locally.
- Disposable Coolify-equivalent twin (`infra/compose.yaml` + edge router)
  with the full routing contract proven.
- CI workflows: `build-images.yml` (GHCR, immutable sha- tags),
  `release-deploy.yml` (manual exact-commit release, quality gate on the
  `verify` merge-gate job, classification A–E, pre-deploy backup + off-VPS
  gate, Coolify API trigger + status polling, independent health + smoke,
  post-verification `production` alias, verdict), `rollback-deploy.yml`.
- Adapted tooling: `restore-drill.sh`, `ops-check.sh`, `smoke-prod.sh`
  (admin marker fix), `test-nginx-log-redaction.sh`, `check-offsite.sh`;
  legacy markers on Caddyfile/deploy.sh/install.sh/systemd unit.
- Infra suite: `pnpm test:infra:coolify` (09 suites) — persistence,
  backup→clean-restore, migration lifecycle + rollback non-reversal,
  routing contract, image secret scan, log redaction (incl. error-log path),
  Coolify contract (incl. W10/W11 deployment-ordering guards).
- Docs: `docs/COOLIFY_DEPLOYMENT.md` (canonical), `docs/STAGING.md`,
  `docs/DISASTER_RECOVERY.md`, updated OPERATIONS/INCIDENT/BACKUP_RESTORE/
  DEPLOYMENT banners + the Persian Technical Owner runbook (v2.0).
- Independent security review (security-auditor) + correctness review
  (reviewer) performed; all BLOCKER/MAJOR findings fixed (reviewer's
  GitHub-Actions semantics catches: gate job name, alias-publish ordering,
  skipped-needs on deploy, restore-drill guard, root-mode restore chown).

FINAL VERDICT: COOLIFY REPOSITORY MIGRATION: READY (see task §42).

Next phase = P2/P3 execution (staging VPS + Coolify Cloud + failure-injection
and release drills) — the open items O1–O5 in COOLIFY_DEPLOYMENT.md §17 are
the live-verification list; the root-mode infra suite + workflows first run
in CI/staging.

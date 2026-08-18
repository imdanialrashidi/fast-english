# Fast English Podcast — Coolify Deployment (canonical)

> **Status: canonical production deployment guide (Coolify era).**
> Supersedes `docs/DEPLOYMENT.md` (Caddy + systemd era — LEGACY/RETIRED,
> kept as historical fallback). The Persian Technical Owner guide is
> `docs/TECHNICAL_OWNER_RUNBOOK_FA.md`.
> **Last updated:** 2026-08-17 — repository-side migration COMPLETE;
> real server provisioning is the next phase (see §16).

## 0. Architecture (final)

```text
Internet ── 80/443 ──▶ Coolify-managed Traefik (on the owned production VPS)
  ├─ https://fastenglishpodcast.com              → Landing container (nginx)
  │     ├─ /releases/*        read-only host volume (APK + metadata)
  │     └─ /api/fast-english/public/settings     → PocketBase (EXACT path only)
  ├─ https://www.fastenglishpodcast.com          → 308 → canonical root
  ├─ https://app.fastenglishpodcast.com          → Student App container (nginx)
  │     ├─ /            SPA fallback + PWA headers
  │     └─ /api/*        → PocketBase (6 MiB buffering; 64 MiB content-import)
  ├─ https://admin.fastenglishpodcast.com        → Admin Console container (nginx)
  │     ├─ /            → 308 → /operator (SPA fallback)
  │     └─ /api/*        → PocketBase (6 MiB buffering; 64 MiB content-import)
  └─ PocketBase container (internal service; NO public port)
        ├─ /pb/pb_data  ← host bind mount /opt/fast-english/shared/pb_data (UID 10001)
        ├─ migrations + hooks + binary baked into the immutable image
        └─ host loopback 127.0.0.1:8090 (maintenance access only)

GitHub ── quality gate (canonical, unchanged)
   └─ release-deploy.yml (manual, exact commit) ──▶ build+verify 4 images ──▶ GHCR
        └─▶ Coolify deploy webhook ──▶ poll deployment status ──▶ public health ──▶ smoke ──▶ verdict
```

**Operating model (decision D1):** Coolify Cloud ($5/mo base) + owned production
VPS. Coolify Cloud is the management plane; the VPS runs only Docker containers
managed by Coolify. Only ports 22/80/443 are ever open on the VPS.

**One proxy layer:** Coolify-managed Traefik. Caddy is retired; the nginx
configs inside the frontend images (`docker/*/nginx.conf`) reproduce the
accepted static-serving, cache, header, redirect and log-redaction contracts.

## 1. The four immutable images

| Image | Dockerfile | Runtime | Container port | Health check | Content |
|---|---|---|---|---|---|
| `landing` | `docker/landing/Dockerfile` | nginx:1.27.5-alpine, USER nginx | 8080 | `GET /healthz` → 200 | static multi-page + prerender; `/srv/releases` host volume |
| `app` | `docker/app/Dockerfile` | nginx:1.27.5-alpine, USER nginx | 8080 | `GET /healthz` → 200 | Student SPA + PWA (`sw.js`, `manifest.webmanifest`) |
| `admin` | `docker/admin/Dockerfile` | nginx:1.27.5-alpine, USER nginx | 8080 | `GET /healthz` → 200 | Admin SPA (no SW/manifest by design) |
| `pocketbase` | `docker/pocketbase/Dockerfile` | alpine:3.21.4, UID/GID **10001** | 8090 | image HEALTHCHECK `/api/health` (wget) | pinned binary 0.39.9 (sha256-verified), `pb_migrations`, `pb_hooks`, `VERSION` |

- Pinned versions: Node `24.13.0-bookworm-slim` (build), nginx `1.27.5-alpine`,
  alpine `3.21.4`, PocketBase **0.39.9** (`server/VERSION` +
  `server/pocketbase.sha256`, verified at build). **`latest` is never used.**
- Image identity: OCI labels (`org.opencontainers.image.revision/version`,
  `com.fastenglish.*`) + the `data-{app,landing,admin}-version` markers Vite
  bakes into the served HTML.
- Non-root everywhere: PocketBase 10001:10001 (fixed), nginx `nginx` user.
- `pb_data` is **never** in the image; the entrypoint refuses to start
  without the storage mount (no container-local database is possible).

## 2. GHCR image registry

- Registry: `ghcr.io/<owner>/fast-english/{landing,app,admin,pocketbase}`
- Immutable tag: `sha-<12-hex-commit>` (always).
- Managed alias: `production` (only via the release workflow; never `latest`).
- Builds: `.github/workflows/build-images.yml` (pinned actions v4/v7/v4,
  GHCR login via GITHUB_TOKEN or `GHCR_PUBLISH_TOKEN`, digests in the job
  summary). **The VPS never builds images.**

## 3. Repository release workflows

### 3.1 `release-deploy.yml` (manual release: production + staging)

`Actions → Deploy Production → Run workflow` with:

| Input | Meaning |
|---|---|
| `ref` | exact commit/tag to release (required) |
| `surfaces` | `landing,app,admin,pocketbase` (default all) |
| `smoke` | `quick` (public) or `full` (disposable accounts) |
| `publish_production_alias` | publish the `production` image alias (default true) |
| `environment` | `production` (default) or `staging` — selects the GitHub
  Environment whose secrets the release uses and the deploy behavior |

Environment semantics:

- **production** (default): unchanged legacy behavior — Coolify apps track the
  moving `production` alias, which the workflow publishes ONLY after health +
  smoke pass.
- **staging**: the workflow first PATCHes the requested Coolify apps to the
  immutable `sha-<commit>` tag (same contract as `rollback-deploy.yml`, O5),
  then deploys with `force` (guaranteed re-pull of the pinned tag). The
  `production` alias is NEVER moved from a staging run — the workflow
  refuses `environment=staging` combined with
  `publish_production_alias=true`. Staging verification FAILS CLOSED: the
  `staging` environment must define `FEP_PROD_HEALTH_{ROOT,WWW,APP,ADMIN}`
  and `FEP_SMOKE_{ROOT,APP,ADMIN}` (staging domains) or the workflow
  refuses to run — an unset secret would otherwise fall back to the
  production domains in the health/smoke scripts. `environment=production`
  with `publish_production_alias=false` is also refused (a production
  release that cannot ship the alias would report a false GREEN).

Pipeline (all evidence in the job summary):

1. **resolve** — exact SHA + version at that ref.
2. **gate-quality** — the canonical `quality` workflow's merge-gate run for
   that commit (the `verify` job that aggregates the static/backend/e2e
   lanes) must be green; a red/missing canonical gate **blocks the release**.
3. **classify** — change class A–E derived from the Git diff
   (`scripts/release-classify.sh`), shown in the summary.
4. **infra-gate** — `pnpm test:infra:coolify` on the exact commit: builds the
   four images locally and runs the persistence / backup-restore / migration /
   routing-contract / secret-scan / log-redaction / Coolify-contract proofs.
5. **build-images** — GHCR publication of the four immutable images
   (sha-<commit> only; the `production` alias is published later, after
   verification — see step 9).
6. **predeploy-backup** — ONLY for class B/C: verified pre-deploy backup on
   the host via SSH (`FEP_SSH_*` secrets; `backup.sh fep-backup-predeploy-…`),
   artifact verified to exist, plus the off-VPS backup gate
   (`deploy/check-offsite.sh`, read-only).
7. **deploy** (environment `production`, manual approval gate; skipped
   predeploy-backup must NOT skip this job) — per surface:
   `scripts/coolify-deploy.sh` (POST `/api/v1/deploy` → parse
   `deployment_uuid` → poll `GET /api/v1/deployments/<uuid>` to `finished`;
   RED on `failed`/`cancelled-by-user`/timeout) → independent public HTTPS
   health (`scripts/prod-health-check.sh`, validates PocketBase JSON bodies
   so a Traefik fallback can never fake health).
8. **smoke** — `smoke-prod.sh` (`quick`/`full`) against the real HTTPS domains.
9. **publish `production` alias** — ONLY after smoke passed (post-approval,
   post-verification): `docker buildx imagetools create` re-points
   `:production` → sha-<commit> for the verified surfaces. Coolify apps pull
   `:production`, so this is what ships the release.
10. **verdict** — GREEN only when Coolify status + health + smoke all pass;
    RED otherwise with the exact next action per failure class (§7).

Secrets (names only; values in GitHub Environment `production`):
`COOLIFY_BASE_URL`, `COOLIFY_API_TOKEN` (deploy-scoped, MFA-protected team),
`COOLIFY_APP_UUID_{LANDING,APP,ADMIN,POCKETBASE}`, `GHCR_PUBLISH_TOKEN`
(optional), `FEP_SSH_HOST/USER/KEY`, `FEP_SMOKE_STAFF_EMAIL/PASSWORD`,
`FEP_SUPERUSER_EMAIL/PASSWORD`. Mirror of the host secrets file
(`/opt/fast-english/shared/secrets/pocketbase.env`).

### 3.2 `rollback-deploy.yml` (manual rollback)

Inputs: `surface`, `image_sha` (previous known-good commit), `environment`
(`production` default / `staging`), and — PocketBase only —
`confirm_migration_safe` (default false ⇒ the workflow **refuses** a
PocketBase rollback unless the operator attests migration compatibility).
Mechanics: `PATCH /api/v1/applications/{uuid}` with
`docker_registry_image_tag: sha-<image_sha>` → `coolify-deploy.sh` → health →
quick smoke. **Never touches pb_data.**

## 4. Coolify Cloud: connect the VPS

Current official procedure (Coolify docs, v4; Cloud dashboard at
app.coolify.io):

1. Order a VPS (Debian/Ubuntu LTS recommended; 2 vCPU/4 GB/40 GB baseline;
   staging can be smaller).
2. Provider firewall: open **22** (restricted to Coolify Cloud IPs + your
   operator IP), **80**, **443** only. Docker/NAT traffic is not filtered by
   host firewalls (UFW) — the provider firewall is the boundary.
3. Coolify Cloud → **Servers → Connect**: paste the SSH command; Coolify
   validates SSH access and installs Docker automatically. Use root or a
   sudo-capable user per the current dashboard instructions.
4. Validate: the server appears online; Docker version shown; SSH trust
   boundary = Coolify Cloud holds the key — restrict SSH by source IP at the
   provider firewall.
5. Never open dashboard ports (8000/6001/6002 are for self-hosted Coolify,
   not needed with Coolify Cloud).

## 5. Host initialization (one-time, on the VPS)

```bash
mkdir -p /opt/fast-english/shared/{pb_data,backups,releases,secrets}
# PocketBase runtime identity is FIXED: UID/GID 10001 (never change the
# image ARG without updating this contract)
chown -R 10001:10001 /opt/fast-english/shared/pb_data /opt/fast-english/shared/backups
chmod 750 /opt/fast-english/shared/pb_data /opt/fast-english/shared/backups
chmod 700 /opt/fast-english/shared/secrets
chmod 755 /opt/fast-english/shared/releases

# secrets file (names only documented — see deploy/env.production.example)
install -m 0600 /dev/stdin /opt/fast-english/shared/secrets/pocketbase.env <<'EOF'
FEP_SUPERUSER_EMAIL=<...>
FEP_SUPERUSER_PASSWORD=<...>
PB_ENCRYPTION_KEY=<...>
EOF

# host-level backup copy helper + timer (KEEP — independent of containers)
install -m 0755 deploy/backup.sh /opt/fast-english/shared/scripts/fep-backup.sh
install -m 0755 deploy/backup-copy.sh /opt/fast-english/shared/scripts/fep-backup-copy.sh
install -m 0755 deploy/check-offsite.sh /opt/fast-english/shared/scripts/fep-check-offsite.sh
install -m 0644 deploy/systemd/fast-english-backup-copy.service /etc/systemd/system/
install -m 0644 deploy/systemd/fast-english-backup-copy.timer /etc/systemd/system/
systemctl daemon-reload && systemctl enable --now fast-english-backup-copy.timer
# sanity: the scripts the release workflow calls exist
bash /opt/fast-english/shared/scripts/fep-check-offsite.sh || true  # will FAIL until S3 is configured (Gate C15)
```

**The PocketBase bind mount is `host:/opt/fast-english/shared/pb_data` →
`container:/pb/pb_data` (read-write).** If ownership is wrong, the container
exits with a clear FATAL message naming the `chown` command — never run
PocketBase as root to work around it.

## 6. The four Coolify Applications

Create four Applications with build pack **Docker Image** (pull from GHCR;
auto-updates OFF; deployments via the release workflow — never "on push").

| Field | Landing | Student App | Admin | PocketBase |
|---|---|---|---|---|
| Resource name | `fep-landing` | `fep-app` | `fep-admin` | `fep-pocketbase` |
| Image | `ghcr.io/…/fast-english/landing:production` | `…/app:production` | `…/admin:production` | `…/pocketbase:production` |
| Ports exposed | 8080 | 8080 | 8080 | 8090 |
| Domain(s) | `fastenglishpodcast.com` + path route `fastenglishpodcast.com/api/fast-english/public/settings` (exact path → this app) | `app.fastenglishpodcast.com` (root) + path route `app.fastenglishpodcast.com/api` | `admin.fastenglishpodcast.com` (root) + path route `admin.fastenglishpodcast.com/api` | (no public domain of its own) |
| www redirect | Coolify Direction: redirect www → non-www (308) on the Landing app | — | — | — |
| Health check | `/healthz` port 8080 (HTTP 200) | `/healthz` port 8080 | `/healthz` port 8080 | `/api/health` port 8090 (Dockerfile HEALTHCHECK takes precedence) |
| Persistent storage | `/srv/releases` ← host `/opt/fast-english/shared/releases` (read-only) | — | — | `/pb/pb_data` ← host `/opt/fast-english/shared/pb_data` (read-write) |
| Required env | — | — | — | `PB_ENCRYPTION_KEY` (must equal the host secrets file) |
| Restart behavior | restart on failure, no auto-update | same | same | same; **Coolify must never delete/replace the host pb_data dir** |
| Deployment strategy | image redeploy (new container after health) | same | same | same (migrations run on startup) |
| Network/API | Traefik path route for the ONE public-settings path; everything else `/api/*` on this domain → 404 | Traefik path route `/api/*` → PocketBase; Request-Buffering middleware 6 MiB (64 MiB for `/api/fast-english/staff/content-import/*`) | Traefik path route `/api/*` → PocketBase; same buffering | internal only; no public port; host loopback mapping `127.0.0.1:8090:8090` (maintenance scripts) |

Additional notes:

- The Student/Admin nginx refuses `/api/*` and `/_/*` directly (defence in
  depth) — the Traefik path route is the primary path.
- Traefik Request-Buffering middleware (Coolify custom middleware) reproduces
  the retired Caddy body bounds: 6 MiB general API, 64 MiB content-import.
- Loopback mapping `127.0.0.1:8090:8090` keeps `backup.sh`, `configure.sh`,
  `restore-drill.sh` and `ops-check.sh` working unchanged against
  `http://127.0.0.1:8090` (verify the IP-bound port mapping works on the
  Coolify version in staging — open item O1).
- Deploying Landing/Student/Admin alone never restarts PocketBase (verified
  locally by the routing-contract suite; to be re-verified live in staging).

## 7. Deployment change classification and failure handling

| Class | Meaning | Required behavior |
|---|---|---|
| A | Landing/Student/Admin only | No PB restart; no backup solely for UI |
| B | PB hooks/backend, no migration | Pre-deploy backup (policy); PB redeploy; health + backend smoke |
| C | Migration | Pre-deploy verified backup MANDATORY; compatibility warning; rollback does NOT reverse the migration |
| D | Config/secret | Controlled runtime update; restart only the affected service |
| E | Android | Not deployed via the web-container workflow (see ANDROID_RELEASE.md) |

Derived automatically from the diff (`scripts/release-classify.sh`); shown in
the release summary. A migration (any change under `server/pb_migrations`)
is always class C — automation never assumes migration safety.

**RED outcomes and next actions (never automatic destructive recovery):**

| Failure | Detected by | Next action |
|---|---|---|
| Deploy trigger failed | `coolify-deploy.sh` exit 2 / no `deployment_uuid` | Check Coolify API token/UUIDs; no production change happened |
| Coolify build/deploy failed | poll → `failed`/`cancelled-by-user` (exit 3) or timeout (exit 4) | Coolify dashboard → deployment log; rollback to previous image (`rollback-deploy.yml`) |
| Health failed | `prod-health-check.sh` non-zero | Check Traefik routing + container status; frontends → rollback image; PB → §8 |
| Smoke failed | `smoke-prod.sh` non-zero | Do NOT restore data automatically; frontends → previous image; PB without migration → previous image; PB after migration → §8.3 |

## 8. Rollback contract

1. **Frontends:** previous known-good image/digest (`rollback-deploy.yml`,
   `image_sha`) → deploy → health → smoke. PocketBase never restarts.
2. **PocketBase without migration:** previous image → **same persistent
   `pb_data`** → health → backend smoke.
3. **PocketBase after migration:** **STOP automatic rollback.** An image
   rollback does not reverse an applied migration (proven locally by
   `tests/infra/06-pb-migration.sh`). Recovery from a bad migration release
   = restore the verified pre-deploy backup via the emergency procedure
   (`docs/BACKUP_RESTORE.md` §5) after a compatibility review.
4. **Data corruption:** restore a verified backup only through the explicit
   emergency procedure — never automatically.
5. **Coolify must never automatically replace or delete
   `/opt/fast-english/shared/pb_data`.** It is a bind mount owned by the
   fixed backend UID/GID; rollback swaps images only.

## 9. Backups (three layers — preserved)

1. **Live data:** `/opt/fast-english/shared/pb_data` (host bind mount).
2. **Local copies:** PB-native `backups.cron` 02:30 UTC (keep 14, inside
   pb_data) → host `backup-copy.sh` systemd timer 02:40 UTC → verified ZIPs
   in `/opt/fast-english/shared/backups` (separate from pb_data). The host
   timer is container-independent and survives every redeploy.
3. **Off-VPS:** PocketBase-native S3-compatible backups (`configure.sh` with
   `FEP_BACKUP_S3_*`) — a **Production Gate**; Coolify's generic database
   backup does NOT cover SQLite/PocketBase and is not used.

On-demand: `bash deploy/backup.sh [name]`. Restore drill:
`bash deploy/restore-drill.sh [name]` (disposable instance, fail-closed,
never touches live data). Record-level proof: `pnpm smoke:restore-proof`;
container-era proofs: `pnpm test:infra:coolify` (delete/recreate persistence
+ backup→clean-restore into a brand-new empty directory + migration lifecycle).

## 10. DNS runbook (execute once the VPS IP exists)

| Name | Type | Value |
|---|---|---|
| `fastenglishpodcast.com` | A | `<VPS-IP>` |
| `www.fastenglishpodcast.com` | A | `<VPS-IP>` |
| `app.fastenglishpodcast.com` | A | `<VPS-IP>` |
| `admin.fastenglishpodcast.com` | A | `<VPS-IP>` |
| staging (see §13) | A | `<STAGING-VPS-IP>` × 4 names |

- Create the records AFTER the VPS exists and the provider firewall is open
  (80/443), before/when creating the Coolify apps.
- Confirm propagation: `dig +short fastenglishpodcast.com` on several
  resolvers; `dig fastenglishpodcast.com @8.8.8.8`.
- TLS: Coolify/Traefik issues Let's Encrypt automatically once DNS + port 443
  resolve to the VPS — no manual cert steps. Test:
  `curl -fsSI https://app.fastenglishpodcast.com/api/health` and
  `echo | openssl s_client -servername fastenglishpodcast.com -connect <IP>:443 | openssl x509 -noout -dates`.
- www: Coolify Direction "redirect to non-www" (308) on the Landing app;
  verify `curl -sI https://www.fastenglishpodcast.com` → 308 Location root.
- Do NOT invent the IP: it comes from the VPS provider (next phase).

## 11. Firewall

Provider firewall (the only effective boundary for Docker/NAT):

| Port | Purpose | Source |
|---|---|---|
| 22/tcp | SSH (Coolify Cloud connect + operator) | Coolify Cloud IPs + operator IP (restrict where the provider allows) |
| 80/tcp | HTTP → Traefik (Let's Encrypt + redirects) | 0.0.0.0/0 |
| 443/tcp | HTTPS | 0.0.0.0/0 |

- **Never** expose 8090 (PocketBase), 8000/6001/6002 (self-hosted Coolify —
  not used with Cloud), or any Docker range.
- Host-level UFW is not relied upon (Docker NAT bypasses it); optional extra
  hardening only.

## 12. Security posture (Coolify era)

- Coolify Cloud account: **MFA required**; team least-privilege; API tokens
  **deploy-scoped**, expiring, per team; rotate on any suspicion.
- GitHub: `production` environment with **required reviewers** (approval gate);
  secrets only in that environment; `release-deploy`/`rollback-deploy` are the
  only production mutation paths; no auto-deploy on push.
- SSH key custody: the Coolify-held key is the trust boundary — provider
  firewall restricts SSH sources; operator SSH key for the pre-deploy backup
  step lives in GitHub secrets (or a passphrase-protected local key).
- Containers: non-root everywhere; PocketBase UID 10001; no `privileged` mode,
  no host Docker socket mounts, no host network.
- PocketBase: no public port; superuser `/_/` 404 on all domains; schema
  locked (`meta.hideControls`); loopback-only maintenance; superuser IP
  whitelist recommended.
- Secrets: never in code; `VITE_*` build-time values are NOT secrets and live
  in the build env; the only container runtime secret is
  `PB_ENCRYPTION_KEY` (Coolify stores env encrypted; dashboard access is
  MFA-gated; keep in sync with the host file and rotate both together).
- Supply chain: pinned versions + checksums (PocketBase), pinned actions,
  immutable sha tags, GHCR provenance, no `latest`.

## 13. Staging

- Separate small VPS (or clearly isolated server resources), separate project
  in the same Coolify Cloud account, **completely separate** `pb_data`,
  secrets, Staff/Student accounts, backup location (S3 prefix/bucket) and
  domains: `staging.fastenglishpodcast.com`, `app-staging.…`,
  `admin-staging.…` (+ `staging` www if desired).
- **Never share the Production database with Staging.**
- Staging is the vehicle for the failure-injection acceptance checklist:
  `docs/STAGING.md` (bad images, failing PB startup, broken hook, health
  failure, missing env, container deletion/recreation, persistent data proof,
  failed frontend deploy, previous-image rollback, backend rollback without
  migration, migration rollback warning, off-site restore, proxy routing
  failure, VPS restart, Docker restart).
- Staging deploys use the same GHCR images (sha tags) — the exact commit
  tested in staging is what production later pins.

## 14. Observability after Coolify

- `deploy/ops-check.sh` (adapted): container state + restarts (docker),
  loopback + public PocketBase health (JSON body), certificates, disk,
  backup age + container-log backup errors, 5xx from frontend container
  logs, optional Coolify API status. Exit 0/1/2; cron-friendly.
- Coolify built-ins: deployment history, container status/restarts, disk
  alerts, webhook notifications (`deployment_success|failed`,
  `status_changed`, `backup_*`, `server_unreachable`, `high_disk_usage`,
  `container_stopped|restarted`).
- No separate monitoring platform (unchanged, not approved).

## 15. Logging and token redaction (Coolify era)

- Frontend nginx configs log **without query strings** (`$uri`, never
  `$request_uri`) — audio/file tokens (`?token=…`) can never appear in their
  logs. Executable proof: `bash deploy/test-nginx-log-redaction.sh` (also
  suite 08 of `pnpm test:infra:coolify`).
- Coolify/Traefik access logs: **keep disabled** (Coolify default). This is
  the documented residual limitation — Traefik has no built-in query
  redaction; access logging stays off; dashboard access is MFA-protected.
- PocketBase internal activity logs record request URIs (incl. queries) —
  pre-existing behavior, superuser-only via loopback/SSH tunnel,
  `logs.maxDays=30`, unchanged by this migration.
- The old Caddy access-log filter proof (`deploy/test-log-redaction.sh`)
  stays wired into the canonical quality gate as the legacy proof.

## 16. Legacy/retired artifacts (classification)

| Artifact | Status |
|---|---|
| `deploy/Caddyfile` | LEGACY / RETIRED (historical fallback only) |
| `deploy/systemd/fast-english-pocketbase.service` | LEGACY / RETIRED |
| `deploy/systemd/fast-english-backup-copy.{service,timer}` | KEEP (host-level, container-independent) |
| `deploy/install.sh` | LEGACY / RETIRED (provisioning = this runbook) |
| `deploy/deploy.sh` | LEGACY FALLBACK (replaced by GHCR + release-deploy pipeline) |
| `deploy/backup.sh`, `backup-copy.sh` | KEEP |
| `deploy/configure.sh` | KEEP/ADAPT (loopback) |
| `deploy/restore-drill.sh` | ADAPT (repo-relative hooks/migrations/binary) |
| `deploy/smoke-prod.sh` | KEEP/ADAPT (admin marker corrected) |
| `deploy/ops-check.sh` | ADAPT (container + public-HTTPS checks) |
| `deploy/test-log-redaction.sh` | LEGACY PROOF (KEEP — still in the canonical gate) |
| `deploy/test-nginx-log-redaction.sh` | KEEP (new, Coolify-era proof) |
| `docs/DEPLOYMENT.md` | LEGACY reference (banner added; superseded by this doc) |
| `docs/COOLIFY_DEPLOYMENT.md` | **CANONICAL (this document)** |

## 17. Next phase (external launch inputs)

Repository-side Coolify engineering is COMPLETE. The next phase is
operational, requires external resources, and must NOT be performed from this
repository task:

1. Purchase the production VPS + a small staging VPS; record their IPs.
2. Create the Coolify Cloud account (MFA); connect both servers.
3. Create the DNS records (§10).
4. Configure provider firewalls (§11).
5. Create the four Coolify Applications (§6) on production + staging copies.
6. Run `docs/STAGING.md` acceptance (failure-injection) on staging.
7. Configure + verify the off-VPS backup destination (S3).
8. First production release via `release-deploy.yml` + full smoke.
9. Real Android APK publishing + physical-device tests.
10. Open items verified live in staging (O1–O5 below).

**Open items to verify against a real Coolify instance (staging):**

- O1 — `127.0.0.1:8090:8090` IP-bound port mapping on a Docker-Image app
  (fallback: Compose-based PB or docker-exec wrappers).
- O2 — image redeploy re-pulls the updated `production`/`sha-` tag.
- O3 — health checks gate Traefik routing AND Coolify marks bad deploys
  failed (incl. "unhealthy → 404 / no available server" behavior).
- O4 — path-route priority: landing exact settings path vs `/`; app/admin
  `/api` vs `/`; fallback-to-root must NOT expose generic landing `/api`.
- O5 — rollback to a previous GHCR-sourced image (`local images only`
  constraint) via the Applications PATCH + deploy flow.

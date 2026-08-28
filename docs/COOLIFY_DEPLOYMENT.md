# Fast English Podcast — Coolify Deployment (canonical, self-hosted)

> **Status: canonical production deployment guide (self-hosted Coolify era).**
> Supersedes `docs/DEPLOYMENT.md` (Caddy + systemd era — LEGACY/RETIRED,
> kept as historical fallback). The Persian Technical Owner guide is
> `docs/TECHNICAL_OWNER_RUNBOOK_FA.md`.
> **Last updated:** 2026-08-28 — self-hosted Coolify contract (immutable sha-<commit> identity, fail-closed base URL, explicit API routing).

## 0. Architecture (final)

```text
Internet ── 80/443 ──▶ Coolify-managed Traefik (on the owned production VPS, self-hosted Coolify)
  ├─ https://fastenglishpodcast.com              → Landing container (nginx) — owns root
  │     ├─ /               static multi-page + prerender
  │     ├─ /releases/*     read-only host volume (APK + metadata)
  │     ├─ /api/fast-english/public/settings ──▶ PocketBase (EXACT path only; direct to PB)
  │     └─ /api/*          404 (never via Landing; nginx refuses; Traefik never routes generic /api here)
  ├─ https://www.fastenglishpodcast.com          → 308 → canonical root
  ├─ https://app.fastenglishpodcast.com          → Student App container (nginx) — owns root
  │     ├─ /               SPA fallback + PWA headers (nginx owns root)
  │     └─ /api/*  ──────────────────────────────────▶ PocketBase (direct; nginx refuses /api/*)
  ├─ https://admin.fastenglishpodcast.com        → Admin Console container (nginx) — owns root
  │     ├─ /               → 308 → /operator (nginx) then SPA fallback (owns root)
  │     └─ /api/*  ──────────────────────────────────▶ PocketBase (direct; nginx refuses /api/*)
  └─ PocketBase container (internal service; NO public hostname, NO public 8090)
        ├─ /pb/pb_data  ← host bind mount /opt/fast-english/shared/pb_data (UID 10001)
        ├─ migrations + hooks + binary baked into the immutable image
        └─ host loopback 127.0.0.1:8090 (maintenance access only; not exposed via Traefik)

GitHub ── quality gate (canonical, unchanged)
   └─ release-deploy.yml (manual, exact commit) ──▶ build 4 sha-<commit> images ──▶ GHCR
        └─▶ PATCH Coolify app → sha-<commit> (authoritative) → POST /api/v1/deploy → poll → public health → smoke → verdict
             └─ optional post-verification `production` alias publish (secondary tag, never authoritative)
```

**Operating model (decision D1 — self-hosted):** Self-hosted Coolify on the owned production
VPS (Coolify installed via its official installer; Traefik managed by Coolify on the
same host). No Coolify Cloud dependency, no external management plane. Only ports 22/80/443 are
ever open on the VPS (Coolify dashboard is reached via the same 443/Traefik route or via SSH tunnel, never as an extra public port).

**One proxy layer:** Coolify-managed Traefik. Caddy is retired; the nginx configs inside the frontend images (`docker/*/nginx.conf`) reproduce the accepted static-serving, cache, header, redirect and log-redaction contracts.

**Routing ownership contract (canonical):**
- Frontend resources own their root web domains: Landing owns `fastenglishpodcast.com` `/`, Student App owns `app.fastenglishpodcast.com` `/`, Admin owns `admin.fastenglishpodcast.com` `/` (and staged `/operator`). Traefik routes root traffic to these nginx containers.
- PocketBase owns the accepted API path routes and is reached DIRECTLY via Traefik path routing, never via the frontend nginx:
  - `app.fastenglishpodcast.com/api/*` → PocketBase
  - `admin.fastenglishpodcast.com/api/*` → PocketBase
  - `fastenglishpodcast.com/api/fast-english/public/settings` → PocketBase (EXACT path only; all other `/api/*` on Landing → 404)
- PocketBase has NO standalone public hostname and port 8090 must never become publicly exposed (Traefik does NOT publish 8090; only `127.0.0.1:8090:8090` loopback for maintenance).

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
- Immutable tag: `sha-<12-hex-commit>` (always, authoritative).
- Optional moving alias: `production` — published ONLY post-verification via
  `docker buildx imagetools create` when `publish_production_alias=true`
  (production only). This is a convenience tag and is NEVER the authoritative
  deployment identity (deployments pin the `sha-<commit>` tag directly).
- Builds: `.github/workflows/build-images.yml` (pinned actions, GHCR login
  via GITHUB_TOKEN or `GHCR_PUBLISH_TOKEN`, digests in the job summary).
  **The VPS never builds images.**

## 3. Repository release workflows

### 3.1 `release-deploy.yml` (manual release: production + staging — self-hosted)

`Actions → release-deploy → Run workflow` with:

| Input | Meaning |
|---|---|
| `ref` | exact commit/tag to release (required) |
| `surfaces` | `landing,app,admin,pocketbase` (default all) |
| `smoke` | `quick` (public) or `full` (disposable accounts) |
| `publish_production_alias` | publish the `production` convenience alias post-verification (default true, production only; never authoritative) |
| `environment` | `production` (default) or `staging` — selects the GitHub Environment whose secrets the release uses |

Environment semantics (self-hosted, immutable):

- **Both production and staging** pin the requested Coolify apps to the
  immutable `sha-<commit>` tag BEFORE triggering the deploy:
  `PATCH /api/v1/applications/{uuid} {"docker_registry_image_tag":"sha-<commit>"}`
  then `POST /api/v1/deploy {"uuid":…,"force":true}` with status polling.
  The image verified by health + smoke is exactly the image that was
  deployed. Staging and production use the same principle and secrets are
  isolated by GitHub Environment.
- The `production` alias is NEVER authoritative. When `publish_production_alias=true`
  (production only) the workflow publishes `production → sha-<commit>` AFTER
  health + smoke pass as a secondary tag. Staging with `publish_production_alias=true`
  is refused (never move the production alias from a staging run).

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
   (`sha-<commit>` only; alias not published here).
6. **predeploy-backup** — ONLY for class B/C: verified pre-deploy backup on
   the host via SSH (`FEP_SSH_*` secrets; `backup.sh fep-backup-predeploy-…`),
   artifact verified to exist, plus the off-VPS backup gate
   (`deploy/check-offsite.sh`, read-only).
7. **deploy** — pins each requested surface to `sha-<commit>` (fail-closed when
   `COOLIFY_BASE_URL`, `COOLIFY_API_TOKEN`, or the per-surface UUID is
   missing — no fallback), then per surface:
   `scripts/coolify-deploy.sh --force` (`POST /api/v1/deploy` → parse
   `deployment_uuid` → poll `GET /api/v1/deployments/<uuid>` to `finished`;
   RED on `failed`/`cancelled-by-user`/timeout) → independent public HTTPS
   health (`scripts/prod-health-check.sh`, validates PocketBase JSON bodies
   so a Traefik fallback can never fake health).
8. **smoke** — `smoke-prod.sh` (`quick`/`full`) against the real HTTPS domains.
9. **publish `production` alias (optional, production only, post-verification)** —
   `docker buildx imagetools create` re-points `:production` → `sha-<commit>`
   for the verified surfaces. This is a convenience tag only.
10. **verdict** — GREEN only when Coolify status + health + smoke all pass;
    RED otherwise with the exact next action per failure class (§7).

Required secrets (names only; values in the selected GitHub Environment;
self-hosted Coolify — no Cloud fallback):

- `COOLIFY_BASE_URL` — self-hosted Coolify base URL (e.g. `https://coolify.example.com`); **required, fail-closed, no default** (the workflow and `coolify-deploy.sh` refuse to run when absent).
- `COOLIFY_API_TOKEN` — deploy-scoped API token from the self-hosted instance; required.
- `COOLIFY_APP_UUID_{LANDING,APP,ADMIN,POCKETBASE}` — one per surface; required for the surfaces being deployed.
- `GHCR_PUBLISH_TOKEN` (optional), `FEP_SSH_HOST/USER/KEY` (pre-deploy backup step only), `FEP_SMOKE_STAFF_EMAIL/PASSWORD`, `FEP_SUPERUSER_EMAIL/PASSWORD`. Mirror of the host secrets file where applicable (`/opt/fast-english/shared/secrets/pocketbase.env`).

### 3.2 `rollback-deploy.yml` (manual rollback — self-hosted)

Inputs: `surface`, `image_sha` (previous known-good commit), `environment`
(`production` default / `staging`), and — PocketBase only —
`confirm_migration_safe` (default false ⇒ the workflow **refuses** a
PocketBase rollback unless the operator attests migration compatibility).
Mechanics: `PATCH /api/v1/applications/{uuid}` with
`docker_registry_image_tag: sha-<image_sha>` → `coolify-deploy.sh --force` → health →
quick smoke. **Never touches pb_data.** Requires `COOLIFY_BASE_URL` + `COOLIFY_API_TOKEN`
+ the per-surface UUID; fail-closed with no `https://app.coolify.io` fallback.

## 4. Self-hosted Coolify: install & connect the VPS

Self-hosted Coolify runs on your owned VPS and manages Traefik + the four
applications on the same host (no external Cloud plane).

1. Order a VPS (Debian/Ubuntu LTS recommended; 2 vCPU/4 GB/40 GB baseline;
   staging can be smaller). Record its public IP.
2. Provider firewall: open **22** (restricted to your operator IP), **80**,
   **443** only. Docker/NAT traffic is not filtered by host UFW — the provider
   firewall is the boundary. Never expose 8090 or raw Docker ranges.
3. Install Coolify (self-hosted) per its official docs (e.g. `curl -fsSL https://cdn.coolify.io/install.sh | bash` on the VPS as root, or the current documented installer). Validate the dashboard is reachable via its configured URL (e.g. `https://coolify.example.com` behind Traefik) and that Docker is managed by Coolify.
4. Harden dashboard access: restrict by source IP where possible, require strong
   auth, and create a deploy-scoped API token for GitHub Actions (`COOLIFY_API_TOKEN`).
5. Never open extra dashboard ports beyond what the self-hosted installer
   documents for your deployment (the apps are reached via 80/443 through
   Traefik; PocketBase 8090 stays loopback-only).

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

## 6. The four Coolify Applications (self-hosted)

Create four Applications with build pack **Docker Image** (pull from GHCR;
auto-updates OFF; deployments via the release workflow — never "on push").

| Field | Landing | Student App | Admin | PocketBase |
|---|---|---|---|---|
| Resource name | `fep-landing` | `fep-app` | `fep-admin` | `fep-pocketbase` |
| Image | `ghcr.io/…/fast-english/landing:sha-<commit>` (pinned per release; `:production` is only a secondary alias) | `…/app:sha-<commit>` | `…/admin:sha-<commit>` | `…/pocketbase:sha-<commit>` |
| Ports exposed | 8080 | 8080 | 8080 | 8090 |
| Domain(s) | `fastenglishpodcast.com` (owns root) + Traefik path route `fastenglishpodcast.com/api/fast-english/public/settings` (EXACT path → PocketBase directly) | `app.fastenglishpodcast.com` (owns root) + Traefik path route `app.fastenglishpodcast.com/api/*` → PocketBase directly | `admin.fastenglishpodcast.com` (owns root) + Traefik path route `admin.fastenglishpodcast.com/api/*` → PocketBase directly | (no public domain; not exposed via Traefik) |
| www redirect | Traefik/Coolify redirect www → non-www (308) on the Landing app | — | — | — |
| Health check | `/healthz` port 8080 (HTTP 200) | `/healthz` port 8080 | `/healthz` port 8080 | `/api/health` port 8090 (Dockerfile HEALTHCHECK) |
| Persistent storage | `/srv/releases` ← host `/opt/fast-english/shared/releases` (read-only) | — | — | `/pb/pb_data` ← host `/opt/fast-english/shared/pb_data` (read-write) |
| Required env | — | — | — | `PB_ENCRYPTION_KEY` (must equal the host secrets file) |
| Restart behavior | restart on failure, no auto-update | same | same | same; **Coolify must never delete/replace the host pb_data dir** |
| Deployment strategy | `PATCH sha-<commit>` + `deploy --force` → new container after health (immutable) | same | same | same (migrations run on startup) |
| Network/API | Traefik path route for the ONE public-settings exact path → PocketBase; everything else `/api/*` on this domain → 404 (nginx refuses) | Traefik path route `/api/*` → PocketBase directly; Request-Buffering middleware 6 MiB (64 MiB for `/api/fast-english/staff/content-import/*`); nginx refuses `/api/*` directly | Same as App: Traefik `/api/*` → PocketBase directly; same buffering; nginx refuses `/api/*` directly | internal only; no public Traefik route; host loopback mapping `127.0.0.1:8090:8090` (maintenance scripts) |

Additional notes:

- **Routing ownership proof:** Traefik (edge) routes `*/api/*` DIRECTLY to PocketBase. The Student/Admin/Landing nginx intentionally refuse `/api/*` and `/_/*` with 404 (defence in depth) — a routing misconfiguration can never serve API traffic through the frontend containers. The infra routing-contract suite (`tests/infra/07-routing-contract.sh` / `pnpm test:infra:coolify`) proves this against the disposable twin (infra/edge-router/nginx.conf reproduces the Traefik routes).
- Traefik Request-Buffering middleware (Coolify custom middleware) reproduces the retired Caddy body bounds: 6 MiB general API, 64 MiB content-import.
- Loopback mapping `127.0.0.1:8090:8090` keeps `backup.sh`, `configure.sh`, `restore-drill.sh` and `ops-check.sh` working unchanged against `http://127.0.0.1:8090` (verify the IP-bound port mapping works on the Coolify version in staging — open item O1).
- Deploying Landing/Student/Admin alone never restarts PocketBase (different Coolify applications; verified locally by the routing-contract suite; to be re-verified live in staging). Coolify must NOT restart PocketBase when only a frontend image changes.
- **No public 8090:** Traefik never publishes `8090`. The only `8090` mapping is the loopback `127.0.0.1:8090:8090` for host maintenance; firewall never opens 8090.
- Frontend containers serve root traffic; PocketBase serves only the accepted API path routes listed above. No wildcard API proxy through frontends.

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
| Deploy trigger failed | `coolify-deploy.sh` exit 2 / no `deployment_uuid` or missing `COOLIFY_BASE_URL`/token/UUID (fail-closed) | Check `COOLIFY_BASE_URL`, `COOLIFY_API_TOKEN`, `COOLIFY_APP_UUID_*`; no production change happened |
| Coolify build/deploy failed | poll → `failed`/`cancelled-by-user` (exit 3) or timeout (exit 4) | Coolify dashboard → deployment log; rollback to previous `sha-<commit>` via `rollback-deploy.yml` |
| Health failed | `prod-health-check.sh` non-zero | Check Traefik routing + container status; frontends → rollback to previous `sha-<commit>`; PB → §8 |
| Smoke failed | `smoke-prod.sh` non-zero | Do NOT restore data automatically; frontends → previous `sha-<commit>`; PB without migration → previous `sha-<commit>`; PB after migration → §8.3 |

## 8. Rollback contract

1. **Frontends:** previous known-good `sha-<commit>` (`rollback-deploy.yml`,
   `image_sha`) → `PATCH` + `deploy --force` → health → smoke. PocketBase never restarts.
2. **PocketBase without migration:** previous `sha-<commit>` → **same persistent
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
| `coolify.<domain>` (optional) | A | `<VPS-IP>` (self-hosted dashboard) |

- Create the records AFTER the VPS exists and the provider firewall is open
  (80/443), before/when creating the Coolify apps.
- Confirm propagation: `dig +short fastenglishpodcast.com` on several
  resolvers; `dig fastenglishpodcast.com @8.8.8.8`.
- TLS: Coolify/Traefik issues Let's Encrypt automatically once DNS + port 443
  resolve to the VPS — no manual cert steps. Test:
  `curl -fsSI https://app.fastenglishpodcast.com/api/health` and
  `echo | openssl s_client -servername fastenglishpodcast.com -connect <IP>:443 | openssl x509 -noout -dates`.
- www: Coolify/Traefik redirect www → non-www (308) on the Landing app;
  verify `curl -sI https://www.fastenglishpodcast.com` → 308 Location root.
- Self-hosted Coolify dashboard: if exposed via a hostname (e.g. `coolify.example.com`),
  create its A record as well and secure it (auth + restricted access).
- Do NOT invent the IP: it comes from the VPS provider (next phase).

## 11. Firewall

Provider firewall (the only effective boundary for Docker/NAT):

| Port | Purpose | Source |
|---|---|---|
| 22/tcp | SSH (operator) | Operator IP only (restrict where the provider allows) |
| 80/tcp | HTTP → Traefik (Let's Encrypt + redirects) | 0.0.0.0/0 |
| 443/tcp | HTTPS | 0.0.0.0/0 |

- **Never** expose 8090 (PocketBase), extra Coolify dashboard ports, or any Docker range beyond 80/443.
- Host-level UFW is not relied upon (Docker NAT bypasses it); optional extra
  hardening only.
- Coolify dashboard itself is reached via 443 (Traefik) or SSH tunnel — not by opening an extra public port.

## 12. Security posture (self-hosted Coolify era)

- Self-hosted Coolify: dashboard access secured (strong auth, restricted source IP where possible); API tokens **deploy-scoped**, expiring; rotate on any suspicion.
- GitHub: `production` environment with **required reviewers** (approval gate);
  secrets only in that environment (including `COOLIFY_BASE_URL` which is now
  required and never defaults); `release-deploy`/`rollback-deploy` are the only production mutation paths; no auto-deploy on push. A missing base URL or token fails closed (never falls back to `https://app.coolify.io`).
- Containers: non-root everywhere; PocketBase UID 10001; no `privileged` mode,
  no host Docker socket mounts, no host network.
- PocketBase: no public port (only loopback `127.0.0.1:8090`), superuser `/_/` 404 on all domains; schema locked (`meta.hideControls`); loopback-only maintenance; superuser IP whitelist recommended.
- Secrets: never in code; `VITE_*` build-time values are NOT secrets and live
  in the build env; the only container runtime secret is
  `PB_ENCRYPTION_KEY` (stored in Coolify env, host file, and GitHub Environment — keep in sync).
- Supply chain: pinned versions + checksums (PocketBase), pinned actions,
  immutable `sha-<commit>` tags, GHCR provenance, no `latest`. The `production` alias is never authoritative.

## 13. Staging (self-hosted)

- Separate small VPS (or clearly isolated server resources) with its own
  self-hosted Coolify instance (or a clearly isolated Coolify project/environment on the same self-hosted host — but with **completely separate** `pb_data`, secrets, Staff/Student accounts, backup location (S3 prefix/bucket) and domains: `staging.fastenglishpodcast.com`, `app-staging.…`,
  `admin-staging.…` (+ `staging` www if desired).
- **Never share the Production database with Staging.**
- Staging deploys use the same immutable-image mechanism (pin `sha-<commit>` then
  `--force` deploy) as production — never the moving alias.
- Staging is the vehicle for the failure-injection acceptance checklist:
  `docs/STAGING.md` (bad images, failing PB startup, broken hook, health
  failure, missing env, container deletion/recreation, persistent data proof,
  failed frontend deploy, previous-image rollback, backend rollback without
  migration, migration rollback warning, off-site restore, proxy routing
  failure, VPS restart, Docker restart).
- Staging deploys use the same GHCR images (sha tags) — the exact commit
  tested in staging is what production later pins. Staging verification fails
  closed when staging domain secrets are unset (never falls back to production
  domains).

## 14. Observability after Coolify

- `deploy/ops-check.sh` (adapted): container state + restarts (docker),
  loopback + public PocketBase health (JSON body), certificates, disk,
  backup age + container-log backup errors, 5xx from frontend container
  logs, optional Coolify API status (when `COOLIFY_BASE_URL` + `COOLIFY_API_TOKEN` provided). Exit 0/1/2; cron-friendly.
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
  redaction; access logging stays off; dashboard access is protected.
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
| `deploy/install.sh` | LEGACY / RETIRED (provisioning = this runbook §4/§5) |
| `deploy/deploy.sh` | LEGACY FALLBACK (replaced by GHCR + release-deploy pipeline) |
| `deploy/backup.sh`, `backup-copy.sh` | KEEP |
| `deploy/configure.sh` | KEEP/ADAPT (loopback) |
| `deploy/restore-drill.sh` | ADAPT (repo-relative hooks/migrations/binary) |
| `deploy/smoke-prod.sh` | KEEP/ADAPT (admin marker corrected) |
| `deploy/ops-check.sh` | ADAPT (container + public-HTTPS checks) |
| `deploy/test-log-redaction.sh` | LEGACY PROOF (KEEP — still in the canonical gate) |
| `deploy/test-nginx-log-redaction.sh` | KEEP (new, Coolify-era proof) |
| `docs/DEPLOYMENT.md` | LEGACY reference (banner added; superseded by this doc) |
| `docs/COOLIFY_DEPLOYMENT.md` | **CANONICAL (this document — self-hosted)** |

## 17. Next phase (external launch inputs)

Repository-side Coolify engineering is COMPLETE. The next phase is
operational, requires external resources, and must NOT be performed from this
repository task:

1. Purchase the production VPS + a small staging VPS; record their IPs.
2. Install self-hosted Coolify on both hosts; create the dashboard API tokens (store as `COOLIFY_BASE_URL` + `COOLIFY_API_TOKEN` in the GitHub Environments).
3. Create the DNS records (§10).
4. Configure provider firewalls (§11).
5. Create the four Coolify Applications (§6) on production + staging copies.
6. Run `docs/STAGING.md` acceptance (failure-injection) on staging.
7. Configure + verify the off-VPS backup destination (S3).
8. First production release via `release-deploy.yml` (pin `sha-<commit>`) + full smoke.
9. Real Android APK publishing + physical-device tests.
10. Open items verified live in staging (O1–O5 below).

**Open items to verify against a real Coolify instance (staging):**

- O1 — `127.0.0.1:8090:8090` IP-bound port mapping on a Docker-Image app
  (fallback: Compose-based PB or docker-exec wrappers).
- O2 — `PATCH sha-<commit>` + redeploy re-pulls the updated `sha-` tag (force).
- O3 — health checks gate Traefik routing AND Coolify marks bad deploys
  failed (incl. "unhealthy → 404 / no available server" behavior).
- O4 — path-route priority: landing exact settings path vs `/`; app/admin
  `/api` vs `/`; fallback-to-root must NOT expose generic landing `/api`.
- O5 — rollback to a previous GHCR-sourced `sha-<commit>` image via the Applications PATCH + `--force` deploy flow.

# Fast English Podcast — production deployment package

> **Status (self-hosted Coolify):** the accepted production architecture is now
> **self-hosted Coolify + owned VPS + Coolify-managed Traefik + four immutable
> container images** (`docker/*`, `sha-<commit>` tags), released through
> `.github/workflows/release-deploy.yml` (immutable SHA pinned before deploy) and documented in
> **`docs/COOLIFY_DEPLOYMENT.md`** (the canonical deployment guide).
> The Caddy + systemd + release-symlink layer below is **LEGACY/RETIRED**
> (kept as historical fallback + the legacy redaction proof); do not use it
> for a new production install.
>
> What survives unchanged: `backup.sh`, `backup-copy.sh` (+ its host timer),
> `restore-drill.sh` (adapted to repo-relative hooks/migrations), `smoke-prod.sh`
> (adapted), `ops-check.sh` (adapted to containers), `configure.sh` (loopback),
> `test-nginx-log-redaction.sh` (new logging-path proof).

See `docs/COOLIFY_DEPLOYMENT.md` for the canonical runbook and
`docs/OPERATIONS.md` for day-to-day operations. This file is the quick index.

## Script classification (post-migration)

| Path | Status | Note |
|---|---|---|
| `Caddyfile` | LEGACY / RETIRED | historical fallback; new proxies live in `docker/*/nginx.conf` |
| `systemd/fast-english-pocketbase.service` | LEGACY / RETIRED | PB runs as the Coolify container (UID 10001) |
| `systemd/fast-english-backup-copy.{service,timer}` | KEEP | host-level file copy, container-independent |
| `install.sh` | LEGACY / RETIRED | provisioning is the Coolify runbook checklist (§4/§5) |
| `configure.sh` | KEEP/ADAPT | works against the loopback 127.0.0.1:8090 mapping |
| `deploy.sh` | LEGACY FALLBACK | replaced by the GHCR + release-deploy pipeline (immutable sha) |
| `backup.sh` / `backup-copy.sh` | KEEP | unchanged (loopback port) |
| `restore-drill.sh` | ADAPT | repo-relative migrations/hooks/binary + guards |
| `smoke-prod.sh` | KEEP/ADAPT | unchanged surface; admin marker corrected |
| `ops-check.sh` | ADAPT | container + public-HTTPS checks instead of systemd |
| `test-log-redaction.sh` | LEGACY PROOF (KEEP) | still wired into the canonical gate |
| `test-nginx-log-redaction.sh` | KEEP (new) | Coolify-era logging-path proof |
| `check-offsite.sh` | KEEP (new) | off-VPS backup gate check (C15), host-side |
## Layout

| Path | Purpose |
|---|---|
| `Caddyfile` | Legacy production Caddy config (RET) |
| `systemd/fast-english-pocketbase.service` | Legacy hardened PocketBase unit (RET) |
| `systemd/fast-english-backup-copy.{service,timer}` | Daily copy of PB backups off `pb_data` (02:40 UTC) — KEEP |
| `install.sh` | Legacy first-time server bootstrap (RET) |
| `configure.sh` | One-time production settings (backups cron, trustedProxy, logs, SMTP honest state, S3-optional) — KEEP/ADAPT |
| `deploy.sh` | Legacy atomic release deployment (RET) |
| `backup.sh` | On-demand verified backup via the PB Backups API — KEEP |
| `backup-copy.sh` | Copies automatic backups off `pb_data` + 14-backup retention — KEEP |
| `restore-drill.sh` | Disposable-instance restore drill (never touches live data) — ADAPT |
| `smoke-prod.sh` | Production HTTPS smoke tests (public + disposable accounts) — KEEP/ADAPT |
| `test-log-redaction.sh` | Executable access-log token-redaction proof — LEGACY KEEP |
| `ops-check.sh` | Lightweight monitoring checks (services, certs, disk, backups, 5xx) — ADAPT |
| `env.production.example` | Variable NAMES only; self-hosted Coolify secrets documented therein |

## Server topology (Coolify era — self-hosted)

```text
/opt/fast-english/shared/
  pb_data/          PocketBase data (host bind mount → container /pb/pb_data, UID 10001)
  backups/          verified backup copies (outside pb_data, 14 kept)
  releases/         public APK + release metadata (/srv/releases in landing container, read-only)
  secrets/pocketbase.env  root:root 0600, never in Git
  scripts/fep-backup.sh etc.  host timer helpers

Coolify (self-hosted, on same VPS)
  Traefik (managed) handles 80/443 → landing/app/admin (8080) + PocketBase API routes → PB (8090)
  Four Docker Image applications (landing, app, admin, pocketbase) each pinned to sha-<commit>
  PocketBase only loopback 127.0.0.1:8090:8090 for maintenance
```

## Quick start (self-hosted Coolify)

```bash
# 1. install self-hosted Coolify per docs/COOLIFY_DEPLOYMENT.md §4
# 2. place the secrets file first
install -d -m 0700 /opt/fast-english/shared/secrets
install -m 0600 /dev/stdin /opt/fast-english/shared/secrets/pocketbase.env <<'EOF'
FEP_SUPERUSER_EMAIL=...
FEP_SUPERUSER_PASSWORD=...
PB_ENCRYPTION_KEY=... # required, 32 chars
EOF

# 3. host init + backup timer per docs/COOLIFY_DEPLOYMENT.md §5
# 4. create four Coolify Applications per §6 (sha-<commit> images)
# 5. release via GitHub Actions: Actions → release-deploy → Run (ref + environment)
bash deploy/smoke-prod.sh --quick
```

## Verification commands

```bash
bash deploy/test-nginx-log-redaction.sh
bash deploy/restore-drill.sh
bash deploy/ops-check.sh
pnpm test:infra:coolify  # builds images + persistence/restore/migration/routing/redaction/coolify-contract
```

## Secret names (values live only in the server env file + GitHub Environment + Coolify app env)

`FEP_SUPERUSER_EMAIL`, `FEP_SUPERUSER_PASSWORD`, `PB_ENCRYPTION_KEY`,
`FEP_SMTP_*`, `FEP_BACKUP_S3_*`, `FEP_SMOKE_*`,
`COOLIFY_BASE_URL` (required, self-hosted URL, no fallback), `COOLIFY_API_TOKEN`, `COOLIFY_APP_UUID_*`.

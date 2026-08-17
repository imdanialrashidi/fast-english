# Fast English Podcast — production deployment package

> **Status (Coolify migration):** the accepted production architecture is now
> **Coolify Cloud + owned VPS + Coolify-managed Traefik + four immutable
> container images** (`docker/*`), released through
> `.github/workflows/release-deploy.yml` and documented in
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
| `install.sh` | LEGACY / RETIRED | provisioning is the Coolify runbook checklist |
| `configure.sh` | KEEP/ADAPT | works against the loopback 127.0.0.1:8090 mapping |
| `deploy.sh` | LEGACY FALLBACK | replaced by the GHCR + release-deploy pipeline |
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
| `Caddyfile` | Production Caddy config (all four domains, APK hosting, token redaction, security headers) |
| `systemd/fast-english-pocketbase.service` | Hardened PocketBase unit (non-root, loopback-only, sandboxed) |
| `systemd/fast-english-backup-copy.{service,timer}` | Daily copy of PB backups off `pb_data` (02:40 UTC) |
| `install.sh` | First-time server bootstrap (user, topology, binary, unit, Caddyfile, superuser) |
| `configure.sh` | One-time production settings (backups cron, trustedProxy, logs, SMTP honest state, S3-optional) |
| `deploy.sh` | Atomic release deployment with pre-backup, health checks, smoke and rollback |
| `backup.sh` | On-demand verified backup via the PB Backups API |
| `backup-copy.sh` | Copies automatic backups off `pb_data` + 14-backup retention |
| `restore-drill.sh` | Disposable-instance restore drill (never touches live data) |
| `smoke-prod.sh` | Production HTTPS smoke tests (public + disposable accounts) |
| `test-log-redaction.sh` | Executable access-log token-redaction proof |
| `ops-check.sh` | Lightweight monitoring checks (services, certs, disk, backups, 5xx) |
| `env.production.example` | Variable NAMES only; real secrets live in the server-only env file |

## Server topology

```text
/opt/fast-english/
  releases/<release-id>/{landing,app,server,android}   immutable releases
  current -> releases/<release-id>                     atomic symlink
  shared/pb_data/                                      PocketBase data (outside releases)
  shared/backups/                                      backup copies (outside pb_data)
  shared/releases/                                     public APK + release metadata
  shared/logs/                                         Caddy access logs (rotated)
  shared/secrets/pocketbase.env                        root:root 0600, never in Git
  shared/scripts/fep-backup-copy.sh                    timer helper
  bin/pocketbase                                       0.39.9 linux amd64
```

## Quick start (server, as root)

```bash
# 1. place the secrets file first
install -d -m 0700 /opt/fast-english/shared/secrets
install -m 0600 /dev/stdin /opt/fast-english/shared/secrets/pocketbase.env <<'EOF'
FEP_SUPERUSER_EMAIL=...
FEP_SUPERUSER_PASSWORD=...
# PB_ENCRYPTION_KEY=... (optional, recommended)
EOF

# 2. install + configure + first release
bash deploy/install.sh
bash deploy/configure.sh
bash deploy/backup.sh                      # initial verified backup
bash deploy/deploy.sh /path/to/release-bundle
systemctl enable --now caddy
bash deploy/smoke-prod.sh --quick
```

## Build the release bundle (build machine)

```bash
pnpm install --frozen-lockfile
pnpm typecheck && pnpm check && pnpm test
VITE_WEB_APP_URL=https://app.fastenglishpodcast.com \
VITE_ANDROID_APK_URL=https://fastenglishpodcast.com/releases/fast-english-podcast-v1.0.0.apk \
VITE_ANDROID_APK_VERSION=1.0.0 \
pnpm build:landing && pnpm build:app && node scripts/prerender-landing.mjs
bash scripts/verify.sh
# stage release-bundle/<id>/{landing,app,server,android} then copy to the server
```

## Verification commands

```bash
caddy validate --config deploy/Caddyfile && caddy fmt --overwrite deploy/Caddyfile
systemd-analyze verify deploy/systemd/fast-english-pocketbase.service
bash deploy/test-log-redaction.sh
bash deploy/restore-drill.sh
bash deploy/ops-check.sh
```

## Secret names (values live only in the server env file)

`FEP_SUPERUSER_EMAIL`, `FEP_SUPERUSER_PASSWORD`, `PB_ENCRYPTION_KEY`,
`FEP_SMTP_*`, `FEP_BACKUP_S3_*`, `FEP_SMOKE_STUDENT_*`, `FEP_SMOKE_OPERATOR_*`.

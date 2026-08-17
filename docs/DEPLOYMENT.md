# Fast English Podcast — Production Deployment

> **LEGACY / RETIRED (2026-08-17).** This document describes the Caddy +
> systemd + release-symlink architecture. The canonical production
> deployment guide is now **`docs/COOLIFY_DEPLOYMENT.md`** (Coolify Cloud →
> owned VPS → Coolify-managed Traefik → four immutable container images).
> This page is kept ONLY as historical fallback reference; do not use it for
> a new production install.

Responsible owner: **<TODO: replace with the named operator/owner>**
Last updated: 2026-08-01 (P4-S3 package; deployment Gate OPEN — see §9).

## 1. Domains and services

| Domain | Purpose | Served by |
|---|---|---|
| `fastenglishpodcast.com` | static Landing + `/releases/` (APK + metadata) | Caddy → `/opt/fast-english/current/landing` + `shared/releases` |
| `www.fastenglishpodcast.com` | 308 redirect to the canonical root | Caddy `redir` |
| `app.fastenglishpodcast.com` | Product App/PWA + `/api/*` → PocketBase | Caddy → `current/app` + `127.0.0.1:8090` |
| `admin.fastenglishpodcast.com` | Unified Staff Admin Console (separate SPA) + `/api/*` | Caddy → `current/admin` + `127.0.0.1:8090` |

Services on the server:

| Service | Unit / file | Port | Notes |
|---|---|---|---|
| Caddy | `caddy.service` (distro) | 80/443 | config `/etc/caddy/Caddyfile` |
| PocketBase | `fast-english-pocketbase.service` | **127.0.0.1:8090 only** | non-root user `fastenglish` |
| Backup copy | `fast-english-backup-copy.timer` | — | 02:40 UTC daily |

## 2. Server layout

```text
/opt/fast-english/
  releases/<release-id>/
    landing/            built Landing (dist-landing output)
    app/                built Product App (dist-app output)
    server/             pb_migrations/ + pb_hooks/ + VERSION
    android/            signed APK + release-metadata.json + RELEASE-NOTES.md
  current -> releases/<release-id>          (atomic symlink, flipped by deploy.sh)
  shared/
    pb_data/            PocketBase data (DB, storage, local backups) — outside releases
    backups/            verified backup copies (separate from pb_data), 14 kept
    releases/           public APK + release metadata (immutable, versioned files)
    logs/               Caddy access logs (rotated 10×10MiB, 30 days)
    secrets/pocketbase.env   superuser/SMTP/S3 env — root:root 0600, never in Git
    scripts/fep-backup-copy.sh
  bin/pocketbase        PocketBase 0.39.9 linux amd64 (root-owned, read-only)
```

Releases are immutable (`chmod -R a-w` after install). `pb_data` never lives
inside a release. Rollback restores the previous static release without
touching `pb_data` (migration caveat in §6).

## 3. Build the release bundle (build machine)

```bash
pnpm install --frozen-lockfile
pnpm typecheck && pnpm check && pnpm test
VITE_WEB_APP_URL=https://app.fastenglishpodcast.com \
VITE_ANDROID_APK_URL=https://fastenglishpodcast.com/releases/fast-english-podcast-v1.0.0.apk \
VITE_ANDROID_APK_VERSION=1.0.0 \
pnpm build:landing && pnpm build:app && pnpm build:admin && node scripts/prerender-landing.mjs
bash scripts/verify.sh
bash scripts/check-production-bundle.sh dist-landing dist-app dist-admin
```

Then stage a bundle directory `<id>/{landing,app,admin,server,android}` (copy
`dist-landing/`, `dist-app/`, `dist-admin/`,
`server/pb_migrations+pb_hooks+VERSION`, `releases/*`) and copy it to the
server.

Business values (plan prices, destination card, review ETA, support/collaboration
contact) are NOT build-time values anymore: the Landing reads them at runtime
from `/api/fast-english/public/settings` (scoped Caddy handle on the landing
domain), and a Staff Admin edits them in the Admin Console (`/settings` →
تنظیمات کسب‌وکار). Seeding the two launch plans and the demo placement bank
uses the guarded seed tools (§11).

## 4. First-time install (server, as root)

```bash
# 0. prerequisites: Debian/Ubuntu/Arch server, curl, python3, unzip;
#    the caddy package installed; DNS pointing all four names at this server;
#    ports 80/443 reachable from the internet.

# 1. secrets file FIRST (names only — see deploy/env.production.example)
install -d -m 0700 /opt/fast-english/shared/secrets
install -m 0600 /dev/stdin /opt/fast-english/shared/secrets/pocketbase.env <<'EOF'
FEP_SUPERUSER_EMAIL=<fill-at-install>
FEP_SUPERUSER_PASSWORD=<fill-at-install>
EOF

# 2. bootstrap + configure + first release
bash deploy/install.sh              # user, topology, binary, units, Caddyfile, superuser
systemd-analyze verify /etc/systemd/system/fast-english-pocketbase.service
caddy validate --config /etc/caddy/Caddyfile && caddy fmt --overwrite /etc/caddy/Caddyfile
bash deploy/configure.sh            # production settings (backups cron, trustedProxy, ...)
bash deploy/backup.sh               # initial verified backup BEFORE the first release
bash deploy/deploy.sh /path/to/release-bundle
systemctl enable --now caddy
bash deploy/smoke-prod.sh           # full HTTPS smoke (disposable accounts)
bash deploy/restore-drill.sh        # restore drill on a disposable instance
```

## 4b. Business data seeding (after the first release is live)

```bash
# Canonical launch plans (monthly 299,000 / quarterly 807,300 — NO yearly):
export FEP_PB_URL=https://app.fastenglishpodcast.com
# superuser credentials from the server secrets file — never committed
export FEP_PB_SUPERUSER_EMAIL=... FEP_PB_SUPERUSER_PASSWORD=...
pnpm seed:plans --target=production --confirm-production --yes

# Placement bank: the committed file is kind=demo — development/staging
# ONLY. The reviewed production bank remains HUMAN INPUT REQUIRED; when it
# arrives, commit it as seeds/placement/reviewed-bank.v1.json (kind=reviewed)
# and install with:
#   pnpm seed:placement --file seeds/placement/reviewed-bank.v1.json \
#     --replace --target=production --confirm-production --yes
# Demo data is REFUSED for production unless you explicitly pass --allow-demo.
```

Then, in the Admin Console (`admin.fastenglishpodcast.com` → تنظیمات → تنظیمات
کسب‌وکار): set the card-to-card destination (card number, holder, bank, short
instructions, review ETA — defaults to «حداکثر تا ۲۴ ساعت») and the public
support/collaboration contact. The Landing picks both up at runtime without a
rebuild. Also create the first Staff Admin (`pnpm staff:bootstrap`) and import
content packages (`pnpm content:import`).

## 5. Deploying a new release

```bash
bash deploy/deploy.sh /opt/release-bundles/<release-id>
```

`deploy.sh` (root): verifies the bundle + APK checksum → checks disk space →
pre-deployment backup → installs the release immutably → flips the `current`
symlink atomically (`ln -sfn … current.tmp && mv -Tf …`) → restarts
PocketBase (migrations run on startup) → health check → `systemctl reload
caddy` → publishes the APK + `release-metadata.json` + `RELEASE-NOTES.md`
into `shared/releases` (served at `/releases/*` by Caddy) → runs
`smoke-prod.sh --quick` (missing metadata is now a hard FAIL).

Rollback coverage: any failure **after** the symlink switch — PocketBase
restart, health check, Caddy reload, or mandatory smoke — triggers an
automatic rollback to the previous release via an EXIT trap (exit 2;
exit 3 if the rollback itself fails). Failures before the switch abort
without touching anything (exit 1). The previous `current` target is
recorded in `/opt/fast-english/.current.previous` before each switch.

Exit codes: `0` deployed; `1` verification failed; `2` deployed then rolled
back; `3` rollback failed (manual intervention, see §6).

## 6. Rollback

```bash
# Manual rollback (deploy.sh does this automatically on any post-switch
# failure; the previous target is recorded in .current.previous):
cd /opt/fast-english
OLD=$(cat .current.previous)             # target before the last deploy
ln -sfn "$OLD" current.tmp && mv -Tf current.tmp current
systemctl restart fast-english-pocketbase
curl -fsS http://127.0.0.1:8090/api/health
systemctl reload caddy
bash deploy/smoke-prod.sh --quick
```

Rules:
- The previous release directory is **never deleted**.
- `pb_data` is untouched by a rollback.
- **Database migrations are NOT automatically reversible.** A migration that
  has already been applied stays applied after rollback (the schema may be
  newer than the rolled-back hooks expect). Before rolling back past a
  release that introduced migrations, verify hook/migration compatibility or
  restore the pre-deployment backup (`docs/BACKUP_RESTORE.md`). This is the
  documented migration rollback limitation.

## 7. Verification commands

```bash
caddy validate --config /etc/caddy/Caddyfile
systemd-analyze verify /etc/systemd/system/fast-english-pocketbase.service
bash deploy/test-log-redaction.sh        # token redaction proof (executable)
bash deploy/ops-check.sh                 # health/certs/disk/backups/5xx
bash deploy/backup.sh                    # on-demand verified backup
bash deploy/restore-drill.sh             # disposable-instance restore drill
```

## 8. Secret names (values only in the server env file, never in Git/docs)

`FEP_SUPERUSER_EMAIL`, `FEP_SUPERUSER_PASSWORD`, `PB_ENCRYPTION_KEY`,
`FEP_SMTP_HOST/PORT/USERNAME/PASSWORD/TLS`, `FEP_BACKUP_S3_*`,
`FEP_SMOKE_STUDENT_*`, `FEP_SMOKE_OPERATOR_*`.

## 9. Deployment Gate status (this package)

- Deployment package: **complete and validated locally** (Caddyfile,
  systemd units, install/configure/deploy/backup/restore-drill/smoke/ops
  scripts, log-redaction test, docs).
- **Production deployment: NOT performed.** No server credentials/SSH access
  exist in this environment, and DNS for `fastenglishpodcast.com` (+ www/app/
  admin) does not resolve — the four records must be created and pointed at
  the server before Caddy can issue certificates.
- Mandatory actions before the Gate can close: DNS records, server access,
  secrets file, `install.sh` + `configure.sh`, first backup, first release,
  full HTTPS smoke, real-device Android checks, `/review` and `/ship`.
- **Off-VPS backup destination (Gate requirement):** before the first real
  deployment an approved remote backup destination must exist and be
  verified — S3-compatible bucket via `FEP_BACKUP_S3_*` (PocketBase native)
  or an approved equivalent (see `docs/BACKUP_RESTORE.md` §1/§7). Local-only
  copies on the VPS do not satisfy the off-VPS backup baseline.
- **Failure-injection drill (Gate requirement):** before the first real
  deployment, verify `deploy.sh` auto-rollback by injecting failures on a
  staging twin of the server (e.g. break the release's `server/pb_hooks`,
  stop PocketBase mid-restart, or point Caddy at an invalid config) and
  confirm the symlink, service and Caddy return to the previous release.

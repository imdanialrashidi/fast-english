# Fast English Podcast — Production Launch Checklist

Owner: **<TODO: operator name>** — Run before and during the production
launch. Every box must be checked with evidence; nothing is assumed.

## A. Preconditions (deployment Gate)

- [ ] DNS records exist and resolve for all four names:
      `fastenglishpodcast.com`, `www`, `app`, `admin` → server IP
      (as of 2026-08-01 they do NOT resolve; create before launch)
- [ ] Ports 80 and 443 reachable from the internet
- [ ] Server OS + arch match the PocketBase binary (linux amd64, 0.39.9)
- [ ] Disk space ≥ 2× expected release size + pb_data growth; memory ≥ 1 GiB
- [ ] No unknown existing service/directory at `/opt/fast-english`
- [ ] Secrets file created (root:root 0600) with approved superuser
      credentials; keystore in operator custody
- [ ] SMTP: approved provider configured OR honest disabled state
      (`configure.sh` reports `smtp.enabled=false`) — no fake sender
- [ ] S3 backup bucket: approved credentials AND verified off-VPS restore
      drill (off-VPS destination is a Gate requirement — local-only copies do
      not satisfy it)
- [ ] Support/legal identity approved (landing `VITE_SUPPORT_URL`; privacy/
      terms placeholders still marked `needs-review` until real copy lands)

## B. Install and configuration

- [ ] `deploy/install.sh` created user `fastenglish`, topology, units
- [ ] `systemd-analyze verify` passes for the PocketBase unit
- [ ] `caddy validate` + `caddy fmt` pass for `/etc/caddy/Caddyfile`
- [ ] `deploy/configure.sh` verified: appName/appURL, hideControls,
      logs.maxDays=30, logAuthId=false, backups cron 30 2 * * *, keep 14,
      trustedProxy, smtp state, rateLimits enabled
- [ ] PocketBase listens ONLY on 127.0.0.1:8090 (`ss -tlnp` shows no
      public listener) and runs as `fastenglish` (not root)
- [ ] Superuser Dashboard NOT reachable from any public domain
- [ ] Initial verified backup created BEFORE the first release
- [ ] Restore drill passes against a disposable instance (fail-closed:
      superuser auth + every collection must succeed; works with encrypted
      settings via PB_ENCRYPTION_KEY)

## C. Release

- [ ] `pnpm install --frozen-lockfile && pnpm typecheck && pnpm check &&
      pnpm test && bash scripts/verify.sh` green
- [ ] Production build with final values; bundle gate
      (`scripts/check-production-bundle.sh`) passes: no localhost/10.0.2.2/
      dev IPs/debug APK/keystore paths in the bundles
- [ ] `deploy/deploy.sh` succeeded; previous release preserved; rollback
      path documented and rehearsed (incl. the failure-injection drill:
      restart/health/Caddy failures after the symlink switch roll back)
- [ ] Signed APK publicly downloadable; sha256 + Content-Length match
      `release-metadata.json`; no directory listing; HTTPS only; Landing
      CTA + version match the metadata (deploy.sh publishes APK + metadata +
      notes to `shared/releases` before smoke)

## D. Production smoke (real HTTPS, disposable accounts only)

- [ ] `deploy/smoke-prod.sh` full: 0 FAIL (58 scenarios locally)
  - Landing routes/canonicals/sitemap/robots/APK/legal markers
  - App loads; manifest + SW; signup/login/logout/refresh
  - Receipt upload; protected preview; pending state
  - Operator queue/detail/receipt/approval/activation
  - Placement start; lessons list/detail; audio full + 206 + seek;
    progress save/resume/continue
  - Entitlement: expired/future/suspended/wrong-role denied
  - Admin domain: redirect, operator API, no student content, `/_/` 404
- [ ] Access-log token redaction proven: `deploy/test-log-redaction.sh`
      and the live-server grep (token absent, marker present)
- [ ] No real payment submitted; disposable accounts deleted after the run

## E. Android / PWA (device gate)

- [ ] PWA update prompt works; SW never caches `/api/`/protected responses
- [ ] Release APK installs on a physical device (v2 signature)
- [ ] APK connects to Production (https://app.fastenglishpodcast.com);
      real audio plays and seeks; progress restores after relaunch;
      no SW interference in Capacitor
- [ ] `apksigner verify` + `sha256sum` documented for the shipped file

## F. Operations

- [ ] `deploy/ops-check.sh` exit 0; cron wired for daily checks
- [ ] Backup timer active (`systemctl list-timers fast-english-backup-copy`)
- [ ] Logs rotating; access logs readable only by authorized users
- [ ] Monitoring expectations documented (no platform — approved)
- [ ] Owner placeholders replaced in the six ops docs

## G. Final sign-off

- [ ] No secret in Git, logs, bundles, or docs
- [ ] `/review` performed on this Phase 4 change set
- [ ] `/ship` executed; P4-S1/S2/S3 marked Complete; Phase 4 review Pending
- [ ] Incident contacts and escalation paths recorded

# Fast English Podcast — Operations

> **COOLIFY MIGRATION STATUS (2026-08-17):** production now runs the
> Coolify-era architecture — see **`docs/COOLIFY_DEPLOYMENT.md`** (canonical)
> and `deploy/ops-check.sh` (adapted to containers + public HTTPS). The
> Caddy/systemd references in this document describe the retired legacy
> layer and are kept only for historical reference.

Responsible owner: **<TODO: replace with the named operator>**
Last updated: 2026-08-01.

## 1. Daily checks

```bash
bash /opt/fast-english/../deploy/ops-check.sh   # or deploy/ops-check.sh from the repo
```

Covers: PocketBase container + public HTTPS activity, restart counts,
certificate expiry
(<14 days warns), disk usage (≥75% warn, ≥90% crit), backup freshness
(>26h crit), backup errors in the journal, HTTP 5xx visibility from the
access logs, local health endpoint. Exit code: `0` ok / `1` warn / `2` crit.
Suitable for cron:

```cron
17 6 * * * root bash /opt/fast-english/shared/scripts/ops-check.sh >> /var/log/fep-ops.log 2>&1
```

## 2. Health checks (Coolify era)

| Check | Command |
|---|---|
| PocketBase container | `docker ps | grep fast-english` + `curl -fsS http://127.0.0.1:8090/api/health` |
| Proxy (Traefik/Coolify) | Coolify dashboard application status (public HTTPS below) |
| Public | `curl -fsSI https://app.fastenglishpodcast.com/api/health` (JSON body = real PB: `curl -fsS …/api/health \| grep '"code":200'`) |
| Certificates | `bash deploy/ops-check.sh` (or `openssl s_client` per domain) |

## 3. Logs

| Log | Location | Retention |
|---|---|---|
| Caddy access — landing | `/opt/fast-english/shared/logs/access-landing.log` | 10 × 10 MiB, 30 days |
| Caddy access — app | `…/access-app.log` | same |
| Caddy access — admin | `…/access-admin.log` | same |
| Caddy errors/startup | `journalctl -u caddy` | journald |
| PocketBase | `journalctl -u fast-english-pocketbase` | journald |
| PocketBase activity (API) | PB internal logs (`/api/logs`, settings `logs.maxDays=30`) | 30 days |

Access logs are readable only by root/Caddy (`shared/logs` 0750,
`fastenglish`-owned); never make them world-readable.

### Token-redaction rule (audio privacy)

Audio file tokens travel as the `token` query parameter. Every site's
access-log block filters `request>uri` with the official query filter and
replaces token values with `[REDACTED]`; `log_credentials` is **not**
enabled, so Authorization/Cookie stay redacted by Caddy defaults. Proof:
`bash deploy/test-log-redaction.sh` — sends requests containing fake token
values and asserts they are absent from the log while the redaction marker
and ordinary metadata (method, host, path, status) remain.

Verification on the live server:

```bash
curl -s "https://app.fastenglishpodcast.com/api/health?token=FAKE_TOKEN_XYZ" >/dev/null
grep -c "FAKE_TOKEN_XYZ" /opt/fast-english/shared/logs/access-app.log   # must be 0
grep "REDACTED" /opt/fast-english/shared/logs/access-app.log | tail -1
```

## 4. PocketBase administration

- The superuser Dashboard (`/_/`) is **not** reachable from any public
  domain (404 on app + admin; PocketBase binds 127.0.0.1 only).
- Superuser access is private, over SSH tunnelling only:

```bash
ssh -L 8090:127.0.0.1:8090 <user>@<server>   # then browse http://127.0.0.1:8090/_/
```

- Schema changes are locked in production (`meta.hideControls=true` in
  `configure.sh`). Schema/content changes ship through reviewable
  migrations in a release (see DEPLOYMENT.md) or superuser tooling — never
  ad-hoc Dashboard edits.
- Superuser IP whitelisting (PocketBase ≥0.38) is recommended once the
  operator's fixed IP is known: `./pocketbase superuser ips <ip> --dir=…`.

## 5. Common operations

| Task | Command |
|---|---|
| Restart PocketBase (after hook-only fix) | `systemctl restart fast-english-pocketbase` |
| Reload Caddy (config change) | `systemctl reload caddy` |
| On-demand backup | `bash deploy/backup.sh` |
| Restore drill | `bash deploy/restore-drill.sh` |
| Full smoke | `bash deploy/smoke-prod.sh` |
| Public quick smoke | `bash deploy/smoke-prod.sh --quick` |

## 6. Monitoring limits (explicit)

No monitoring platform is deployed (not approved). Visibility = systemd
state, journald, rotated Caddy logs, `ops-check.sh`. Alerting is manual or
cron-grep until a platform is approved.

## 7. Known failures and first responses

| Symptom | First response |
|---|---|
| `ops-check` CRIT on service | `journalctl -u <unit> -n 100`, check disk, restart unit |
| Caddy 502/504 on /api | PocketBase down or migrations failed — `journalctl -u fast-english-pocketbase` |
| Certificate near expiry | Caddy auto-renews; check DNS + port 443 reachability, `systemctl status caddy` |
| Backup missing/failed | `journalctl -u fast-english-pocketbase --since -48h \| grep -i backup`; run `deploy/backup.sh` manually |
| Disk ≥90% | Prune old releases (keep the previous one), check `shared/backups` rotation |
| 5xx burst | `grep '"status":5' shared/logs/access-*.log \| tail -50`; correlate with deploys |

See `docs/INCIDENT_RUNBOOK.md` for the full procedures.

# Fast English Podcast — Incident Runbook

> **COOLIFY MIGRATION STATUS (2026-08-17):** production now runs the
> Coolify-era architecture — see **`docs/COOLIFY_DEPLOYMENT.md`** (canonical)
> and `docs/INCIDENT_RUNBOOK.md` + `docs/TECHNICAL_OWNER_RUNBOOK_FA.md` for
> the operator-facing adaptation. Commands below that reference systemd/Caddy
> describe the retired legacy layer; the Coolify-era equivalents replace
> `systemctl …` with the Coolify dashboard / `docker …` and `caddy …` with
> Coolify-managed Traefik + the frontend containers.

Responsible owner: **<TODO: replace with the on-call operator>**
Severity guide: SEV1 = production down / data at risk; SEV2 = degraded;
SEV3 = cosmetic/observability. Last updated: 2026-08-01.

## 0. First five minutes (Coolify era)

1. Coolify dashboard → application status; `docker ps | grep fast-english` — what is down?
2. `docker logs <container> -n 100 --no-pager` — why?
3. `curl -fsS http://127.0.0.1:8090/api/health` — backend reachable?
4. `curl -fsSI https://app.fastenglishpodcast.com/api/health` — public path?
5. `bash deploy/ops-check.sh` — disk, certs, backups, 5xx.
6. Announce: time, scope, owner <TODO>.

Do NOT run a restore or rollback before reading the matching section below.

---

## 0a. Legacy reference (pre-Coolify first five minutes)

1. `systemctl is-active fast-english-pocketbase caddy` — what is down?
2. `journalctl -u <unit> -n 100 --no-pager` — why?
3. `curl -fsS http://127.0.0.1:8090/api/health` — backend reachable?
4. `curl -fsSI https://app.fastenglishpodcast.com/api/health` — public path?
5. `bash deploy/ops-check.sh` — disk, certs, backups, 5xx.
6. Announce: time, scope, owner <TODO>.

Do NOT run a restore or rollback before reading the matching section below.

## 1. PocketBase down (SEV1)

Symptoms: 502/503 on `/api/*`; `systemctl is-active` inactive/failed.

```bash
journalctl -u fast-english-pocketbase -n 100
systemctl status fast-english-pocketbase
systemctl restart fast-english-pocketbase     # bounded by RestartSec=5s + StartLimitBurst
curl -fsS http://127.0.0.1:8090/api/health
```

If it keeps failing: check the data dir (`/opt/fast-english/shared/pb_data`),
disk space (`df -h /opt/fast-english`), and the journal for migration
errors. **If migrations failed during a deploy**, do NOT start the service
against the new hooks: roll back the symlink first (see §3), then start.
Never delete `pb_data`.

## 2. Caddy down / cert problems (SEV1)

```bash
systemctl status caddy
journalctl -u caddy -n 100
systemctl reload caddy          # or restart
```

Certificates: Caddy auto-renews; failures usually mean DNS or port 443
reachability. Verify: `dig fastenglishpodcast.com`, `ss -tlnp | grep :443`,
`bash deploy/ops-check.sh` (warns <14 days). Certificates are stored
persistently under `/var/lib/caddy` — never delete the directory.

## 3. Bad release deployed (SEV1/SEV2)

`deploy.sh` rolls back automatically when the mandatory quick smoke fails
(exit 2). Manual rollback if it did not:

```bash
cd /opt/fast-english
ls -la current; cat current 2>/dev/null; ls releases/
ln -sfn releases/<previous-id> current.tmp && mv -Tf current.tmp current
systemctl restart fast-english-pocketbase
curl -fsS http://127.0.0.1:8090/api/health
systemctl reload caddy
bash deploy/smoke-prod.sh --quick
```

**Migration caveat**: rolling back the symlink does NOT undo already-applied
migrations. If the bad release changed the schema and the old hooks cannot
run against it, restore the pre-deployment backup instead
(`shared/backups/fep-backup-predeploy-*`, see `docs/BACKUP_RESTORE.md` §5) —
this loses changes made after that backup. Do not attempt schema
"downgrades" by hand.

## 4. Data loss / corruption (SEV1)

1. Stop PocketBase immediately: `systemctl stop fast-english-pocketbase`.
2. Preserve the damaged directory: `mv shared/pb_data shared/pb_data.broken-<ts>`.
3. Run the restore procedure from `docs/BACKUP_RESTORE.md` §5 with the
   newest verified backup (drill it first on a disposable instance if time
   permits).
4. Verify: health + collection counts + `smoke-prod.sh --quick`.
5. Post-incident: determine why backups missed the corruption window.

## 5. Suspicious access / leaked token (SEV2)

- Audio tokens: they are redacted from logs by design
  (`docs/OPERATIONS.md` §3). A leaked token grants nothing beyond the
  owner's current entitlement (re-validated per request server-side), but
  revoke access by suspending the affected user and rotating their
  password.
- Superuser compromise: rotate `FEP_SUPERUSER_PASSWORD` in the secrets
  file, restart PocketBase, and consider the superuser IP whitelist
  (`pocketbase superuser ips <ip> --dir=…`).

## 6. Storage / disk pressure (SEV2)

`ops-check.sh` warns ≥75%, crits ≥90%. First responses: prune old releases
(keep the previous one — rollback needs it), confirm `backup-copy.sh`
retention works (14 kept), check `/var/lib/caddy` and journal sizes.
Never prune `shared/backups` beyond the policy before confirming a good
restore drill.

## 7. Payment / operator incident (SEV2)

Operator errors are transactional by design (approve/reject are atomic,
idempotent, audited). On a mis-approval: reject is not a reversal — contact
the owner <TODO> and use the audit fields (`reviewed_by`, `reviewed_at`,
snapshots) to determine the corrective path. Do not edit payment_requests /
subscriptions records directly except via reviewed superuser tooling.

## 8. Communications and post-incident

- Log every incident with timestamps, commands, and outcomes in the
  incident log <TODO: location>.
- A task is done when: service healthy, `ops-check.sh` exit 0, smoke
  passes, root cause documented, follow-up owner assigned.

## 9. Escalation

Owner <TODO: name/phone>, technical <TODO: name/phone>, hoster support
<TODO>. Escalate SEV1 immediately; do not wait for a second on-call cycle.

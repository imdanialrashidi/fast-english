# Fast English Podcast — Disaster Recovery (full VPS loss)

> Coolify era. Purpose: restore the service on a BRAND-NEW VPS after total
> loss of the production server. Also the "what must exist outside the failed
> VPS" inventory. **Last updated:** 2026-08-17.

## 0. What must exist OUTSIDE the failed VPS (the DR inventory)

| Asset | Where it lives | Status |
|---|---|---|
| Git repository | GitHub (this repo) | exists |
| Production images | GHCR (`ghcr.io/<owner>/fast-english/*:sha-<commit>` — immutable) | published per release |
| Off-VPS backups | S3-compatible bucket (PB-native `backups.s3`) — **Production Gate** | configured in the provisioning phase; verify with a restore drill |
| Credential custody | Operator vault: Coolify dashboard login (MFA), GitHub admin, DNS registrar, VPS provider console, Android keystore + passwords | human-managed |
| Android signing material | Keystore + `FEP_ANDROID_*` values (never in git) | human-managed |
| Domain/DNS access | DNS registrar (A records for the four names + staging) | human-managed |
| Coolify access | Coolify Cloud account (the management plane survives the VPS) | human-managed |
| Secrets file template | `deploy/env.production.example` (names only) | in git |

Nothing essential to recovery lives ONLY on the VPS: pb_data is recoverable
from the off-VPS backups; configuration is reproducible from this repository
(the Coolify apps are recreated from `docs/COOLIFY_DEPLOYMENT.md` §6).

## 1. Recovery procedure (new VPS)

```text
1.  Order a new VPS (same provider or any); record its IP.
2.  Provider firewall: 22 (restricted) + 80/443.
3.  DNS: point the four A records at the NEW IP; confirm propagation
    (dig +short @8.8.8.8). HTTPS will re-issue once 80/443 resolve.
4.  Coolify Cloud → Servers → Connect the new VPS (Docker installed).
5.  Host init (COOLIFY_DEPLOYMENT.md §5):
      mkdir -p /opt/fast-english/shared/{pb_data,backups,releases,secrets}
      chown -R 10001:10001 pb_data backups
      restore the secrets file (superuser, PB_ENCRYPTION_KEY, S3, SMTP)
      install fep-backup.sh + fep-backup-copy.sh + fep-check-offsite.sh
      + the backup-copy timer (COOLIFY_DEPLOYMENT.md §5)
6.  Deploy the exact known-good images: recreate the four Coolify
    Applications (COOLIFY_DEPLOYMENT.md §6) at the LAST GREEN release SHA
    (from the last release summary or GHCR tags).
7.  RESTORE PocketBase data from the off-VPS backup:
      a. stop the PB container (Coolify) — or keep it stopped;
      b. download the newest verified backup ZIP from the S3 bucket;
      c. restore into a brand-new empty dir and fix ownership:
           mkdir -p /opt/fast-english/shared/pb_data
           unzip -q <backup.zip> -d /opt/fast-english/shared/pb_data
           chown -R 10001:10001 /opt/fast-english/shared/pb_data
         (drill the same ZIP first on the staging/throwaway instance when
          time permits — never blind-restore over live data)
      d. start the PB container; verify migrations/hooks boot cleanly.
8.  Health: curl -fsS http://127.0.0.1:8090/api/health (loopback) and
    https://app.fastenglishpodcast.com/api/health (public JSON body).
9.  Frontends: start the Landing/Student/Admin apps (same images).
10. HTTPS: confirm Let's Encrypt issuance per domain.
11. Full smoke: bash deploy/smoke-prod.sh --full (disposable accounts).
12. Verify backups resume: cron 02:30 + host copy 02:40 + S3 upload;
    ops-check.sh exit 0.
13. If the provider changed, update provider-specific DNS/TLS notes; keep
    the old VPS powered off (not deleted) until smoke is fully green.
```

## 2. Partial-loss scenarios

| Loss | Recovery |
|---|---|
| Only pb_data corrupted | `docs/BACKUP_RESTORE.md` §5 (move aside, restore verified backup, chown 10001, restart container, smoke) |
| Only the VPS disk | Same as §1 but DNS/TLS may survive; re-provision + restore |
| Coolify Cloud account lost | Recreate the account, re-connect servers (new SSH key), recreate the four apps from §6 of COOLIFY_DEPLOYMENT.md; app data untouched (it lives on the VPS + backups) |
| GHCR images lost | Rebuild the exact sha from git: `docker/build-push-action` workflow or `build-images.yml` dispatch on that commit |
| Android keystore lost | NEW signing identity; users must reinstall the APK (documented in ANDROID_RELEASE.md) — keep the keystore off-VPS |

## 3. Proving DR without a second VPS (repository-side evidence)

- Backup→clean-restore into a brand-new empty directory:
  `tests/infra/05-pb-restore.sh` (inside `pnpm test:infra:coolify`) — the
  same steps §1.7 performs, against the real pinned binary/hooks/migrations.
- Persistence across container deletion/recreation: `04-pb-persistence.sh`.
- Migration lifecycle + rollback non-reversal: `06-pb-migration.sh`.
- Routing/health/smoke contract against the twin: `07-routing-contract.sh`,
  `scripts/prod-health-check.sh`, `deploy/smoke-prod.sh`.
- The full-VPS drill itself (a real second VPS) is a provisioning-phase
  activity (staging DR rehearsal), listed in `docs/STAGING.md` gate F13/F15.

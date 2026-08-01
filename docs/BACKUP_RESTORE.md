# Fast English Podcast — Backup and Restore

Responsible owner: **<TODO: replace with the named operator>**
Last updated: 2026-08-01.

## 1. Approved backup policy (explicit reversible assumption)

No external backup policy was provided, so this documented assumption is in
force until an approved policy replaces it:

```text
Daily automatic backup at 02:30 UTC
Keep 14 automatic backups
S3-compatible backup bucket: only when credentials are approved
  (dedicated backups bucket; never the file-storage bucket)
```

An **off-VPS backup destination is a production Gate requirement** (see
`docs/DEPLOYMENT.md` §9): local copies in `shared/backups` protect against a
corrupt live directory but not against VPS loss, so before the first real
deployment an approved remote destination (S3 bucket or approved equivalent)
must be configured and verified with a restore drill.

Implemented as PocketBase settings (applied by `deploy/configure.sh`,
verified against the settings API):

| Setting | Value |
|---|---|
| `backups.cron` | `30 2 * * *` (02:30 UTC daily) |
| `backups.cronMaxKeep` | 14 |
| `backups.s3` | disabled until `FEP_BACKUP_S3_*` credentials are approved |
| retention copies | `deploy/backup-copy.sh` keeps the newest 14 ZIPs in `shared/backups` |

A PocketBase backup is a ZIP snapshot of `pb_data` (SQLite + uploaded
files); local backups and S3 files are excluded by PocketBase itself.

## 2. Storage layout

```text
/opt/fast-english/shared/pb_data/backups/   live PocketBase backups (inside pb_data)
/opt/fast-english/shared/backups/           verified copies (separate from pb_data)
```

Keeping copies outside `pb_data` means a corrupt/accidentally-restored live
directory does not destroy the only copies. `fast-english-backup-copy.timer`
runs the copy at 02:40 UTC daily, right after the 02:30 cron.

## 3. On-demand backup (verified)

```bash
bash deploy/backup.sh                 # name defaults to fep-backup-<UTC>.zip
bash deploy/backup.sh my-name         # lowercase, [a-z0-9_-], .zip appended automatically
```

The script (as root): authenticates to `127.0.0.1:8090` with the superuser
credentials from the secrets file (never printed) → creates the backup via
`POST /api/backups` → verifies it exists and is non-empty → verifies the ZIP
contains the `storage/` uploads tree → copies it to `shared/backups` and
applies the 14-backup retention.

Backup names must match PocketBase 0.39.9's validation
`^[a-z0-9_-]+\.zip$` (verified against the pinned binary's source); the
script lowercases and appends `.zip` automatically.

The backup endpoints (`/api/backups`) are superuser-only and PocketBase
listens on 127.0.0.1 only — they are never exposed publicly.

## 4. Restore drill (disposable instance, never live data)

```bash
bash deploy/restore-drill.sh                # newest backup in shared/backups
bash deploy/restore-drill.sh <name-or-path> # explicit backup
```

The drill: copies/downloads one backup → restores the ZIP into a fresh
temporary data directory → starts the **same** PocketBase binary (0.39.9) on
a temporary localhost port with the current release's migrations+hooks →
waits for `/api/health` → authenticates with the superuser (MUST succeed:
a production backup always contains the superuser) → verifies every expected
collection is readable with a numeric count (any 404/uncountable collection
fails the drill) → reports per-collection **counts only** (never record
values) → stops and removes the temporary environment. The drill is
fail-closed: any missing credential, failed auth, missing collection or
unparseable count exits non-zero. Live production `pb_data` is never
touched. Local run on 2026-08-01 passed: health OK, counts matched the
seeded data (superusers 1, users 1, plans 1, destination 1, topics 1,
lessons 1).

## 5. Restoring production (manual, emergency)

```text
1. STOP writes: systemctl stop fast-english-pocketbase
2. Move the live data aside (do NOT delete):
     mv /opt/fast-english/shared/pb_data /opt/fast-english/shared/pb_data.broken-<ts>
3. Restore the backup ZIP into a fresh dir:
     mkdir /opt/fast-english/shared/pb_data
     unzip -q /opt/fast-english/shared/backups/<name>.zip -d /opt/fast-english/shared/pb_data
   (or POST /api/backups/<name>/restore against a healthy instance — this
    restarts PocketBase, so do it under systemd)
4. chown -R fastenglish:fastenglish /opt/fast-english/shared/pb_data
5. systemctl start fast-english-pocketbase
6. curl -fsS http://127.0.0.1:8090/api/health
7. bash deploy/smoke-prod.sh --quick
```

Only restore over live data after a verified drill of that exact backup.

## 6. Migration rollback limitation (documented)

Database migrations applied by a release are **not automatically
reversible**: rollback of the static release does not undo schema changes.
If a bad release applied migrations, prefer restoring the pre-deployment
backup (deploy.sh creates `fep-backup-predeploy-*` before every deploy) over
a schema "downgrade". Restores lose changes made after the backup.

## 7. S3 off-site copy (when approved)

Set `FEP_BACKUP_S3_ENABLED=true` + bucket/region/endpoint/accessKey/secret
in the secrets file and re-run `deploy/configure.sh`. PocketBase then stores
automatic backups in the dedicated bucket (test with
`POST /api/settings/test/s3 {"filesystem":"backups"}`). Verify a downloaded
bucket object with `sha256sum` against the metadata printed by `backup.sh`.

## 8. Verification checklist

- [ ] `bash deploy/backup.sh` exits 0, prints name + non-zero size
- [ ] ZIP in `shared/backups` has the same sha256 as `pb_data/backups`
- [ ] `bash deploy/restore-drill.sh` passes on the newest backup (fail-closed:
      auth + every collection must succeed)
- [ ] off-VPS destination (S3 or approved equivalent) configured and verified
      with a restore drill from a downloaded bucket object
- [ ] `ops-check.sh` shows backup age < 26h and no journal backup errors

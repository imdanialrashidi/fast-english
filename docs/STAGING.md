# Fast English Podcast — Staging Runbook + Failure-Injection Acceptance (self-hosted)

> Canonical staging procedure for the self-hosted Coolify era. Execute on the staging VPS
> BEFORE the first production release. Every item is executable from this
> checklist; do not redesign it — fix the infrastructure or record the
> deviation with evidence.
> **Last updated:** 2026-08-28 — self-hosted immutable sha-<commit> contract.

## 1. Staging topology (data isolation)

- Separate small VPS (or explicitly isolated server resources) with its own
  self-hosted Coolify instance (or a clearly isolated Coolify project/environment
  on the same self-hosted host, but with completely separate state).
- **Completely separate from Production:** PocketBase `pb_data` (host path
  under `/opt/fast-english-staging/…` or a separate user/disk), secrets
  (`FEP_*` values), Staff/Student accounts, backup location (S3 prefix or
  bucket), domains, and Coolify API tokens/base URLs.
- **Never share the Production database with Staging.**
- Domains: `staging.fastenglishpodcast.com` (Landing),
  `app-staging.fastenglishpodcast.com` (Student),
  `admin-staging.fastenglishpodcast.com` (Admin). www variants only if
  desired. DNS records are created in the provisioning phase (not here).

## 2. Provisioning checklist (staging)

1. VPS ordered; provider firewall: 22 (restricted to operator IP) + 80/443.
2. Install self-hosted Coolify on the staging host per `docs/COOLIFY_DEPLOYMENT.md` §4 → Docker managed → dashboard reachable → deploy API token created.
3. DNS records for the three staging names → propagation confirmed.
4. Host init (§5 of `docs/COOLIFY_DEPLOYMENT.md`) with the staging paths and
   a **separate** secrets file; pb_data chowned to 10001:10001.
5. Four Coolify Applications (same table as §6 of `docs/COOLIFY_DEPLOYMENT.md`)
   with the staging domains + staging UUIDs (each app's image is `ghcr.io/...:sha-<commit>` pinned per release).
6. GitHub `staging` environment secrets (same names as production, staging
   values), including **`COOLIFY_BASE_URL` (staging Coolify URL) + `COOLIFY_API_TOKEN`** (staging token) + `COOLIFY_APP_UUID_*` (staging UUIDs). The release workflows support the staging override natively:
   dispatch `release-deploy.yml` / `rollback-deploy.yml` with
   `environment = staging` — secrets are read from the `staging`
   environment only (never mixed with production), Coolify apps are pinned
   to the immutable `sha-<commit>` tag and deployed with `--force` (identical
   to production), and the `production` image alias is never moved by a staging run (the workflow refuses `publish_production_alias=true` with `environment=staging`). Staging
   domain overrides for health/smoke — `FEP_PROD_HEALTH_{ROOT,WWW,APP,ADMIN}`
   and `FEP_SMOKE_{ROOT,APP,ADMIN}` secrets in the `staging` environment —
   are MANDATORY: the workflow fails closed when they are unset, so a
   staging run can never verify/smoke the production domains.
7. Release the current candidate to staging via `release-deploy.yml`
   (surfaces all, smoke full) — must go GREEN. The deployed image is the
   exact `sha-<commit>` requested; the `production` alias is not used for the
   deployment.

## 3. Failure-injection acceptance (executable)

Run each item; record PASS/FAIL + evidence (step output, Coolify screenshot,
`ops-check.sh` exit code). Recovery path in parentheses.

| # | Injection | Expected (proof) | Recovery |
|---|---|---|---|
| F1 | Bad Landing image (e.g. broken nginx config tag) deployed to staging | Coolify deployment fails or health gate blocks; public landing NOT served from the bad image; release verdict RED | `rollback-deploy.yml` → previous `image_sha`; health + smoke green |
| F2 | Bad Student image | Same for `app-staging`; **PocketBase container start time unchanged** (frontend deploy never restarts PB) | Previous image rollback |
| F3 | PocketBase startup failure (point the app at a bogus env or image) | Coolify marks deploy failed; `/api/health` on app/admin domains fails; PB container restart loop visible; no public 8090 | Fix env/image; redeploy |
| F4 | Broken hook (inject a hook that throws at load) | PB container starts but hook routes 500; backend smoke FAILs; frontends stay healthy | Previous PB image (no migration) or hook fix release |
| F5 | Failed health endpoint (make healthcheck path wrong) | Coolify health gate keeps traffic off the instance ("no available server" / 404) | Correct healthcheck; redeploy |
| F6 | Bad required env (unset `PB_ENCRYPTION_KEY` while data is encrypted) | PB fails with "invalid settings db data or missing encryption key"; clear log | Set the matching key; redeploy (never touch pb_data) |
| F7 | Container removal/recreation (delete the PB container manually) | New container on the same bind mount serves the SAME data (student login + a known record id) | — (this is the persistence proof) |
| F8 | Persistent data proof | Create student + receipt file via the product flow → delete PB container → recreate → same record ID + file sha256 | — |
| F9 | Failed frontend deployment (bad bundle marker) | Release RED; production-like smoke catches missing markers | Previous image |
| F10 | Previous-image rollback | `rollback-deploy.yml` → previous `image_sha` → health + smoke GREEN | — |
| F11 | Backend rollback WITHOUT migration | Previous PB image + same pb_data → health + backend smoke GREEN | — |
| F12 | Migration rollback warning | Apply a migration release → roll back the image → schema STAYS migrated (see `tests/infra/06-pb-migration.sh`); the runbook warning is shown | Restore the pre-deploy backup (explicit emergency procedure) |
| F13 | Off-site backup restore | Download the newest S3 object → `restore-drill.sh` on it passes (auth + counts) → then a full clean-directory restore in staging | — |
| F14 | Proxy/path-routing failure (e.g. remove the landing exact-path route) | Landing generic `/api/*` must NOT reach PocketBase (404); the exact settings path still works; `/api/health` JSON body on app/admin is real PB (not HTML fallback); admin/student `/api/*` directly → PB; root `/` → frontend | Fix Coolify Traefik path routes |
| F15 | VPS restart | After reboot, Coolify restarts the containers (policy), all four public surfaces healthy, PB data intact | — |
| F16 | Docker restart | `systemctl restart docker` (or Coolify restart all) → containers recover; data intact | — |
| F17 | Secret rotation drill | Rotate `PB_ENCRYPTION_KEY` in BOTH the host file and the Coolify app env; **re-run `deploy/configure.sh`** so settings are re-encrypted with the new key (a plain key swap without re-encryption makes PB fail to boot — see F6), then redeploy PB → health green; verify data readable | — |
| F18 | Self-hosted base URL missing (fail-closed) | `COOLIFY_BASE_URL` unset → workflow and `coolify-deploy.sh` fail closed with `FATAL: COOLIFY_BASE_URL is required` (never falls back to `https://app.coolify.io`) | Set `COOLIFY_BASE_URL` to the self-hosted dashboard URL |

## 4. Staging gates before production GO

- [ ] F1–F18 all PASS (or accepted deviation with evidence)
- [ ] `pnpm test:infra:coolify` GREEN on the exact release commit
- [ ] `ops-check.sh` exit 0 on the staging host
- [ ] full smoke (`--full`) GREEN on the staging domains
- [ ] off-VPS backup verified with a restore drill from a downloaded object
- [ ] O1–O5 from `docs/COOLIFY_DEPLOYMENT.md` §17 have a PASS/FAIL with a
      chosen fallback

# Staging Provisioning Phase — Fast English Podcast (Coolify Cloud)

Status: blocked (external inputs required) — repository-side gates executed
Updated: 2026-08-18

## Goal

Provision and validate the real Fast English Podcast Staging environment on
Coolify Cloud: one staging VPS, the four Staging applications from immutable
exact-SHA GHCR images, isolated staging persistence/secrets, DNS/HTTPS,
backup + off-VPS restore proof, the full failure-injection checklist
(`docs/STAGING.md`), release-automation proof, and a GO/NO-GO verdict for
Production. NO Production provisioning, NO product features, NO architecture
redesign.

## Non-goals

- No Production VPS/DNS/secrets/backup namespace; no real payment data.
- No final Android release (staging connectivity only, §28).
- No app/feature changes (one e2e gate-repair exception, see Evidence E6).

## Acceptance contract (from the task; status recorded 2026-08-18)

| Criterion | Status | Note |
|---|---|---|
| Precondition: PR #11 merged; main contains the Coolify migration | PASS | `main` = `6699439` (merge of `feat/coolify-migration`, `fe58edc`) |
| Precondition: canonical CI on main green for the release commit | BLOCKED→fixed | run 32118595805 RED: racy e2e `visual-slice-2` mini-player test; fix delivered in this phase (E6); canonical re-run required on the merged commit |
| Precondition: four immutable GHCR images exist for the exact SHA | FAIL | no GHCR packages exist yet — they are produced by `release-deploy`/`build-images` on first run (human-triggered) |
| S1–S28 staging acceptance | BLOCKED | every item needs real infrastructure/credentials (HUMAN INPUT REQUIRED list below) |
| O1–O5 live-Coolify open items | BLOCKED | live verification on the staging instance |
| F1–F17 failure-injection drills | BLOCKED | on the staging VPS |
| Release workflow staging path | PASS (repo-side) | `environment` input added to `release-deploy.yml` + `rollback-deploy.yml`; contract checks W12 green |

## Confirmed current state (evidence from this session)

- **Release base (E1):** PR #11 `feat/coolify-migration` MERGED 2026-08-18
  (commit `66994393b31fb581b8c1a35eb1db3d0c52ff9b54`); trees of `6699439`
  and `fe58edc` are identical (`git diff --stat` empty); version `1.0.0`;
  no unreviewed product changes ride along (PR #10/#11 diffs contain no
  `app/` changes).
- **Canonical CI (E2):** run 32118595805 (quality, `main` @ `6699439`):
  static ✅ backend ✅ e2e 1–4/5 ✅ e2e 5/5 ❌ (verify aggregate ❌).
  Same test failed on the previous main commit (`ef741aa`, run 32049516909).
- **Red-gate root cause (E3):** `e2e/visual-slice-2.spec.ts:1061` mini-player
  test raced a 0.25 s window: the 2 s fixture clip can end AFTER the SPA
  navigates to Library, so the natural-end `pause` event (the single
  pause-save writer per slice 8) fires after `unbind()` dropped the route
  callbacks → no save → deck CTA stays «ادامه از 2:30» instead of «پخش».
  Instrumented run proved ZERO progress-save requests in the failing path.
  Test and deck code identical to the last green `main` — race, not regression.
- **Fix (E4/E5):** after return-to-lesson the test now asserts the resume
  prompt (stable contract), then re-drives the CTA while the route is
  mounted and polls the honest «پخش» CTA. Deterministic: 3/3 local runs;
  full `visual-slice-2.spec.ts` 69/69 green (fast lane, 3.4 m).
- **Infra gate (E6):** `pnpm test:infra:coolify` on the exact commit
  `6699439` (worktree): **all 9 suites PASS** (image build/identity/secret
  scan, PB persistence across container deletion, backup→clean-restore,
  migration lifecycle + rollback non-reversal, routing contract, nginx
  token redaction, Coolify workflow contract incl. new W12 staging checks).
  One earlier run was interrupted by a port collision with the parallel e2e
  run (environmental, not a defect); the clean re-run passed.
- **External inputs (E7):** NONE available in this environment: no Coolify
  Cloud account/token, no VPS, no DNS records (domain has no A records),
  no S3 credentials, no GitHub environments (`total_count: 0`) or repo
  secrets (`[]`), no GHCR packages, no staging credentials. The harness
  additionally blocks remote shell/file transfer, so SSH-based steps cannot
  be executed from here.
- **Staging release path (E8):** `release-deploy.yml` + `rollback-deploy.yml`
  gained an `environment` input (`production` default / `staging`); staging
  runs PATCH the Coolify apps to `sha-<commit>` and are refused from moving
  the `production` alias; health/smoke domain overrides pass through
  `FEP_PROD_HEALTH_*`/`FEP_SMOKE_*` secrets. `environment:` expressions are
  officially supported (GitHub docs). `tests/infra/check-workflows.mjs` W2
  updated + W12 added; `node tests/infra/check-workflows.mjs` ALL PASS;
  `pnpm verify:fast` green.

## Decisions

- Fix the racy e2e test (not the player): the accepted slice-8 design
  intentionally drops route callbacks on unbind; the test asserted a
  timing-dependent outcome. The deterministic assertion still proves the
  accepted invariants (deck CTA derives from saved progress; end-of-clip
  pause-save writes the honest position).
- Staging deploy path = `environment` input on the existing workflows
  (runbook STAGING.md §2.6 "staging override"); staging Coolify apps pin
  `sha-<commit>` (never the moving alias); the workflow REFUSES
  staging + alias-publish.
- Runbooks remain the contract: no architecture redesign.

## Next actions (HUMAN INPUT REQUIRED — exact sequence)

1. Purchase/order the staging VPS (Ubuntu 24.04 LTS, x86_64, 1–2 vCPU,
   2–4 GB RAM, ≥30–50 GB SSD, public IPv4). Record its IP. Provider
   firewall: 22 (restricted to Coolify Cloud + operator IP), 80, 443 ONLY.
2. Create the Coolify Cloud account (MFA) → Servers → Connect the staging
   VPS (Docker installed by Coolify). Record the server id (non-secret).
3. DNS: A records `staging` / `app-staging` / `admin-staging`.
   `fastenglishpodcast.com` → staging IP. Confirm propagation; never touch
   production DNS.
4. Host init on the staging VPS with STAGING paths
   (`/opt/fast-english-staging/shared/{pb_data,backups,releases,secrets}`,
   chown 10001:10001, staging secrets file with staging-only values:
   `FEP_SUPERUSER_*`, `PB_ENCRYPTION_KEY`, `FEP_BACKUP_S3_*`), install
   `deploy/backup.sh`/`backup-copy.sh`/`check-offsite.sh` + the host timer.
5. Create the four Coolify Applications (docker-image build pack,
   `sha-<commit>` tag, ports/health checks/mounts per `docs/COOLIFY_DEPLOYMENT.md`
   §6) with the staging domains; PocketBase: bind mount + `PB_ENCRYPTION_KEY`
   env, NO public port, loopback 127.0.0.1:8090 mapping (O1).
6. GitHub: create `staging` AND `production` environments; add the
   environment secrets (names in `deploy/env.production.example`); protect
   `production` with required reviewers. Staging secrets = staging values.
7. After PR #12 merges, note the NEW `main` tip SHA (its canonical quality
   run must be green — the `6699439` run is red and can never be the
   release base). Dispatch `release-deploy` with `environment=staging`,
   `ref=<new main tip>`, `smoke=full`. (The product artifact tree is
   unchanged since `6699439`; the merge only carries the e2e gate repair.)
8. Execute `docs/STAGING.md` F1–F17 + O1–O5 + backup/restore drills + the
   full staging product journey; record evidence into this plan.
9. Return the GO/NO-GO verdict; only then proceed to the Production phase.

## Risks / blockers

- Canonical gate for `6699439` is RED until the merged e2e fix re-runs
  green; the release workflows gate on the `verify` check-run and will
  REFUSE a red commit.
- First release requires the operator to run the pipeline (human); images
  do not pre-exist on GHCR.
- S3 backup destination, staging superuser/staff credentials, DNS provider
  access, Coolify Cloud account — all human.
- This environment cannot SSH (remote shell blocked) — the operator (or an
  unrestricted session) must run the VPS steps.

## Handoff

- What changed: e2e mini-player test de-racing (gate repair), staging
  release path in both deploy workflows + contract checks, docs
  (COOLIFY_DEPLOYMENT/STAGING/TECHNICAL_OWNER_RUNBOOK_FA/env example).
- What remains: everything on the HUMAN INPUT REQUIRED list above; then the
  S1–S28 acceptance evidence; then the verdict.
- Must not be overwritten: the exact release base `6699439`; staging-only
  credentials never substituted from production; pb_data never shared.
- First action for a fresh session: verify the canonical quality run for
  the new `main` merge commit is green, then run step 7 above.

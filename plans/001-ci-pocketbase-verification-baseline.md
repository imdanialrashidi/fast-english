# 001 — CI PocketBase verification baseline

- **Written against:** commit `4b7caba` (branch `main`, clean tree)
- **Status:** DRAFT
- **Effort:** S · **Fix risk:** Low · **Finding:** #1 (BLOCKER — CI cannot complete the canonical gate from a fresh checkout)

## Why this matters

The canonical verification gate `scripts/verify.sh` runs a suite of real-backend
smoke tests against a disposable PocketBase instance. A fresh CI checkout has
no PocketBase binary (`server/pocketbase` is git-ignored), so the gate cannot
complete. The local machine currently passes only because the binary happens
to exist there. Without this fix, every PR/push CI run fails at the first smoke
step, which means the project's real verification never runs on GitHub.

## Current state (evidence)

- `.github/workflows/quality.yml` (lines 47–51):
  ```yaml
  - name: Install dependencies
    run: bash scripts/ci-install.sh

  - name: Verify
    run: bash scripts/verify.sh
  ```
- `scripts/ci-install.sh` (lines 7–21) installs Node packages only (`pnpm install --frozen-lockfile`); it never provisions the PocketBase binary.
- `scripts/verify.sh` (line 8) `exec`s `scripts/project-verify.sh` when present.
- `scripts/project-verify.sh` (lines 45–73) unconditionally runs, in order: `smoke-auth`, `smoke-payment`, `smoke-payment-preview`, `smoke-placement`, `smoke-placement-levels`, `smoke-operator`, `smoke-placement-race`, `smoke-placement-capacity`, `smoke-lessons`, `smoke-progress`.
- Every smoke wrapper fails fast when the binary is absent; e.g. `scripts/smoke-auth.sh` (lines 10–12):
  ```bash
  if [[ ! -x server/pocketbase ]]; then
    echo "PocketBase binary not found. Run: pnpm setup:pocketbase" >&2
    exit 1
  fi
  ```
- `.gitignore` (lines 45–48): `server/pb_data/`, `server/pocketbase`, `server/pocketbase.exe` are ignored.
- `scripts/setup-pocketbase.sh` already exists and is the intended provisioning path (downloads the version pinned in `server/VERSION`, checks architecture, extracts, installs, and verifies the reported version). It is currently wired only to `pnpm setup:pocketbase`.

## Repo conventions to follow

- Shell scripts use `set -Eeuo pipefail` and `#!/usr/bin/env bash`.
- CI workflow already uses `actions/checkout@v7`, `actions/setup-node@v7` (Node 24), `persist-credentials: false`, and a 20-minute job timeout.
- The existing pattern for environment provisioning is `scripts/ci-install.sh`; keep the new step in the workflow, not in a new dependency.

## Scope

**In scope:**

- `.github/workflows/quality.yml`
- (optional) `scripts/project-verify.sh` — an explicit preflight assertion only, if you judge it useful; it must not skip or weaken smoke tests

**Out of scope:**

- Committing the PocketBase binary (must stay git-ignored)
- Changing smoke test semantics or making them conditional
- Adding checksum/signature verification of the downloaded binary (separate supply-chain plan, not selected)
- Adding Playwright/E2E runs to CI (documented as separate: `pnpm test:e2e`)
- Changing `server/VERSION`, package versions, or the pnpm/corepack setup

## Steps (ordered)

1. Edit `.github/workflows/quality.yml`. After the `Install dependencies` step and before the `Verify` step, add:
   ```yaml
   - name: Provision PocketBase test binary
     run: bash scripts/setup-pocketbase.sh
   ```
   Place it inside the same job, after `bash scripts/ci-install.sh`. The script reads `server/VERSION` (0.39.9), detects `uname -m`, downloads the official release asset over HTTPS, extracts to `server/pocketbase`, and aborts if the installed version string does not match `server/VERSION`.
2. (Optional) Add an explicit preflight in `scripts/project-verify.sh` right after the `run()` helper definition (before step 1, line ~36):
   ```bash
   test -x server/pocketbase || {
     echo 'server/pocketbase missing — run scripts/setup-pocketbase.sh first' >&2
     exit 1
   }
   ```
   This converts the current per-script "not found" errors into one clear failure at the top of the gate. Do not add any conditional skip.
3. Do not change `.gitignore`; the binary must remain untracked. Verify with `git status --short` that no `server/pocketbase` or `server/pb_data` entry appears.
4. Run the verification commands below locally (binary already present locally, so the smoke suites exercise the real gate).

## Verification gates (machine-checkable)

Each command must exit 0:

```bash
pnpm typecheck
pnpm check
pnpm test
bash scripts/verify.sh
```

Expected final line of `bash scripts/verify.sh`:

```text
All project verification checks passed.
```

CI-behavior check (cannot be run locally without a fresh runner): a fresh checkout must reach the smoke suites — i.e. the workflow no longer fails with `PocketBase binary not found` before any smoke scenario runs. If you have `gh` access, push the branch and confirm the `quality` workflow completes; otherwise state that CI was not re-run locally and the workflow diff is the evidence.

## Test plan

This is a tooling change; the tests are the verification gates themselves:

- The existing smoke suites (`scripts/smoke-*.mjs`) are the behavioral tests and must stay green.
- If you added the preflight, assert its failure mode once by temporarily renaming `server/pocketbase` (then restoring it) and confirming `bash scripts/verify.sh` exits non-zero with the new message before any smoke run. Restore the binary afterwards.

## Maintenance note

- Every PocketBase version bump must touch three places together: `server/VERSION`, the release URL inside `scripts/setup-pocketbase.sh` (derived from `VERSION`), and nothing else — CI uses the same script.
- If a future CI step caches the binary (e.g. `actions/cache`), the cache key must include the contents of `server/VERSION`.
- Watch in review: no one re-adds a conditional skip around smoke suites ("CI flaky") — that would silently disable the real verification this plan exists to enable.

## Escape hatches

- If the GitHub runner cannot download the pinned asset (network/firewall), STOP and report the environment failure with the exact curl error; do not vendor the binary into the repo and do not weaken the smoke gate.
- If `corepack enable`/`pnpm install` fails on the runner (pre-existing condition, unrelated to this plan), stop and report; do not rework the package-manager setup here.

## Done criteria

- [ ] Workflow has a `Provision PocketBase test binary` step before `Verify`
- [ ] `server/pocketbase` still untracked (`git status --short` clean apart from intended changes)
- [ ] All four verification commands pass locally
- [ ] `scripts/verify.sh` prints `All project verification checks passed.`
- [ ] No smoke suite was skipped, weakened, or made conditional

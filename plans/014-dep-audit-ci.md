# Plan 014: Wire a production dependency audit into CI

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**:
> `git diff --stat f64288e..HEAD -- .github/workflows/quality.yml package.json pnpm-lock.yaml`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: dx/security (supply-chain hygiene)
- **Planned at**: commit `f64288e`, 2026-08-14

## Why this matters

The repo pins every dependency exactly (`package.json` + lockfile) and
maintains an elaborate verification ladder, but NO dependency audit runs
anywhere: `.github/workflows/quality.yml` has no `pnpm audit` step, and
`pnpm verify:fast` (the only local gate that could host it) runs on the
local registry — which, in this environment, is a mirror WITHOUT the
audit endpoint (`ERR_PNPM_AUDIT_ENDPOINT_NOT_EXISTS`). Advisories for the
runtime surface (React, MUI, pocketbase SDK, Vite ecosystem) can land
undetected until a manual check. CI uses registry.npmjs.org by default
(no `.npmrc` in the repo), so the audit belongs in CI's static lane.

**Non-goal**: no dependency upgrades in this plan — only the gate.

## Current state

`.github/workflows/quality.yml` static lane (steps):
`Pi harness validation` → `Install dependencies` (with `CI_SKIP_PLAYWRIGHT=1`)
→ `Fast verification (typecheck + Biome + Vitest)` running
`bash scripts/verify-fast.sh`.

No `.npmrc` exists in the repo (`ls -la .npmrc` → absent); the local
mirror registry is a machine-global setting. CI runners default to
`https://registry.npmjs.org/`.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Local audit attempt (mirror) | `pnpm audit --prod` | fails with `ERR_PNPM_AUDIT_ENDPOINT_NOT_EXISTS` (expected locally; documented) |
| Audit against npmjs (evidence) | `pnpm audit --prod --registry=https://registry.npmjs.org` | exits 0 (no high/critical) OR reports advisories — record the actual output |
| Fast gate | `pnpm verify:fast` | exit 0 (unchanged) |

## Scope

**In scope** (the only files you should modify):
- `.github/workflows/quality.yml` (static lane: one new step)

**Out of scope** (do NOT touch):
- `package.json` / `pnpm-lock.yaml` (no upgrades — unless the audit itself
  demands a bump, which is then a separate report to the maintainer).
- `verify-fast.sh` (local gate stays mirror-tolerant).
- The backend/e2e lanes.

## Git workflow

- Branch: `advisor/014-dep-audit-ci` (repo convention: `topic-slug`).
- Commit style: conventional (`build(ci): audit production dependencies in the static lane`).
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Run the audit once (evidence)

Run `pnpm audit --prod --registry=https://registry.npmjs.org` and record
the result in the plan/commit message: exit code, number of
high/critical advisories (if any), and their packages. If HIGH/CRITICAL
advisories affect reachable runtime code, report them to the maintainer
in the PR body (this plan does NOT bump versions).

**Verify**: the command's output is captured; the verdict is recorded.

### Step 2: Wire the audit into the static lane

In `.github/workflows/quality.yml`, in the `static` job, after `Install
dependencies` and before `Fast verification`, add:

```yaml
      # Production dependency advisories (npmjs registry; the local
      # mirror lacks the audit endpoint, so this runs in CI only).
      - name: Audit production dependencies
        run: pnpm audit --prod --audit-level high
```

`--audit-level high` fails the job on high/critical advisories, tolerates
moderate/low (noise control). Keep the exact pin discipline: do not add
`--fix` or an upgrade step.

**Verify**: the workflow YAML is valid (parse it); the static lane has the
new step in the right order.

### Step 3: Confirm no local-gate coupling

**Verify**: `pnpm verify:fast` still exits 0 locally (the audit is CI-only
by design — the local mirror cannot run it; document this in the commit
message so nobody "fixes" the local gate by disabling the CI step).

## Test plan

- CI-only step; local verification is: YAML validity, step placement, the
  recorded audit result from Step 1, and `pnpm verify:fast` green.
- The audit result itself is the deliverable evidence (a clean run with
  the npmjs registry).

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `.github/workflows/quality.yml` static lane contains the audit step
      with `--audit-level high`
- [ ] Step 1's audit output is recorded in the commit message / PR body
- [ ] `pnpm verify:fast` exits 0
- [ ] `git status` shows only in-scope files (plus `plans/README.md`)
- [ ] `plans/README.md` status row updated to DONE

## STOP conditions

Stop and report back (do not improvise) if:

- The npmjs-registry audit finds HIGH/CRITICAL advisories in reachable
  runtime code — do NOT bump versions here; report the advisories with the
  packages and affected versions so the maintainer can decide.
- The workflow file structure has drifted (job/step layout changed).

## Maintenance notes

- The audit is advisory-policy, not a version gate: `--audit-level high`
  means moderate/low advisories won't fail CI — revisit the level if the
  repo's risk posture changes.
- When the local mirror gains an audit endpoint, the step can move into
  `verify-fast.sh`; until then it must stay in CI.
- Future dependency upgrades should land with their own audit evidence
  (run the same command before and after).

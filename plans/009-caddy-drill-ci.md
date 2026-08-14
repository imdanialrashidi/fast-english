# Plan 009: Make the Caddy access-log redaction drill run in CI (and fail loud locally when caddy exists)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**:
> `git diff --stat f64288e..HEAD -- .github/workflows/quality.yml scripts/project-verify.sh deploy/test-log-redaction.sh scripts/ci-install.sh`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: tests/ops (security proof)
- **Planned at**: commit `f64288e`, 2026-08-14

## Why this matters

The one security proof for the documented "audio file token travels as a
URL query parameter" leak vector — `deploy/test-log-redaction.sh` — is
silently skipped everywhere that matters:

- `scripts/project-verify.sh:275-278` prints
  `caddy binary not found — skipping the access-log redaction drill` and
  continues (exit 0) when `caddy` is absent.
- CI's backend lane (`.github/workflows/quality.yml`) installs Node +
  PocketBase only; ubuntu-latest does not ship caddy. So the canonical
  gate NEVER runs the drill, and the deploy-time behavior it pins
  (Caddy's `request>uri` query filter replacing `token` with `[REDACTED]`)
  can drift unnoticed until a real deployment leaks tokens into access
  logs.

The drill itself is real and executable (`deploy/test-log-redaction.sh`
starts a local caddy with the production Caddyfile and asserts redaction).
The fix: provision caddy in the CI backend lane and make the local script
fail when caddy IS present but the drill fails (it already does — the
problem is only the skip branch).

## Current state

`scripts/project-verify.sh:272-280`:

```bash
# 23. P4-S3 — Caddy access-log token-redaction proof. Requires a local caddy
#     binary; the release server runs this drill unconditionally (see
#     deploy/README.md), CI/local runs include it whenever caddy is present.
if command -v caddy >/dev/null 2>&1; then
  run bash deploy/test-log-redaction.sh
else
  echo 'caddy binary not found — skipping the access-log redaction drill (release gate runs it)'
fi
```

CI backend lane (`.github/workflows/quality.yml`): steps `Install
dependencies` → `Provision PocketBase test binary` → `Verify (backend
release gate)` — no caddy anywhere. The repo pins binaries by version
elsewhere (`server/VERSION` pins PocketBase 0.39.9) — follow that pattern.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Drill (local, if caddy appears) | `bash deploy/test-log-redaction.sh` | exit 0 |
| Fast gate | `pnpm verify:fast` | exit 0 |
| Workflow sanity | `node -e "const y=require('js-yaml')"` or visual review | YAML parses |

## Scope

**In scope** (the only files you should modify):
- `.github/workflows/quality.yml` (backend lane: add a caddy provision step)
- `scripts/project-verify.sh` (skip branch → hard fail when `FEP_REQUIRE_CADDY=1`, warn otherwise)
- `scripts/ci-install.sh` (optional: centralize the caddy install there —
  check how it installs PocketBase first and mirror it)

**Out of scope** (do NOT touch):
- `deploy/test-log-redaction.sh` — correct as-is.
- The e2e/static lanes — backend lane only.
- Making local machines without caddy fail: keep the skip for local dev
  (the plan's contract is CI coverage, not forcing caddy on every laptop).
  Use an env escape hatch `FEP_REQUIRE_CADDY=1` so the release gate can
  demand it anywhere.

## Git workflow

- Branch: `advisor/009-caddy-drill-ci` (repo convention: `topic-slug`).
- Commit style: conventional (`build(ci): run the Caddy token-redaction drill in the backend lane`).
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Provision caddy in the CI backend lane

In `.github/workflows/quality.yml`, in the `backend` job, after
`Provision PocketBase test binary` and before `Verify (backend release
gate)`, add a step that installs the caddy version used by the deploy
tooling (check `deploy/test-log-redaction.sh` / `deploy/README.md` for the
pinned version — the deploy docs mention "verified against Caddy v2.10.2"
in docs/PLAN.md; confirm the actual pin in the deploy files and use it):

```yaml
      - name: Provision Caddy (access-log redaction drill)
        run: |
          CADDY_VERSION="v2.10.2"   # match deploy docs / test-log-redaction.sh
          curl -fsSL "https://github.com/caddyserver/caddy/releases/download/${CADDY_VERSION}/caddy_${CADDY_VERSION#v}_linux_amd64.tar.gz" -o /tmp/caddy.tgz
          tar -xzf /tmp/caddy.tgz -C /tmp caddy
          sudo mv /tmp/caddy /usr/local/bin/caddy
          caddy version
```

And in the `Verify (backend release gate)` step, set
`FEP_REQUIRE_CADDY=1` in its `env:` so the drill must actually run:

```yaml
      - name: Verify (backend release gate)
        env:
          FEP_REQUIRE_CADDY: '1'
        run: bash scripts/project-verify.sh
```

Check the actual pinned caddy version before writing the step (grep
`deploy/` and `docs/PLAN.md` for "caddy" version strings); if the deploy
tooling does not pin a version, use the version named in the Caddyfile
compatibility note or `v2.10.2` (the version documented as verified).

**Verify**: YAML is valid (read the final file); the backend job has the
two new bits; no other lane changed.

### Step 2: Make the skip branch honor FEP_REQUIRE_CADDY

In `scripts/project-verify.sh`, replace the skip branch:

```bash
if command -v caddy >/dev/null 2>&1; then
  run bash deploy/test-log-redaction.sh
elif [ "${FEP_REQUIRE_CADDY:-0}" = "1" ]; then
  echo 'ERROR: FEP_REQUIRE_CADDY=1 but caddy binary not found — access-log redaction drill REQUIRED' >&2
  exit 1
else
  echo 'caddy binary not found — skipping the access-log redaction drill locally (CI/release run it; set FEP_REQUIRE_CADDY=1 to demand it)'
fi
```

**Verify**: `bash -n scripts/project-verify.sh` → no syntax errors;
`FEP_REQUIRE_CADDY=1 bash scripts/project-verify.sh` on this machine (no
caddy) fails at step 23 with the new message AFTER the earlier steps pass
— run with a timeout and expect the specific error (or, if you prefer a
cheap check: `FEP_REQUIRE_CADDY=1 bash -c 'source <(sed -n "270,284p" scripts/project-verify.sh)'` is not valid — instead run the full script and accept the earlier steps' cost, OR extract the branch logic check by reading).

Simpler deterministic check without running the whole gate: assert the
snippet semantics by reading + `bash -n`.

### Step 3 (optional): centralize in ci-install.sh

If `scripts/ci-install.sh` already provisions pinned tooling (read it
first), move the caddy download there behind a guard and have the workflow
call it — only if that matches the file's existing structure. Otherwise
leave Step 1's inline step (preferred: smallest diff).

## Test plan

- CI behavior cannot run locally; the verification is: (a) the workflow
  YAML structurally correct and the backend lane will have caddy, (b)
  `FEP_REQUIRE_CADDY=1` fails fast when caddy is absent (read + `bash -n`),
  (c) `bash deploy/test-log-redaction.sh` still passes on any machine with
  caddy (unchanged file).
- `pnpm verify:fast` stays green.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `.github/workflows/quality.yml` backend job has a caddy provision
      step before the verify step, and the verify step sets `FEP_REQUIRE_CADDY: '1'`
- [ ] `scripts/project-verify.sh` fails (exit 1) when
      `FEP_REQUIRE_CADDY=1` and caddy is absent; still skips with a clear
      message otherwise
- [ ] `bash -n scripts/project-verify.sh` exits 0
- [ ] `pnpm verify:fast` exits 0
- [ ] `git status` shows only in-scope files (plus `plans/README.md`)
- [ ] `plans/README.md` status row updated to DONE

## STOP conditions

Stop and report back (do not improvise) if:

- The caddy version pin in deploy tooling differs from v2.10.2 and you
  cannot confirm the right one — report the versions you found.
- `scripts/ci-install.sh` structure makes Step 3 ambiguous — skip Step 3
  (it is optional) and say so.
- The workflow file has drifted structurally (job names/order changed).

## Maintenance notes

- When the Caddyfile changes (headers, proxies, log format), the drill
  (`deploy/test-log-redaction.sh`) is the proof — keep CI provisioning
  caddy so the drill always runs.
- If GitHub Actions runners ever bundle caddy, the provision step can be
  dropped — keep it until then (explicit is better).
- The `FEP_REQUIRE_CADDY` escape hatch is also usable on the release
  server before deploys (`smoke-prod.sh` runs the same drill).

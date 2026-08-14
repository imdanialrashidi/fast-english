# Plan 019: Close the verify-affected routing gaps (app changes → browser lane; spec changes → static checks)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**:
> `git diff --stat f64288e..HEAD -- .pi/verification.json scripts/verify-affected.mjs scripts/verify-feature.sh docs/TOOLING_SETUP.md`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P3
- **Effort**: M
- **Risk**: LOW-MED
- **Depends on**: none
- **Category**: dx (verification routing)
- **Planned at**: commit `f64288e`, 2026-08-14

## Why this matters

`scripts/verify-affected.mjs` routes changed files to verification lanes
via `.pi/verification.json`, but two gaps make the "affected-change
routing" promise (docs/TOOLING_SETUP.md) overstate what is verified:

1. **App feature changes get NO browser/smoke coverage.** The
   `frontend-fast` route maps `app/**`, `shared/**`, `landing/**`,
   `admin/**` to `verify-fast` ONLY (typecheck + Biome + Vitest). A change
   to `app/src/features/payment/api.ts` — a contract pinned by ~30
   Playwright tests and real-PocketBase smokes — triggers zero browser and
   zero backend verification; the lane reports "Affected verification
   passed" while the journey that broke is invisible until CI.
2. **E2E-only changes get NO static checks.** The `browser-e2e` route maps
   `e2e/**` + `playwright.config.ts` to `playwright-fast` ONLY. Spec files
   are NOT in tsconfig's include list (verified) and no Biome run targets
   them in this lane, so a spec edit can ship lint/type debt that only the
   full CI static lane surfaces.

The fix: (a) route app FEATURE code through the feature lane
(`verify-feature all app`: fast + all real-backend smokes + `@critical`
Playwright + app build) instead of the fast lane; (b) add a Biome check
for the e2e surface to the browser-e2e route.

**Constraint**: read `scripts/verify-affected.mjs` FIRST and confirm how
multiple matching routes are handled (first match wins, or union). The
plan assumes first-match (routes are ordered); if it is a union, the new
routes must be added carefully to avoid doubling lanes.

## Current state

`.pi/verification.json` routes (ordered):

| id | include | commands |
|---|---|---|
| harness-workflow | AGENTS.md, .pi/**, docs/**, evals/**, .github/**, tests/**, scripts/pi-*, … | pi-doctor + node --test (harness tests) |
| frontend-fast | app/**, shared/**, landing/**, admin/** | `bash scripts/verify-fast.sh` |
| backend-feature | server/**, schemas/**, content-packages/**, scripts/smoke-*.mjs | `bash scripts/verify-feature.sh` |
| browser-e2e | e2e/**, playwright.config.ts, scripts/playwright-fast.sh | `bash scripts/playwright-fast.sh` |
| verification-scripts | scripts/verify-*.sh | `bash scripts/verify-full.sh` |
| dependency-root | package.json, pnpm-lock.yaml, .nvmrc, capacitor.config.json | `bash scripts/verify-full.sh` |

`tsconfig.json` include: `app/src/**`, `landing/src/**`, `shared/**`,
`admin/src/**`, vite/vitest configs — **e2e/ is NOT typechecked**.
`biome.json` includes `**` (so `npx biome check e2e/` works).

`scripts/verify-feature.sh` signature: `verify:feature [auth|payment|placement|lessons|progress|all] [app|landing|all]`
— `all app` = verify:fast + all smoke groups + `@critical` Playwright +
app build.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Affected routing | `node scripts/verify-affected.mjs --file app/src/features/payment/api.ts --plan` | prints the NEW route set (app-browser) |
| Affected routing (spec) | `node scripts/verify-affected.mjs --file e2e/podcast-library.spec.ts --plan` | prints browser-e2e incl. the biome command |
| Fast gate | `pnpm verify:fast` | exit 0 |

## Scope

**In scope** (the only files you should modify):
- `.pi/verification.json`
- `docs/TOOLING_SETUP.md` (the affected-routing paragraph, if its wording
  promises more than the lanes now deliver)

**Out of scope** (do NOT touch):
- `scripts/verify-affected.mjs`, `verify-feature.sh`, `verify-fast.sh`
  (no runner changes — pure config).
- The full gate (`verify-full.sh`) behavior.
- Adding `e2e/` to tsconfig include (a bigger change — see Maintenance
  notes; Biome is the chosen static check for this lane).

## Git workflow

- Branch: `advisor/019-affected-routing` (repo convention: `topic-slug`).
- Commit style: conventional (`dx(verify): route app feature changes through the browser+smoke lane`).
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Read the runner semantics

Read `scripts/verify-affected.mjs` (and its test `tests/verify-affected.test.mjs`).
Confirm: (a) first-match vs union for multiple routes; (b) whether routes
can overlap safely (the new `app-browser` route overlaps `frontend-fast`
for `app/src/features/**`). If first-match, INSERT the new route BEFORE
`frontend-fast`; if union, keep the route definitions disjoint (drop
`app/src/features/**` from `frontend-fast` instead).

**Verify**: note the chosen mechanism in the commit message.

### Step 2: Add the app-browser route

Add (before `frontend-fast` if first-match; otherwise remove the overlap
from `frontend-fast`):

```json
    {
      "id": "app-browser",
      "include": ["app/src/features/**", "app/src/lib/**"],
      "commands": [["bash", "scripts/verify-feature.sh", "all", "app"]]
    }
```

Decision: `app/src/lib/**` is included because the lib layer (pocketbase
client, auth, telemetry) is exercised by browser journeys; `shared/**`
stays on `frontend-fast` (pure logic + tokens, unit-tested) — note this
choice in the commit. If the runner is first-match, the `frontend-fast`
route's `app/**` include now only catches `app/src/app/**` +
`app/src/pwa/**` + `app/src/main.tsx` etc. — acceptable (those are still
covered by verify-fast, and the feature lane also runs verify-fast as its
first phase).

**Verify**: `node scripts/verify-affected.mjs --file app/src/features/payment/api.ts --plan`
lists `app-browser` (and no longer `frontend-fast` for that file, under
first-match).

### Step 3: Add static checks to the browser-e2e route

In the `browser-e2e` route, change commands to:

```json
      "commands": [
        ["bash", "scripts/playwright-fast.sh"],
        ["npx", "biome", "check", "e2e/", "playwright.config.ts"]
      ]
```

(Biome covers the e2e surface; tsconfig deliberately excludes e2e — add a
comment line in the route or the plan's commit message so nobody "fixes"
the missing tsc by adding e2e to the app tsconfig, which would drag
Playwright types into the app build graph.)

**Verify**: `node scripts/verify-affected.mjs --file e2e/podcast-library.spec.ts --plan`
lists both commands; `npx biome check e2e/ playwright.config.ts` exits 0
on the current tree.

### Step 4: Docs

Update the affected-routing paragraph in `docs/TOOLING_SETUP.md` to
describe the new lanes honestly: app feature code → verify-feature
(fast + smokes + @critical browser + build); app shell/pwa → verify-fast;
e2e specs → playwright-fast + biome.

**Verify**: the paragraph matches the routes table.

### Step 5: Regression sweep

**Verify**: `pnpm verify:fast` exit 0; `node --test tests/verify-affected.test.mjs`
passes (the runner's own tests must not break from config-only changes —
if they pin the route table, update them deliberately and say so).

## Test plan

- `tests/verify-affected.test.mjs` — the runner's unit tests (update only
  if they pin the route table).
- Per-step `--plan` outputs are the acceptance evidence.
- `pnpm verify:fast` + the biome command stay green.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `.pi/verification.json` has the `app-browser` route and the extended `browser-e2e` commands
- [ ] `node scripts/verify-affected.mjs --file app/src/features/payment/api.ts --plan` → `app-browser` (verify-feature all app)
- [ ] `node scripts/verify-affected.mjs --file e2e/podcast-library.spec.ts --plan` → playwright-fast + biome
- [ ] `npx biome check e2e/ playwright.config.ts` exit 0
- [ ] `node --test tests/verify-affected.test.mjs` passes
- [ ] `pnpm verify:fast` exit 0
- [ ] `docs/TOOLING_SETUP.md` updated
- [ ] `git status` shows only in-scope files (plus `plans/README.md`)
- [ ] `plans/README.md` status row updated to DONE

## STOP conditions

Stop and report back (do not improvise) if:

- `verify-affected.mjs` semantics differ from the assumption (e.g. it
  requires routes to be disjoint, or it errors on overlapping includes) —
  report the actual semantics.
- The feature lane (`verify-feature all app`) is too heavy for routine
  app edits (it runs the full smoke battery) — report the measured cost
  with a suggested narrower mapping (e.g. group by the touched feature's
  smoke group is not derivable from paths — a path→group table would be a
  bigger design).

## Maintenance notes

- The `app-browser` lane makes local app work heavier but honest: a
  feature change now proves itself against the real backend + critical
  browser journeys before CI. If the smoke battery is too slow, the
  follow-up is a path→smoke-group table, NOT dropping the lane.
- `e2e/` remains untested by tsc by design; biome is the static check.
  Revisit if e2e grows complex enough to justify its own tsconfig project
  (documented decision).

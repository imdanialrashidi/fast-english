# Plan 023: Fix doc drift — Vite surface count, suite counts, README quick-start, Node version

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 1062bb0..HEAD -- README.md docs/ARCHITECTURE.md docs/QUALITY.md docs/TOOLING_SETUP.md CONTRIBUTING.md .env.example`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: docs (onboarding drift — high leverage, zero code risk)
- **Planned at**: commit `1062bb0`, 2026-08-21

## Why this matters

Four docs are actively wrong and each costs real time:

1. **README quick-start is broken**: `pnpm setup-pocketbase` (hyphen) → `Missing script: setup-pocketbase`. The real script is `setup:pocketbase` (colon). Every new clone fails on the first command.
2. **ARCHITECTURE claims two Vite configs** while the repo has three (`vite.landing`, `vite.app`, `vite.admin`). A contributor planning a cross-surface change misses Admin isolation invariants (no SW, separate `cacheDir`, `FEP_ANDROID_*` only in `admin`? etc.).
3. **Suite counts are inconsistent** (15 vs 16 vs 18) across `README`, `ARCHITECTURE`, `QUALITY`, `project-verify.sh` header. A maintainer estimating gate cost (18 disposable PB startups) gets the wrong model.
4. **CONTRIBUTING says Node 22.19.0** while `.nvmrc` and `package.json engines.node` pin `>=24 <25`. A contributor on Node 22 passes CONTRIBUTING but fails `pnpm install` engine checks.

Plan 008 previously fixed part of this; later slices re-introduced drift. This plan makes a single source-of-truth pass and adds a structural guard so drift is caught locally.

## Current state

- **README.md** (excerpt, lines 1–25):
```md
## Quick start
pnpm setup-pocketbase        # downloads the pinned PB binary (server/VERSION)
...
## Verification gates
pnpm verify:fast ...
pnpm verify:full     # canonical full gate: all 16 smoke suites + builds + full Playwright
...
Real-PocketBase smoke suites (`pnpm smoke:*`, 16 suites) each run a
```
  Actual `package.json` script: `"setup:pocketbase": "bash scripts/setup-pocketbase.sh"` (colon). The 16 count is wrong — real count is 18.

- **docs/ARCHITECTURE.md** (excerpt):
```md
- Two isolated Vite configs (clearest isolated outputs + separate dep sets):
  - `vite.landing.config.ts` → builds `landing/` → `dist-landing/` (Tailwind allowed here only).
  - `vite.app.config.ts` → builds `app/` → `dist-app/` (MUI only).
- Commands ... the `pnpm smoke:*` family (15 real-PocketBase suites)
```
  Missing `vite.admin.config.ts → dist-admin`. Suite count stale at 15.

- **docs/QUALITY.md** / **docs/TOOLING_SETUP.md** / `scripts/project-verify.sh` header comment: 16 (or 15) suites mentioned; real `package.json` `smoke:*` entries = 18 (`auth`, `payment`, `payment-preview`, `operator`, `placement`, `placement-levels`, `placement-race`, `placement-capacity`, `lessons`, `episode`, `progress`, `podcast-domain`, `content-import`, `content-admin`, `library`, `business-settings`, `staff`, `restore-proof`); `verify-smokes-parallel.sh` also lists 18.

- **CONTRIBUTING.md:5**: `Use Node.js 22.19.0 or newer.` vs `.nvmrc:1` `24` and `package.json:engines.node >=24 <25` and `docs/TOOLING_SETUP.md:7` "repository pins Node 24".

- **.env.example**: documents `VITE_API_TARGET`, `VITE_WEB_APP_URL`, etc., but omits dev-only `VITE_CATALOG` (catalog route) and `PB_CORS_ORIGINS` used by `scripts/dev.sh`.

- **No guard exists** today for doc drift — plan 008's guard idea was not landed.

- **Conventions:** docs are markdown, 2-space indent, no auto-formatting beyond Biome (which ignores `docs/`). `pnpm verify:fast` is `tsc + biome + vitest` only — docs changes only need `pnpm check` (biome) + `vitest` for any new structural test.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Lint | `pnpm check` | exit 0 |
| Fast gate | `pnpm verify:fast` | exit 0 |
| New guard test | `npx vitest run tests/docs-drift.test.mjs` | 1 file pass |

## Scope

**In scope** (the only files you should modify):
- `README.md`
- `docs/ARCHITECTURE.md`
- `docs/QUALITY.md`
- `docs/TOOLING_SETUP.md`
- `CONTRIBUTING.md`
- `.env.example`
- `scripts/project-verify.sh` (header comment only — the "16 smoke suites" comment)
- `tests/docs-drift.test.mjs` (new structural guard, mirroring `tests/hook-rate-limit.test.mjs` style)

**Out of scope** (do NOT touch, even though they look related):
- Any `server/pb_hooks/*.pb.js`, `app/**`, `landing/**`, `admin/**`, `vite.*.config.ts` — no code changes.
- `package.json` — engine pins are correct; docs align to it, not vice versa.
- `docs/PLAN.md` slice log — appending is out of scope unless directly contradicting (it is not).

## Git workflow

- Branch: `advisor/023-doc-drift-suite-vite-node`
- Commit: `docs: fix Vite surface count, suite counts, quick-start, Node version`
- Do NOT push unless instructed.

## Steps

### Step 1: Fix README quick-start

Edit `README.md`:

- Change `pnpm setup-pocketbase` → `pnpm setup:pocketbase` (colon). Keep the comment after it (`# downloads the pinned PB binary (server/VERSION)`).
- Add a note above or below: ``Requires `corepack enable` for pnpm 11.17 (see `scripts/ci-install.sh`).`` Keep it one line — match existing tone.
- Fix suite count line: `all 16 smoke suites` → `all 18 smoke suites`. And the `16 suites` sentence → `18 suites`.
- Keep the `Node ≥ 24 (.nvmrc); pnpm 11.` line as is (already correct).

**Verify**: `pnpm check` passes; `grep -n "setup:pocketbase" README.md` hits; `grep -n "setup-pocketbase" README.md` (hyphen) returns no hit.

### Step 2: Fix ARCHITECTURE — three Vite surfaces

Edit `docs/ARCHITECTURE.md`:

- Change `Two isolated Vite configs ...` block to:
```md
- Three isolated Vite configs (clearest isolated outputs + separate dep sets):
  - `vite.landing.config.ts` → builds `landing/` → `dist-landing/` (Tailwind allowed here only).
  - `vite.app.config.ts` → builds `app/` → `dist-app/` (MUI only).
  - `vite.admin.config.ts` → builds `admin/` → `dist-admin/` (MUI, Staff console, no PWA).
```
- Add after bullet: `Each uses an isolated `cacheDir` (`node_modules/.vite-*`) so dev servers do not clobber.`
- Fix suite count `15 real-PocketBase suites` → `18 real-PocketBase suites`.
- In `Commands` line, add `|dev:admin` and `|build:admin` if missing — list all three surfaces exactly as `package.json` has them.

**Verify**: search `Two isolated Vite` returns no hit; `grep -n "vite.admin.config" docs/ARCHITECTURE.md` hits.

### Step 3: Fix QUALITY, TOOLING_SETUP, project-verify.sh suite counts

- In `docs/QUALITY.md` section "Canonical verification lanes": change `all 16 real-PB smoke suites` → `all 18 real-PB smoke suites` (both occurrences if two).
- In `docs/TOOLING_SETUP.md` verification lanes: same replacement (`16 suites` → `18 suites`).
- In `scripts/project-verify.sh` header comment (first 30 lines): change `16 smoke suites` / `16 real-PocketBase` comments → `18` (comment only, no logic change).

Do not change any executable logic in `project-verify.sh` — only the header comment block.

**Verify**: `grep -rn "16 smoke" docs/ scripts/project-verify.sh` returns no hit; `grep -rn "16 suite" docs/` returns no hit.

### Step 4: Fix CONTRIBUTING Node version + add corepack note

Edit `CONTRIBUTING.md`:

- Change `Use Node.js 22.19.0 or newer.` → `Use Node 24 (see .nvmrc, engines.node >=24 <25). Run corepack enable for pnpm 11.17.`
- Keep other sections untouched.

**Verify**: `grep -n "22.19" CONTRIBUTING.md` no hit; `grep -n "Node 24" CONTRIBUTING.md` hits.

### Step 5: Complete .env.example dev-only vars

Append to `.env.example` under an `# [OPTIONAL] dev-only` section (create it if absent, at the end, before any trailing blank line):

```
# [OPTIONAL] dev-only — not required for production
# VITE_CATALOG=1              # enable /dev/catalog (dev station, see playwright.config.ts)
# PB_CORS_ORIGINS=http://localhost:5173,http://localhost:5174,http://localhost:5175
```

Keep existing vars untouched. Do not add secrets.

**Verify**: `grep -n "VITE_CATALOG" .env.example` hits.

### Step 6: Add structural guard `tests/docs-drift.test.mjs`

Create `tests/docs-drift.test.mjs` (Node `node:test` + `node:assert/strict`, `fs` reads relative to `import.meta.dirname`). The test should:

1. Read `README.md`, `docs/ARCHITECTURE.md`, `docs/QUALITY.md`, `docs/TOOLING_SETUP.md`, `CONTRIBUTING.md`, `.env.example`, `package.json`, `scripts/project-verify.sh`.
2. Assert `README.md` contains `setup:pocketbase` and does NOT contain the hyphen typo as a code block command (search for `` `pnpm setup-pocketbase` `` or bare `pnpm setup-pocketbase` line).
3. Assert `docs/ARCHITECTURE.md` contains `vite.admin.config.ts` and `Three isolated Vite`.
4. Assert `README.md` + `docs/ARCHITECTURE.md` + `docs/QUALITY.md` + `scripts/project-verify.sh` contain `18` suite/suites and do NOT contain `16 suite`/`15 suite` in the relevant contexts (allow `16` elsewhere if unrelated, but suite context must be 18).
5. Assert `CONTRIBUTING.md` contains `Node 24` and does NOT contain `22.19`.
6. Assert `.env.example` contains `VITE_CATALOG` and `PB_CORS_ORIGINS`.
7. Optional: assert the count of `smoke:*` scripts in `package.json` is 18 (count keys starting `smoke:`) and matches the 18 in docs — keeps gate honest if a new smoke is added.

Keep the test structural (string counts), not parsing MD AST. Mirror style of `tests/hook-rate-limit.test.mjs`.

**Verify**: `npx vitest run tests/docs-drift.test.mjs` → pass; `pnpm verify:fast` → exit 0.

## Test plan

- **New structural guard** `tests/docs-drift.test.mjs` — 5–7 assertions as above; no smoke, no build.
- **Regression**: `pnpm check` (biome) + `pnpm typecheck` + `pnpm verify:fast` (vitest includes new guard).

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `grep -rn "pnpm setup-pocketbase" README.md` (hyphen) returns no hit; `grep -n "setup:pocketbase" README.md` hits
- [ ] `grep -n "Three isolated Vite" docs/ARCHITECTURE.md` hits; `grep -n "Two isolated Vite" docs/ARCHITECTURE.md` no hit
- [ ] `grep -rn "16 smoke" docs/ scripts/` no hit; `grep -rn "18 suite" docs/README.md | wc -l` ≥ 3
- [ ] `grep -n "Node 24" CONTRIBUTING.md` hits; `grep -n "22.19" CONTRIBUTING.md` no hit
- [ ] `grep -n "VITE_CATALOG" .env.example` hits
- [ ] `npx vitest run tests/docs-drift.test.mjs` exits 0
- [ ] `pnpm verify:fast` exits 0
- [ ] `git status` only touches files in Scope + `plans/README.md`

## STOP conditions

Stop and report back if:

- Any excerpt in "Current state" does not match live code (docs have drifted differently than described).
- The suite count in `package.json` is not 18 (new suites added/removed since `1062bb0`) — report actual count and update docs to that count instead of hardcoding 18.
- `scripts/project-verify.sh` header comment structure changed so the "16" string is not in the header but in executable logic — do not edit logic.
- Fixing requires editing `package.json` engines or adding a workspace.

## Maintenance notes

- When a new smoke suite is added, update `package.json` + `verify-smokes-parallel.sh` + `docs/QUALITY.md` + `README.md` + `ARCHITECTURE.md` + this guard's count assertion in one commit.
- When a new Vite surface is added, update `ARCHITECTURE.md` bullet list and the `Three` → `Four` wording, and the guard's Vite assertion.
- Reviewers: doc changes are not type-checked — the guard is the CI pin. Ensure the `VITE_CATALOG` dev-only section stays under `[OPTIONAL]` so deploy tooling does not require it.


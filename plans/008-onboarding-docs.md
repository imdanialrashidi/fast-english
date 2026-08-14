# Plan 008: Onboarding and doc drift — README, .env.example, stale docs

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**:
> `git diff --stat f64288e..HEAD -- README.md .env.example CONTRIBUTING.md docs/TOOLING_SETUP.md docs/PRODUCT.md docs/PLAN.md server/pb_hooks/lesson_routes.pb.js`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: docs + dx
- **Planned at**: commit `f64288e`, 2026-08-14

## Why this matters

The repository's session map and onboarding surface are broken in five
ways, and `docs/PLAN.md` is the always-read recovery map for agents:

1. **README.md is 0 bytes** — the first thing any human (or agent) opens.
   `CONTRIBUTING.md:8` says "Install the reviewed Pi pin from `README.md`"
   — a dead link.
2. **`.env.example` omits ~10 variable names** that shipped scripts
   require (`FEP_PB_URL`, `FEP_PB_SUPERUSER_EMAIL/PASSWORD`,
   `FEP_STAFF_EMAIL/PASSWORD/DISPLAY_NAME`, `FEP_CONTENT_DIR`,
   `VITE_API_TARGET`, `VITE_TELEMETRY_ENDPOINT`, `PB_PORT`), so
   `pnpm staff:bootstrap` / `pnpm content:validate` are undiscoverable.
3. **`docs/TOOLING_SETUP.md:53` says "15 suites"** — the repo has 16
   `smoke:*` scripts (the family gained `smoke:episode`/`smoke:library`).
4. **`docs/PRODUCT.md:89-94` leaves all six acceptance criteria
   unchecked** although five are implemented and gated (signup/login,
   receipt approval idempotency, placement, lessons/progress, PWA); only
   physical-device install, release keystore, and `/review`+`/ship` remain
   open.
5. **`docs/PLAN.md` stops at Podcast Slice 6** while the code is at
   Slice 8+ (Episode Experience, player lifecycle, perf+observability) —
   a fresh session starting from PLAN.md believes Slice 7 is "Not started"
   and may rebuild or re-review it. A stale "matching level" entitlement
   comment in `server/pb_hooks/lesson_routes.pb.js:34-35` (the header)
   contradicts the implemented cross-level entitlement (Slice 6).

## Current state

- `README.md` — 0 bytes (verify with `wc -c README.md`).
- `CONTRIBUTING.md:8` — "Install the reviewed Pi pin from `README.md`."
- `.env.example` — 28 lines documenting only dev/Android/landing names
  (see the file; the missing names are listed in Why this matters).
- `docs/TOOLING_SETUP.md:53` — "Real-Backend smokes (`pnpm smoke:*`, 15 suites)".
- `docs/PRODUCT.md:89-94` — six `- [ ]` criteria, all unchecked.
- `docs/PLAN.md` — last record is "Podcast Slice 6 — Production Library &
  Discovery" (2026-08-08). Slices 7-9 are delivered (evidence:
  `e2e/podcast-episode.spec.ts` exists, `docs/exec-plans/active/player-lifecycle-reliability.md`
  documents Slice 8, `docs/exec-plans/active/2026-08-app-perf-observability.md`
  documents Slice 9, `docs/DESIGN.md` records the Slice 7 decision).
- `server/pb_hooks/lesson_routes.pb.js:34-35` header says entitlement
  requires "matching level"; implementation removed level equality
  (Slice 6) — see the file header block.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Fast gate | `pnpm verify:fast` | exit 0 (docs-only changes must not break anything) |
| Consistency greps | see each step | exact outputs listed |

## Scope

**In scope** (the only files you should modify):
- `README.md`
- `.env.example`
- `CONTRIBUTING.md`
- `docs/TOOLING_SETUP.md`
- `docs/PRODUCT.md`
- `docs/PLAN.md`
- `server/pb_hooks/lesson_routes.pb.js` (header comment only)

**Out of scope** (do NOT touch):
- Any behavior, hooks logic, package.json scripts, or CI config.
- `docs/PRODUCT.md` content beyond the acceptance checkbox section.
- Rewriting `docs/PLAN.md` history — append, never edit past slice records.

## Git workflow

- Branch: `advisor/008-onboarding-docs` (repo convention: `topic-slug`).
- Commit style: conventional (`docs: restore README, document env names, fix stale gate counts`).
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Restore README.md

Write a concise README (10-20 lines + links) covering: what the product is
(one sentence), the three surfaces (`app/` Student MUI, `admin/` Staff
console, `landing/` static Tailwind; PocketBase backend in `server/`),
quick start (Node ≥24 per `.nvmrc`, `pnpm install`, `pnpm dev:app` +
`pnpm setup-pocketbase` + `pnpm dev:server` — verify the exact dev-server
command from `package.json` before writing), and the canonical gates:
`pnpm verify:fast` / `verify:feature` / `verify:full` with one-line
descriptions, pointing to `docs/TOOLING_SETUP.md` for the full toolchain,
`docs/QUALITY.md` for the quality contract, and `docs/PLAN.md` for the
implementation log. Persian product name + English description. Do NOT
fabricate commands — copy script names exactly from `package.json`.

**Verify**: `wc -c README.md` → non-zero; every referenced script exists in
`package.json` (`grep` the names).

### Step 2: Fix CONTRIBUTING's dead link

Replace the `README.md` pointer with the real onboarding doc:

```markdown
2. Install the reviewed Pi pin from `docs/TOOLING_SETUP.md`.
```

**Verify**: `grep -n 'README.md' CONTRIBUTING.md` → no remaining
`README.md` reference (or only intentional ones).

### Step 3: Complete .env.example names

Append the missing variable names (names only, with a one-line comment each
— never values). The canonical sources for each name are the scripts that
read them: `scripts/staff-bootstrap.mjs` (FEP_PB_URL, FEP_PB_SUPERUSER_*,
FEP_STAFF_*), `scripts/content/cli.mjs` + `scripts/content/auth.mjs`
(FEP_CONTENT_DIR), `vite.app.config.ts` (VITE_API_TARGET),
`app/src/lib/telemetry/telemetry-env.d.ts` (VITE_TELEMETRY_ENDPOINT),
`scripts/dev.sh` (PB_PORT). Keep the header rule "Document required
variable names only. Never add real values."

**Verify**: for each of the 10 names, `grep -c <name> .env.example` → ≥ 1.

### Step 4: Fix the smoke count

`docs/TOOLING_SETUP.md:53` — "15 suites" → "16 suites" (cross-check
`grep -c 'smoke:' package.json` = 16). Also fix `docs/ARCHITECTURE.md:19`
if it says 15 (check; only fix if stale).

**Verify**: `grep -n '15 suites' docs/TOOLING_SETUP.md docs/ARCHITECTURE.md`
→ no matches.

### Step 5: Check the implemented PRODUCT.md criteria

In `docs/PRODUCT.md:89-94`, check the five implemented criteria and leave
the two genuinely open ones unchecked:
- Criterion 1 (signup/login) → `[x]`
- Criterion 2 (receipt approval) → `[x]`
- Criterion 3 (placement) → `[x]`
- Criterion 4 (lessons/progress) → `[x]`
- Criterion 5 (PWA installable; release APK on physical device) → keep
  `[ ]` — the PWA half is proven but the release-APK/device half is
  explicitly open (add a parenthetical: `PWA proven; release APK +
  physical-device gate open`)
- Criterion 6 (reproducible builds + verify.sh + /review + /ship) →
  `[x]` for the build/verify half, keep `[ ]` with a parenthetical
  (`/review` and `/ship` not run) — match the existing doc style.

**Verify**: `grep -c '^- \[x\]' docs/PRODUCT.md` → 4 (with the two
partially-open rows still `- [ ]`).

### Step 6: Append Slice 7-9 records to PLAN.md

Append three records to `docs/PLAN.md` in the existing record style
("## Podcast Slice 7 — … (date)"), 6-12 lines each, derived ONLY from
repo evidence: `docs/DESIGN.md` (Slice 7 decision log), the slice-8/9
execution plans in `docs/exec-plans/active/`, `docs/OBSERVABILITY.md`, and
the git log (`git log --oneline -20`). Each record: goal, key outcomes,
verification evidence (unit/smoke/e2e counts as recorded in the source
docs), and "Not performed" line. Do not invent numbers — cite what the
source docs say.

**Verify**: `grep -n 'Podcast Slice 7\|player lifecycle\|Podcast Slice 9' docs/PLAN.md` → matches exist.

### Step 7: Fix the stale entitlement comment

In `server/pb_hooks/lesson_routes.pb.js`, the file header (around `:34-35`)
still says entitlement requires "matching level". Fix the comment to state
the Slice 6 contract: any Published Variant A1-C2, level is a browsing
preference, not an authorization boundary. Comment-only change.

**Verify**: `grep -n 'matching level' server/pb_hooks/lesson_routes.pb.js` → no matches;
`pnpm smoke:lessons` still green (comment-only, but prove the file loads).

## Test plan

- No test files: this plan is docs + a comment. The verification is the
  per-step greps plus `pnpm verify:fast` (proves nothing broke) and
  `pnpm smoke:lessons` (proves the hook file still loads).

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `wc -c README.md` > 0 and all referenced commands exist in package.json
- [ ] All 10 missing env names present in `.env.example` (grep)
- [ ] `grep -rn '15 suites' docs/` → no matches; 16 verified against package.json
- [ ] `docs/PRODUCT.md` has 4 checked criteria, 2 open with accurate parentheticals
- [ ] `docs/PLAN.md` contains Slice 7-9 records
- [ ] `grep -n 'matching level' server/pb_hooks/lesson_routes.pb.js` → no matches
- [ ] `pnpm verify:fast` exits 0; `pnpm smoke:lessons` exits 0
- [ ] `git status` shows only in-scope files (plus `plans/README.md`)
- [ ] `plans/README.md` status row updated to DONE

## STOP conditions

Stop and report back (do not improvise) if:

- A source doc (slice-8/9 exec plans, DESIGN.md decision log) contradicts
  what you intend to write — cite the source and report; do not guess.
- `docs/PRODUCT.md` criteria were already partially updated (drift) —
  re-derive which are open from `docs/PLAN.md`'s open gates and report.
- The lesson_routes header has been rewritten since this plan was written.

## Maintenance notes

- `docs/PLAN.md` is the session map — future slices should append records
  in the same style. Consider a "current state" pointer at the top of the
  file so the log can stay append-only.
- `.env.example` should be updated in the same commit as any new script
  that reads `process.env` — add that to the repo's change checklist.

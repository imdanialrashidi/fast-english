# Plan 010: Remove dead student routes, previewData, and the unused workbox-window dependency

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**:
> `git diff --stat f64288e..HEAD -- app/src/app/routes app/src/data package.json pnpm-lock.yaml`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: tech-debt (dead code)
- **Planned at**: commit `f64288e`, 2026-08-14

## Why this matters

Three legacy route files in `app/src/app/routes/` are unreferenced in
production (the live surfaces live in `app/src/features/`): `DashboardRoute.tsx`,
`LessonsRoute.tsx`, `LessonDemoRoute.tsx`. They are the ONLY importers of
`app/src/data/previewData.ts` (deterministic preview fixtures that the
real app no longer uses — every live surface reads the backend). They
confuse search and onboarding ("which LessonsRoute is live?") and pin a
static test to a corpse file. Separately, `workbox-window@7.4.1` is
declared in `package.json` but never imported anywhere (`PwaManager` uses
`virtual:pwa-register/react`), misleading readers about the PWA stack.

## Current state

- `app/src/app/routes/` contains `DashboardRoute.tsx`, `LessonsRoute.tsx`,
  `LessonDemoRoute.tsx` — `grep -rn 'app/routes/DashboardRoute\|app/routes/LessonsRoute\|app/routes/LessonDemoRoute' app/src --include='*.tsx' --include='*.ts'`
  matches ONLY the files' own header comments (the live `LessonsRoute` is
  `app/src/features/lessons/routes/LessonsRoute.tsx`, imported by
  `app/src/app/App.tsx:63-65`).
- `app/src/data/previewData.ts` — imported only by the three dead routes
  (verify with grep before deleting).
- `app/src/app/routes/LessonDirection.test.ts` — reads
  `LessonDemoRoute.tsx` as a SOURCE-TEXT fixture and asserts three
  patterns: `lang="en"`, `dir="ltr"`, a bounded reading column
  (`maxWidth.*38rem`), and the absence of a right-align pattern. These
  assertions test the DESIGN CONTRACT (LTR isolation of the English body),
  not the dead file — the contract lives on in
  `app/src/features/lessons/routes/LessonDetailRoute.tsx` (the live
  surface), so the test must be repointed, not deleted.
- `package.json` devDependencies: `"workbox-window": "7.4.1"` — grep for
  imports in `app/`, `shared/`, `admin/`, `landing/` finds nothing
  (`PwaManager.tsx:13` uses `virtual:pwa-register/react`).

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Fast gate | `pnpm verify:fast` | exit 0 |
| App build | `pnpm build:app` | exit 0 (dead-code tree-shake sanity) |
| Dep install consistency | `pnpm install --lockfile-only` then `git diff --stat pnpm-lock.yaml` | lockfile entry for workbox-window removed |
| Grep gates | per step | exact outputs listed |

## Scope

**In scope** (the only files you should modify):
- Delete: `app/src/app/routes/DashboardRoute.tsx`,
  `app/src/app/routes/LessonsRoute.tsx`,
  `app/src/app/routes/LessonDemoRoute.tsx`,
  `app/src/data/previewData.ts`
- Rewrite: `app/src/app/routes/LessonDirection.test.ts` (repurpose as a
  source-contract test over the LIVE route)
- `package.json` (remove `workbox-window` from devDependencies)

**Out of scope** (do NOT touch):
- `app/src/features/lessons/routes/LessonsRoute.tsx` and the rest of
  `features/` — they are live.
- Any PWA code (`app/src/pwa/`), Vite configs, `pnpm-workspace.yaml`.
- Other `app/src/data/` files (check what else lives there before
  assuming the whole dir is dead).

## Git workflow

- Branch: `advisor/010-dead-code-removal` (repo convention: `topic-slug`).
- Commit style: conventional (`chore(app): remove unreferenced legacy routes and preview fixtures`).
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Confirm the death certificates

Run the greps from Current state yourself: (a) no imports of the three
route files outside their own headers; (b) `previewData` imported only by
the three dead routes; (c) `workbox-window` not imported anywhere in
`app/`, `shared/`, `admin/`, `landing/`. Also check
`app/src/app/App.tsx` route table for `/dashboard`, `/lessons`, `/sample`
— the LIVE equivalents live elsewhere (`/dashboard` → `<Navigate to="/" />`,
`/sample` → sample route in features) — confirm none of the three files
are routed.

**Verify**: all greps return the expected (empty) results; if any import
exists that this plan missed, STOP and report.

### Step 2: Delete the dead files

`rm app/src/app/routes/DashboardRoute.tsx app/src/app/routes/LessonsRoute.tsx app/src/app/routes/LessonDemoRoute.tsx app/src/data/previewData.ts`

**Verify**: `git status` shows the four deletions; `grep -rn 'previewData' app/src` → no matches.

### Step 3: Repoint LessonDirection.test.ts

Rewrite `app/src/app/routes/LessonDirection.test.ts` to read the LIVE
surface (`app/src/features/lessons/routes/LessonDetailRoute.tsx`) instead
of the deleted file, keeping the same assertions (they pin the accepted
DESIGN contract: `lang="en"`, `dir="ltr"`, bounded `38rem`-ish measure,
no right-align pattern). Verify the live file actually contains those
patterns first (grep it) — if the exact token differs (e.g. the measure
lives in a shared constant), assert the same contract via the token's
usage in that file, and note the change in your report. Keep the test
file's location (it is a static source-contract test, and moving it is
out of scope).

**Verify**: `npx vitest run app/src/app/routes/LessonDirection.test.ts` → passes with the new source path.

### Step 4: Drop workbox-window

Remove `"workbox-window": "7.4.1"` from `devDependencies` in
`package.json`, then regenerate the lockfile:
`pnpm install --lockfile-only` (or `pnpm install` if the repo workflow
requires it — check how the lockfile is maintained; `pnpm install` is
safe and reversible).

**Verify**: `grep -n 'workbox-window' package.json` → no matches;
`git diff --stat pnpm-lock.yaml` shows the removal (only workbox-window
and its transitive entries); `pnpm verify:fast` green (a broken lockfile
would fail install/typecheck).

### Step 5: Build + grep gates

**Verify**:
- `pnpm build:app` exits 0
- `grep -rn 'DashboardRoute\|LessonDemoRoute' app/src` → no matches
- `grep -rn 'app/routes/LessonsRoute' app/src` → no matches
- `grep -rn 'workbox-window' app/ shared/ admin/ landing/ package.json` → no matches

## Test plan

- `app/src/app/routes/LessonDirection.test.ts` — repointed source-contract
  test (Step 3); red-green: before repointing it fails (file missing), after
  it passes against the live surface.
- Existing nets: `pnpm verify:fast` (route-presence test
  `App.routes.test.ts` stays green — proves the live route table is
  untouched), `pnpm build:app` (production bundle compiles without the dead
  files).

## Done criteria

Machine-checkable. ALL must hold:

- [ ] The four files are deleted (git status shows the removals)
- [ ] `LessonDirection.test.ts` passes against the LIVE lesson surface
- [ ] `workbox-window` gone from package.json and the lockfile
- [ ] `pnpm verify:fast` exits 0 (incl. `App.routes.test.ts`)
- [ ] `pnpm build:app` exits 0
- [ ] All grep gates in Step 5 are empty
- [ ] `git status` shows only in-scope files (plus `plans/README.md`)
- [ ] `plans/README.md` status row updated to DONE

## STOP conditions

Stop and report back (do not improvise) if:

- Any live import of the three routes or `previewData` exists beyond the
  documented ones (the death certificate is wrong).
- `LessonDetailRoute.tsx` does not contain the LTR/bounded-measure
  patterns the test asserts (the contract moved elsewhere) — report where
  the contract lives instead of weakening the test.
- `pnpm install --lockfile-only` produces unexpected lockfile churn
  (unrelated entries) — restore and report.

## Maintenance notes

- The lesson-direction contract test now reads the LIVE route file — a
  redesign of the lesson surface must keep the test's source patterns in
  sync (that is the point of the test).
- `previewData.ts` was the last preview-fixture module; if future dev
  surfaces need deterministic previews, re-introduce fixtures under
  `features/<x>/` with clear "preview only" markers, not a shared data dir.

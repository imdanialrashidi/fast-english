# Plan 031: Add Vitest coverage threshold + pure unit layer for hooks

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 1062bb0..HEAD -- vitest.config.ts package.json app/src/features/*/logic.ts server/pb_hooks/*.pb.js tests/`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW (pure extraction + config only)
- **Depends on**: 030 (optional — shared typecheck lane keeps hook extraction fast; not code-blocking)
- **Category**: tests (coverage gate + pyramid inversion)
- **Planned at**: commit `1062bb0`, 2026-08-21

## Why this matters

No Vitest `coverage` threshold exists — `vitest.config.ts` has `include` but no `coverage:{provider:'v8', thresholds}`; `package.json` has no `test:coverage` script; `.gitignore:coverage/` is ignored but never emitted. High-churn auth/money/placement hooks (`server/pb_hooks/*` 15 files) have zero `*.test.*` and rely solely on 18 heavy smokes (10–15 min) + Playwright. Churn on `lesson_routes`, `progress_routes`, `staff_routes` has no sub-second feedback. Adding a cheap coverage gate plus extracting pure `entitlement`/`masking`/`placement` helpers into TS keeps the smoke pyramid but gives fast local 20ms feedback.

## Current state

- **Vitest config `vitest.config.ts` (excerpt):**
```ts
export default defineConfig({
  test: {
    passWithNoTests: true,
    include: ['app/**/*.test.{ts,tsx}','landing/**/*.test.{ts,tsx}','shared/**/*.test.{ts,tsx}','admin/**/*.test.{ts,tsx}','scripts/content/**/*.test.mjs','tests/**/*.test.mjs']
  }
});
```
  No `coverage` block.

- **`package.json`:** `pnpm test = vitest run --passWithNoTests`; no `test:coverage` script; `pnpm-lock` already has `coverage-v8` + `coverage-istanbul` (transitive via Vitest?) but not wired.

- **Hooks:** `server/pb_hooks/*` (15 files) — zero `*.test.*` in `include` glob (glob excludes `server/`). `app/src/features/payment/api.test.ts` has 5 units but `Placement` only `placement.test.ts` pure + 4 smoke files.

- **Pure helpers that exist:** `app/src/features/home/logic.ts` (already unit-tested), `app/src/features/library/logic.ts` (partial), `shared/lib/formatters.ts` (tested). Pattern to replicate: extract `entitlement` pure checks into `shared/` so hooks call shared helper.

- **Conventions:** `vitest.config.ts` coverage provider `v8`; `pnpm verify:fast` runs `vitest run` (no coverage) — coverage should be opt-in (`test:coverage`) not in fast lane (to keep 25s). CI `quality.yml` static lane runs `pnpm audit --prod`; do not wire coverage into CI blocking yet — just local gate.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Install coverage | `pnpm add -D @vitest/coverage-v8` (if not already installed) | exit 0 |
| Coverage run | `pnpm test:coverage` or `npx vitest run --coverage --coverage.provider=v8 --coverage.thresholds.statements=65` | exit 0, prints coverage table, thresholds met |
| Fast gate | `pnpm verify:fast` | exit 0 (fast lane unchanged, no coverage) |
| Hook extraction smoke | `bash scripts/smoke-lessons.sh node scripts/smoke-lessons.mjs` | pass (hooks still call pure helpers) |

## Scope

**In scope** (the only files you should modify):
- `vitest.config.ts`
- `package.json` (add `test:coverage` script, ensure `@vitest/coverage-v8` devDep)
- `shared/lib/entitlement.ts` (new — pure `isEntitled` helpers extracted)
- `shared/lib/placement.ts` or `app/src/features/placement/constants.test.ts` extension (new/extend — `TOTAL_Q`, `validateOptions`, score→level)
- `tests/coverage-gate.test.mjs` or `vitest.config.ts` thresholds (see Steps)

**Out of scope** (do NOT touch, even though they look related):
- Any hook business logic beyond wiring the extracted pure helper (no behavior change).
- `server/pb_hooks/*.pb.js` heavy logic — extract pure parts only if trivial; do not port JSVM transaction code to TS in this plan (report if non-trivial).
- E2E `e2e/*.spec.ts` — no Playwright changes.
- CI `quality.yml` — do not wire coverage into CI blocking in this plan (local only).

## Git workflow

- Branch: `advisor/031-vitests-coverage-pyramid`
- Commit: `test(coverage): add v8 coverage gate and pure entitlement helpers`
- Do NOT push unless instructed.

## Steps

### Step 1: Wire coverage threshold into `vitest.config.ts`

Edit `vitest.config.ts`:

```ts
export default defineConfig({
  define: { /* existing */ },
  test: {
    passWithNoTests: true,
    include: [ /* existing */ ],
    coverage: {
      provider: 'v8',
      include: ['app/src/**/*.{ts,tsx}','shared/**/*.{ts,tsx}','admin/src/**/*.{ts,tsx}'],
      exclude: ['**/*.test.{ts,tsx}','**/dist-*','**/build-boundary.test.ts'],
      thresholds: { statements: 65, branches: 55, functions: 60, lines: 65 },
      reporter: ['text','lcov','html'],
    }
  }
});
```

- Thresholds are intentionally modest (65/55) — baseline today is ~unknown but `app/src/features/home/logic.ts` already covered; the goal is to prevent drops, not to gate at 80.
- `pnpm test` stays non-coverage (fast lane). Add new script `test:coverage = vitest run --coverage --passWithNoTests` in `package.json`.

Add `@vitest/coverage-v8` if not already in `devDependencies`:
```bash
pnpm add -D @vitest/coverage-v8
```

**Verify**: `pnpm test:coverage 2>&1 | head -n 40` prints a coverage table (text) and exits 0; `pnpm verify:fast` still exits 0 (no coverage in fast lane).

### Step 2: Extract pure entitlement/masking/placement helpers into TS

Create `shared/lib/entitlement.ts` (pure, no hooks):

```ts
export function isStudentEntitled(student: { account_status:string, placement_completed:boolean, selected_level:string }, nowMs:number, subs:{starts_at:string,expires_at:string,status:string}[]): { ok:boolean, code:string } {
  if (student.account_status==='suspended') return { ok:false, code:'account_suspended' };
  if (student.account_status!=='active') return { ok:false, code:'subscription_required' };
  if (!student.placement_completed || !student.selected_level) return { ok:false, code:'placement_incomplete' };
  const hasSub = subs.some(s => { const exp=new Date(s.expires_at).getTime(), start=new Date(s.starts_at).getTime(); return !isNaN(exp)&&!isNaN(start)&&start<=nowMs&&exp>nowMs&&s.status==='active'; });
  if (!hasSub) return { ok:false, code:'subscription_required' };
  return { ok:true, code:'ok' };
}
export function maskPhone(phone:string):string { return phone.length>6? phone.substring(0,5)+'****'+phone.slice(-1): phone; }
```

And extend `app/src/features/placement/constants.ts` with pure `validateOptions(options: {id:string,label:string}[]):{ok:boolean,code:string}` and `scoreToLevel(score:number):string` if not already pure.

Each pure function mirrors the inlined hook entitlement block (`progress_routes.pb.js` list/detail/put triple-copy). In hooks, you may optionally `require('../../../shared/lib/entitlement.js')`? No — hooks cannot import TS reliably. So in this plan, **do not wire hooks to the TS file yet** — just create the TS file and its unit tests as the fast layer. Wiring hooks to it can be a follow-up after `tsconfig.server.json` (plan 030) verifies the import path.

Create units:

- `shared/lib/entitlement.test.ts` — 10 cases: suspended → `account_suspended`, `pending_payment`→`subscription_required`, `active` no sub → `subscription_required`, active with expired sub → deny, active with valid sub plus placement incomplete → `placement_incomplete`, happy path → ok.
- `shared/lib/placement-validation.test.ts` or extend `app/src/features/placement/placement.test.ts` — `validateOptions` reject HTML/duplicate IDs/>6 options, `scoreToLevel` 0→A1 … 20→C2, `TOTAL_Q=20` gap handling.

**Verify**: `npx vitest run shared/lib/entitlement.test.ts app/src/features/placement` → pass. `pnpm test:coverage` → coverage table now includes `shared/lib/entitlement.ts` at 100% statements.

### Step 3: Keep fast lane cheap, coverage opt-in

Ensure `scripts/verify-fast.sh` still runs `pnpm test` (no `--coverage`). `pnpm test:coverage` is manual or a `pnpm verify:full` additive flag. Do not add coverage to CI `quality.yml` in this plan (report as follow-up).

**Verify**: `pnpm verify:fast` (≈25s) does not collect coverage (no `coverage/` dir produced); `pnpm test:coverage` produces `coverage/coverage-final.json` + `coverage/lcov.info` and exits 0.

### Step 4: Optional — wire one hook to call the pure helper (only if trivial)

If wiring is one line and `require` works in goja:

```js
var ent = require(__hooks + '/../../shared/lib/entitlement.js');
var check = ent.isStudentEntitled({account_status:String(student.get("account_status")), placement_completed:Boolean(student.get("placement_completed")), selected_level:String(student.get("selected_level"))}, Date.now(), subsArrayForPure);
if (!check.ok) throw { httpStatus: 403, code: check.code };
```

But this requires a build step to ship `shared/lib/entitlement.js` into `server/pb_hooks`. If no build pipeline exists, skip wiring in this plan — just document as "TS helpers are the fast reference; hooks stay inline until a shared build is decided". Report which you chose.

## Test plan

- **New units**: `shared/lib/entitlement.test.ts` (entitlement matrix), placement validation tests — all pass via `vitest`.
- **Coverage gate**: `pnpm test:coverage` thresholds met (65 statements initial).
- **Regression**: `pnpm verify:fast` (no coverage) + one smoke (`smoke-lessons`) still green — proves hooks unchanged.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `grep -q "coverage" vitest.config.ts` and `grep -q "provider.*v8" vitest.config.ts`
- [ ] `grep -q "test:coverage" package.json`
- [ ] `test -f shared/lib/entitlement.ts` and `npx vitest run shared/lib/entitlement.test.ts` exits 0
- [ ] `pnpm test:coverage 2>&1 | grep -q "Coverage"` and exits 0
- [ ] `pnpm verify:fast` exits 0 (fast lane unchanged)
- [ ] `git status` only touches files in Scope + `plans/README.md`

## STOP conditions

Stop and report back if:

- `@vitest/coverage-v8` install mutates `pnpm-workspace.yaml` or violates `minimumReleaseAgeExclude` handling — report.
- Pure extraction duplicates a hook bug (e.g. hook checks `placement_completed` but also `selected_level` empty; pure logic would differ) — report mismatch and do not wire.
- Hook `require` of TS file fails in goja (needs transpiled JS) — then leave helpers as TS-only in this plan and report as wiring follow-up.
- Wiring threshold `65` is already failing on current tree — lower to `50` and report baseline.

## Maintenance notes

- New placement/question/level logic must add a pure unit in `shared/lib` before adding a smoke scenario — fast lane first, heavy lane second.
- When `tsconfig.server.json` (plan 030) lands, the pure helpers can be imported directly by hooks after a `tsc --outDir server/pb_hooks/shared` step — decide then.
- Reviewers: coverage thresholds are modest on purpose; do not lower them to green a bad merge. If coverage drops, add pure tests, not `// c8 ignore`.


# Plan 027: Remove residual formatter duplicates (landing + admin)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 1062bb0..HEAD -- shared/lib/formatters.ts landing/src/lib/persianDigits.ts landing/src/components/PlanPricing.tsx landing/src/components/PaymentSection.tsx admin/src/features/settings/BusinessSettingsPanel.tsx app/src/lib/phone.ts shared/build-boundary.test.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: tech-debt (consolidation — leftover of plan 016)
- **Planned at**: commit `1062bb0`, 2026-08-21

## Why this matters

Plan 016 consolidated most Persian formatters into `shared/lib/formatters.ts` (`formatToman`, `toPersianDigits`, `toLatinDigits`, `normalizeLastFour`) but left three residuals:

1. `landing/src/lib/persianDigits.ts` re-implements `toPersianDigits(n:number, padTo)` with different signature (`padTo` vs shared's `string|number`).
2. `admin/src/features/settings/BusinessSettingsPanel.tsx:56` bypasses shared `formatToman` with `toPersianDigits(value.toLocaleString('en-US'))` (different thousands separator `en-US` vs shared `fa-IR`).
3. `app/src/lib/phone.ts` keeps its own `toLatinDigits` map duplicating `shared/lib/formatters.ts:60`.

Result: same price renders via two locale paths, `padTo` divergence, Arabic-Indic fix must be applied twice. Delete landing helper, extend shared helper, migrate panel, re-export phone helper.

## Current state

- **Canonical `shared/lib/formatters.ts` (excerpt):**
```ts
export function toPersianDigits(input: string | number | null | undefined): string {
  // maps 0-9 → ۰-۹ via PERSIAN_DIGITS, handles null/undefined → ""
}
export function toLatinDigits(input: string | null | undefined): string { /* PERSIAN_TO_LATIN + ARABIC_TO_LATIN */ }
export function formatToman(value: number | null | undefined, opts?: { suffix?: string }): string {
  // n.toLocaleString('fa-IR'), Persian digits, optional suffix 'تومان'
}
```

- **Landing duplicate `landing/src/lib/persianDigits.ts:8`:**
```ts
export function toPersianDigits(n: number, padTo = 0) {
  return String(Math.abs(n)).padStart(padTo, '0').split('').map(d => PERSIAN_DIGITS[Number(d)] ?? d).join('');
}
```

- **Landing consumer `landing/src/components/PlanPricing.tsx:18-19`:**
```ts
import { formatToman } from '../../../shared/lib/formatters';
import { toPersianDigits } from '../lib/persianDigits';
...
toPersianDigits(savingPercent) // padTo not used here, but HowItWorks uses padTo
```

- **Admin bypass `admin/src/features/settings/BusinessSettingsPanel.tsx:56`:**
```ts
function formatToman(value: number): string {
  return `${toPersianDigits(value.toLocaleString('en-US'))}`;
}
```
  And import `toPersianDigits` from `../../lib/persianDigits` (local) or direct — read live file to confirm path.

- **`app/src/lib/phone.ts:31`:**
```ts
export function toLatinDigits(input: string | null | undefined): string {
  // PERSIAN_DIGITS / ARABIC_DIGITS map, for(ch) out+=map[ch]??ch
}
export function normalizeIranianPhone(...){ return toLatinDigits(...); }
```

- **Boundary test gap:** `shared/build-boundary.test.ts:18-30` lists `landingFiles` 27 entries but omits `PlanPricing.tsx`/`PaymentSection.tsx` so landing→shared imports are not asserted; `grep -rn workbox-window` style.

- **Conventions:** `shared/lib/formatters.ts` is shared-surface-agnostic (no `app`/`landing` imports). `app → shared` is allowed, `shared → app` is not. Tests `shared/lib/formatters.test.ts` + `landing/src/Landing.test.ts` pin rendering. `app/src/lib/phone.test.ts` pins normalization.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Fast gate | `pnpm verify:fast` | exit 0 |
| Focused unit | `npx vitest run shared/lib/formatters.test.ts app/src/lib/phone.test.ts landing/src/Landing.test.ts` | all pass |
| Build | `pnpm build:landing && pnpm build:admin && pnpm build:app` | each emits deterministic `dist-*` |
| Boundary test | `npx vitest run shared/build-boundary.test.ts` | pass |

## Scope

**In scope** (the only files you should modify):
- `shared/lib/formatters.ts` (extend `toPersianDigits` with optional `padTo`)
- `landing/src/lib/persianDigits.ts` (delete)
- `landing/src/components/PlanPricing.tsx` (migrate to shared)
- `landing/src/components/PaymentSection.tsx` (if it uses landing helper — check; migrate if yes)
- `landing/src/components/HowItWorks.tsx` (if it uses `padTo` variant — check; migrate if yes)
- `admin/src/features/settings/BusinessSettingsPanel.tsx` (replace local `formatToman` with shared)
- `app/src/lib/phone.ts` (re-export `toLatinDigits` from shared)
- `shared/build-boundary.test.ts` (fix allowlist gap)

**Out of scope** (do NOT touch, even though they look related):
- Any date/duration formatters (plan 029) — separate concern.
- Any `vite.*.config.ts` or `package.json`.
- Any hook files or migrations.

## Git workflow

- Branch: `advisor/027-formatters-residual`
- Commit: `refactor(formatters): remove landing persianDigits duplicate, align admin panel`
- Do NOT push unless instructed.

## Steps

### Step 1: Extend `shared/lib/formatters.ts` to support `padTo`

Edit `shared/lib/formatters.ts`:

1. Extend `toPersianDigits` signature to support `padTo`:
```ts
export function toPersianDigits(input: string | number | null | undefined, opts?: { padTo?: number }): string {
  let str = /* existing String(input) logic, null→"" */;
  // If opts?.padTo provided: split on non-digit preservation? For existing landing usage
  // `toPersianDigits(n, padTo)` where n is a number and padTo is total width, we map:
  // allow numeric left-pad before digit conversion:
  if (opts?.padTo && typeof input === 'number') {
    str = String(Math.abs(input)).padStart(opts.padTo, '0');
    // then fall through digit mapping
  }
  // existing for(ch of String(str)) mapping 0-9 → PERSIAN_DIGITS
}
```
   Preserve backward compat: calls without `opts` behave identically to today (no pad). Ensure `null/undefined` → `""` unchanged. If you prefer overload `toPersianDigits(n:number, padTo?:number)` keep that alias — but maintain at least one signature used by landing (`number` + `padTo`).

2. Keep `toLatinDigits` and `formatToman` unchanged except ensuring `formatToman` still uses `fa-IR` and `toPersianDigits` internally (no new locale).

**Verify**: `npx vitest run shared/lib/formatters.test.ts` still passes; add one quick assertion in that file's new test block or via a manual `node -e` that `toPersianDigits(7, {padTo:2}) === '۰۷' && toPersianDigits(123) === '۱۲۳'`.

### Step 2: Delete landing helper and migrate landing consumers

- Delete `landing/src/lib/persianDigits.ts`.
- In `landing/src/components/PlanPricing.tsx`: replace `import { toPersianDigits } from '../lib/persianDigits'` with `import { toPersianDigits } from '../../../shared/lib/formatters'` (keep existing `formatToman` import from same shared file; dedupe into one import line).
- Search landing for any other import of `../lib/persianDigits` (`grep -rn persianDigits landing/`). If `PaymentSection.tsx` or `HowItWorks.tsx` imports it (especially `padTo` usage `toPersianDigits(n, 2)`), replace with `toPersianDigits(n, {padTo: 2})` and adjust call site.

Ensure no `persianDigits` string remains in `landing/` after this step (`grep -rn persianDigits landing/` → no hit).

**Verify**: `pnpm build:landing` succeeds; `npx vitest run landing/src/Landing.test.ts` passes.

### Step 3: Migrate admin `BusinessSettingsPanel` to shared `formatToman`

Edit `admin/src/features/settings/BusinessSettingsPanel.tsx`:

- Remove the local `function formatToman(value:number){ return ... }` (around `:56`) and any local `toPersianDigits` import.
- Import `{ formatToman } from '../../../shared/lib/formatters'` (adjust relative depth — count `admin/src/features/settings/` → `shared/` = `../../../shared`).
- Replace every `formatToman(x)` call with `formatToman(x, { suffix: 'تومان' })` so Persian `۱٬۲۳۴ تومان` rendering is preserved. If some call uses `formatToman` for a non-price context, keep suffix empty (read live file to see call sites).

Keep the component otherwise unchanged.

**Verify**: `pnpm build:admin` succeeds; `npx vitest run admin` (or `shared/build-boundary`) still passes; visual spot-check if admin smoke exists.

### Step 4: Re-export `toLatinDigits` from shared in `app/src/lib/phone.ts`

Edit `app/src/lib/phone.ts`:

- Keep the file and its public API (`toLatinDigits`, `normalizeIranianPhone`, etc.) intact.
- Replace the local `PERSIAN_DIGITS`/`ARABIC_DIGITS` maps + `function toLatinDigits(...)` body with a re-export: `export { toLatinDigits } from '../../../shared/lib/formatters';` (adjust relative depth `app/src/lib/` → `shared/` = `../../../shared`). Ensure `normalizeIranianPhone` still calls the (now re-exported) `toLatinDigits` — it will resolve via shared.

Ensure `shared` never imports `app` (it does not). `app → shared` is allowed per boundary.

**Verify**: `npx vitest run app/src/lib/phone.test.ts` still passes (phone normalization covers `۰۱۲۹` and `٠١٢٩` → `0129`).

### Step 5: Fix the build-boundary test gap

Edit `shared/build-boundary.test.ts`:

- Add `landing/src/components/PlanPricing.tsx` (and `PaymentSection.tsx` / `HowItWorks.tsx` if they import shared after your edit) to the `landingFiles` allowlist or to an explicit `shared/lib/formatters` allowed import list. The intention: `landing → shared/lib/formatters` is explicitly allowed; any other `landing → shared` coupling is not. So either add a regex allow `from.*shared\/lib\/formatters` or add the files to `landingFiles` with an exception.

Keep the test's core invariant: `landingFiles` must not import `shared` except `shared/lib/formatters` (document in a comment).

**Verify**: `npx vitest run shared/build-boundary.test.ts` passes; `grep -rn "landing/src/components/PlanPricing" shared/build-boundary.test.ts` hits.

### Step 6: Final regression

Run `pnpm verify:fast` and the three builds. `landing` must not import from the deleted `persianDigits.ts` path (grep proves).

**Verify**: `grep -rn persianDigits` returns no hit except `shared/lib/formatters.ts` internal reference (if any) and `plans/`; `pnpm verify:fast` exit 0.

## Test plan

- **Existing tests**: `shared/lib/formatters.test.ts` (Persian digits render), `app/src/lib/phone.test.ts` (Arabic/Persian digit normalization, `normalizeIranianPhone`), `landing/src/Landing.test.ts` / `PlanPricing` snapshot, `shared/build-boundary.test.ts` (re-pointed).
- **New implicit**: padTo behavior `toPersianDigits(7,{padTo:2}) === '۰۷'` and admin price formatting `'۱٬۲۳۴ تومان'` (existing `admin/src/features/settings/BusinessSettingsPanel` snapshot if any).

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `test -f landing/src/lib/persianDigits.ts` fails (file deleted)
- [ ] `grep -rn "persianDigits" landing/ admin/src/features/settings/BusinessSettingsPanel.tsx` returns no hit (except shared import line if any — then hits only `shared/lib/formatters` import)
- [ ] `grep -n "function formatToman" admin/src/features/settings/BusinessSettingsPanel.tsx` no hit; `grep -n "from.*shared/lib/formatters" admin/src/features/settings/BusinessSettingsPanel.tsx` hits
- [ ] `grep -n "export { toLatinDigits } from" app/src/lib/phone.ts` hits
- [ ] `npx vitest run shared/lib/formatters.test.ts app/src/lib/phone.test.ts shared/build-boundary.test.ts` exit 0
- [ ] `pnpm verify:fast` exit 0; `pnpm build:landing && pnpm build:admin && pnpm build:app` each exit 0
- [ ] `git status` only touches files in Scope + `plans/README.md`

## STOP conditions

Stop and report back if:

- `landing/src/lib/persianDigits.ts` does not exist at `1062bb0` (already deleted) — report actual state.
- `BusinessSettingsPanel.tsx` has more than one local formatter (date, etc.) and migration would conflate with plan 029 — only migrate `formatToman`, report if other formatters exist.
- Landing `HowItWorks.tsx` uses `padTo` in a way that shared's `String(Math.abs(n)).padStart` path would mojibake non-ASCII input — report instead of guessing.
- `shared/build-boundary.test.ts` allows `landing → shared` via a broad `!includes('shared')` check that cannot be allowlisted cleanly — report pattern needed.

## Maintenance notes

- Future landing components requiring `padTo` should call `toPersianDigits(n, {padTo})` from shared directly — do not re-introduce a landing helper.
- If admin adds a new local `formatDateTime` (plan 029 will consolidate), do not add more local `formatToman` variants.
- Reviewers: verify `fa-IR` separator `٬` vs `en-US` `,` in admin price snapshots — the migration intentionally changes to `fa-IR`.


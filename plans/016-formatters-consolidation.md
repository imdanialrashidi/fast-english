# Plan 016: Consolidate Persian formatting helpers into shared/lib/formatters

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**:
> `git diff --stat f64288e..HEAD -- shared/lib/formatters.ts app/src/features/payment/formatters.ts app/src/features/payment/api.ts app/src/features/payment/schemas.ts admin/src/features/payments/formatters.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S-M
- **Risk**: LOW
- **Depends on**: none
- **Category**: tech-debt (duplication with drift)
- **Planned at**: commit `f64288e`, 2026-08-14

## Why this matters

The same formatting logic exists in three places with **divergent output**:

1. `toPersianDigits` is implemented identically in
   `shared/lib/formatters.ts` (private, unexported) and
   `app/src/features/payment/formatters.ts` (private).
2. `formatToman` exists twice with DIFFERENT output: the app version
   (`payment/formatters.ts:33`) returns digits only via
   `toLocaleString('fa-IR')`; the admin version
   (`admin/src/features/payments/formatters.ts:16-19`) appends the literal
   «تومان». The same price renders differently in the Student payment
   flow and the Operator review screen.
3. `normalizeLastFour` exists three times inside one feature: exported in
   `payment/formatters.ts`, a private hand-rolled mirror in
   `payment/api.ts:219-221`, and a schema transform in
   `payment/schemas.ts:81` — the mirror can drift from the form's
   transform (silent mismatch between what the user sees validated and
   what is sent).

A single shared implementation keeps the two surfaces consistent and makes
the last-four contract one function. Outputs stay byte-identical per
surface during the migration.

## Current state

- `shared/lib/formatters.ts` — `PERSIAN_DIGITS` + private `toPersianDigits`
  (used only by `formatFileSize`), exported `formatFileSize`.
- `app/src/features/payment/formatters.ts` — private `toPersianDigits`
  (duplicate), `formatToman(value)` → `n.toLocaleString('fa-IR')` (digits
  only), `normalizeLastFour(raw)` using `toLatinDigits` from
  `app/src/lib/phone`, `formatLastFour` (zero-padded display).
- `admin/src/features/payments/formatters.ts:16-19` —
  `formatToman(amount)` → `` `${new Intl.NumberFormat('fa-IR').format(amount)} تومان` ``.
- `app/src/features/payment/api.ts:219-221` — private `normalizeLastFour`
  mirror.
- `app/src/features/payment/schemas.ts:81` — a `normalizeLastFour`-style
  transform inside the Zod schema.
- `app/src/lib/phone.ts` — `toLatinDigits` (Persian/Arabic digit → Latin).
  NOTE: `shared/` must never import from `app/` or `admin/` (build-boundary
  invariant, enforced by `scripts/check-bundle-boundaries.mjs` + tests) —
  `shared/lib/formatters.ts` needs its own digit-normalization or a new
  shared `phone` module.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Fast gate | `pnpm verify:fast` | exit 0 |
| Payment formatter tests | `npx vitest run app/src/features/payment/formatters.test.ts` | all pass |
| Admin tests | `npx vitest run admin` | all pass |
| Boundary gate | `bash scripts/check-bundle-boundaries.mjs dist-app dist-admin` (or via project-verify) | exit 0 |

## Scope

**In scope** (the only files you should modify):
- `shared/lib/formatters.ts`
- `app/src/features/payment/formatters.ts`
- `app/src/features/payment/api.ts`
- `app/src/features/payment/schemas.ts`
- `admin/src/features/payments/formatters.ts`
- `shared/lib/formatters.test.ts` (new)
- `app/src/features/payment/formatters.test.ts` (imports only, if needed)

**Out of scope** (do NOT touch):
- `app/src/lib/phone.ts` (kept as-is; the shared module gets its own copy
  of the digit conversion — see Steps; if you find a shared module that
  already has it, use that instead).
- Date/time formatters (`formatDateTime`, `formatDate`, `formatAge`,
  `statusLabel`, `accountStatusLabel`) — admin-only, no duplication.
- Behavior changes to any rendered output.

## Git workflow

- Branch: `advisor/016-formatters-consolidation` (repo convention: `topic-slug`).
- Commit style: conventional (`refactor(shared): consolidate Persian formatting helpers`).
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Shared implementations

In `shared/lib/formatters.ts`:
1. Export `toPersianDigits` (same implementation).
2. Add a shared digit normalizer (port the Persian/Arabic → Latin logic
   from `app/src/lib/phone.ts`'s `toLatinDigits` — read it first and port
   exactly; do NOT import from app).
3. Add `normalizeLastFour(raw: string | null | undefined): string` —
   `toLatinDigits(raw).replace(/\D/g, '')` (the exact current contract).
4. Add `formatToman(value: number | null | undefined, opts?: { suffix?: string }): string`:
   - non-finite/negative → `''` (current contract);
   - `Math.trunc(value).toLocaleString('fa-IR')` (current app output);
   - when `opts.suffix` is set, append `' ' + opts.suffix` (admin's
     current `«تومان»` output — byte-identical: `'۱٬۲۳۴ تومان'`).

Add `shared/lib/formatters.test.ts` covering: digits conversion both
directions, `formatToman` with and without suffix, `normalizeLastFour`
(Persian/Arabic/ASCII, separators, empty).

**Verify**: `npx vitest run shared/lib/formatters.test.ts` → all pass.

### Step 2: Migrate the Student payment feature

- `app/src/features/payment/formatters.ts`: delete the private
  `PERSIAN_DIGITS`/`toPersianDigits` and re-export from shared
  (`export { toPersianDigits, formatToman, normalizeLastFour } from '../../../../shared/lib/formatters'`
  — or import and re-export to keep the feature's public API stable for its
  callers; check every importer first). Keep `formatLastFour` (it builds on
  `normalizeLastFour`). Callers of the feature's `formatToman` keep getting
  digits-only output (no `suffix` passed).
- `app/src/features/payment/api.ts:219-221`: delete the private mirror and
  import `normalizeLastFour` from the feature formatters (or shared).
- `app/src/features/payment/schemas.ts:81`: same — the Zod transform uses
  the shared `normalizeLastFour`.

**Verify**: `npx vitest run app/src/features/payment` → all pass;
`grep -rn "function normalizeLastFour\|function toPersianDigits" app/src/features/payment` → no matches (only the shared definition remains).

### Step 3: Migrate the Admin formatter

- `admin/src/features/payments/formatters.ts`: `formatToman` becomes
  `formatToman(amount, { suffix: 'تومان' })` imported from
  `../../../../shared/lib/formatters` (verify the relative path from
  `admin/src/features/payments/`); delete the local implementation. Keep
  `formatAge`/`formatDateTime`/`formatDate`/labels local.

**Verify**: `npx vitest run admin` → all pass; the operator screens render
`'۱٬۲۳۴ تومان'` exactly as before (the admin tests pin this — confirm by
reading the admin formatter tests; if none pin the exact string, add one
assertion to the admin test file for `formatToman(1234, { suffix: 'تومان' })`).

### Step 4: Regression sweep

**Verify**: `pnpm verify:fast` exit 0; `pnpm build:app && pnpm build:admin`
exit 0; `bash scripts/check-bundle-boundaries.mjs dist-app dist-admin`
exit 0 (shared stays boundary-clean); `grep -rn "fa-IR" app/src admin/src`
shows only the shared implementation (or the date formatters, which are
out of scope).

## Test plan

- New `shared/lib/formatters.test.ts` (Step 1) — the shared contract.
- Existing nets: `app/src/features/payment/formatters.test.ts` (behavior
  unchanged — same outputs), `admin` tests, `pnpm verify:fast`, boundary
  gate.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `toPersianDigits`, `normalizeLastFour`, `formatToman` defined ONLY in `shared/lib/formatters.ts`
- [ ] No private copies remain: `grep -rn "function normalizeLastFour\|function toPersianDigits\|function formatToman" app/src admin/src` → no matches
- [ ] `npx vitest run shared/lib/formatters.test.ts` passes (new file)
- [ ] `npx vitest run app/src/features/payment admin` all pass
- [ ] `pnpm verify:fast` exit 0; app + admin builds exit 0; boundary gate exit 0
- [ ] `git status` shows only in-scope files (plus `plans/README.md`)
- [ ] `plans/README.md` status row updated to DONE

## STOP conditions

Stop and report back (do not improvise) if:

- A caller depends on the feature-local `formatToman` signature in a way
  the shared API cannot express (report the call site).
- `toLatinDigits` in `app/src/lib/phone.ts` has behavior beyond digit
  conversion (e.g. phone validation) that must not be duplicated — report
  and split the plan.
- An existing test pins the admin `formatToman` WITHOUT the «تومان» suffix
  or the app version WITH it (the outputs must stay byte-identical per
  surface — a conflicting pin means the surfaces already differ somewhere
  else; report).

## Maintenance notes

- `shared/lib/formatters.ts` is now the single home for money/number
  presentation — new surfaces (landing, future exports) must import from
  here, not re-implement.
- The `suffix` option exists ONLY for the admin unit label; if the product
  later unifies the price presentation, remove the option and the admin
  suffix together.
- `formatFileSize` already lives in shared — it can now use the exported
  `toPersianDigits` instead of the private one (same behavior; optional
  cleanup inside Step 1).

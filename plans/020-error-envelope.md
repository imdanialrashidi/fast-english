# Plan 020: Consolidate the API-error envelope extraction into shared/lib

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**:
> `git diff --stat f64288e..HEAD -- shared/lib app/src/lib/authErrors.ts app/src/features/payment/errors.ts app/src/features/payment/types.ts app/src/features/lessons/routes app/src/features/home app/src/features/library app/src/features/progress admin/src/features/payments/errors.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P3
- **Effort**: M
- **Risk**: LOW-MED
- **Depends on**: none
- **Category**: tech-debt (four error-mapping systems)
- **Planned at**: commit `f64288e`, 2026-08-14

## Why this matters

Four different error-mapping systems exist across the two surfaces, each
re-implementing the same PocketBase/fetch envelope extraction
(`{status, data:{code,message}}`-ish) with different depth and copy:

1. `app/src/features/payment/errors.ts` — the most complete: typed
   envelope extraction (`ExtractedErr`, `parseApiErrorBody`), Persian
   copy, status codes, `toPaymentError`.
2. `app/src/lib/authErrors.ts` — `mapAuthError` (its own envelope read).
3. Inline casts in feature routes — e.g.
   `app/src/features/lessons/routes/LessonsRoute.tsx:89-100`
   `(err as {status?; data?}).data?.code`, and the same shape in
   Home/Library/Progress.
4. `admin/src/features/payments/errors.ts` — `ApiError`/`toOperatorError`
   (its own envelope read).

Every new feature copies whichever pattern it reads first; the same
server code (e.g. `subscription_required`) is surfaced differently per
route, and a fix to envelope handling must be applied in four places.

**Non-goal**: unifying the Persian copy or the per-feature code maps
(payment codes are money-specific; auth codes are auth-specific; operator
codes are operator-specific — they stay). The plan consolidates ONLY the
envelope extraction + the shared typed shape, and migrates the inline
casts to it.

## Current state

- `app/src/features/payment/errors.ts:36` — `interface ExtractedErr`; `:138`
  — `parseApiErrorBody(body): { code?, message? } | null`; `:144` —
  `toPaymentError(err)`. The envelope logic: given an unknown `err`, read
  `{status?, data?}` from SDK errors and `{status, body}` from raw fetch
  responses (read the file to extract the exact normalization — it is the
  contract to promote).
- `app/src/lib/authErrors.ts:68` — `mapAuthError(err): AuthError` (reads
  the same envelope family).
- Route inline casts: `app/src/features/lessons/routes/LessonsRoute.tsx`
  (~:89-100), `app/src/features/home/routes/HomeRoute.tsx`,
  `app/src/features/library/routes/LibraryRoute.tsx`,
  `app/src/features/progress/routes/ProgressRoute.tsx` — grep
  `as {status` to find all sites.
- `admin/src/features/payments/errors.ts:138` — `toOperatorError(err, requestId?)`.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Feature unit tests | `npx vitest run app/src/features/payment app/src/lib/authErrors.test.ts admin` | all pass |
| Fast gate | `pnpm verify:fast` | exit 0 |
| Browser lane | `pnpm test:e2e:fast e2e/payment-redesign.spec.ts e2e/podcast-library.spec.ts` | all pass (error states are pinned there) |

## Scope

**In scope** (the only files you should modify):
- `shared/lib/apiError.ts` (new; dependency-free)
- `shared/lib/apiError.test.ts` (new)
- `app/src/features/payment/errors.ts` (use the shared envelope internally;
  keep `toPaymentError` + payment copy/codes)
- `app/src/lib/authErrors.ts` (use the shared envelope)
- `admin/src/features/payments/errors.ts` (use the shared envelope)
- The route inline-cast sites (4 files listed above) — replace the casts
  with the shared extractor

**Out of scope** (do NOT touch):
- The Persian copy, the per-feature code tables, the error TYPES
  (`PaymentError`, `AuthError`, `OperatorError`) — only the extraction
  internals move.
- Server error responses (plans 001-005 already fixed the server side).

## Git workflow

- Branch: `advisor/020-error-envelope` (repo convention: `topic-slug`).
- Commit per step (shared module → adapters → route sites), conventional
  style (`refactor(shared): one API-error envelope extractor`).
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: The shared envelope module

Read `app/src/features/payment/errors.ts` fully first — its
`ExtractedErr`/`parseApiErrorBody`/`toPaymentError` normalization is the
contract. Create `shared/lib/apiError.ts` exporting:

- `interface ApiErrorEnvelope { status?: number; code?: string; message?: string }`
- `extractApiError(err: unknown): ApiErrorEnvelope` — normalizes SDK
  errors (`{status, data: {code, message}}`), raw fetch responses
  (`{status, body: {code, message}}`), PocketBase-style thrown errors, and
  anything else → `{}` (never throws). Port the exact rules from
  `payment/errors.ts`.
- `isErrorCode(err: unknown, code: string): boolean` (the `code ===` or
  `full.indexOf` helpers the routes use — port what exists).

Add `shared/lib/apiError.test.ts` covering: SDK-shape error, fetch-shape
error, thrown string, undefined, PB `{status, body}` with/without code,
case where `data` is a string (the payment extractor handles this — port
it).

**Verify**: `npx vitest run shared/lib/apiError.test.ts` → all pass.

### Step 2: Adapter migration (behavior unchanged)

- `app/src/features/payment/errors.ts`: keep `toPaymentError`/copy/codes
  but have `parseApiErrorBody` (or its replacement) delegate to
  `extractApiError`. Keep the payment export names (callers + tests
  depend on them).
- `app/src/lib/authErrors.ts`: `mapAuthError` reads the envelope via
  `extractApiError` — same codes/copy.
- `admin/src/features/payments/errors.ts`: `toOperatorError` uses
  `extractApiError` internally.

**Verify**: `npx vitest run app/src/features/payment app/src/lib/authErrors.test.ts admin` → all pass (no assertion changes).

### Step 3: Route cast migration

For each inline-cast site (`grep -rn "as {status" app/src/features/*/routes/`):
replace the manual `(err as {status?; data?}).data?.code` reads with
`extractApiError(err).code` / `.status` / `.message`. Keep the routes'
local copy/state handling identical (only the extraction call changes).

**Verify**: `grep -rn "as {status" app/src/ --include='*.tsx' --include='*.ts'` → no matches; `pnpm verify:fast` exit 0.

### Step 4: Browser regression

**Verify**: `pnpm test:e2e:fast e2e/payment-redesign.spec.ts e2e/podcast-library.spec.ts`
all pass (both specs pin error/empty/denied states that flow through the
migrated extractors).

## Test plan

- New `shared/lib/apiError.test.ts` (Step 1) — the envelope contract,
  ported from the payment extractor's existing coverage.
- Existing nets: payment/auth/admin unit suites (unchanged assertions),
  `pnpm verify:fast`, and the two browser specs that pin error surfaces.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `shared/lib/apiError.ts` exports `extractApiError` (+ helpers) with tests
- [ ] `grep -rn "as {status" app/src/ --include='*.tsx' --include='*.ts'` → no matches
- [ ] payment/authErrors/admin adapters delegate to the shared envelope (read the diffs)
- [ ] `npx vitest run app/src/features/payment app/src/lib/authErrors.test.ts admin shared/lib/apiError.test.ts` all pass
- [ ] `pnpm verify:fast` exit 0
- [ ] `pnpm test:e2e:fast e2e/payment-redesign.spec.ts e2e/podcast-library.spec.ts` all pass
- [ ] `git status` shows only in-scope files (plus `plans/README.md`)
- [ ] `plans/README.md` status row updated to DONE

## STOP conditions

Stop and report back (do not improvise) if:

- The payment extractor's normalization has cases the shared module cannot
  express without importing feature code (report the case).
- An adapter's unit test pins an internal detail of the old extraction
  (e.g. a specific intermediate shape) — update the test to the public
  behavior only after confirming the behavior is unchanged; report any
  assertion you had to change.
- A route site uses the envelope for something beyond code/status/message
  (e.g. raw `data` passthrough) — report; do not widen the shared API
  speculatively.

## Maintenance notes

- New features should import `extractApiError` from `shared/lib/apiError`
  and keep their own code→copy tables — the envelope is shared, the
  vocabulary is not.
- If the server ever adds a request-id envelope field, extend
  `extractApiError` once — all four systems inherit it.
- The admin surface may later share the app's Persian copy tables; that is
  a separate product decision (out of scope).

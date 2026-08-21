# Plan 029: Unify date/duration formatters, centralize telemetry, delegate admin errors to shared envelope

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 1062bb0..HEAD -- shared/lib/date.ts shared/lib/telemetry app/src/lib/telemetry landing/src/lib/telemetry admin/src/features/content/errors.ts admin/src/features/payments/formatters.ts admin/src/features/content/presentation.ts app/src/features/payment/formatters.ts shared/build-boundary.test.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED (Intl option change alters snapshots; telemetry move touches both surfaces)
- **Depends on**: 027 (shared formatters must have first landed its `toPersianDigits` extension so `shared/lib/date` can reuse `toPersianDigits` if needed)
- **Category**: tech-debt (4 date formatters + telemetry duplication + error-mapper divergence)
- **Planned at**: commit `1062bb0`, 2026-08-21

## Why this matters

- **4 date/duration formatters** render the same `iso` differently: `admin/payments/formatters.ts:20` (`fa-IR` short month) vs `admin/content/presentation.ts:89` (`dateStyle:short`) vs `app/payment/formatters.ts:70` (another short/time) plus `admin/content/presentation.ts:81` `formatDuration(sec)→mm:ss` vs `app/payment/formatters:durationDays`. Every i18n change is a 4-file edit; snapshots diverge across operator vs content studio.
- **Telemetry stack duplicated** `app/src/lib/telemetry/{events,sinks,index}.ts` ↔ `landing/src/lib/telemetry/{events,sinks,index}.ts` (95% clone, 200-entry `RingBuffer`, `Beacon`/`Console` sinks, `window.__fepTelemetry`). Plan 011's phone/path `redact.ts` fix must be applied twice; landing lacks app's `truncate` import.
- **Admin content errors** `admin/src/features/content/errors.ts:15` keeps a bespoke `ApiError` + `COPY` + `safeErrorMessage`/`resolveContentError` independent of `shared/lib/apiError.ts:36` `extractApiError` which `app/payment`, `admin/payments`, `app/lib/authErrors` already delegate to after plan 020. Content Studio error copy drifts from operator/payment.

Consolidate dates into `shared/lib/date.ts`, telemetry into `shared/lib/telemetry/`, and delegate admin content errors to `extractApiError` while preserving its `COPY` table and boundary test gap from plan 027.

## Current state

- **Date formatters (four sites):**
  - `admin/src/features/payments/formatters.ts:20` `formatDateTime(iso)` → `new Intl.DateTimeFormat('fa-IR',{year:'numeric',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})`
  - `admin/src/features/content/presentation.ts:89` `formatDateTime(iso)` → `Intl.DateTimeFormat('fa-IR',{dateStyle:'short',timeStyle:'short'})`
  - `app/src/features/payment/formatters.ts:70` `formatPersianDateTime(iso)` → `Intl.DateTimeFormat('fa-IR',{dateStyle:'short',timeStyle:'short'})` plus `formatDurationDays`/`formatDuration`
  - `admin/src/features/content/presentation.ts:81` `formatDuration(totalSeconds)→'mm:ss'` (floor minutes, zero-padded seconds) vs `app` duration helpers
  Each catches differently (`'—'` vs `''` vs `iso` fallback).

- **Telemetry duplication:**
  - `app/src/lib/telemetry/index.ts:1-55` `RING_LIMIT=200`, `RingBufferSink`, `BeaconSink`, `ConsoleSink`, `initTelemetry()->window.__fepTelemetry`, `track(name,level,fields)`
  - `landing/src/lib/telemetry/index.ts:1-55` same contract, comment `same contract as app/src/lib/telemetry/sinks.ts, implemented locally so landing...`, delta is `APP_VERSION` vs `LANDING_VERSION` and `trackAcquisition` vs `trackFunnel`.
  The landing must stay `app`-free per `shared/build-boundary.test.ts`; both surfaces already import `shared/lib/*`, so `shared/lib/telemetry` is allowed.

- **Error handling:**
  - `shared/lib/apiError.ts:36` `extractApiError(err):{status,code,message}` (post-plan 020 canonical).
  - `admin/src/features/content/errors.ts:15` `class ApiError extends Error {status,code,details}` + `COPY` + `safeErrorMessage`/`resolveContentError` — own envelope read, never calls `extractApiError`.

- **Conventions:** `shared/lib/*` is surface-agnostic, no `app`/`landing` imports. Tests `shared/build-boundary.test.ts` asserts `landing` must not import `shared` except explicitly allowlisted `shared/lib/formatters` (from plan 027). Extend that allowlist to `shared/lib/date` and `shared/lib/telemetry`. Vitest `include` covers `app/**/*.test`, `shared/**/*.test`, `landing/**/*.test`.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Fast gate | `pnpm verify:fast` | exit 0 |
| Unit focused | `npx vitest run shared/lib/date.test.ts shared/lib/telemetry/ app/src/lib/telemetry landing/src/lib/telemetry admin/src/features/content/errors.test.ts` | pass |
| Build | `pnpm build:app && pnpm build:landing && pnpm build:admin` | each emit `dist-*` |
| Boundary | `npx vitest run shared/build-boundary.test.ts` | pass |

## Scope

**In scope** (the only files you should modify):
- `shared/lib/date.ts` (new)
- `shared/lib/telemetry/` (new dir: `redact.ts`, `sinks.ts`, `create.ts` — or `index.ts` if reusing plan 011's `redact.ts`)
- `app/src/lib/telemetry/index.ts` / `app/src/lib/telemetry/sinks.ts` / `app/src/lib/telemetry/events.ts` (replace with wrappers/factory)
- `landing/src/lib/telemetry/index.ts` / `landing/src/lib/telemetry/sinks.ts` / `landing/src/lib/telemetry/events.ts` (replace with wrappers)
- `admin/src/features/payments/formatters.ts` (delegate to `shared/lib/date`)
- `admin/src/features/content/presentation.ts` (delegate to `shared/lib/date`)
- `app/src/features/payment/formatters.ts` (delegate to `shared/lib/date`)
- `admin/src/features/content/errors.ts` (delegate to `extractApiError` internally)
- `shared/build-boundary.test.ts` (extend allowlist)
- `shared/lib/date.test.ts` (new pin)
- `shared/lib/telemetry/redact.test.ts` or extend existing (new/extend pin)

**Out of scope** (do NOT touch, even though they look related):
- `shared/lib/formatters.ts` / `landing/src/lib/persianDigits.ts` — plan 027's domain.
- Any `server/pb_hooks/**` or migrations.
- `app/src/lib/phone.ts` (plan 027).

## Git workflow

- Branch: `advisor/029-vite-telemetry-error-unification` (or continue 027 branch if still open — separate commit).
- Commits: 1) `refactor(date): shared lib/date` 2) `refactor(telemetry): shared lib/telemetry factory` 3) `refactor(admin): delegate content errors to extractApiError` (or one commit if preferred — keep reviewable).
- Do NOT push unless instructed.

## Steps

### Step 1: Create `shared/lib/date.ts` and migrate date/duration formatters

Create `shared/lib/date.ts`:

```ts
// Single source for Persian date/duration. Locale fa-IR only (product is Persian-first).
// Fallback is explicit via options; callers must choose '—' vs '' vs iso.

export function formatDateTime(value: string | Date | null | undefined, opts?: { style?: 'short'|'long', fallback?: string }): string {
  if (!value) return opts?.fallback ?? '—';
  try {
    const d = typeof value === 'string' ? new Date(value) : value;
    if (isNaN(d.getTime())) return opts?.fallback ?? '—';
    if (opts?.style === 'long') {
      return new Intl.DateTimeFormat('fa-IR', { year:'numeric', month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' }).format(d);
    }
    return new Intl.DateTimeFormat('fa-IR', { dateStyle:'short', timeStyle:'short' }).format(d);
  } catch { return opts?.fallback ?? '—'; }
}

export function formatDate(value: string | Date | null | undefined, opts?: { fallback?: string }): string { /* dateStyle:'short' only */ }
export function formatDuration(totalSeconds: number | null | undefined, opts?: { fallback?: string }): string {
  if (!totalSeconds || totalSeconds <= 0) return opts?.fallback ?? '—';
  const m = Math.floor(totalSeconds / 60);
  const s = Math.floor(totalSeconds % 60);
  return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}
export function formatDurationDays(days: number | null | undefined, opts?: { fallback?: string }): string { /* keep existing app helper logic but unify fallback handling */ }
```

- Keep signatures minimal; the point is one `Intl.DateTimeFormat` options matrix, not four.
- Reuse existing test expectations: start by copying the four current outputs for a fixed ISO (e.g. `2024-01-01T14:30:00Z`) and assert shared produces the same `short`/`long` variant each caller previously used — then switch callers. This avoids snapshot drift.
- Create `shared/lib/date.test.ts` pinning: `formatDateTime('2024-01-01T00:00:00Z',{style:'short'})`, `style:'long'`, `formatDuration(61)==='01:01'`, `formatDuration(0, {fallback:'—'})==='—'`.

Migrate call sites:
- `admin/src/features/payments/formatters.ts:20` → `export const formatDateTime = (iso:string)=> sharedFormatDateTime(iso,{style:'long',fallback:'—'})` (preserve long style for operator).
- `admin/src/features/content/presentation.ts:89` → delegate with `style:'short'`.
- `app/src/features/payment/formatters.ts:70` → delegate with `style:'short'`.

Keep each file's local name if tests import `formatDateTime` directly; just make it a wrapper. Remove duplicated `try/catch` bodies. Ensure fallback semantics stay per-caller (if one caller previously returned `''` for empty, pass `{fallback:''}`).

**Verify**: `npx vitest run shared/lib/date.test.ts admin/src/features/payments/formatters.test.ts admin/src/features/content/presentation.test.ts app/src/features/payment/formatters.test.ts` → pass. `grep -rn "Intl.DateTimeFormat" admin/ app/src/features/payment/formatters` → only `shared/lib/date.ts` hits.

### Step 2: Centralize telemetry into `shared/lib/telemetry`

Create `shared/lib/telemetry/`:

- `shared/lib/telemetry/sinks.ts` — move `RingBufferSink(200)`, `BeaconSink(endpoint)`, `ConsoleSink` from `app` (keep `truncate` import if app used it; migrate logic so landing also gets truncation). Keep `RING_LIMIT=200` constant.
- `shared/lib/telemetry/redact.ts` — ensure the phone/path regex from plan 011 (`redactPhone`, `redactPath`, `sanitizeMessage`) lives here and is shared (if `shared/lib/telemetry/redact.ts` already exists after 011, reuse it).
- `shared/lib/telemetry/create.ts` — factory:
```ts
export function createTelemetry(opts: { version:string, endpoint?:string, redact?:boolean }): { track:(name:string,level:string,fields?:Record<string,unknown>)=>void, initTelemetry:()=>void, sinks: Sink[] }
```
  The factory installs `window.__fepTelemetry = { buffer, track, sinks }` like today. `app` and `landing` wrappers pass `version: __APP_VERSION__` vs `__LANDING_VERSION__` (read via `import.meta.env` or global defines already in vite configs). Keep `BeaconSink` optional when `endpoint` empty (current deploy: no S3 bucket → OFF). Preserve `trackAcquisition`/`trackFunnel` naming via thin per-surface wrappers.

- Replace `app/src/lib/telemetry/{index,sinks,events}.ts` with:
```ts
export * from '../../../shared/lib/telemetry/create'; // re-export factory
import { createTelemetry } from '../../../shared/lib/telemetry/create';
export const telemetry = createTelemetry({ version: __APP_VERSION__, endpoint: import.meta.env.VITE_TELEMETRY_ENDPOINT });
export const { track, initTelemetry } = telemetry;
```
  Similarly for `landing/src/lib/telemetry` with `__LANDING_VERSION__`. Keep events enums local if needed, or move them shared — prefer shared `events.ts`.

- Ensure `shared` never imports `app`/`landing` (boundary holds). `app → shared` is allowed.

**Verify**: `pnpm build:app && pnpm build:landing` succeed (telemetry tree-shaken). `npx vitest run shared/lib/telemetry` (or existing `app/src/lib/telemetry` tests) pass. `grep -rn "RING_LIMIT" shared/lib/telemetry` hits; `grep -rn "RING_LIMIT" app/src/lib/telemetry landing/src/lib/telemetry` → no hit (moved to shared).

### Step 3: Delegate `admin/src/features/content/errors.ts` to `extractApiError`

Edit `admin/src/features/content/errors.ts`:

- Keep `COPY` map and `class ApiError` shape (so existing `instanceof` checks not broken).
- Change envelope extraction to:
```ts
import { extractApiError } from '../../../../shared/lib/apiError'; // adjust depth admin/src/features/content → shared/lib
export function resolveContentError(err: unknown): ApiError {
  const env = extractApiError(err); // {status,code,message}
  const copy = COPY[env.code] ?? env.message;
  return new ApiError(env.status ?? 500, env.code ?? 'unexpected_error', copy, env.details);
}
export function safeErrorMessage(err: unknown): string { return resolveContentError(err).message; }
```
- Keep `COPY` Persian messages exactly as they are (payment/operator/content copies stay per-feature by design per plan 020 non-goal).

**Verify**: `npx vitest run admin/src/features/content/errors.test.ts` (if exists) or `pnpm verify:fast` passes; `grep -n "extractApiError" admin/src/features/content/errors.ts` hits; `grep -n "function safeErrorMessage" admin/src/features/content/errors.ts` still exists.

### Step 4: Fix `shared/build-boundary.test.ts` allowlist extension

Extend the allowlist (from plan 027's edit) to include `shared/lib/date` and `shared/lib/telemetry` for `landing`:

- The test asserts `landingFiles` must not import `shared` except explicitly allowlisted `shared/lib/formatters`, `shared/lib/date`, `shared/lib/telemetry`. Add `shared/lib/date` + `shared/lib/telemetry` to the allow regex (`from.*shared\/lib\/(formatters|date|telemetry)`).

**Verify**: `npx vitest run shared/build-boundary.test.ts` passes; landing still has no `shared/assets/brand` or other cross-surface imports.

### Step 5: Final regression

Run `pnpm verify:fast` + `pnpm build:app && pnpm build:landing && pnpm build:admin`. `grep -rn "Intl.DateTimeFormat" app/src/features/payment/formatters admin/src/features/` → 0 (only shared). `grep -rn "RingBufferSink" app/src/lib/telemetry landing/src/lib/telemetry` → 0 (only shared).

**Verify**: `pnpm verify:fast` exit 0; three builds deterministic.

## Test plan

- **New tests:** `shared/lib/date.test.ts` (short/long, duration `01:01`, fallback), `shared/lib/telemetry/redact.test.ts` extension (phone/path truncation already there but now shared).
- **Existing tests:** `admin/src/features/payments/formatters.test.ts` `formatToman «۱٬۲۳۴ تومان»` still pass (date delegation does not affect it), boundary test `shared/build-boundary.test.ts`, telemetry wrappers not broken.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `test -f shared/lib/date.ts` and `grep -q "formatDateTime" shared/lib/date.ts`
- [ ] `grep -rn "Intl.DateTimeFormat" admin/ app/src/features/payment/formatters` → no hit (only `shared/lib/date.ts`)
- [ ] `test -d shared/lib/telemetry` and `grep -q "createTelemetry" shared/lib/telemetry/create.ts`
- [ ] `grep -rn "RingBufferSink" app/src/lib/telemetry landing/src/lib/telemetry` → no hit (only `shared/lib/telemetry/sinks.ts`)
- [ ] `grep -q "extractApiError" admin/src/features/content/errors.ts`
- [ ] `npx vitest run shared/build-boundary.test.ts shared/lib/date.test.ts` exit 0
- [ ] `pnpm verify:fast` exit 0; `pnpm build:app && pnpm build:landing && pnpm build:admin` exit 0
- [ ] `git status` only touches files in Scope + `plans/README.md`

## STOP conditions

Stop and report back if:

- Any excerpt in "Current state" mismatches live code (formatters signatures already changed by a concurrent branch, or telemetry already moved to `shared`).
- `admin/content/errors.ts` envelope read is already delegated (plan 020 landed partially) — report no-op needed.
- `Intl.DateTimeFormat` with `dateStyle` not available in Node test (Node 24 supports it — if it throws in vitest, report instead of polyfilling).
- Telemetry factory would require `__APP_VERSION__` define in `shared` (defines are per-vite config) — report how you wired version instead of hardcoding.
- You need to touch any hook/migration or add a workspace.

## Maintenance notes

- Future `admin` or `app` components needing `formatDateTime` must import from `shared/lib/date.ts` directly — do not add local wrappers with new Intl options.
- Telemetry `redact.ts` (phone/path) is the privacy boundary — any new field logged via `track` must pass through `sanitizeMessage` in `shared/lib/telemetry/redact.ts` before hitting `RingBufferSink`/`BeaconSink`.
- Admin content error `COPY` stays per-feature (money vs content vs operator have different Persian tones per plan 020) — only the envelope extraction is shared.
- Reviewers: date migration intentionally changes no visible string if wrappers preserve `style:short/long` per caller — snapshots should not move. Flag any snapshot delta.


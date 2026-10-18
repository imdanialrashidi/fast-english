# Plan 003: Self-review ban on reject/cancel/grant/revoke money paths

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 5774c6f..HEAD -- app/Actions/ApprovePayment.php app/Filament/ tests/`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: plans/001-verify-gate.md (use the gate for Done criteria)
- **Category**: security
- **Planned at**: commit `5774c6f`, 2026-10-18
- **Issue**: omit

## Why this matters

`ApprovePayment::approve()` refuses staff acting on their own request (pre-check plus in-transaction re-check at `app/Actions/ApprovePayment.php:56-66`), but the four sibling transitions on the same money/access objects have no actor-vs-owner check: `reject` (:178-212), `cancel` (:220-253), `grant` (:264-331), `revoke` (:341-385). A staff member can therefore grant themselves a durable subscription window (which persists even if the staff flag is later lost — the staff bypass needs no window, a granted window survives without it), or reject/cancel their own request outside the audited self-approval ban. This plan extends the identical ban to all four paths — a narrow added guard, same error style, no lock-order or transaction change.

## Current state

The relevant files, each with one line on its role:

- `app/Actions/ApprovePayment.php` — single shared owner of all five money transitions with fixed lock order User → PaymentRequest → Subscription (class docblock :21-33, keep intact).
  - `approve` self-ban (the pattern to copy), lines 56-66:
    ```php
    if ((int) $precheck->user_id === (int) $staff->id) {
        throw ValidationException::withMessages(['request' => 'Staff cannot approve their own payment request.']);
    }
    // ... and inside the transaction (:64-66) the same check on $row->user_id
    ```
  - `reject(int $requestId, User $staff, ...)` (:178-212): loads `$ownerId` via `PaymentRequest::where('id', $requestId)->value('user_id')` (:187), then `DB::transaction` with lock order User → PaymentRequest (:193-195). NO actor-vs-owner check anywhere.
  - `cancel(int $requestId, User $staff, ...)` (:220-253): identical structure (:229 owner lookup, :236-237 locked). NO check.
  - `grant(int $userId, User $staff, int $durationDays, string $reason, ...)` (:264-331): `$userId` IS the target owner directly; locks User → Subscription (:279-280). NO check. Event records `actor_id` (:323) but does not refuse self-targeting.
  - `revoke(int $userId, User $staff, string $reason)` (:341-385): same shape as grant. NO check (verify by reading :341-385 before editing — same guard applies).
- `app/Filament/**/PaymentRequests*` + grant/revoke surfaces — callers of these four methods (find via `grep -rn "ApprovePayment::reject\|ApprovePayment::cancel\|ApprovePayment::grant\|ApprovePayment::revoke" app/ routes/`); they need no changes (the exception propagates as a validation error), but enumerate them in the handoff.
- `tests/Feature/S6ApproveTest.php`, `S6StaffTest.php`, `S6GrantRevokeTest.php` — existing self-approval-ban test for `approve` (copy its structure) and grant/revoke coverage.

Repo conventions that apply: guard via `ValidationException::withMessages([...])` with field key `'request'` (approve uses `['request' => ...]`); in-transaction re-check after locking (TOCTOU between pre-check and lock); fixed lock order unchanged; Persian UI copy lives in Filament resources, English messages in the Action.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Gate | `bash scripts/project-verify.sh` (plan 001) | exit 0; if PG absent, lane fallback below |
| Targeted PHP | `php artisan test --filter="S6\|Approve\|GrantRevoke\|Staff"` | all pass |
| Style | `vendor/bin/pint --test` | exit 0 |

## Scope

**In scope** (the only files you should modify):

- `app/Actions/ApprovePayment.php` (add four guards only)
- `tests/Feature/S6ApproveTest.php` (or `S6StaffTest.php` / `S6GrantRevokeTest.php` — add negative tests)

**Out of scope** (do NOT touch, even though they look related):

- Lock order, transaction bodies, window math, event shapes, idempotent-replay semantics — behavior identical except the new refusal.
- `approve()` itself — the reference implementation, already correct.
- Filament resources calling these methods — no caller changes; the `ValidationException` surfaces through existing handling.
- `requireActiveStaff()` — untouched.
- Any migration or policy file.

## Git workflow

- Branch: `advisor/003-self-review-ban`
- Commit per guard + tests; message style: short imperative.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Read the four targets and enumerate callers

What to do: read `ApprovePayment.php:178-253` (reject, cancel), `:264-331` (grant), `:341-385` (revoke) in full. Run `grep -rn "ApprovePayment::\(reject\|cancel\|grant\|revoke\)" app/ routes/ tests/ | head -30` and record the caller list for the handoff.

**Verify**: you can state, for each of the four methods, where the owner id is available (reject/cancel: `$ownerId` pre-check + `$row->user_id` in-transaction; grant/revoke: `$userId` param + `$owner->id` in-transaction).

### Step 2: Add the four guards mirroring approve

What to do: in each method add BOTH a pre-check (before `DB::transaction`, next to the existing not-found/empty-reason validation) and an in-transaction re-check (after `lockForUpdate`, next to the status check):

- reject/cancel pre-check: `if ((int) $ownerId === (int) $staff->id) throw ValidationException::withMessages(['request' => 'Staff cannot review their own payment request.']);` — exact message wording is yours but keep field key `'request'`; in-transaction: same check on `(int) $row->user_id`.
- grant/revoke pre-check: `if ((int) $userId === (int) $staff->id) throw ValidationException::withMessages(['request' => 'Staff cannot grant or revoke their own subscription.']);` — in-transaction: same on `(int) $owner->id`.

Copy the approve message where it fits (`'Staff cannot approve their own payment request.'` stays approve-only). Do not reorder locks, do not add parameters, do not change return shapes.

**Verify**: `grep -n "own payment request\|own subscription\|own subscription" app/Actions/ApprovePayment.php` → 6+ hits (approve's 2 + 4 new, each with pre + in-transaction). `vendor/bin/pint --test` → exit 0.

### Step 3: Add negative tests for all four paths

What to do: following the existing approve self-ban test in `S6ApproveTest.php` (find it via `grep -n "own" tests/Feature/S6*.php`), add one test per method: staff acting on their own request/user gets a `ValidationException` (no status change, no new event, no window change). Assert: reject-self → request still `pending`; cancel-self → still `pending`; grant-self → no subscription created/extended, no event; revoke-self → `revoked_at` still null, no event.

**Verify**: new tests FAIL if the guards are temporarily commented out (spot-check one), PASS with guards: `php artisan test --filter="S6|Approve|GrantRevoke|Staff"` → all green.

### Step 4: Run the gate

What to do: run the plan-001 gate, or the fallback (`vendor/bin/pint --test` + full `php artisan test` — the S6 race suite is PostgreSQL-only and MUST run).

**Verify**: full `php artisan test` exits 0 — especially `S6RaceTest` (lock order untouched) and `S6ApproveTest`.

## Test plan

- New tests: 4 negative tests (reject-self, cancel-self, grant-self, revoke-self) in the S6 files, modeled on the existing approve self-ban test.
- Existing suites that must stay green: all `S6*` (approve/entitlement/grant-revoke/staff/race/reject-cancel/subscription-tables), plus any Filament panel test touching these actions.
- Verification: `php artisan test --filter="S6"` → all pass; full suite green in the gate.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `grep -c "staff->id" app/Actions/ApprovePayment.php` covers all five transitions (approve + 4 new), each with pre-check AND in-transaction re-check
- [ ] 4 new negative tests exist and pass
- [ ] `php artisan test --filter="S6"` exits 0 (incl. `S6RaceTest` — lock order preserved)
- [ ] `vendor/bin/pint --test` exits 0
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The excerpts in "Current state" don't match (e.g. revoke's signature differs, or a check already exists somewhere).
- Any caller cánnot propagate `ValidationException` cleanly (e.g. a console command that would fatal) — list the caller, don't redesign it.
- A product decision says staff self-service is intentional on some path (e.g. cancel of own duplicate) — that contradicts the approve ban; escalate, don't carve an exception silently.
- Verification fails twice after a reasonable fix attempt, or the fix seems to need lock-order/transaction changes.

## Maintenance notes

For the human/agent who owns this code after the change lands:

- Every future transition added to this class MUST include the same pre + in-transaction self-target check — add it to the class docblock checklist if one exists, or the PR template.
- The check compares IDs, not roles: a staff member acting on another staff member's request is still allowed (matches approve semantics).
- If second-reviewer workflow ever replaces the outright ban, all five methods change together — never one.

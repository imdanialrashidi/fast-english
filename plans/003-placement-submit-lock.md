# Plan 003: Fix placement final-submit lock dead-end after a stale-revision recovery

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**:
> `git diff --stat f64288e..HEAD -- app/src/features/placement e2e/p2-s1.spec.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `f64288e`, 2026-08-14

## Why this matters

The placement flow is the onboarding gate: an active student answers 20
questions, reviews, and clicks «ثبت نهایی». `handleConfirmSubmit` in
`PlacementRoute.tsx` sets a `submitLockRef` at entry to prevent double
submission. If the server answers `placement_attempt_stale` (409 — the
attempt was modified elsewhere, exactly the scenario the repo's own
`smoke-placement-race` creates), the handler reloads the attempt and
`return`s **without resetting the lock**. The user then completes the whole
placement again, but the final submit silently no-ops forever — a dead-end
UX on a money-adjacent journey, recoverable only by a full page refresh.

Releasing the lock on the stale path is safe: the server's submit is
idempotent and transactional (repeated submit returns the same accepted
result — proven by `scripts/smoke-placement.mjs` "repeated submit
idempotence").

## Current state

`app/src/features/placement/routes/PlacementRoute.tsx:225-247` (exact lines
may shift by a few; find the function by name):

```tsx
  async function handleConfirmSubmit() {
    if (submitLockRef.current) return;
    submitLockRef.current = true;
    setShowSubmitConfirm(false);
    setPhase('submitting');

    try {
      const resp = await api.submitAttempt(attemptId!, { expectedRevision: revision });
      // Funnel telemetry: placement final submission succeeded (answers
      // never leave the server; nothing answer-related is reported).
      trackFunnel(FUNNEL_EVENTS.placementSubmitted);
      applyResponse(resp);
    } catch (err) {
      const mapped = mapPlacementError(err);
      if (mapped.code === 'placement_attempt_stale') {
        await loadAttempt();
        return;                              // <-- BUG: submitLockRef stays true
      }
      setPhase('error');
      setErrorInfo({ title: 'خطا در ثبت نهایی', description: mapped.message, retry: mapped.retry });
      submitLockRef.current = false;
    }
  }
```

`submitLockRef` is declared earlier in the component (a `useRef(false)`), and
`loadAttempt` / `applyResponse` never touch it.

- **Repo conventions**: the route is a typed React component with RHF + Zod
  (`app/src/features/placement/`), Product copy lives in
  `app/src/app/copy/productCopy.ts` (the error title above is already
  canonical — do not change any copy). Client logic that is pure is
  unit-tested in colocated `*.test.ts(x)` files; browser behavior lives in
  `e2e/`.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Fast gate | `pnpm verify:fast` | exit 0 |
| Placement smokes | `pnpm smoke:placement && pnpm smoke:placement-race && pnpm smoke:placement-levels` | all pass |
| New e2e spec (see Step 2) | `pnpm test:e2e:fast e2e/p2-s1.spec.ts` | all pass |
| Full placement e2e group | `pnpm test:e2e:fast e2e/p2-s1.spec.ts e2e/p2-qa.spec.ts e2e/p2-s2.spec.ts` | all pass |

## Scope

**In scope** (the only files you should modify):
- `app/src/features/placement/routes/PlacementRoute.tsx` (the one-line fix)
- `e2e/p2-s1.spec.ts` (append one regression test)
- `app/src/features/placement/placement-stale-lock.test.ts` (new, optional —
  only if you extract lock handling; see Step 1 note)

**Out of scope** (do NOT touch):
- Server placement routes (`server/pb_hooks/placement_routes.pb.js`) — the
  server behavior is correct and proven by the race smoke.
- The submit-confirm dialog, telemetry call sites, error copy, or any other
  client behavior.
- `submitLockRef` semantics on the normal success/error paths — they are
  correct.

## Git workflow

- Branch: `advisor/003-placement-submit-lock` (repo convention: `topic-slug`).
- Commit style: conventional (`fix(placement): release submit lock after stale-revision recovery`).
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: The fix

In `handleConfirmSubmit`, reset the lock on the stale branch:

```tsx
      if (mapped.code === 'placement_attempt_stale') {
        submitLockRef.current = false;   // recovery path: allow a fresh submit
        await loadAttempt();
        return;
      }
```

Rationale (put it in a brief comment): the server is idempotent for repeated
submission, so re-enabling the gate after a successful reload cannot double-
submit; without this, the user is stuck in a dead-end after a 409.

Note: if you prefer to keep logic out of the component, you may instead
extract a tiny `submitGate` helper (`app/src/features/placement/submitGate.ts`
with `acquire()/release()`) and unit-test it — but the one-line fix plus the
browser regression in Step 2 is the smallest change that satisfies this
plan; do NOT invent the abstraction unless the fix fails its tests for
reason.

**Verify**: `pnpm typecheck` exits 0; `pnpm smoke:placement` and
`pnpm smoke:placement-race` pass (server behavior unchanged).

### Step 2: Browser regression test

Append one test to `e2e/p2-s1.spec.ts` using its existing helpers
(`getSuperuserToken`, `nextPhone`, `jsonFetch`, and the app's placement UI
flow already exercised in that file — reuse its signup/activate/start
pattern):

1. Create an active student, start a placement attempt in the browser, answer
   all 20 questions, open the review screen, and open the submit confirm
   dialog (do NOT submit yet).
2. While the confirm dialog is open, modify the attempt server-side from
   Node (simulating the concurrent tab): `PUT
   /api/fast-english/placement/attempts/{id}/answer` with the student token,
   one question, and the current revision — this bumps the revision.
3. Click «ثبت نهایی» in the browser. Expect the stale-recovery path:
   the app reloads the attempt and returns to the question/review flow
   WITHOUT a permanent error state.
4. Close and re-open the confirm dialog, click «ثبت نهایی» again. Assert the
   submission succeeds (the app reaches the submitted/result state — the
   same assertion the file's existing submit test uses).

If the stale branch is NOT fixed, step 4's click is swallowed by the stuck
lock (`if (submitLockRef.current) return;`) and the test fails — that is the
defect sensitivity.

**Verify**: `pnpm test:e2e:fast e2e/p2-s1.spec.ts` → the new test and all
existing tests in the file pass.

## Test plan

- New e2e test in `e2e/p2-s1.spec.ts` (Step 2) — reproduces the 409-stale
  path in a real browser against a real PocketBase and proves the second
  submit succeeds.
- Existing coverage that must stay green: `pnpm smoke:placement` (submit
  idempotence, duplicate-submit rejection), `pnpm smoke:placement-race`
  (concurrent submits), `e2e/p2-qa.spec.ts`, `e2e/p2-s2.spec.ts`.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `pnpm verify:fast` exits 0
- [ ] `pnpm smoke:placement`, `pnpm smoke:placement-race`,
      `pnpm smoke:placement-levels` exit 0
- [ ] `pnpm test:e2e:fast e2e/p2-s1.spec.ts e2e/p2-qa.spec.ts e2e/p2-s2.spec.ts` all pass, including the new stale-submit test
- [ ] The new test fails (or the second submit assertion fails) when the
      Step-1 fix is reverted — prove this by temporarily reverting the line,
      running only the new test, observing the failure, then restoring the
      fix (do not commit the revert)
- [ ] `git status` shows only in-scope files (plus `plans/README.md`)
- [ ] `plans/README.md` status row updated to DONE

## STOP conditions

Stop and report back (do not improvise) if:

- The live `handleConfirmSubmit` no longer matches the excerpt (drift).
- The stale path's behavior differs from "reload attempt, return" (e.g. the
  handler was refactored into a state machine) — re-assess where the lock
  release belongs and report.
- The e2e stale simulation cannot be made deterministic after two attempts
  (e.g. the 409 is not reliably triggered) — report with the exact
  observations instead of weakening the assertion or adding sleeps.
- You discover a second submit path (e.g. keyboard shortcut) that bypasses
  `handleConfirmSubmit` — report; do not silently widen the fix.

## Maintenance notes

- If placement is ever changed to a non-idempotent submit, re-evaluate the
  lock-release-on-stale decision (today the server guarantees idempotence).
- The stale branch is the only place `loadAttempt()` runs while a submit is
  in flight — a future refactor should keep the invariant "lock is always
  released before the component returns to an interactive phase".

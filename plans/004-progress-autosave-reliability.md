# 004 — Progress autosave reliability (latest position always wins)

- **Written against:** commit `4b7caba` (branch `main`, clean tree)
- **Status:** DRAFT
- **Effort:** S · **Fix risk:** Medium · **Finding:** #4 (MAJOR — playback progress can be lost during pause/seek/navigation)

## Why this matters

The progress autosave hook drops or fails to send the **newest** playback
position in three realistic situations:

1. **Queued-save revision mismatch (data loss):** `performSave` keeps only one
   pending payload and, after the in-flight write succeeds, drains it only when
   the queued payload's `expectedRevision` equals the revision the in-flight
   write was started with (`useProgressSave.ts:94`). That condition is almost
   never true after a pause during an in-flight save: the queued payload carries
   the same stale revision, but the comparison is against the *started* revision
   — wait, the comparison is `queued.expectedRevision === revision` where
   `revision` is the *started* revision — so it usually DOES match… except when
   the queued save arrived after the in-flight write began **with a newer
   revision** (e.g. a `409`-reload bumped `revisionRef` in between, or a second
   save fired with a fresh revision). Then the pending payload is silently
   discarded (`pendingRef.current = null` at line 93 without sending).
2. **Timer flush drops the payload (`flush` at lines 149–159):** `flush()` clears
   `timerRef` and only drains `pendingRef` — but the payload scheduled inside
   the debounce timer is NOT stored in `pendingRef`; it lives only in the timer
   closure (`queueSave` lines 141–144). Clearing the timer without draining the
   scheduled position loses it. `handleEnded` and the unmount effect both call
   `flush()`, so "finished listening / navigated away" can lose the final
   position.
3. **Hook revision never initialized from loaded progress:** `LessonDetailRoute`
   loads progress itself (`getLessonProgress`, lines 82–94) and never hands it
   to the hook; the hook's `revisionRef` stays `0`. The first save then sends
   `expectedRevision: 0` against a record that already has `revision >= 1` →
   guaranteed `409` on first save for a returning user; the 409 path then reloads
   and retries (works, but adds a wasted round trip and, combined with bug 1,
   can drop the newest position).

The server side (`server/pb_hooks/progress_routes.pb.js`) is correct and must
not change: revision guard, monotonic furthest, completion threshold, and
`private, no-store` semantics are all covered by `scripts/smoke-progress.mjs`.

## Current state (evidence)

`app/src/features/progress/useProgressSave.ts`:

- Lines 46–51: refs `writeInFlightRef`, `pendingRef`, `lastSavedRef`, `revisionRef`, `timerRef`, `lastTimeUpdateRef`.
- Lines 53–64: `loadProgress` exists but is **not called by the route** and is not part of the returned API used by `LessonDetailRoute`.
- Lines 67–98: `performSave` — in-flight guard at 70–78; success path updates refs then:
  ```ts
  const queued = pendingRef.current;
  pendingRef.current = null;
  if (queued && queued.expectedRevision === revision) {
    void performSave(queued.positionSeconds, result.revision);
  }
  ```
- Lines 99–116: 409 path reloads fresh progress and retries the **failed** position (`performSave(position, fresh.revision)`), not the newest pending one.
- Lines 121–147: `queueSave` — debounce timer holds the payload in its closure; `pendingRef` is untouched here.
- Lines 149–160: `flush` — clears `timerRef`; drains `pendingRef` only.
- Lines 211–231: beforeunload/unmount effect — unmount calls `flush()`; `beforeunload` clears the timer (comment admits the payload is lost).

`app/src/features/lessons/routes/LessonDetailRoute.tsx`:

- Lines 42–53: hook invoked with `{ lessonId: id, enabled, onSaved, onStaleRevision }` — no initial progress.
- Lines 82–94: route loads progress via `progressApi.getLessonProgress(id)` and only sets React state.

## Repo conventions to follow

- Hooks in `app/src/features/progress/`; API wrappers in `app/src/features/progress/api.ts` (unchanged).
- Tests: `app/src/**/*.test.{ts,tsx}` are picked up by `vitest.config.ts`; existing hook-adjacent tests are static/contract style (e.g. `app/src/features/payment/receiptPreview.contract.test.ts`), but **no DOM/jsdom testing library is installed** (`@testing-library/react` is NOT in `package.json`). Plan for deterministic unit tests of the queue logic and real-browser E2E for integration — do not add a new dependency without strong justification (YAGNI ladder).
- E2E: `e2e/p3-s2.spec.ts` is the established real-browser pattern for progress (see tests 5, 9, 16; helpers `injectToken`, `jsonFetch`, `makeFullStudent`).

## Scope

**In scope:**

- `app/src/features/progress/useProgressSave.ts`
- `app/src/features/lessons/routes/LessonDetailRoute.tsx`
- New unit test file `app/src/features/progress/useProgressSave.test.ts` (queue logic only — see Design)
- `e2e/p3-s2.spec.ts` (one new browser scenario)

**Out of scope:**

- Server hooks (`server/pb_hooks/progress_routes.pb.js`), schema, API contract (`progress/types.ts`, `progress/api.ts`)
- Offline persistence, `sendBeacon`/`keepalive`/background-sync (documented limitation stays: `beforeunload` cannot await)
- Adding testing libraries or new dependencies
- Any change to `AudioPlayer.tsx`

## Design

Make the hook's state machine "latest payload wins":

1. **Single source of truth for the pending payload:** store the latest queued
   position in `pendingRef` at `queueSave` time (along with `revisionRef.current`
   at that moment). The debounce timer only schedules a drain of `pendingRef`.
   Clearing the timer (flush/unmount/beforeunload) therefore never loses data —
   the payload survives in `pendingRef`.
2. **Drain semantics:** after an in-flight write succeeds, drain `pendingRef`
   unconditionally using the **returned** revision:
   ```ts
   const queued = pendingRef.current;
   pendingRef.current = null;
   if (queued) void performSave(queued.positionSeconds, result.revision);
   ```
   (Drop the `queued.expectedRevision === revision` condition — the returned
   revision is always correct for the next write.)
3. **409 recovery:** on 409, reload authoritative progress, update
   `revisionRef`/`lastSavedRef`, and retry with the **newest pending position**
   if one exists, else the failed position:
   ```ts
   const queued = pendingRef.current;
   pendingRef.current = null;
   void performSave(queued ? queued.positionSeconds : position, fresh.revision);
   ```
4. **Initialization:** add an `initialProgress?: LessonProgressResponse` option
   to `UseProgressSaveOptions`; when provided (or when `loadProgress` succeeds),
   set `revisionRef.current` and `lastSavedRef.current` from it in an effect.
   In `LessonDetailRoute`, pass the already-fetched progress object to the hook
   (single source of truth — the route no longer needs to call `loadProgress`
   separately; keep the route's own fetch for the resume-prompt UI state, but
   feed its result into the hook).
5. **Lesson change reset:** when `lessonId` changes, reset `revisionRef`,
   `lastSavedRef`, `pendingRef`, `timerRef`, `lastTimeUpdateRef`.
6. Keep: in-flight serialization, `isSubmitting`-style gating via `enabled`,
   duplicate-write suppression (position delta < 0.5s), and "never show saved
   before acknowledgement".

## Test plan

**New unit test file** `app/src/features/progress/useProgressSave.test.ts` —
deterministic, no DOM needed. If the hook is hard to drive without a renderer,
extract the minimal pure queue-transition function (e.g. a small exported
`drainPending(pending, result)` helper or a reducer) and test that; the hook
then uses it. (Choose the pure-function extraction ONLY if direct hook testing
is impractical without new dependencies — this keeps the diff small and honest.)

Cases:

- In-flight write started at revision 4; position 50 queued; response returns
  revision 5 → next request sends position 50 with `expectedRevision: 5`.
- Debounce timer cleared by `flush()` with a scheduled position → the position
  is still sent (payload survives in `pendingRef`).
- 409 while a newer position is pending → retry sends the newer position with
  the reloaded revision.
- Initial progress with `revision: 3` → first save sends `expectedRevision: 3`.
- Lesson change resets revision to 0 (fresh lesson starts clean).

**E2E** (`e2e/p3-s2.spec.ts`): add one scenario that delays the first PUT (e.g.
`page.route` to stall `/api/fast-english/lessons/*/progress` once), triggers a
pause/seek to a newer position, releases the stall, and asserts the final
server position equals the newest position. Follow the existing
`injectToken`/`jsonFetch` helpers. If `page.route` stalling proves flaky in
this suite's single-worker setup, fall back to: save position A via the UI
pause, immediately seek, wait, then read the API and assert monotonic
furthest ≥ newest position — and note the weaker guarantee.

## Verification gates (machine-checkable)

```bash
pnpm typecheck
pnpm check
pnpm test
pnpm test:e2e -- e2e/p3-s2.spec.ts
bash scripts/smoke-placement.sh node scripts/smoke-progress.mjs
bash scripts/verify.sh
```

- New unit tests pass; existing suites (theme/routes/payment/placement) still green.
- `scripts/smoke-progress.mjs` (server contract) unchanged and green — it must
  NOT be weakened; its concurrency scenarios (11/12/12b) are the server-side proof.
- E2E p3-s2 suite green (existing tests 5/9/16 plus the new scenario).

## Maintenance note

- The hook is the only writer of `lesson_progress` from the client; its three
  invariants are: latest position wins, every write uses the current revision,
  and clearing a timer never discards a payload. Future autosave changes must
  preserve all three.
- `LessonDetailRoute` must keep feeding loaded progress into the hook — a
  future refactor that "optimizes" the double fetch must not drop the
  initialization path or bug 3 returns.
- Watch in review: someone "simplifying" the drain condition back to a revision
  comparison reintroduces bug 1; the unit test for the revision-5 drain is the
  regression guard.

## Escape hatches

- If no practical way to drive the hook exists without a DOM/testing library,
  STOP before adding a dependency; extract the pure queue helper as described
  and keep the E2E scenario as the integration proof.
- If the E2E stalling approach is too flaky, use the weaker monotonic assertion
  and document it. Never mark the feature done on unit tests alone.

## Done criteria

- [ ] Latest queued position is always drained with the returned revision
- [ ] `flush()`/unmount no longer drops the scheduled payload
- [ ] 409 recovery prefers the newest pending position
- [ ] Hook revision initialized from loaded progress (first save no longer 409s for returning users)
- [ ] Lesson change resets hook state
- [ ] New unit tests + E2E scenario green; server smoke untouched and green

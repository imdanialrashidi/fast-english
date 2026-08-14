# Plan 005: Fix server error contracts — progress position-0 500 and placement raw-error leakage

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**:
> `git diff --stat f64288e..HEAD -- server/pb_hooks/progress_routes.pb.js server/pb_hooks/placement_routes.pb.js server/pb_hooks/placement_level_routes.pb.js scripts/smoke-progress.mjs scripts/smoke-placement.mjs scripts/smoke-placement-levels.mjs`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: security (info-leak hygiene) + correctness (API contract)
- **Planned at**: commit `f64288e`, 2026-08-14

## Why this matters

Two error-contract defects on the server:

1. **`PUT /api/fast-english/progress/{lessonId}` returns 500 for a
   legitimate `positionSeconds: 0` save on a fresh lesson.** The handler's
   validation accepts any non-negative position (`progress_routes.pb.js:326`
   rejects only negatives), but the create path writes
   `position_seconds: 0` into a required NumberField, and PB 0.39.9 treats 0
   as "blank" for required number fields — the save throws and the handler
   maps it to 500. This is already recorded as a known limitation in
   `docs/exec-plans/active/player-lifecycle-reliability.md`, and e2e specs
   work around it by deleting progress records via superuser. The API
   contract says non-negative; a 0:00 pause-save from a future client (or an
   autosave edge) gets an opaque 500 instead of a contract answer.
2. **Placement routes echo raw exception text in error responses.** Six sites
   return `message: msg` where `msg` is the raw JSVM/DB error string
   (`placement_routes.pb.js:190,285,491,689` and
   `placement_level_routes.pb.js:257,453,713`). Every other route family in
   the repo returns the fixed `"Internal error."` for 500s (e.g.
   `payment_routes.pb.js`, `lesson_routes.pb.js`). Raw internals enable
   schema/storage reconnaissance and violate the repo's sanitized-error
   contract; the mapped-code branches (404/409/400) also echo exception text
   as the user-facing message.

## Current state

- **Progress create-with-0** — `server/pb_hooks/progress_routes.pb.js`:
  validation at `:326` (`"positionSeconds must be non-negative."`), create
  path at `:475-485`:

```js
          if (!existing) {
            // ---- CREATE new progress record ----
            var progCol = $app.findCollectionByNameOrId(PROGRESS_C);
            var newRec = new Record(progCol);
            newRec.set("user", uid);
            newRec.set("lesson", lessonId);
            newRec.set("position_seconds", positionSeconds);   // 0 → PB required-number "blank" error → 500
            newRec.set("furthest_seconds", positionSeconds);
            ...
            try {
              txApp.save(newRec);
            } catch (createErr) {
              var ceMsg = String(createErr && createErr.message ? createErr.message : String(createErr));
              if (ceMsg.indexOf("UNIQUE") >= 0 || ceMsg.indexOf("unique") >= 0) {
                // first-save race recovery...
              } else {
                throw { httpStatus: 500, code: "progress_save_failed", message: ceMsg };
              }
            }
```

  (The exact throw shape at the tail may differ slightly — read `:495-515`.)
  Schema: `server/pb_migrations/1700000015_create_lesson_progress.js` —
  `position_seconds` required, min 0.

- **Placement raw messages** — `server/pb_hooks/placement_routes.pb.js`:

```js
  // :190 (start route, questions load)
  } catch (qe) {
    var qeMsg = String(qe && qe.message ? qe.message : String(qe));
    return e.json(500, { code: "qe", message: qeMsg });
  }
```

```js
  // :480-495 (answer route catch — representative)
  } catch (topErr) {
    var msg = String(topErr && topErr.message ? topErr.message : String(topErr));
    var rawD = String(topErr && topErr.rawData ? topErr.rawData : "");
    var full = (msg + " " + rawD).toLowerCase();
    var codeMap2 = { not_found: 404, attempt_not_in_progress: 409, invalid_question: 400, invalid_option: 400, invalid_request: 400 };
    for (var ec2 in codeMap2) { if (full.indexOf(ec2) >= 0) { return e.json(codeMap2[ec2], { code: ec2, message: msg }); } }
    return e.json(500, { code: "unexpected_error", message: msg });
  }
```

  Same shape at `:285` (start tx), `:689` (submit tx), and
  `placement_level_routes.pb.js:257, 453, 713`. For the mapped branches the
  thrown errors are `BadRequestError("invalid_option", ...)` so `msg` equals
  the code name (not sensitive) — but the 500 fallbacks carry raw DB/JSVM
  text, and the codeMap matching on `msg + rawD` means a raw message that
  happens to contain "not_found" would also be echoed.

- **The repo's sanitized pattern** (match it): `payment_routes.pb.js` and
  `lesson_routes.pb.js` return `{ code: "unexpected_error", message:
  "Internal error." }` for 500s and fixed safe messages for mapped codes.

- **Repo conventions**: ES5-only JS in hooks; hooks excluded from Biome —
  match the file's style by eye. Server-side detail may be logged via
  `console.error` (the repo logs non-sensitive diagnostics; never log
  paths/tokens/phones).

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Fast gate | `pnpm verify:fast` | exit 0 |
| Progress suite | `pnpm smoke:progress` | all pass (57 scenarios) |
| Placement suites | `pnpm smoke:placement && pnpm smoke:placement-levels && pnpm smoke:placement-race` | all pass |
| Lessons regression | `pnpm smoke:lessons` | all pass |
| Browser progress regression | `pnpm test:e2e:fast e2e/p3-s2.spec.ts` | all pass |

## Scope

**In scope** (the only files you should modify):
- `server/pb_hooks/progress_routes.pb.js`
- `server/pb_hooks/placement_routes.pb.js`
- `server/pb_hooks/placement_level_routes.pb.js`
- `scripts/smoke-progress.mjs` (one new scenario)
- `scripts/smoke-placement.mjs` (one new assertion — or extend an existing
  scenario)

**Out of scope** (do NOT touch):
- Migrations and schema (`1700000015` etc.) — no schema change; the fix is
  at the validation boundary.
- The progress UPDATE path — updating an existing record to position 0 is
  legal and must keep working (the field already exists there; no
  required-field-zero issue).
- The client (`app/`) — it does not currently send 0 on create; the fix is
  server-contract hygiene. Do not add client handling in this plan.
- `docs/exec-plans/active/player-lifecycle-reliability.md` — the known-
  limitation record may be annotated after the fix lands (optional, one
  line); ask before editing plan docs, or leave them — the smoke scenario
  becomes the source of truth.

## Git workflow

- Branch: `advisor/005-server-error-contracts` (repo convention: `topic-slug`).
- Commit per step, conventional style (e.g. `fix(server): return 400 for zero-position progress create`).
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Reject position-0 creates with a contract answer

In `server/pb_hooks/progress_routes.pb.js`, in the PUT handler, at the
validation point (near `:326` where negatives are rejected), add:

```js
      // PB 0.39 required NumberFields reject 0 ("blank"); a brand-new
      // progress record must therefore start above 0. The UPDATE path
      // (existing record) still accepts 0 — see below.
      if (positionSeconds === 0 && !existingProgress) {
        return e.json(400, { code: "invalid_position", message: "positionSeconds must be greater than 0 when creating progress." });
      }
```

Constraints: (a) `existingProgress` must be the variable that holds the
result of the "load or create" lookup — read `:468-475` and use the actual
name; the check must live AFTER the existence lookup and BEFORE the create
branch. (b) The UPDATE branch must still accept 0 (an existing record can be
saved back to 0 — that path sets a non-required-in-practice value and is
proven by existing smoke scenarios). (c) Keep the response code
`invalid_position` — it is the same family the handler already emits at
`:310/:318/:326`, so client error mapping (if any) is unchanged.

Also update the file-header contract comment (around `:10`:
`//   - PUT accepts only { positionSeconds, expectedRevision }`) with one
line noting create-with-0 → 400.

**Verify**: `pnpm smoke:progress` all green.

### Step 2: Add the smoke scenario proving the fix

In `scripts/smoke-progress.mjs`, add a scenario (follow the file's existing
scenario/assert patterns and its fixture helpers — a fresh student + lesson,
or reuse the suite's standard creation helpers): `PUT
/api/fast-english/progress/{lessonId}` with `{ positionSeconds: 0,
expectedRevision: <none> }` on a lesson with NO existing progress record →
expect status 400 and body code `invalid_position`. Also assert the UPDATE
path still accepts 0: save a nonzero position first, then PUT 0 with the
returned revision → expect 200.

**Verify**: `pnpm smoke:progress` all green including the new scenario.

### Step 3: Stop placement routes from echoing raw errors

In `server/pb_hooks/placement_routes.pb.js`:
- `:190` (questions-load catch): keep the code `"qe"` (client-compatible) but
  return `message: "Internal error."`; log the detail server-side with
  `console.error` (no paths/tokens).
- `:285`, `:491`, `:689` (500 fallbacks of the start/answer/submit catches):
  change `message: msg` → `message: "Internal error."`.
- The codeMap branches (`:490`, `:688`): return fixed safe messages instead
  of `msg` — e.g. a small map `{ not_found: "Not found.", attempt_not_in_progress: "Attempt is not in progress.", invalid_question: "Invalid question.", invalid_option: "Invalid option.", invalid_request: "Invalid request." }` — so user-facing text never contains exception text. Keep the `code` field identical (the client maps by code — verify `app/src/features/placement/errors.ts` before changing any code value; you are NOT changing codes, only messages).

In `server/pb_hooks/placement_level_routes.pb.js` (`:257, :453, :713`): same
500-fallback change; same safe-message treatment for its codeMap branches
(`:452` etc.) if they echo `msg` — read each site and apply the same rule:
**codes unchanged, messages never contain exception text**.

**Verify**: `pnpm smoke:placement && pnpm smoke:placement-levels && pnpm smoke:placement-race` all green (these suites assert error codes and bodies).

### Step 4: Add the no-leak assertion

In `scripts/smoke-placement.mjs`, extend one existing failure-path scenario
(or add one) to assert that any 500 response body's `message` is exactly
`Internal error.` — i.e. fetch a route that can 500 without breaking the
suite, or (simpler and deterministic) assert on the bodies already captured
in an existing forced-error scenario that its `message` contains none of the
leak markers (`"Error"`, `"sql"`, `"query"`, `"column"`, `"undefined"`).
Prefer: add a check inside the existing scenario that triggers the start
route with a broken pre-condition (the suite already has forced-error
scenarios — reuse one and add the message assertion). If no deterministic
500 trigger exists, a negative assertion on an existing 4xx body suffices
for the mapped branches, plus a code-level statement that the 500 fallback
is now constant.

**Verify**: `pnpm smoke:placement` all green.

## Test plan

- New `smoke-progress` scenario (Step 2): create-with-0 → 400
  `invalid_position`; update-to-0 → 200. Defect-sensitive: with Step 1
  reverted, the create-with-0 assertion observes 500 and fails.
- New/extended `smoke-placement` assertion (Step 4): no exception text in
  error bodies. Defect-sensitive: with Step 3 reverted, the leak markers
  reappear.
- Existing nets: `smoke-progress` (57), `smoke-placement` (33),
  `smoke-placement-levels`, `smoke-placement-race`, `smoke-lessons`,
  `e2e/p3-s2.spec.ts`.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `pnpm verify:fast` exits 0
- [ ] `pnpm smoke:progress` exits 0, including the new create-with-0 → 400
      and update-to-0 → 200 scenario
- [ ] `pnpm smoke:placement`, `pnpm smoke:placement-levels`,
      `pnpm smoke:placement-race`, `pnpm smoke:lessons` exit 0
- [ ] `pnpm test:e2e:fast e2e/p3-s2.spec.ts` passes
- [ ] `grep -n 'message: msg' server/pb_hooks/placement_routes.pb.js server/pb_hooks/placement_level_routes.pb.js` returns no matches
- [ ] `grep -rn 'ceMsg' server/pb_hooks/progress_routes.pb.js` — no response
      path uses the raw error string as a user-facing message (the UNIQUE-
      race recovery may still reference it internally — verify by reading)
- [ ] Red-green proven for both fixes (temporary revert → new assertions
      fail → restore; record evidence)
- [ ] `git status` shows only in-scope files (plus `plans/README.md`)
- [ ] `plans/README.md` status row updated to DONE

## STOP conditions

Stop and report back (do not improvise) if:

- The live code at the cited locations differs materially from the excerpts
  (drift — in particular the exact variable holding the existing-record
  lookup in the progress PUT handler).
- A smoke suite asserts a message string that this plan's change would break
  (e.g. a suite greps for exception text in a 500 body) — then the suite
  itself encodes the bug; report the conflicting assertion.
- The client (`app/src/features/placement/errors.ts` or progress save logic)
  turns out to depend on a raw message — check it first; if it does, report
  (codes are unchanged, so this is unlikely).
- You find additional `message: msg`-style leaks in the two placement files
  beyond the six listed — fix them under the same rule and note them in the
  report.

## Maintenance notes

- The progress PUT handler now has a three-way contract: create (>0),
  update (=0 ok), update (revision guard). Future changes to progress
  semantics (e.g. explicit "reset progress" APIs) should reuse `invalid_position`
  vocabulary rather than inventing new codes.
- Placement error codes are client-visible contracts (`app/src/features/placement/errors.ts`
  maps them); messages are now presentation-only — treat code changes as
  breaking, message changes as free.
- The e2e workaround that deletes progress records via superuser
  (`player-lifecycle-reliability.md`) can eventually be replaced by the new
  400 contract — out of scope here; note it for the slice owner.

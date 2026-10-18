# Plan 002: Race-safe vocabulary + placement-answer saves

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 5774c6f..HEAD -- app/Support/Vocabulary.php app/Http/Controllers/VocabularyController.php app/Http/Controllers/PlacementController.php tests/`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: plans/001-verify-gate.md (use the gate for Done criteria)
- **Category**: bug
- **Planned at**: commit `5774c6f`, 2026-10-18
- **Issue**: omit

## Why this matters

Two user-triggered write paths do find-then-insert on a unique key with no race handling, so a concurrent double-submit (double-click, retry, two tabs) 500s instead of converging:

1. `Vocabulary::save()` checks `(user_id, word_key)` then inserts; the controller catches only `ValidationException`, so the unique-violation `QueryException` bubbles to a 500 — instead of the designed idempotent 422-with-`existingId`.
2. `PlacementController::answer()` does find-then-insert on `(attempt_id, question_id)` with no unique-violation handling — one of two rapid first-saves 500s.

Both have unique indexes that fire deterministically under concurrency; the fix maps the violation back onto the existing-row path both endpoints already implement.

## Current state

The relevant files, each with one line on its role:

- `app/Support/Vocabulary.php:55-80` — `save()`; existing-row early return, then bare `VocabularyWord::create(...)`. Excerpt (lines 55-80):
  ```php
  $existing = VocabularyWord::where('user_id', $user->id)
      ->where('word_key', self::key($clean))
      ->first();
  if ($existing !== null) {
      return ['entry' => $existing, 'created' => false, 'existingId' => $existing->id];
  }
  $initial = SpacedRepetition::initial($now);
  $entry = VocabularyWord::create([...]); // no unique-violation handling
  return ['entry' => $entry->fresh(), 'created' => true, 'existingId' => null];
  ```
- `app/Http/Controllers/VocabularyController.php:119-138` — `store()`; `try { Vocabulary::save(...) } catch (ValidationException $e) { 422 }`; `if (! $result['created'])` returns 422 with `['message' => 'این واژه قبلاً در دفترچه شما ذخیره شده است.', 'id' => existingId]`; success returns 201. A `QueryException` from the unique index is NOT caught.
- `app/Http/Controllers/PlacementController.php:243-256` — `answer()`; excerpt:
  ```php
  $existing = PlacementAnswer::where('attempt_id', $attempt->id)
      ->where('question_id', $question->id)
      ->first();
  if ($existing !== null) {
      $existing->forceFill([...])->save();
  } else {
      $row = new PlacementAnswer;
      $row->forceFill([...])->save(); // unique violation under race → 500
  }
  ```
- `database/migrations/2026_10_09_000015_create_vocabulary_words_table.php:39` — `$table->unique(['user_id', 'word_key']);`
- `database/migrations/2026_10_08_000012_create_placement_tables.php:100` — `$table->unique(['attempt_id', 'question_id']);`
- `resources/js/pages/Reader/Show.tsx:102-129` — glossary `save()` treats 201 as saved, 422 as duplicate-saved ("این واژه قبلاً..."), and MUST stay working: after this plan the duplicate response keeps exactly status 422 with the same Persian message and `id` field. Do not touch this file in this plan — it is the consumer contract.

Repo conventions that apply: ownership enforced server-side via policies; money/access-adjacent writes tested with PostgreSQL race tests (see `tests/Feature/S6RaceTest.php` and `S7SubmitRaceTest.php` for the concurrent-submit pattern to copy); Persian user messages inline in controllers.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Gate | `bash scripts/project-verify.sh` (plan 001) | exit 0; if PG/server absent, lane fallback below |
| Targeted PHP | `php artisan test --filter="Vocabulary\|Placement"` | all pass |
| Style | `vendor/bin/pint --test` | exit 0 |

## Suggested executor toolkit

None required.

## Scope

**In scope** (the only files you should modify):

- `app/Support/Vocabulary.php`
- `app/Http/Controllers/PlacementController.php` (the `answer()` find-then-insert block only, ~lines 243-256)
- `app/Http/Controllers/VocabularyController.php` (only if the catch must widen; prefer fixing inside `Vocabulary::save`)
- `tests/Feature/R4VocabularyTest.php` or `tests/Feature/D5VocabularyNotebookTest.php` (extend with race regression test)
- `tests/Feature/S7PlacementTest.php` (extend with answer-race regression test)

**Out of scope** (do NOT touch, even though they look related):

- `resources/js/pages/Reader/Show.tsx` — consumer contract frozen (201 vs duplicate-422); any 422-shape change breaks it.
- `app/Actions/SubmitPlacement.php`, `app/Actions/ApprovePayment.php` — separate race surfaces, separate plans.
- `app/Actions/PublishPlacementTest.php` — separate staff race, explicitly rejected for now.
- Any migration: the unique indexes already exist; no schema change.
- The SRS grading path (`Vocabulary::grade`) — untouched.

## Git workflow

- Branch: `advisor/002-write-races`
- Commit per step; message style: short imperative, e.g. `Map vocabulary duplicate race onto existing-row path`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Add failing race regression tests first

What to do: add one test per path that forces the unique violation WITHOUT real threads (deterministic and PostgreSQL-faithful):

1. Vocabulary: create a word via `Vocabulary::save()` (or `POST /app/words` as the owner), then simulate the loser leg by calling `VocabularyWord::create()` with the same `(user_id, word_key)` directly and asserting the response maps to the duplicate contract: HTTP 422, body contains the existing Persian duplicate message and the surviving row's `id` — NOT a 500. Model the test on the existing duplicate test in `R4VocabularyTest.php` (find it by searching `existingId` / `قبلاً در دفترچه`).
2. Placement: start an attempt as the owner (see `S7PlacementTest.php` setup), insert a `PlacementAnswer` row for question 1 directly, then `POST /app/placement/{attempt}/answer` with the same `question_id` and assert it converges (200/302 per transport, stored value equals the posted value, exactly 1 row for the pair).

**Verify**: both new tests FAIL on the pristine code (500 / unhandled exception), proving they capture the bug. `php artisan test --filter="<new test names>"` → red.

### Step 2: Map the vocabulary unique violation onto the existing-row path

What to do: in `Vocabulary::save()`, wrap the `VocabularyWord::create(...)` in a try/catch for `Illuminate\Database\QueryException`; on catch, re-fetch by `(user_id, word_key)` and return `['entry' => $surviving, 'created' => false, 'existingId' => $surviving->id]`. Only swallow the violation when the surviving row exists; otherwise rethrow. Alternative accepted: catch `QueryException` with SQLSTATE `23505` check explicitly (PostgreSQL unique violation) — prefer the explicit code check with a fallback re-fetch so a non-unique DB error still surfaces. Keep the signature and all other behavior identical.

**Verify**: `php artisan test --filter="Vocabulary"` → all pass including the new race test (now green). `vendor/bin/pint --test` → exit 0.

### Step 3: Make placement first-answer saves atomic

What to do: in `PlacementController::answer()` replace the find-then-insert with `updateOrCreate(['attempt_id' => ..., 'question_id' => ...], ['selected_option' => ..., 'is_correct' => null])`. This keeps `is_correct=null` until submit (server marking invariant) and converges both legs on one row. Do not change validation, authorization, JSON/redirect responses, or anything above line 243.

**Verify**: `php artisan test --filter="Placement"` → all pass including the new race test and the existing `S7SubmitRaceTest` suite. `vendor/bin/pint --test` → exit 0.

### Step 4: Run the gate

What to do: run the plan-001 gate (`bash scripts/project-verify.sh`), or if plan 001 is not yet landed, `vendor/bin/pint --test` + `php artisan test` + `npm run typecheck`.

**Verify**: gate exits 0 (or the only failures are pre-existing and reported, never fixed by touching out-of-scope files).

## Test plan

- New tests: vocabulary duplicate-race test (422-with-`id`, no 500); placement answer-race test (single row, posted value wins/converges). Both in the existing feature files named above, following the `S7SubmitRaceTest` concurrent pattern (direct-insert loser leg — deterministic, no sleeps, no real threads).
- Existing suites that must stay green: `R4VocabularyTest`, `D5VocabularyNotebookTest`, `S7PlacementTest`, `S7SubmitRaceTest` (marking invariant), `S10PaidOnlyTest` (gating untouched).
- Verification: `php artisan test --filter="Vocabulary|Placement"` → all pass.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] New vocabulary race test exists and passes; duplicate still returns 422 with the same Persian message + surviving `id`
- [ ] New placement answer-race test exists and passes; exactly 1 row per `(attempt_id, question_id)`, `is_correct` still null pre-submit
- [ ] `php artisan test --filter="Vocabulary|Placement"` exits 0
- [ ] `vendor/bin/pint --test` exits 0
- [ ] `grep -rn "updateOrCreate\|QueryException" app/Support/Vocabulary.php app/Http/Controllers/PlacementController.php` shows the two guards in place
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The excerpts in "Current state" don't match the live code (drifted since `5774c6f`).
- The duplicate-422 shape (message text, `id` field, status code) differs from what's quoted here — the React consumer depends on it; do not invent a new shape.
- A step's verification fails twice after a reasonable fix attempt.
- The fix appears to require a migration, a schema change, or touching an out-of-scope file.
- You discover `word_key` normalization (`Vocabulary::key()`) is case/collation-sensitive in a way that makes the re-fetch miss — report, don't redesign normalization here.

## Maintenance notes

For the human/agent who owns this code after the change lands:

- Any new find-then-insert on a unique key in this codebase must handle `23505` the same way — grep for `->first()` followed by `::create` on review.
- The `updateOrCreate` in `answer()` still issues two statements under the hood; true single-statement atomicity would need `upsert`, but the unique index makes the retry path convergent — the race suite is the proof, keep it.
- If a bulk-import path for vocabulary is ever added, it must use `insertOrIgnore`/chunked upserts, not this per-row path.

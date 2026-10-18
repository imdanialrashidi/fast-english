# Plan 004: Reader + Today + Words read-path query budgets

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 5774c6f..HEAD -- app/Http/Controllers/TopicReaderController.php app/Http/Controllers/TodayController.php app/Http/Controllers/VocabularyController.php app/Http/Controllers/LandingController.php app/Support/DailyPlan.php app/Support/Entitlement.php tests/`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW
- **Depends on**: plans/001-verify-gate.md (use the gate for Done criteria)
- **Category**: perf
- **Planned at**: commit `5774c6f`, 2026-10-18
- **Issue**: omit

## Why this matters

The three heaviest signed-in pages pay per-row full-body costs the library already fixed: the reader loads every sibling lesson's full row (`body_en`, `glossary`, `audio_cues` JSON) to render one (`TopicReaderController.php:52-55` + `firstWhere` at :77); Today recomputes eligibility twice and sums minutes in PHP over full `Lesson` rows; the Words list eager-loads unconstrained `lesson`+`topic` for two scalar fields and issues 3-4 count queries. The library's `S3LibraryTest.php:56` query-budget test is the repo's best performance test and has no equivalents — regressions re-enter invisibly. This plan constrains the eagers (same column-select pattern the library uses), threads eligibility once, and pins all three pages with budget tests.

## Current state

The relevant files, each with one line on its role:

- `app/Http/Controllers/TopicReaderController.php:52-77` — loads ALL published lessons full-row then picks one in PHP:
  ```php
  $publishedLessons = $topic->lessons()
      ->where('status', 'published')
      ->orderByRaw(\App\Support\Levels::orderExpression())
      ->get();                       // full rows incl. body_en/glossary/audio_cues
  ...
  $lesson = $publishedLessons->firstWhere('level', $requested);  // :77
  ```
  Only the matched lesson renders (:104-160). `$availableLevels = $publishedLessons->pluck('level')` (:61) is the only other use of the collection.
- `app/Http/Controllers/TodayController.php:25-26` — `$plan = DailyPlan::build($user); $recommendations = DailyPlan::recommendations($user, 3);`
- `app/Support/DailyPlan.php` — `build()` calls `Entitlement::eligible($user)` (:40); `recommendations()` calls it again (:181). `build()` issues: continue-progress + `lesson.topic` (:43-46), due count (:56-59), reviewed-today count (:61-63), completed-today `->with('lesson')->get()` summed in PHP (:65-70), `nextLesson()` double-query on level miss (:161-175). `recommendations()` eager `with(['lessons' => ...])` with NO select (:193-197) while `TodayController.php:61-62` uses only `level` + `estimated_minutes`.
- `app/Support/Entitlement.php:72-88` — `eligible()` does `$user->fresh()` + lazy subscription load per call; called twice per Today hit.
- `app/Http/Controllers/VocabularyController.php:36-60` — `with(['lesson','topic'])` unconstrained (:38) while props use only `lesson.level` + `topic.slug`; three separate counts (:51-59). Props mapping at :67-78 uses `$entry->lesson?->level`, `$entry->topic?->slug` (verify exact lines before editing).
- `app/Http/Controllers/LandingController.php:48-58` — featured-topics `with(['lessons' => ...])` with no select; props use only `level` + `estimated_minutes` (same fix, public page — include it; cheapest of the set).
- `app/Http/Controllers/TopicLibraryController.php:50-56` — THE EXEMPLAR to copy: `->with([... 'lessons' => fn ($lessons) => $lessons->where('status','published')->orderByRaw(...)->select(['id','topic_id','level','estimated_minutes'])])`. Note: constrained eagers MUST include the FK (`topic_id`) or the relation resolves empty.
- `tests/Feature/S3LibraryTest.php:56-89` — THE TEST PATTERN to copy: `build(small)` / `build(large)` fixtures + `DB::getQueryLog()` count pinned constant (`$this->assert...` — read the exact assertion at :74-89 before copying).

Repo conventions that apply: props are plain arrays mapped explicitly in controllers; premium-field leak guards (`assertDontSee`, `S5PrivacyTest`, `S10PaidOnlyTest`) must keep passing — never widen a select to include `body_en`/`glossary`/`audio_cues`/answer keys where the current code excludes them; level ordering via `Levels::orderExpression()`.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Gate | `bash scripts/project-verify.sh` (plan 001) | exit 0 |
| Targeted PHP | `php artisan test --filter="S3Library|S1Reader|S1Level|R5DailyPlan|R4Vocabulary|D5|R3AudioCues|S8Landing"` | all pass |
| Style | `vendor/bin/pint --test` | exit 0 |

## Scope

**In scope** (the only files you should modify):

- `app/Http/Controllers/TopicReaderController.php`
- `app/Support/DailyPlan.php`
- `app/Http/Controllers/VocabularyController.php` (index eagers + counts; `review()` only if the identical `count()+first()` pair at :201-212 is trivially collapsible — otherwise leave it)
- `app/Http/Controllers/LandingController.php` (featured eager select only)
- `tests/Feature/` — 3-4 new query-budget tests (reader, Today, Words; landing optional if the pattern ports cheaply)

**Out of scope** (do NOT touch, even though they look related):

- `app/Support/Entitlement.php` internals — you may pass eligibility results around, but do not change `eligible()`'s semantics or signature.
- `nextLesson()` fallback semantics (preferred-level → newest) — keep behavior, only thread the already-computed `$eligible`.
- Backup (`BackupManager`), placement submit loop, bundle/icon work — separate findings, not this plan.
- Any prop shape, URL, or response status — read-path reshape only; every existing assertion must pass unchanged.
- Caching (per-user memoization, HTTP cache headers) — explicitly out; get the query shape right first.

## Git workflow

- Branch: `advisor/004-read-path-budgets`
- Commit per page (reader, Today, Words+landing, tests); message style: short imperative.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Reader — query the requested level directly

What to do: replace the `get()` + `firstWhere` with: (a) `$availableLevels = $topic->lessons()->where('status','published')->orderByRaw(Levels::orderExpression())->pluck('level')` (levels only — cheap, keeps `:61` and the `NotReady` branch working); (b) `$lesson = $topic->lessons()->where('status','published')->where('level',$requested)->first()` with the existing preferred/first-level fallback (`$requested` resolution at :63-75 stays); the NotReady branch (:79-88) stays. Select only columns the render path (:104-160) uses — read that range first and list them; at minimum keep the FK, `level`, `title_en`, `body_en`, `glossary`, cue fields, `duration_seconds`, `estimated_minutes`, `audio_revision`, `is_public_sample`, `status`. Do NOT select fewer than the render consumes.

**Verify**: `php artisan test --filter="S1Reader|S1Level|R3AudioCues"` → pass. Reader still 404s drafts, shows NotReady for missing levels, honors `?level=` + preferred-level default.

### Step 2: Today — thread eligibility once, sum in SQL, constrain eagers

What to do (all inside `DailyPlan.php` + no controller-shape change):

1. Compute `$eligible = Entitlement::eligible($user)` once in `build()`, pass it into `nextLesson($user, $exclude, $eligible)` (change the private signature) and into `recommendations()` (add an optional `?bool $eligible = null` param defaulting to recompute, so existing callers keep working; `TodayController` passes the built value — controller change is one line).
2. Replace the completed-today `->with('lesson')->get()` + PHP `sum()` (:65-70) with a joined `sum('lessons.estimated_minutes')` (join `lesson_progress` → `lessons` on the same user/today scope). Keep `min($reviewedToday, 5)` logic identical.
3. Constrain the `recommendations()` eager (:193-197) to `->select(['id','topic_id','level','estimated_minutes'])` (mirror the library; FK included).
4. Constrain `nextLesson()`'s `with('topic')` only if it over-fetches — check what the task-shape uses first; if it needs only topic status/cover, select accordingly, else leave.

**Verify**: `php artisan test --filter="R5DailyPlan|D5"` → pass. `S10PaidOnlyTest` gating leg passes (eligibility threading didn't weaken the sample rule).

### Step 3: Words + Landing — constrained eagers, grouped counts

What to do:

1. `VocabularyController@index`: `with(['lesson:id,topic_id,level', 'topic:id,slug'])` — verify against the props mapping (:67-78) that no other column is read (if `cover_path` or similar sneaks in, add it — never drop a consumed column). Collapse the three counts into one `where('user_id',...)->groupBy('status')` query (due still needs its `due_at` scope — implement as `selectRaw` with conditional sums OR keep two queries: one grouped learning/known + one due; document the choice in code comment).
2. `LandingController` featured eager: add the library's `->select(['id','topic_id','level','estimated_minutes'])`. Leave the sample-lookup logic alone.

**Verify**: `php artisan test --filter="R4Vocabulary|D5Vocabulary|S8Landing|S3Filter"` → pass. Words tabs/counts/pagination identical; landing cards identical.

### Step 4: Pin query budgets for reader, Today, Words

What to do: copy the `S3LibraryTest.php:56-89` build-small/build-large + `DB::getQueryLog()` pattern into budget tests: `/app/topics/{slug}?level=` (budgets constant as sibling lessons grow 1→6), `/app/today` (constant as words/progress grow), `/app/words` (constant as words grow 5→50). First run them against the OPTIMIZED code to record the true constants, then sanity-check they FAIL on the pre-fix code (`git stash` the src changes, run, unstash — or assert on a bound tight enough that the old N+1 shape exceeds it; record the numbers in the test comments).

**Verify**: new budget tests pass on fixed code; each fails (or exceeds bound) on pre-fix code — record both numbers in the handoff. Full targeted filter (Commands table) green.

### Step 5: Run the gate

**Verify**: `bash scripts/project-verify.sh` (or fallback lanes) → exit 0, full suite.

## Test plan

- New tests: 3 (reader / today / words) query-budget tests + optional landing one, modeled on `S3LibraryTest.php:56-89`. Growth dimensions: sibling lessons per topic, vocabulary words per user, progress rows.
- Existing suites that must stay green: `S1Reader`, `S1Level`, `R3AudioCues`, `R5DailyPlan`, `D5*`, `R4Vocabulary`, `S8Landing`, `S3FilterSearch`, `S5PrivacyTest`, `S10PaidOnlyTest` (no prop-shape or gating change).
- Verification: targeted filter green + full gate green.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `grep -n "firstWhere" app/Http/Controllers/TopicReaderController.php` → no matches (direct query replaces it)
- [ ] `grep -n "Entitlement::eligible" app/Support/DailyPlan.php` → exactly 1 call site (threaded, not doubled)
- [ ] `grep -n "with(\[" app/Http/Controllers/VocabularyController.php app/Http/Controllers/LandingController.php` → constrained selects with FKs present
- [ ] 3+ new budget tests exist and pass; pre-fix code exceeds each bound (numbers recorded in handoff)
- [ ] Targeted filter + full gate exit 0
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The excerpts in "Current state" don't match (e.g. render path uses columns not listed — then expand the select, never shrink below consumption).
- Any existing privacy/gating test fails after constraining a select (a needed column was dropped) — restore the column, don't weaken the test.
- The joined-sum in Step 2 changes `learned_minutes` on any existing fixture (rounding/timezone edge) — report with the fixture diff.
- Budget numbers on fixed code are NOT meaningfully lower than pre-fix (the finding's premise fails) — report measurements, don't pad the test to pass trivially.
- Any step needs caching, schema, prop-shape, or out-of-scope file changes.

## Maintenance notes

For the human/agent who owns this code after the change lands:

- The budget tests are the tripwire: any new eager or per-row query on these pages must update the bound deliberately in the same PR.
- Column-select discipline: every new `with()` on a heavy model (`Lesson.body_en/glossary/audio_cues`) MUST carry an explicit select with the FK — review-check this.
- If per-user caching is ever added to Today, the budget tests stay (they pin the uncached floor); invalidation on progress/word/review writes becomes the new risk.

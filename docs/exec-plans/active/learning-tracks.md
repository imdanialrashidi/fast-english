# Learning tracks — books, exercises, progress

Status: exercises track delivered 2026-11-16. Slices 1–5 are in the working tree; all six
American English File books now carry exercises and decks (64 units, 1,630 answered-question
items, 1,320 audio cards). This plan turns Fast English from an audio-article library into the
owner's target product: the article is the podcast, its glossary is a
text-first flashcard deck, every book unit adds flashcards and a real
exercise set, and progress reads across both tracks. Behavior contracts live
in `docs/PRODUCT.md`; this file owns ordering and status.

## Owner decisions (2026-11-15)

1. «پادکست» = the existing audio article (`topic` + `lesson` text/MP3/glossary).
   No series/season/episode entities.
2. Each lesson's glossary is its flashcard deck; any number of words (the old
   12-entry cap is removed).
3. Cards are text-first: word + audio, explicit answer reveal, no card image
   (book decks and lesson decks alike).
4. Flashcard word audio is produced offline with Underdog Woof; the owner
   confirmed the commercial licence. Workflow: `docs/ops/FLASHCARD_AUDIO_FA.md`.
5. Books are a first-class section: unit = درس + فلشکارت + تمرین.

## Delivered — slice 1: text cards + lesson vocabulary decks (2026-11-15)

- Text-first `FlashcardPlayer` (no image, explicit reveal, configurable
  ratings, four grades on lesson decks).
- `/app/lessons/{lesson}/flashcards` + `POST .../reviews`: the glossary is the
  deck; grading writes the same `vocabulary_words` row the notebook reads.
- Reader glossary CTA «فلشکارت این درس».
- `word_audio` table, private `/media/words/{wordAudio}/audio`, and
  `php artisan flashcards:audio:import`.
- Card-image route removed; `flashcards.image_path` nullable.
- Glossary entry cap removed in `Glossary`, the MCP validator, and the
  Filament form.
- Evidence: Pest 446 passed, Pint/typecheck/build PASS, Playwright
  `flashcards.spec.ts` 4 passed.

## Delivered — slice 2: book-unit exercises (2026-11-15)

- `exercise_sets` / `exercise_items` / `exercise_attempts` /
  `exercise_answers`, with server marking and owner-scoped attempts.
- Three types: choice, fill-blank, order. The pre-submit payload carries no
  answer key and no explanation; the result page reveals both.
- Unit page entry with the latest score; intro, one-at-a-time session,
  result, retry.
- `php artisan exercises:import` from reviewed JSON, plus the AEF Starter
  unit 1 fixture.
- Evidence: `tests/Feature/ExerciseTest.php` 9, `ExerciseImportTest.php` 5,
  `tests/Unit/ExerciseGraderTest.php` 4, Playwright `exercises.spec.ts` 2
  passed; full suite in the handoff.

## Delivered — slice 3: books section and unit hub (2026-11-15)

- `/app/books` shelf, `/app/books/{book}` book page, and the unit hub at
  `/app/books/{book}/{unit}` with the deck and exercise paths.
- Player moved to `.../flashcards`, results to `.../flashcards/results`,
  exercises to `.../exercises`. Every child returns to the hub.
- Nav label «کتابها» (library glyph); legacy `/app/flashcards...` URLs
  redirect to the books equivalents.
- No fake «درس» path: a book unit has no lesson-text model yet, so the hub
  deliberately has two real paths.
- Evidence: `tests/Feature/BookUnitTest.php` 5; Playwright 6/6 (flashcards +
  exercises); screenshot `books-unit-hub-393.png`.

## Delivered — slice 4: cross-track exercise progress (2026-11-15)

- `App\Support\Exercises\ExerciseProgress`: per-book attempted sets/latest
  score, per-unit question count/latest score, and the one Today task
  (fresh → review → none when complete).
- Shelf line `تمرین: X از Y یونیت · آخرین …`, book-row exercise state, hub
  last/best/attempt count.
- Today adds `تمرین کتاب` / `مرور تمرین کتاب` for an eligible learner; the
  query budget moved 13 → 14 with a constant shape.
- Evidence: `tests/Feature/ExerciseProgressTest.php` 2; full Pest 471;
  Playwright 6/6 with the post-result progress assertions.

## Delivered — slice 5: cross-track review hub (2026-11-15)

- `/app/review` read-only hub: due words, due cards, latest-attempt exercise
  mistakes; deterministic primary action (words → cards → exercise retry).
- Today gains a due-card task; the hub is linked from Today and the books
  shelf. No new nav tab and no merged session.
- Evidence: `tests/Feature/ReviewHubTest.php` 6; full Pest 477; Playwright
  `review.spec.ts` 2/2 (8/8 with flashcards + exercises); screenshot
  `review-hub-393.png`.

## Remaining slices

### Slice 5 — Content and admin (in progress)

- Rebuilt 2026-11-16 after the owner's grammar-first brief: the six-book
  catalog, `exercise_topics`, in-place marking, answered-question progress and
  the unit lesson page. All 12 Starter units are authored end to end
  (2 topics and 18 questions each, 20 cards each with Woof audio); Unit 1 is
  the reference unit. Starter content is complete: 216 questions, 240 cards.
  Book 1 is complete: 12 units (3 topics and 24–27 questions each, 20 cards each),
  308 questions and 240 cards. Book 2 is complete: 12 units, 324 questions and 240 cards. Book 3 is complete: 10 units, 262 questions and 200 cards. Book 4 is complete: 10 units, 260 questions and 200 cards. Book 5 is complete: 10 units, 260 questions and 200 cards. All 64 units across the six
  books are live.
- The old 12 five-item Starter sets are archived in
  `database/seeders/fixtures/exercises/legacy-v1/`; only the v2 U1 set is live.
- Next: owner review of the finished track; future units follow the `aef-unit` skill.
  skill (`docs/ops/AEF_CONTENT_PIPELINE_FA.md`). Filament resources for
  exercises and attempt history still follow the content.
- Filament resources for books/units/cards, `word_audio` review, exercises
  and attempt history.
- Rights: AEF text/artwork is OUP; commercial redistribution needs clearance
  (recorded in `docs/FLASHCARDS.md`).

### Slice 6 — Sales polish (~3–5 days)

- Onboarding (level, first lesson, first deck, first exercise), landing/sample
  promise that matches the product, paywall copy, and a real-device pass.

## Open decisions

- One grade set for both deck kinds (four grades for books too) or keep the
  two-grade book schedule. Current: books two, lesson decks four.
- Whether `/app/flashcards/review` moves under the future «مرور» destination.
- Merged review session: one card model/grader across words and book cards, or
  keep the hub read-only with two sessions.

## Risks

- Content production (exercises + word clips) is the long pole, not code.
- Two schedules remain (book SM-2 vs vocabulary SM-2); acceptable while each
  has a distinct surface, revisit if the review queue merges.
- AEF rights and real-device audio remain the launch-boundary checks.

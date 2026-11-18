# Learning tracks — books, exercises, progress

Status: exercises delivered 2026-11-16; book decks retired 2026-11-18. All six
American English File books carry exercises (66 units, 1,630 questions). Flashcards
now belong to articles only; book units are grammar topics + questions. This
plan turns Fast English from an audio-article library into the owner's target
product: the article is the podcast, its glossary is a text-first flashcard
deck, every book unit adds a real exercise set, and progress reads across both
tracks. Behavior contracts live in `docs/PRODUCT.md`; this file owns ordering
and status.

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

## Delivered — 2026-11-18: article-only flashcards, exercise-only books

- Book vocabulary decks removed at the owner's direction: the shelf, book
  page and unit page no longer show cards; the deck/results/review/media
  routes, controllers, scheduler, importer and tests are gone. Legacy
  `/app/flashcards/**` links redirect to the books section.
- The only decks are article glossary decks (`/app/lessons/{lesson}/flashcards`),
  four grades writing the notebook row, reader CTA «فلشکارت واژههای این مقاله».
- 803 unique article glossary words (16 topics / 89 published lessons) got
  Underdog Woof clips, imported by `flashcards:audio:import`; clips are keyed
  by word, private and `no-store`, and a missing clip hides the speaker.
- Books are exercises only: six books / 66 units / 1,630 questions, real unit
  titles in `catalog.json`, typographic covers (no licensed art), exercise
  progress on shelf/book/unit, two-queue review hub, Today 14 queries.
- Evidence: full Pest **461 passed**, Pint **PASS** (418 files), typecheck +
  build **PASS**, full Chromium **96 passed**.

## Remaining slices

### Slice 5b — Admin (in progress)

- Filament resources for books/units, exercises and attempt history, plus a
  `word_audio` review surface. Today every content change is a CLI import.
- Rights: AEF text/artwork is OUP; commercial redistribution needs clearance
  (recorded in `docs/FLASHCARDS.md` and `docs/LAUNCH_INPUTS_FA.md`).

### Slice 6 — Sales polish (~3–5 days)

- Onboarding (level, first article, first deck, first exercise), a landing and
  sample promise that match the product, paywall copy, and a real-device pass.

## Open decisions

- Whether the review hub grows a merged session (one card/grader across words
  and exercise mistakes) or stays read-only with two queues.
- Free preview of the books: the product rule is paid-only, so a shopper sees
  no question or card before paying.

## Risks

- Content production (articles and word clips) is the long pole, not code.
- AEF rights and real-device audio remain the launch-boundary checks; the
  803-clip batch was checked for format/duration/serving, not by a human ear.

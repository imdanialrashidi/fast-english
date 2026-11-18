# Flashcards

Status: text-first implementation in the working tree on 2026-11-15. Owner
clarification of the same day: «پادکست» is the existing audio article, each
lesson's glossary is its flashcard deck, and cards carry no picture.

Two decks share one player:

- **Book units** — American English File Starter (12 units, 258 cards) with
  the two-grade Anki-style schedule.
- **Lesson vocabulary** — the article's glossary, with the vocabulary
  notebook's four-grade SM-2 schedule. An article with N key words yields N
  cards; there is no entry cap.

Family and Friends is a **Kidotalks** feature (children-only). It is not
duplicated in Fast English.

## Product rule

The books shelf → book → unit hub is the path; the hub opens one deck
session (or one lesson deck from the reader).

1. The English word is on the card from the start, with a speaker when an
   approved clip exists. There is no picture and no timed reveal.
2. **نمایش پاسخ** reveals the Persian meaning, the example and (when known)
   the IPA. On a card with audio, the clip plays on reveal; the speaker
   replays it.
3. Book decks: **درست گفتم / درست نگفتم**. Lesson decks: **دوباره / سخت /
   خوب / آسان**. Previous/next are separate; the first card has no previous
   action and the last card has no next action, with the slot kept so the
   layout does not jump.
4. A self-report is the only input; the server owns the schedule. The answer
   is recorded per card for the session, and revisiting a card shows it.
5. The end screen groups the session into the deck's two buckets (book:
   «درست گفتم / درست نگفتم»; lesson: «بلدم / نیاز به مرور») with retry of
   the second bucket.
6. The book unit result page is the persistent two-bucket view. A lesson
   deck's result lives in the notebook it writes to.

Opening a lesson deck writes nothing. Grading a card creates or updates the
learner's `vocabulary_words` row for that word, so the deck and «واژه‌ها»
can never disagree and no second schedule exists for the same word.

The daily review queue (`/app/flashcards/review`) contains only book cards
the learner has already met: due learning/relearning first, then due reviews,
oldest due first, capped by `config('flashcards.daily_review_limit')` (100).

## Data model

| Table | Purpose |
|---|---|
| `flashcard_books` | Book identity, cover, study config, publication status. |
| `flashcard_units` | One unit of a book; unique `(book_id, number)`. |
| `flashcards` | Book content: word, display, IPA, Persian meaning, definition, example, audio path, stable `external_id`. `image_path` is optional and no longer rendered or served. |
| `word_audio` | Approved word clips for lesson decks: unique `word_key`, private path, source/voice/seed, review status. |
| `user_flashcards` | One book-card schedule per learner/card: phase, step, due_at, interval_days, ease_factor, reps, lapses, last_rating. |
| `flashcard_reviews` | Append-only book-card events with before/after snapshot and a unique `(user_id, client_review_id)` idempotency key. |
| `vocabulary_words` | The notebook and the lesson-deck schedule: one row per (user, word), with lesson/topic origin and the four-grade SM-2 fields. |

Content and learner state are separate tables. Re-importing corrected content
upserts books/units/cards by stable ids and never touches `user_flashcards`,
`flashcard_reviews` or `vocabulary_words`.

## Schedulers

`App\Support\Flashcards\Scheduler` is the two-grade book schedule:

| Event | Effect |
|---|---|
| New → Good | learning step 1 (10 min) |
| Learning → Good | graduates to review at 1 day |
| New/Learning → Again | stays in learning, returns in 1 minute |
| Review → Good | interval = round(current interval × ease), capped at 180 days |
| Review → Again | lapse: ease − 0.2 (floor 1.3), relearning at 10 minutes |
| Relearning → Good | returns to review at 1 day |

Defaults live in `config/flashcards.php`.

Lesson decks use `App\Support\SpacedRepetition` (Again/Hard/Good/Easy), the
same rule as the notebook: Again resets to due-now with ease − 0.2; Hard
×1.2 with ease − 0.15; Good 1 → 3 → ×ease; Easy 4 → ×ease×1.3; ease floor
1.3. The interval is capped at **365 days** (`MAX_INTERVAL_DAYS`); a
2026-11-16 migration clamps older rows whose interval/due date had grown past
the cap. A word marked known stays known on Good/Easy and reopens on
Again/Hard.

Timestamps are stored UTC. The book scheduler uses exact timestamps; the
daily limit and the "reviewed today" counter use the Asia/Tehran day boundary
(`App\Support\Flashcards\StudyDay`).

## Routes

| Route | Purpose |
|---|---|
| `GET /app/books` | Book shelf with progress and the daily review summary. |
| `GET /app/books/{book:slug}` | One book's unit list. |
| `GET /app/books/{book:slug}/{unit}` | Unit hub: card progress plus the deck and exercise entries. |
| `GET /app/books/{book:slug}/{unit}/flashcards` | Unit player (`?only=again` for retry). |
| `GET /app/books/{book:slug}/{unit}/flashcards/results` | Two result buckets. |
| `GET /app/flashcards/review` | Daily due queue / empty state (card-level surface). |
| `POST /app/flashcards/reviews` | One idempotent book-card review event. |
| `GET /app/lessons/{lesson}/flashcards` | The lesson glossary as a deck. |
| `POST /app/lessons/{lesson}/flashcards/reviews` | One four-grade vocabulary review. |
| `GET /media/flashcards/{flashcard}/audio` | Private book-card word audio. |
| `GET /media/words/{wordAudio}/audio` | Private approved word clip. |
| `GET /media/flashcard-books/{book:slug}/cover` | Private book cover. |

All routes are behind `auth`, `reject.disabled` and `subscribed`. Staff pass
the subscription gate through the existing entitlement rule. The old
`/app/flashcards`, `/app/flashcards/{book}`, its `{unit}` and `/results`
paths redirect to the matching books URL. Media is served from the private
disk with `private, no-store`; the service-worker allowlist never caches it.
There is no card-image route.

The book review endpoint:

- validates `flashcard_id`, `rating` (`again|good`), `client_review_id` (UUID),
  optional `session_id` and `duration_ms`;
- locks the learner's `user_flashcards` row, applies the pure scheduler and
  inserts the event in one transaction;
- returns the current phase/due interval and the unit counts;
- replays the same `client_review_id` without a second schedule.

The lesson review endpoint:

- validates `word_key` (must exist in that lesson's current glossary) and
  `rating` (`again|hard|good|easy`);
- creates the notebook row on first grade (meaning/example copied from the
  glossary), locks it on later grades, and applies `SpacedRepetition`;
- returns the resulting status, due date and interval;
- never writes a row for another learner and never accepts a word the lesson
  does not list.

## Content import

Book content:

```bash
php artisan flashcards:import storage/app/private/imports/aef-3e-starter
```

The source folder is the one containing `manifest.json`. The command upserts
the book, units and cards by stable external ids, imports card audio after an
MPEG sniff, and is idempotent. Images are still accepted from the dataset but
are not required and are not served.

Word audio (process and QA: `docs/ops/FLASHCARD_AUDIO_FA.md`):

```bash
php artisan flashcards:audio:import storage/app/private/imports/word-audio/manifest.json
php artisan flashcards:audio:import <manifest> --dry-run
php artisan flashcards:audio:import <manifest> --force
```

Each manifest item names the word, the MP3 file next to the manifest, and the
review status (`draft|approved|rejected`). The command copies real MPEG bytes
to `storage/app/private/flashcards/words/` under a deterministic name,
upserts `word_audio` by `word_key`, and exits non-zero when any item is
missing or is not MPEG audio. Only `approved` rows produce a player URL.

## Verification

Commands and results on 2026-11-15:

| Check | Result |
|---|---|
| `php artisan test` (PostgreSQL, via the pinned container) | 481 passed, 5,879 assertions |
| `vendor/bin/pint --test` | PASS |
| `npm run typecheck` | PASS |
| `npm run build` | PASS |
| `npx playwright test tests/browser/flashcards.spec.ts` on the `:8112` lane | 4 passed |
| Full Chromium suite on the `:8112` lane | 98 passed |

Browser evidence:

- `test-results/browser-shots/flashcards-card-front-393.png`
- `test-results/browser-shots/flashcards-card-393.png`
- `test-results/browser-shots/flashcards-summary-393.png`
- `test-results/browser-shots/flashcards-results-393.png`
- `test-results/browser-shots/flashcards-retry-320.png`
- `test-results/browser-shots/flashcards-review-390.png`
- `test-results/browser-shots/lesson-deck-393.png`
- `test-results/browser-shots/lesson-deck-summary-393.png`

The browser proof checks: the word is visible before the answer, the meaning
is hidden until the reveal, the word audio is requested, first/last action
rules, a revisited card is revealed with its recorded grade, a wrong answer
lands in the second bucket, retry filters to it, the daily queue renders, the
lesson deck shows all glossary words with four grades, and grading writes the
notebook row. No horizontal overflow at 320/393.

## Limits and unexecuted checks

- A real iPhone Safari/PWA audio unlock was **not** exercised on a physical
  device. The start button unlocks a shared `HTMLAudioElement` with
  `public/audio/silence.mp3`; the Chromium lane proves the request path and
  the `play()` call, not iOS behavior.
- No offline review: the app's privacy contract keeps private card content out
  of the service-worker cache.
- No admin CRUD for books/cards/word audio yet. Book content comes from the
  dataset importer; word audio from the reviewed manifest.
- Only AEF Starter is produced. AEF 1–5, FF 1–6 and any other book need their
  own dataset build before importing.
- Lesson decks inherit glossary production: a word without an approved clip
  is a silent card, and IPA appears only if the card has one (the glossary
  schema does not store IPA today).
- The AEF artwork is a consistent pictogram/typographic system derived from
  the book, not photography, and is no longer shown on cards.
- Textbook text and images remain © Oxford University Press; the dataset is
  for the owner's educational use. Commercial redistribution needs clearance.
- Underdog Woof clips are cleared for commercial use by the owner's
  2026-11-15 confirmation; the licence record stays outside Git.

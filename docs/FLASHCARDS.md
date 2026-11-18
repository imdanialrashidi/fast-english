# Flashcards — article decks

Status: article-only since 2026-11-18 (owner decision). Book vocabulary
decks were retired; a book unit is now grammar topics + exercises only.
Owner clarification 2026-11-15 still governs the card itself: text-first,
word + audio, explicit reveal, no picture.

## One deck per article level

- The reader's glossary is the deck. Opening
  `/app/lessons/{lesson}/flashcards` from the article shows one card per
  glossary word; an article with N key words yields N cards, no cap.
- The deck belongs to the lesson row (one level of an article), so another
  level keeps its own glossary and its own cards.
- Cards are paid content: the route sits behind the active-subscription
  gate, and grading is owner-scoped.
- Opening a deck writes nothing. Grading a card creates or updates the
  learner's `vocabulary_words` row, so «واژه‌ها» and the deck share exactly
  one schedule (Again / Hard / Good / Easy, the notebook's SM-2).
- A word marked known stays known on Good/Easy and reopens on Again/Hard.

## The card

1. The English word is on the card from the start, with a speaker when an
   approved clip exists.
2. **نمایش پاسخ** reveals the Persian meaning, the example and (when known)
   the IPA. The clip plays on reveal; the speaker replays it.
3. Four grades; previous/next are separate; the first card has no previous
   action and the last has no next action, with the slot kept so the layout
   does not jump.
4. The end screen groups the session into «بلدم / نیاز به مرور» and offers
   a retry of the second bucket.
5. A card without a clip is still valid: the speaker is hidden, everything
   else works.

## Word audio

- Source: Underdog Woof (Juno), commercial licence confirmed by the owner
  on 2026-11-15. Workflow and mastering: `docs/ops/FLASHCARD_AUDIO_FA.md`.
- Every word clip is keyed by `Vocabulary::key(word)` — lowercased, trimmed.
  One clip serves every level that lists the same word.
- Files are private (`storage/app/private/flashcards/words/…`) and served
  only through `/media/words/{wordAudio}/audio` with `private, no-store`.
- Import: `php artisan flashcards:audio:import <manifest.json>` (idempotent;
  a bad or oversized file fails the batch).
- Coverage (2026-11-18): 803 unique words across 16 published topics and 89
  published lessons; 803 approved clips imported.

## Data model

| Table | Purpose |
|---|---|
| `word_audio` | Approved clips: unique `word_key`, private path, source/voice/seed, duration, review status. |
| `vocabulary_words` | The notebook and the deck schedule: one row per (user, word), with lesson/topic origin and the four-grade SM-2 fields. |
| `flashcard_books` / `flashcard_units` | Coursebook identity and units for the exercises track. No book cards are created or served. |
| `flashcards`, `user_flashcards`, `flashcard_reviews` | Retired legacy tables (kept in the schema for rollback; no route, screen or command writes them). |

## Proof

- `tests/Feature/LessonFlashcardTest.php` — deck payload, no answer key,
  four grades write the notebook, owner scope, no clip → no speaker, clip
  served `private, no-store`.
- `tests/Feature/WordAudioImportTest.php` — manifest validation, idempotent
  import, non-MPEG rejected.
- `tests/browser/lesson-flashcards.spec.ts` — reader → deck → grades →
  notebook, 393 px and 320 px.
- Book-card tests and routes are gone; `BookUnitTest` asserts the unit page
  has no `flashcards` prop and the legacy deck URLs no longer resolve to a
  deck.

## What is deliberately absent

Book decks, card images, a picture prompt, a daily book-card queue, a
merged review session, and an admin CRUD for cards. The review hub keeps
two queues: due words and exercise mistakes.

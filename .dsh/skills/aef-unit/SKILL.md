---
name: aef-unit
description: "Author, import and verify one American English File unit — grammar topics, choice/matching exercises, vocabulary cards and Woof audio — inside the Fast English books section."
whenToUse: "Any work on AEF content under Books → American English File: a new unit, corrected explanation, new questions, a rebuilt deck, or a progress/placement fix."
---

# AEF unit authoring

The full standard is `docs/ops/AEF_CONTENT_PIPELINE_FA.md`. Read it before the first unit of a
session; this skill is the short loop.

## Non-negotiables

1. Grammar topics, their order, use and formulas come from the **Grammar Bank** of the same lesson.
   Exercises come from the **GRAMMAR** section of the same lesson in the Workbook.
2. The unit page reads top to bottom: topic 1 explanation → its questions → topic 2 → … → vocabulary.
   Never move a question under another topic.
3. Explanations, notes and feedback are Persian; formulas and examples are English at the book's level.
4. Every choice has exactly one right index; every wrong option has its own Persian feedback.
   Every matching set has unique right sides (2–6 pairs). One matching per unit at most.
5. The first answer is the only one that counts. A retry must return the stored result and must not
   change the count.
6. Cards are text-first: word, IPA, Persian meaning, simple English definition, short example, part of
   speech, lesson code, topic. No image. Every card has a Woof MP3.
7. All of it is paid content: no free question, card or preview.
8. Only replace content the owner explicitly approved (old AEF cards). Never touch articles, lessons,
   glossaries or learner rows.

## Loop for one unit

1. **Map:** file/lesson codes, grammar titles, Grammar Bank page, Workbook section — from the PDFs.
2. **OCR:** `scripts/aef/ocr-pages.sh "<pdf>" <first> <last> /tmp/aef-ocr/<book>-uNN 250`.
   Scans have no text layer; check the rendered page for tables and column order.
3. **Write** `database/seeders/fixtures/exercises/aef-3e-<book>-uNN.json` (v2: topics + items).
4. **Write** `database/seeders/fixtures/aef/aef-3e-<book>-uNN-cards.json` (15–25 cards).
   Before validating, run `python3 scripts/aef/fix-explanations.py <unit>.json`: the validator
   rejects any choice explanation without Persian text, and the helper prefixes a Persian sentence
   while keeping the English detail.
5. **Audio:** `python3 scripts/aef/generate-audio.py <cards.json> storage/app/aef-audio/<book>/uNN`.
6. **Validate, then import:**
   ```bash
   python3 scripts/aef/validate-content.py database/seeders/fixtures/exercises database/seeders/fixtures/aef
   php artisan aef:import-catalog                      # once per series
   php artisan exercises:import <unit>.json --dry-run  # then without --dry-run
   php artisan flashcards:import-aef <cards>.json --audio=storage/app/aef-audio/<book>/uNN
   ```
7. **Verify on the real page** at 393px and 320px: wrong answer shows key + feedback + explanation;
   the same question again does not raise progress; reload keeps it; the shelf and book list show the
   same numbers; the card audio answers 206.
8. **Checks:**
   ```bash
   php artisan test --filter="Exercise|BookUnit|ReviewHub|Grader"
   BASE_URL=http://127.0.0.1:8112 npx playwright test tests/browser/exercises.spec.ts --project=chromium
   ```

## Before calling a unit done

- [ ] Title and unit number match the Student Book.
- [ ] Every topic exists in the same lesson's Grammar Bank, in the book's order.
- [ ] Every question sits under a topic taught before it.
- [ ] One right answer per choice; a feedback line for each distractor.
- [ ] Cards have IPA, meaning, definition, example and audio.
- [ ] `source` records edition, book, lessons, Grammar Bank and Workbook refs.
- [ ] Mobile screenshots and the test results are recorded.

Then start the next unit. Do not batch several units before the first one passes this list.

## Common traps

- PDF page number ≠ printed page number at the front of a book; check the printed number.
- OCR merges two columns and drops the right edge; re-render that page alone before trusting it.
- A grammar point repeated later in the book may look the same but drills a different form; use the
  current unit's Grammar Bank box only.
- `exercises:import` never deletes items; if the set's shape changed, prune explicitly.
- Woof takes about 1–2 seconds per word after the model loads; 20 cards is under a minute.
- The browser lane and the test suite use different databases; never run Pest against `fe_browser`.

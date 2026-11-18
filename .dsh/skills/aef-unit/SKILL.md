---
name: aef-unit
description: "Author, import and verify one American English File unit — grammar topics and choice/matching exercises — inside the Fast English books section."
whenToUse: "Any work on AEF content under Books → American English File: a new unit, corrected explanation, new questions, or a progress fix."
---

# AEF unit authoring

The full standard is `docs/ops/AEF_CONTENT_PIPELINE_FA.md`. Read it before the first unit of a
session; this skill is the short loop.

Book vocabulary decks were retired on 2026-11-18: a unit is grammar topics + questions only.
Flashcards exist for articles, not for book units.

## Non-negotiables

1. Grammar topics, their order, use and formulas come from the **Grammar Bank** of the same lesson.
   Exercises come from the **GRAMMAR** section of the same lesson in the Workbook.
2. The unit page reads top to bottom: topic 1 explanation → its questions → topic 2 → … .
   Never move a question under another topic.
3. Explanations, notes and feedback are Persian; formulas and examples are English at the book's level.
4. Every choice has exactly one right index; every wrong option has its own Persian feedback.
   Every matching set has unique right sides (2–6 pairs). One matching per unit at most.
5. The first answer is the only one that counts. A retry must return the stored result and must not
   change the count.
6. No vocabulary cards and no word audio are authored for a book unit.
7. All of it is paid content: no free question or preview.
8. Only replace content the owner explicitly approved. Never touch articles, lessons, glossaries,
   article decks or learner rows.

## Loop for one unit

1. **Map:** file/lesson codes, grammar titles, Grammar Bank page, Workbook section — from the PDFs.
2. **OCR:** `scripts/aef/ocr-pages.sh "<pdf>" <first> <last> /tmp/aef-ocr/<book>-uNN 250`.
   Scans have no text layer; check the rendered page for tables and column order.
3. **Write** `database/seeders/fixtures/exercises/aef-3e-<book>-uNN.json` (v2: topics + items).
   Run `python3 scripts/aef/fix-explanations.py <unit>.json` before validating: the validator rejects
   any choice explanation without Persian text, and the helper prefixes a Persian sentence while
   keeping the English detail.
4. **Validate, then import:**
   ```bash
   python3 scripts/aef/validate-content.py database/seeders/fixtures/exercises
   php artisan aef:import-catalog                      # once per series; installs unit titles
   php artisan exercises:import <unit>.json --dry-run  # then without --dry-run
   ```
5. **Verify on the real page** at 393px and 320px: wrong answer shows key + feedback + explanation;
   the same question again does not raise progress; reload keeps it; the shelf and book page show the
   same numbers.
6. **Checks:**
   ```bash
   php artisan test --filter="Exercise|BookUnit|ExerciseProgress|Grader"
   BASE_URL=http://127.0.0.1:8112 npx playwright test tests/browser/exercises.spec.ts --project=chromium
   ```

## Before calling a unit done

- [ ] Title and unit number match the Student Book.
- [ ] Every topic exists in the same lesson's Grammar Bank, in the book's order.
- [ ] Every question sits under a topic taught before it.
- [ ] One right answer per choice; a feedback line for each distractor.
- [ ] `source` records edition, book, lessons, Grammar Bank and Workbook refs.
- [ ] Mobile screenshots and the test results are recorded.

Then start the next unit. Do not batch several units before the first one passes this list.

## Common traps

- PDF page number ≠ printed page number at the front of a book; check the printed number.
- OCR merges two columns and drops the right edge; re-render that page alone before trusting it.
- A grammar point repeated later in the book may look the same but drills a different form; use the
  current unit's Grammar Bank box only.
- `exercises:import` never deletes items; if the set's shape changed, prune explicitly.
- The browser lane and the test suite use different databases; never run Pest against `fe_browser`.

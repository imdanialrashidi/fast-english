# Book exercises

Status: rebuilt 2026-11-16 (owner request) as a grammar-first unit page inside
Books → American English File. The 2026-11-15 attempt flow (one set of five
mixed questions, submit-once, result page) is gone; nothing in this document
describes it.

## Product rule

- The path is `کتاب‌ها → American English File → کتاب → یونیت`; the unit page is
  the lesson. Exercises are not a separate tab and not a separate session.
- One published set per unit. A unit without a set shows a calm not-ready block
  and keeps its vocabulary deck.
- The unit page renders, in the book's order: grammar topic explanation
  (Persian use, formulas, examples, one note) → that topic's questions → next
  topic → the unit's vocabulary deck.
- Each question is marked in place. The first answer is stored; the correct
  answer, a Persian explanation and the option-specific feedback appear
  immediately. A retry returns the stored result and changes nothing.
- Progress is answered questions, not score: `answered / questions`, first
  answer only, shown on the unit page, the unit row and the book card.
- Paid-only (`auth`, `reject.disabled`, `subscribed`) and owner-scoped. No free
  question or preview exists anywhere.
- Two types only: **choice** (2–3 options, one right index) and **matching**
  (2–6 unique pairs, two-tap pairing). Matching is the variety, not the norm.

## Data model

| Table | Purpose |
|---|---|
| `exercise_sets` | One set per unit (or lesson): stable `external_id`, title, Persian instructions, status, order, `source` JSON for internal refs. |
| `exercise_topics` | Ordered grammar topics of the set: `key`, title EN/FA, `use_fa`, `formulas` JSON, `examples` JSON, `notes_fa`. |
| `exercise_items` | Items: `topic_id`, position, type, prompt, client `options`, server `answer`, `explanation_fa`, per-option `feedback`. |
| `exercise_attempts` | One row per submitted answer (score 0/1, total 1), owner-scoped. |
| `exercise_answers` | The stored response and `is_correct`; `(attempt_id, item_id)` unique. |

Content and learner state are separate. Topics and items are upserted by
stable keys; the importer never deletes an item on its own.

## Marking

`App\Support\Exercises\Grader` is the one marking owner (pure):

| Type | Answer in DB | Response | Rule |
|---|---|---|---|
| choice | `{index: 2}` | option index | integer equality |
| matching | `options {left, right}`, `{map: [i…]}` | one displayed-right index per left | each displayed index is mapped back through the stable shuffle; every pair must match |

The right column is a deterministic shuffle (`md5(item id | right index)`), so a
refresh never reorders it and the key cannot be read from the display order.

The answer endpoint returns `is_correct`, `correct`, `explanation_fa`,
`feedback_fa` (for the chosen option) and `already`. The unit page payload
carries no key, no explanation and no feedback for unanswered items.

## Routes

| Route | Purpose |
|---|---|
| `GET /app/books/{book:slug}/{unit}` | The unit page: topics, questions, progress, deck entry. |
| `POST /app/books/{book:slug}/{unit}/exercises/answer` | Mark one question; first answer only. |
| `GET /app/books/{book:slug}/{unit}/exercises` | Redirects to the unit page. |
| `GET /app/books/{book:slug}/{unit}/flashcards` | The unit deck. |

## Content import

```bash
php artisan aef:import-catalog
php artisan exercises:import database/seeders/fixtures/exercises/aef-3e-starter-u01.json
php artisan exercises:import <file> --dry-run
```

The v2 file carries `topics[]` and `items[]` (see
`docs/ops/AEF_CONTENT_PIPELINE_FA.md`). Validation refuses an unknown type, a
missing/invalid topic reference, fewer than two choice options, an answer index
out of range, a matching set outside 2–6 pairs, duplicate right labels, a
feedback key that is not an option, or a duplicate external id/position. A bad
file exits non-zero and writes nothing.

## Progress read side

`App\Support\Exercises\ExerciseProgress`:

- `forBooks(user, bookIds)` → `{questions, answered}` per book.
- `forUnits(user, bookId)` → `{questions, answered}` per unit.
- `firstAnswers(user, itemIds)` → the earliest answer per item (the page state).
- `next(user)` → the first unit in book order with unanswered questions.
- `mistakes(user)` → first answers that were wrong, for the read-only hub.

An answered question counts once even when the answer was wrong; a retry never
raises the number.

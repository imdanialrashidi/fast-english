<?php

namespace App\Support\Exercises;

use App\Models\ExerciseAnswer;
use App\Models\ExerciseItem;
use App\Models\ExerciseSet;
use App\Models\User;
use Illuminate\Support\Collection;

/**
 * Read-side exercise progress: answered-question counts per unit and per
 * book, the stored first answer of each question, the one Today task, and
 * the mistakes the review hub reports.
 *
 * A question counts once, with its first answer, even when that answer was
 * wrong; a retry never raises the count. Counts are computed from content +
 * answers, never stored on a content row, so a re-import cannot corrupt
 * progress. Query shape is constant: one item query and one answer query per
 * page, grouped in PHP.
 */
final class ExerciseProgress
{
    /**
     * @param  list<int>  $bookIds
     * @return array<int, array{questions: int, answered: int}>
     */
    public static function forBooks(User $user, array $bookIds): array
    {
        $result = [];
        foreach ($bookIds as $bookId) {
            $result[$bookId] = ['questions' => 0, 'answered' => 0];
        }

        if ($bookIds === []) {
            return $result;
        }

        $items = ExerciseItem::query()
            ->join('exercise_sets', 'exercise_sets.id', '=', 'exercise_items.set_id')
            ->join('flashcard_units', 'flashcard_units.id', '=', 'exercise_sets.unit_id')
            ->where('exercise_sets.status', 'published')
            ->whereIn('flashcard_units.book_id', $bookIds)
            ->get(['exercise_items.id', 'flashcard_units.book_id']);

        $answered = self::answeredItemIds($user, $items->pluck('id')->all());

        foreach ($items as $item) {
            $bookId = (int) $item->book_id;
            if (! isset($result[$bookId])) {
                continue;
            }

            $result[$bookId]['questions']++;
            if (isset($answered[(int) $item->id])) {
                $result[$bookId]['answered']++;
            }
        }

        return $result;
    }

    /**
     * @return array<int, array{questions: int, answered: int}>
     */
    public static function forUnits(User $user, int $bookId): array
    {
        $items = ExerciseItem::query()
            ->join('exercise_sets', 'exercise_sets.id', '=', 'exercise_items.set_id')
            ->join('flashcard_units', 'flashcard_units.id', '=', 'exercise_sets.unit_id')
            ->where('exercise_sets.status', 'published')
            ->where('flashcard_units.book_id', $bookId)
            ->get(['exercise_items.id', 'flashcard_units.id as unit_id']);

        $answered = self::answeredItemIds($user, $items->pluck('id')->all());
        $result = [];

        foreach ($items as $item) {
            $unitId = (int) $item->unit_id;
            $row = $result[$unitId] ?? ['questions' => 0, 'answered' => 0];
            $row['questions']++;
            if (isset($answered[(int) $item->id])) {
                $row['answered']++;
            }
            $result[$unitId] = $row;
        }

        return $result;
    }

    /**
     * The first stored answer of every item in one set, keyed by item id.
     * The earliest answer wins; a later retry never replaces it.
     *
     * @param  list<int>  $itemIds
     * @return array<int, array{response: mixed, is_correct: bool, answered_at: ?string}>
     */
    public static function firstAnswers(User $user, array $itemIds): array
    {
        if ($itemIds === []) {
            return [];
        }

        $rows = ExerciseAnswer::query()
            ->join('exercise_attempts', 'exercise_attempts.id', '=', 'exercise_answers.attempt_id')
            ->where('exercise_attempts.user_id', $user->id)
            ->whereIn('exercise_answers.item_id', $itemIds)
            ->orderBy('exercise_answers.id')
            ->get([
                'exercise_answers.item_id',
                'exercise_answers.response',
                'exercise_answers.is_correct',
                'exercise_answers.created_at',
            ]);

        $first = [];
        foreach ($rows as $row) {
            $itemId = (int) $row->item_id;
            if (isset($first[$itemId])) {
                continue;
            }

            $first[$itemId] = [
                'response' => $row->response,
                'is_correct' => (bool) $row->is_correct,
                'answered_at' => $row->created_at?->toIso8601String(),
            ];
        }

        return $first;
    }

    /**
     * The one exercise task Today offers: the first unit, in book order, that
     * still has unanswered questions. A fully answered course creates none.
     *
     * @return array{key: string, title: string, detail: string, url: string, done: bool}|null
     */
    public static function next(User $user): ?array
    {
        $sets = ExerciseSet::query()
            ->published()
            ->with(['unit:id,book_id,number,title_en', 'unit.book:id,slug,title_en,sort_order'])
            ->withCount('items')
            ->get(['id', 'unit_id', 'sort_order']);

        $sets = $sets
            ->filter(fn (ExerciseSet $set): bool => $set->unit !== null
                && $set->unit->book !== null
                && (int) $set->items_count > 0)
            ->sortBy(fn (ExerciseSet $set): string => sprintf(
                '%05d-%05d-%05d',
                (int) $set->unit->book->sort_order,
                (int) $set->unit->number,
                (int) $set->sort_order,
            ))
            ->values();

        foreach ($sets as $set) {
            $itemIds = ExerciseItem::query()->where('set_id', $set->id)->pluck('id')->all();
            $answered = self::answeredItemIds($user, $itemIds);

            if (count($answered) >= count($itemIds)) {
                continue;
            }

            $book = $set->unit->book;
            $unit = $set->unit;

            return [
                'key' => 'exercise',
                'title' => 'تمرین کتاب',
                'detail' => sprintf('%s · یونیت %d · %d سؤال', $book->title_en, (int) $unit->number, (int) $set->items_count),
                'url' => route('books.unit', ['book' => $book->slug, 'unit' => $unit->number]),
                'done' => false,
            ];
        }

        return null;
    }

    /**
     * Questions whose first answer was wrong, across every published set.
     * The hub only reports the count and the last unit to revisit; it never
     * starts a second exercise flow.
     *
     * @return array{wrong: int, sets: int, retry_url: ?string, result_url: ?string}
     */
    public static function mistakes(User $user): array
    {
        $items = ExerciseItem::query()
            ->join('exercise_sets', 'exercise_sets.id', '=', 'exercise_items.set_id')
            ->where('exercise_sets.status', 'published')
            ->get(['exercise_items.id', 'exercise_items.set_id']);

        if ($items->isEmpty()) {
            return ['wrong' => 0, 'sets' => 0, 'retry_url' => null, 'result_url' => null];
        }

        $first = self::firstAnswers($user, $items->pluck('id')->all());
        $wrong = 0;
        $setIds = [];

        foreach ($items as $item) {
            $answer = $first[(int) $item->id] ?? null;
            if ($answer !== null && $answer['is_correct'] === false) {
                $wrong++;
                $setIds[(int) $item->set_id] = true;
            }
        }

        $retryUrl = null;
        if ($setIds !== []) {
            $set = ExerciseSet::query()
                ->whereIn('id', array_keys($setIds))
                ->with('unit.book')
                ->get()
                ->filter(fn (ExerciseSet $set): bool => $set->unit?->book !== null)
                ->sortBy(fn (ExerciseSet $set): int => (int) $set->id)
                ->last();

            if ($set !== null) {
                $retryUrl = route('books.unit', [
                    'book' => $set->unit->book->slug,
                    'unit' => $set->unit->number,
                ]);
            }
        }

        return [
            'wrong' => $wrong,
            'sets' => count($setIds),
            'retry_url' => $retryUrl,
            'result_url' => null,
        ];
    }

    /**
     * @param  list<int>  $itemIds
     * @return array<int, true>
     */
    private static function answeredItemIds(User $user, array $itemIds): array
    {
        if ($itemIds === []) {
            return [];
        }

        $ids = ExerciseAnswer::query()
            ->join('exercise_attempts', 'exercise_attempts.id', '=', 'exercise_answers.attempt_id')
            ->where('exercise_attempts.user_id', $user->id)
            ->whereIn('exercise_answers.item_id', $itemIds)
            ->distinct()
            ->pluck('exercise_answers.item_id');

        $map = [];
        foreach ($ids as $id) {
            $map[(int) $id] = true;
        }

        return $map;
    }

    /**
     * @param  Collection<int, ExerciseItem>  $items
     * @return array<int, array{response: mixed, is_correct: bool, answered_at: ?string}>
     */
    public static function forSet(User $user, Collection $items): array
    {
        return self::firstAnswers($user, $items->pluck('id')->all());
    }
}

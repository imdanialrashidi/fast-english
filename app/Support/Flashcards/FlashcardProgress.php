<?php

namespace App\Support\Flashcards;

use App\Models\FlashcardUnit;
use App\Models\User;
use App\Models\UserFlashcard;
use Carbon\CarbonImmutable;
use Illuminate\Database\Query\Builder;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * Read-side projections for the flashcard screens: per-book and per-unit
 * counts, the due queue, and the "next due" hint. Counts are computed from
 * learner state, never stored on content rows, so a content re-import cannot
 * corrupt progress and a count can never disagree with the cards on screen.
 */
final class FlashcardProgress
{
    /**
     * @param  list<int>  $bookIds
     * @return array<int, array{total: int, known: int, unknown: int, due: int, fresh: int}>
     */
    public static function forBooks(User $user, array $bookIds): array
    {
        $rows = self::summaryQuery($user)
            ->when($bookIds !== [], fn (Builder $q) => $q->whereIn('flashcard_books.id', $bookIds))
            ->groupBy('flashcard_books.id')
            ->selectRaw('flashcard_books.id as group_id')
            ->selectRaw(self::aggregateSql(), [now()])
            ->get();

        return self::keyed($rows, $bookIds);
    }

    /**
     * @return array<int, array{total: int, known: int, unknown: int, due: int, fresh: int}>
     */
    public static function forUnits(User $user, int $bookId): array
    {
        $rows = self::summaryQuery($user)
            ->where('flashcard_units.book_id', $bookId)
            ->groupBy('flashcard_units.id')
            ->selectRaw('flashcard_units.id as group_id')
            ->selectRaw(self::aggregateSql(), [now()])
            ->get();

        return self::keyed($rows, []);
    }

    /**
     * @return array{total: int, known: int, unknown: int, due: int, fresh: int}
     */
    public static function forUnit(User $user, FlashcardUnit $unit): array
    {
        $row = self::summaryQuery($user)
            ->where('flashcards.unit_id', $unit->id)
            ->selectRaw(self::aggregateSql(), [now()])
            ->first();

        return self::shape($row);
    }

    public static function dueCount(User $user, ?int $bookId = null): int
    {
        return (int) UserFlashcard::query()
            ->where('user_id', $user->id)
            ->whereIn('phase', ['learning', 'review', 'relearning'])
            ->whereNotNull('due_at')
            ->where('due_at', '<=', now())
            ->when($bookId !== null, fn ($q) => $q->whereHas(
                'flashcard.unit',
                fn ($unit) => $unit->where('book_id', $bookId)
            ))
            ->count();
    }

    /**
     * The daily review queue: due learning/relearning first, then due
     * reviews, oldest due first. A unit session is the new-card path; this
     * queue only contains cards the learner has already met.
     *
     * @return Collection<int, UserFlashcard>
     */
    public static function queue(User $user, int $limit = 100): Collection
    {
        $limit = max(1, min($limit, (int) config('flashcards.daily_review_limit', 100)));

        return UserFlashcard::query()
            ->where('user_id', $user->id)
            ->whereIn('phase', ['learning', 'review', 'relearning'])
            ->whereNotNull('due_at')
            ->where('due_at', '<=', now())
            ->orderByRaw("case when phase in ('learning','relearning') then 0 else 1 end")
            ->orderBy('due_at')
            ->orderBy('id')
            ->limit($limit)
            ->with(['flashcard.unit.book'])
            ->get();
    }

    public static function nextDueAt(User $user): ?CarbonImmutable
    {
        $next = UserFlashcard::query()
            ->where('user_id', $user->id)
            ->whereIn('phase', ['learning', 'review', 'relearning'])
            ->whereNotNull('due_at')
            ->where('due_at', '>', now())
            ->min('due_at');

        return is_string($next) && $next !== '' ? CarbonImmutable::parse($next, 'UTC') : null;
    }

    public static function reviewsToday(User $user): int
    {
        return (int) DB::table('flashcard_reviews')
            ->where('user_id', $user->id)
            ->where('reviewed_at', '>=', StudyDay::startUtc())
            ->count();
    }

    /**
     * A book's cards are reachable only while it is published; the summary
     * query must never leak counts for drafts.
     */
    private static function summaryQuery(User $user): Builder
    {
        return DB::table('flashcards')
            ->join('flashcard_units', 'flashcard_units.id', '=', 'flashcards.unit_id')
            ->join('flashcard_books', 'flashcard_books.id', '=', 'flashcard_units.book_id')
            ->leftJoin('user_flashcards as uf', function ($join) use ($user): void {
                $join->on('uf.flashcard_id', '=', 'flashcards.id')
                    ->where('uf.user_id', '=', $user->id);
            })
            ->where('flashcard_books.status', 'published');
    }

    private static function aggregateSql(): string
    {
        return "count(*) as total,
            coalesce(sum(case when uf.last_rating = 'good' then 1 else 0 end), 0) as known,
            coalesce(sum(case when uf.last_rating = 'again' then 1 else 0 end), 0) as unknown,
            coalesce(sum(case when uf.phase in ('learning','review','relearning') and uf.due_at <= ? then 1 else 0 end), 0) as due,
            coalesce(sum(case when uf.id is null or uf.phase = 'new' then 1 else 0 end), 0) as fresh";
    }

    /**
     * @param  Collection<int, object>  $rows
     * @param  list<int>  $expected
     * @return array<int, array{total: int, known: int, unknown: int, due: int, fresh: int}>
     */
    private static function keyed(Collection $rows, array $expected): array
    {
        $result = [];
        foreach ($expected as $id) {
            $result[$id] = self::shape(null);
        }
        foreach ($rows as $row) {
            $result[(int) $row->group_id] = self::shape($row);
        }

        return $result;
    }

    /** @return array{total: int, known: int, unknown: int, due: int, fresh: int} */
    private static function shape(mixed $row): array
    {
        if ($row === null) {
            return ['total' => 0, 'known' => 0, 'unknown' => 0, 'due' => 0, 'fresh' => 0];
        }

        return [
            'total' => (int) $row->total,
            'known' => (int) $row->known,
            'unknown' => (int) $row->unknown,
            'due' => (int) $row->due,
            'fresh' => (int) $row->fresh,
        ];
    }
}

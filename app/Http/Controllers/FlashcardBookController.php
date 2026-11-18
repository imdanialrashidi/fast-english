<?php

namespace App\Http\Controllers;

use App\Models\FlashcardBook;
use App\Models\User;
use App\Support\Exercises\ExerciseProgress;
use App\Support\Flashcards\FlashcardPresenter;
use App\Support\Flashcards\FlashcardProgress;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Flashcard book shelf and one book's unit list. Every page is learner-only
 * (auth + disabled + active subscription); the content itself is global and
 * the per-user counts are computed, never stored on the book.
 */
class FlashcardBookController extends Controller
{
    public function index(Request $request): Response
    {
        $user = $this->learner($request);

        $books = FlashcardBook::query()
            ->where('status', 'published')
            ->withCount('units')
            ->orderBy('sort_order')
            ->orderBy('id')
            ->get();

        $counts = FlashcardProgress::forBooks($user, $books->pluck('id')->all());
        $exercise = ExerciseProgress::forBooks($user, $books->pluck('id')->all());

        $totals = FlashcardPresenter::emptyCounts();
        $rows = $books->map(function (FlashcardBook $book) use ($counts, $exercise, &$totals): array {
            $bookCounts = $counts[$book->id] ?? FlashcardPresenter::emptyCounts();
            foreach ($totals as $key => $value) {
                $totals[$key] = $value + $bookCounts[$key];
            }

            return FlashcardPresenter::book(
                $book,
                $bookCounts,
                (int) $book->units_count,
                $exercise[$book->id] ?? null,
            );
        })->all();

        return Inertia::render('Flashcards/Index', [
            'books' => $rows,
            'totals' => $totals,
            'review' => $this->reviewSummary($user),
        ]);
    }

    public function show(Request $request, FlashcardBook $book): Response
    {
        abort_unless($book->status === 'published', 404);

        $user = $this->learner($request);
        $counts = FlashcardProgress::forBooks($user, [$book->id]);
        $bookCounts = $counts[$book->id] ?? FlashcardPresenter::emptyCounts();

        $units = $book->units()
            ->orderBy('sort_order')
            ->orderBy('number')
            ->get();

        $unitCounts = FlashcardProgress::forUnits($user, $book->id);
        $exercise = ExerciseProgress::forUnits($user, $book->id);

        return Inertia::render('Flashcards/Book', [
            'book' => FlashcardPresenter::book($book, $bookCounts, $units->count()),
            'units' => $units->map(function ($unit) use ($book, $unitCounts, $exercise): array {
                $unit->setRelation('book', $book);

                return FlashcardPresenter::unit(
                    $unit,
                    $unitCounts[$unit->id] ?? FlashcardPresenter::emptyCounts(),
                    $exercise[$unit->id] ?? null,
                );
            })->all(),
            'review' => $this->reviewSummary($user, $book->id),
        ]);
    }

    /** @return array{due: int, next_due_at: string|null, reviewed_today: int} */
    private function reviewSummary(User $user, ?int $bookId = null): array
    {
        $next = FlashcardProgress::nextDueAt($user);

        return [
            'due' => FlashcardProgress::dueCount($user, $bookId),
            'next_due_at' => $next?->toIso8601String(),
            'reviewed_today' => FlashcardProgress::reviewsToday($user),
        ];
    }

    private function learner(Request $request): User
    {
        $user = $request->user();
        abort_if($user === null || $user->disabled_at !== null, 403);

        return $user;
    }
}

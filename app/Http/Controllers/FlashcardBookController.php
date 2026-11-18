<?php

namespace App\Http\Controllers;

use App\Models\FlashcardBook;
use App\Models\User;
use App\Support\Exercises\ExerciseProgress;
use App\Support\Flashcards\FlashcardPresenter;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/**
 * The books section: the shelf and one book's unit list. Every page is
 * learner-only (auth + disabled + active subscription). Progress is the
 * exercise track only; book vocabulary decks were retired on 2026-11-18 so
 * flashcards exist for articles alone.
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

        $exercise = ExerciseProgress::forBooks($user, $books->pluck('id')->all());

        $rows = $books->map(fn (FlashcardBook $book): array => FlashcardPresenter::book(
            $book,
            (int) $book->units_count,
            $exercise[$book->id] ?? null,
        ))->all();

        return Inertia::render('Books/Index', [
            'books' => $rows,
        ]);
    }

    public function show(Request $request, FlashcardBook $book): Response
    {
        abort_unless($book->status === 'published', 404);

        $user = $this->learner($request);

        $units = $book->units()
            ->orderBy('sort_order')
            ->orderBy('number')
            ->get();

        $exercise = ExerciseProgress::forUnits($user, $book->id);

        return Inertia::render('Books/Show', [
            'book' => FlashcardPresenter::book($book, $units->count(), null),
            'units' => $units->map(function ($unit) use ($book, $exercise): array {
                $unit->setRelation('book', $book);

                return FlashcardPresenter::unit($unit, $exercise[$unit->id] ?? null);
            })->all(),
        ]);
    }

    private function learner(Request $request): User
    {
        $user = $request->user();
        abort_if($user === null || $user->disabled_at !== null, 403);

        return $user;
    }
}

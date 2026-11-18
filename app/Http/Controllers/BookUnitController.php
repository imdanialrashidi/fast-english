<?php

namespace App\Http\Controllers;

use App\Models\ExerciseSet;
use App\Models\FlashcardBook;
use App\Models\User;
use App\Support\Exercises\ExercisePresenter;
use App\Support\Exercises\ExerciseProgress;
use App\Support\Flashcards\FlashcardProgress;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/**
 * The unit page (owner request 2026-11-16): a unit is one scrolling lesson —
 * each grammar topic's Persian explanation, formulas and examples, then that
 * topic's questions — followed by the unit's vocabulary deck. Exercises are
 * answered in place with immediate feedback; the flashcard deck stays a
 * child route so opening a unit never starts a session by accident.
 */
class BookUnitController extends Controller
{
    public function show(Request $request, FlashcardBook $book, int $unit): Response
    {
        abort_unless($book->status === 'published', 404);

        $user = $this->learner($request);
        $unitModel = $book->units()->where('number', $unit)->firstOrFail();

        $set = ExerciseSet::query()
            ->published()
            ->where('unit_id', $unitModel->id)
            ->with(['topics', 'items.topic'])
            ->orderBy('sort_order')
            ->orderBy('id')
            ->first();

        $items = $set?->items ?? collect();
        $answers = ExerciseProgress::firstAnswers($user, $items->pluck('id')->all());

        $counts = FlashcardProgress::forUnit($user, $unitModel);
        $answered = count($answers);

        $previous = $book->units()->where('number', '<', $unitModel->number)->orderByDesc('number')->first();
        $next = $book->units()->where('number', '>', $unitModel->number)->orderBy('number')->first();

        return Inertia::render('Books/Unit', [
            'book' => [
                'slug' => (string) $book->slug,
                'title_en' => (string) $book->title_en,
                'title_fa' => $book->title_fa,
                'level' => $book->level,
                'url' => route('flashcards.book', ['book' => $book->slug]),
            ],
            'unit' => [
                'number' => (int) $unitModel->number,
                'title_en' => (string) $unitModel->title_en,
                'title_fa' => $unitModel->title_fa,
                'subtitle' => $unitModel->subtitle,
                'flashcards_url' => route('flashcards.unit', [
                    'book' => $book->slug,
                    'unit' => $unitModel->number,
                ]),
                'results_url' => route('flashcards.results', [
                    'book' => $book->slug,
                    'unit' => $unitModel->number,
                ]),
                'previous_url' => $previous === null ? null : route('books.unit', [
                    'book' => $book->slug,
                    'unit' => $previous->number,
                ]),
                'next_url' => $next === null ? null : route('books.unit', [
                    'book' => $book->slug,
                    'unit' => $next->number,
                ]),
            ],
            'progress' => [
                'questions' => $items->count(),
                'answered' => $answered,
            ],
            'set' => $set === null || $items->isEmpty() ? null : [
                'title' => (string) $set->title,
                'instructions_fa' => (string) $set->instructions_fa,
                'source' => is_array($set->source) ? $set->source : null,
            ],
            'topics' => $set === null
                ? []
                : $set->topics->map(fn ($topic): array => ExercisePresenter::topic($topic))->all(),
            'items' => $items
                ->map(fn ($item): array => ExercisePresenter::item($item, $answers[$item->id] ?? null))
                ->all(),
            'answer_url' => route('exercises.answer', [
                'book' => $book->slug,
                'unit' => $unitModel->number,
            ]),
            'flashcards' => [
                'cards_count' => $counts['total'],
                'known_count' => $counts['known'],
                'unknown_count' => $counts['unknown'],
                'url' => route('flashcards.unit', [
                    'book' => $book->slug,
                    'unit' => $unitModel->number,
                ]),
            ],
        ]);
    }

    private function learner(Request $request): User
    {
        $user = $request->user();
        abort_if($user === null || $user->disabled_at !== null, 403);

        return $user;
    }
}

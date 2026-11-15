<?php

namespace App\Http\Controllers;

use App\Models\FlashcardBook;
use App\Models\FlashcardUnit;
use App\Models\User;
use App\Models\UserFlashcard;
use App\Support\Flashcards\FlashcardPresenter;
use App\Support\Flashcards\FlashcardProgress;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/**
 * One unit = one flashcard session. The unit page is the player: cards in
 * book order, image first, then the word/audio after three seconds. The
 * results page groups every card by its latest self-report.
 */
class FlashcardUnitController extends Controller
{
    public function show(Request $request, FlashcardBook $book, int $unit): Response
    {
        abort_unless($book->status === 'published', 404);

        $user = $this->learner($request);
        $unitModel = $this->unit($book, $unit);
        $cards = $this->cards($user, $unitModel);
        $onlyWrong = $request->query('only') === 'again';

        if ($onlyWrong) {
            $cards = array_values(array_filter(
                $cards,
                fn (array $card): bool => $card['last_rating'] === 'again',
            ));
        }

        return Inertia::render('Flashcards/Unit', [
            'book' => $this->bookSummary($book),
            'unit' => $this->unitSummary($unitModel),
            'cards' => $cards,
            'study' => $book->studyConfig(),
            'counts' => FlashcardProgress::forUnit($user, $unitModel),
            'only' => $onlyWrong ? 'again' : null,
            'review_url' => route('flashcards.review'),
        ]);
    }

    public function results(Request $request, FlashcardBook $book, int $unit): Response
    {
        abort_unless($book->status === 'published', 404);

        $user = $this->learner($request);
        $unitModel = $this->unit($book, $unit);
        $cards = $this->cards($user, $unitModel);

        $known = array_values(array_filter($cards, fn (array $card): bool => $card['last_rating'] === 'good'));
        $unknown = array_values(array_filter($cards, fn (array $card): bool => $card['last_rating'] === 'again'));

        return Inertia::render('Flashcards/Results', [
            'book' => $this->bookSummary($book),
            'unit' => $this->unitSummary($unitModel),
            'known' => $known,
            'unknown' => $unknown,
            'counts' => FlashcardProgress::forUnit($user, $unitModel),
            'retry_url' => route('flashcards.unit', [
                'book' => $book->slug,
                'unit' => $unitModel->number,
                'only' => 'again',
            ]),
        ]);
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function cards(User $user, FlashcardUnit $unit): array
    {
        $cards = $unit->cards()->get();
        $states = UserFlashcard::query()
            ->where('user_id', $user->id)
            ->whereIn('flashcard_id', $cards->pluck('id'))
            ->get()
            ->keyBy('flashcard_id');

        return $cards
            ->map(fn ($card): array => FlashcardPresenter::card($card, $states->get($card->id)))
            ->values()
            ->all();
    }

    private function unit(FlashcardBook $book, int $number): FlashcardUnit
    {
        return $book->units()->where('number', $number)->firstOrFail();
    }

    /** @return array<string, mixed> */
    private function bookSummary(FlashcardBook $book): array
    {
        return [
            'slug' => (string) $book->slug,
            'title_en' => (string) $book->title_en,
            'title_fa' => $book->title_fa,
            'level' => $book->level,
            'url' => route('flashcards.book', ['book' => $book->slug]),
        ];
    }

    /** @return array<string, mixed> */
    private function unitSummary(FlashcardUnit $unit): array
    {
        return [
            'number' => (int) $unit->number,
            'title_en' => (string) $unit->title_en,
            'title_fa' => $unit->title_fa,
            'subtitle' => $unit->subtitle,
            'results_url' => route('flashcards.results', [
                'book' => $unit->book->slug,
                'unit' => $unit->number,
            ]),
        ];
    }

    private function learner(Request $request): User
    {
        $user = $request->user();
        abort_if($user === null || $user->disabled_at !== null, 403);

        return $user;
    }
}

<?php

namespace App\Http\Controllers;

use App\Http\Responses\NoStore;
use App\Models\Flashcard;
use App\Models\FlashcardReview;
use App\Models\User;
use App\Models\UserFlashcard;
use App\Support\Flashcards\FlashcardPresenter;
use App\Support\Flashcards\FlashcardProgress;
use App\Support\Flashcards\Scheduler;
use Illuminate\Database\QueryException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Daily review queue and the one write that advances a card.
 *
 * The client sends a stable `client_review_id` per answer, so a retried
 * request can never apply two schedules. The row lock + unique indexes make
 * a concurrent double-submit converge on one event; the loser reads the
 * current state and returns it instead of failing.
 */
class FlashcardReviewController extends Controller
{
    public function index(Request $request): Response
    {
        $user = $this->learner($request);
        $queue = FlashcardProgress::queue($user, (int) config('flashcards.daily_review_limit', 100));
        $dueTotal = FlashcardProgress::dueCount($user);

        $cards = [];
        $study = null;
        foreach ($queue as $state) {
            $card = $state->flashcard;
            if ($card === null) {
                continue;
            }

            $row = FlashcardPresenter::card($card, $state);
            $row['book_title'] = $card->unit?->book?->title_en;
            $row['book_slug'] = $card->unit?->book?->slug;
            $row['unit_title'] = $card->unit?->title_en;
            $row['unit_number'] = $card->unit?->number;
            $cards[] = $row;

            if ($study === null && $card->unit?->book !== null) {
                $study = $card->unit->book->studyConfig();
            }
        }

        return Inertia::render('Flashcards/Review', [
            'cards' => $cards,
            'study' => $study ?? [
                'reveal_delay_ms' => (int) config('flashcards.reveal_delay_ms', 3000),
                'auto_play_audio' => true,
                'show_phonetic' => true,
                'show_translation' => true,
            ],
            'counts' => [
                'due_total' => $dueTotal,
                'returned' => count($cards),
                'reviewed_today' => FlashcardProgress::reviewsToday($user),
            ],
            'next_due_at' => FlashcardProgress::nextDueAt($user)?->toIso8601String(),
            'books_url' => route('flashcards.index'),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $user = $this->learner($request);

        $data = $request->validate([
            'flashcard_id' => ['required', 'integer', 'exists:flashcards,id'],
            'rating' => ['required', 'in:again,good'],
            'client_review_id' => ['required', 'uuid'],
            'session_id' => ['nullable', 'uuid'],
            'duration_ms' => ['nullable', 'integer', 'min:0', 'max:600000'],
        ]);

        $card = Flashcard::query()
            ->with('unit.book')
            ->findOrFail((int) $data['flashcard_id']);

        if ($card->unit === null || $card->unit->book === null || $card->unit->book->status !== 'published') {
            abort(404);
        }

        $rating = (string) $data['rating'];
        $clientReviewId = (string) $data['client_review_id'];

        try {
            $result = DB::transaction(function () use ($user, $card, $rating, $clientReviewId, $data): array {
                $state = UserFlashcard::query()
                    ->where('user_id', $user->id)
                    ->where('flashcard_id', $card->id)
                    ->lockForUpdate()
                    ->first();

                $existing = FlashcardReview::query()
                    ->where('user_id', $user->id)
                    ->where('client_review_id', $clientReviewId)
                    ->exists();

                if ($existing) {
                    return ['state' => $state, 'duplicate' => true];
                }

                $current = $state?->schedulerState() ?? Scheduler::initial();
                $next = Scheduler::review(
                    $current,
                    $rating,
                    now()->toImmutable(),
                    (array) config('flashcards.scheduler', []),
                );

                if ($state === null) {
                    $state = new UserFlashcard([
                        'user_id' => $user->id,
                        'flashcard_id' => $card->id,
                    ]);
                }

                $state->fillSchedulerState($next);
                $state->save();

                FlashcardReview::create([
                    'user_id' => $user->id,
                    'flashcard_id' => $card->id,
                    'client_review_id' => $clientReviewId,
                    'session_id' => $data['session_id'] ?? null,
                    'rating' => $rating,
                    'was_new' => $current['phase'] === 'new',
                    'phase_before' => $current['phase'],
                    'phase_after' => $next['phase'],
                    'interval_before' => $current['interval_days'],
                    'interval_after' => $next['interval_days'],
                    'ease_before' => $current['ease'],
                    'ease_after' => $next['ease'],
                    'duration_ms' => $data['duration_ms'] ?? null,
                    'reviewed_at' => now(),
                ]);

                return ['state' => $state, 'duplicate' => false];
            });
        } catch (QueryException $e) {
            if (! $this->isUniqueViolation($e)) {
                throw $e;
            }

            $state = UserFlashcard::query()
                ->where('user_id', $user->id)
                ->where('flashcard_id', $card->id)
                ->first();

            return $this->payload($user, $card, $state, true);
        }

        return $this->payload($user, $card, $result['state'], $result['duplicate']);
    }

    private function payload(User $user, Flashcard $card, ?UserFlashcard $state, bool $duplicate): JsonResponse
    {
        return response()->json([
            'card_id' => $card->id,
            'phase' => $state?->phase,
            'due_at' => $state?->due_at?->toIso8601String(),
            'interval_days' => $state?->interval_days,
            'last_rating' => $state?->last_rating,
            'duplicate' => $duplicate,
            'counts' => FlashcardProgress::forUnit($user, $card->unit),
        ])->withHeaders(NoStore::headers());
    }

    private function isUniqueViolation(QueryException $e): bool
    {
        return $e->getCode() === '23505'
            || (($e->errorInfo[0] ?? null) === '23505');
    }

    private function learner(Request $request): User
    {
        $user = $request->user();
        abort_if($user === null || $user->disabled_at !== null, 403);

        return $user;
    }
}

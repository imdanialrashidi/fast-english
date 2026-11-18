<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Models\VocabularyWord;
use App\Support\Exercises\ExerciseProgress;
use App\Support\Flashcards\FlashcardProgress;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/**
 * One review hub across both tracks (owner request 2026-11-15): due
 * vocabulary words, due book cards, and mistakes from the latest exercise
 * attempt per set. The hub only reads; each queue keeps its own session.
 *
 * The primary action is deterministic: words first (the notebook is the
 * smallest commitment), then cards, then exercise mistakes.
 */
class ReviewController extends Controller
{
    public function index(Request $request): Response
    {
        $user = $this->learner($request);

        $wordsDue = VocabularyWord::query()
            ->where('user_id', $user->id)
            ->where('status', 'learning')
            ->where('due_at', '<=', now())
            ->count();

        $wordsLearning = VocabularyWord::query()
            ->where('user_id', $user->id)
            ->where('status', 'learning')
            ->count();

        $cardsDue = FlashcardProgress::dueCount($user);
        $nextCardDue = FlashcardProgress::nextDueAt($user);
        $mistakes = ExerciseProgress::mistakes($user);

        $total = $wordsDue + $cardsDue + $mistakes['wrong'];

        $primary = match (true) {
            $wordsDue > 0 => ['label' => 'شروع مرور واژه‌ها', 'url' => route('words.review')],
            $cardsDue > 0 => ['label' => 'شروع مرور کارت‌ها', 'url' => route('flashcards.review')],
            $mistakes['wrong'] > 0 && $mistakes['retry_url'] !== null => [
                'label' => 'تلاش دوبارهٔ تمرین',
                'url' => $mistakes['retry_url'],
            ],
            default => null,
        };

        return Inertia::render('Review/Index', [
            'total' => $total,
            'primary' => $primary,
            'words' => [
                'due' => $wordsDue,
                'learning' => $wordsLearning,
                'review_url' => route('words.review'),
                'notebook_url' => route('words.index'),
            ],
            'cards' => [
                'due' => $cardsDue,
                'next_due_at' => $nextCardDue?->toIso8601String(),
                'review_url' => route('flashcards.review'),
                'books_url' => route('flashcards.index'),
            ],
            'exercises' => $mistakes,
        ]);
    }

    private function learner(Request $request): User
    {
        $user = $request->user();
        abort_if($user === null || $user->disabled_at !== null, 403);

        return $user;
    }
}

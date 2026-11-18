<?php

namespace App\Http\Controllers;

use App\Http\Responses\NoStore;
use App\Models\Lesson;
use App\Models\User;
use App\Models\VocabularyWord;
use App\Models\WordAudio;
use App\Support\Flashcards\FlashcardPresenter;
use App\Support\SpacedRepetition;
use App\Support\Vocabulary;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

/**
 * One lesson's vocabulary deck (owner clarification 2026-11-15): the
 * lesson glossary is the deck, so an article with ten key words yields ten
 * cards. There is no entry cap.
 *
 * The card schedule is the vocabulary notebook's four-grade SM-2, not a
 * second flashcard scheduler: grading a card creates or updates the same
 * `vocabulary_words` row the notebook reads, so the deck and «واژه‌ها»
 * can never disagree. Cards are text-first; a word without an approved
 * audio clip is still playable, just silent.
 */
class LessonFlashcardController extends Controller
{
    public function show(Request $request, Lesson $lesson): Response
    {
        $lesson->loadMissing('topic');
        $this->ensurePublished($lesson);
        $user = $this->learner($request);

        [$cards, $counts] = $this->deck($user, $lesson);

        return Inertia::render('Flashcards/Lesson', [
            'lesson' => [
                'id' => (int) $lesson->id,
                'title_en' => (string) $lesson->title_en,
                'level' => (string) $lesson->level,
                'topic_slug' => (string) $lesson->topic->slug,
                'topic_title' => (string) $lesson->topic->title_en,
                'reader_url' => route('reader.show', [
                    'topic' => $lesson->topic->slug,
                    'level' => $lesson->level,
                ]),
            ],
            'cards' => $cards,
            'counts' => $counts,
            'study' => [
                'reveal_delay_ms' => 0,
                'auto_play_audio' => true,
                'show_phonetic' => false,
                'show_translation' => true,
            ],
            'review_url' => route('lessons.flashcards.store', ['lesson' => $lesson->id]),
            'back_url' => route('reader.show', [
                'topic' => $lesson->topic->slug,
                'level' => $lesson->level,
            ]),
        ]);
    }

    public function store(Request $request, Lesson $lesson): JsonResponse
    {
        $lesson->loadMissing('topic');
        $this->ensurePublished($lesson);
        $user = $this->learner($request);

        $data = $request->validate([
            'word_key' => ['required', 'string', 'max:120'],
            'rating' => ['required', 'in:again,hard,good,easy'],
            'duration_ms' => ['nullable', 'integer', 'min:0', 'max:600000'],
        ]);

        $key = Vocabulary::key((string) $data['word_key']);
        $entry = $this->entry($lesson, $key);

        if ($entry === null) {
            throw ValidationException::withMessages([
                'word_key' => 'این واژه در واژه‌های این درس نیست.',
            ]);
        }

        $rating = (string) $data['rating'];
        $now = now();

        $word = DB::transaction(function () use ($user, $lesson, $key, $entry, $rating, $now): VocabularyWord {
            $word = VocabularyWord::query()
                ->where('user_id', $user->id)
                ->where('word_key', $key)
                ->lockForUpdate()
                ->first();

            if ($word === null) {
                $word = new VocabularyWord([
                    'user_id' => $user->id,
                    'word' => (string) $entry['word'],
                    'word_key' => $key,
                    'meaning_fa' => (string) $entry['meaning_fa'],
                    'example_en' => $entry['example_en'] ?? null,
                    'lesson_id' => $lesson->id,
                    'topic_id' => $lesson->topic_id,
                    'status' => 'learning',
                    'ease_factor' => 2.5,
                    'interval_days' => 0,
                    'repetitions' => 0,
                    'lapses' => 0,
                    'due_at' => $now,
                ]);
            }

            // A mastered word stays mastered unless the learner says they
            // forgot it; then it re-enters learning from the current state.
            if ($word->status === 'known' && in_array($rating, ['good', 'easy'], true)) {
                $word->last_reviewed_at = $now;
                $word->save();

                return $word;
            }

            if ($word->status === 'known') {
                $word->status = 'learning';
            }

            $next = SpacedRepetition::schedule([
                'ease_factor' => (float) ($word->ease_factor ?? 2.5),
                'interval_days' => (int) ($word->interval_days ?? 0),
                'repetitions' => (int) ($word->repetitions ?? 0),
                'lapses' => (int) ($word->lapses ?? 0),
            ], $rating, $now);

            $word->fill([
                'ease_factor' => $next['ease_factor'],
                'interval_days' => $next['interval_days'],
                'repetitions' => $next['repetitions'],
                'lapses' => $next['lapses'],
                'due_at' => $next['due_at'],
                'last_reviewed_at' => $next['last_reviewed_at'],
            ])->save();

            return $word;
        });

        return response()->json([
            'word_key' => $key,
            'status' => $word->status,
            'due_at' => $word->due_at?->toIso8601String(),
            'interval_days' => $word->interval_days,
            'ease_factor' => $word->ease_factor,
            'duration_ms' => $data['duration_ms'] ?? null,
        ])->withHeaders(NoStore::headers());
    }

    /**
     * @return array{0: list<array<string, mixed>>, 1: array<string, int>}
     */
    private function deck(User $user, Lesson $lesson): array
    {
        $entries = $this->entries($lesson);
        $keys = array_keys($entries);

        $states = VocabularyWord::query()
            ->where('user_id', $user->id)
            ->whereIn('word_key', $keys)
            ->get()
            ->keyBy('word_key');

        $audios = WordAudio::query()
            ->approved()
            ->whereIn('word_key', $keys)
            ->get()
            ->keyBy('word_key');

        $cards = [];
        $counts = ['total' => 0, 'new' => 0, 'learning' => 0, 'known' => 0, 'due' => 0];

        foreach ($entries as $key => $entry) {
            $state = $states->get($key);
            $card = FlashcardPresenter::vocabCard($entry, $key, count($cards) + 1, $state, $audios->get($key));
            $cards[] = $card;
            $counts['total']++;

            if ($state === null) {
                $counts['new']++;
            } elseif ($state->status === 'known') {
                $counts['known']++;
            } else {
                $counts['learning']++;
                if ($state->due_at !== null && $state->due_at->lessThanOrEqualTo(now())) {
                    $counts['due']++;
                }
            }
        }

        return [$cards, $counts];
    }

    /**
     * The lesson glossary as one ordered key => entry map. A repeated word
     * is one card, not two, because the vocabulary notebook has one row per
     * word for the same learner.
     *
     * @return array<string, array{word: string, meaning_fa: string, example_en: ?string}>
     */
    private function entries(Lesson $lesson): array
    {
        $entries = is_array($lesson->glossary) ? $lesson->glossary : [];
        $map = [];

        foreach ($entries as $entry) {
            if (! is_array($entry)) {
                continue;
            }

            $key = Vocabulary::key((string) ($entry['word'] ?? ''));
            if ($key === '' || array_key_exists($key, $map)) {
                continue;
            }

            $map[$key] = [
                'word' => (string) $entry['word'],
                'meaning_fa' => (string) ($entry['meaning_fa'] ?? ''),
                'example_en' => $entry['example_en'] ?? null,
            ];
        }

        return $map;
    }

    /** @return array{word: string, meaning_fa: string, example_en: ?string}|null */
    private function entry(Lesson $lesson, string $key): ?array
    {
        return $this->entries($lesson)[$key] ?? null;
    }

    private function ensurePublished(Lesson $lesson): void
    {
        abort_unless(
            $lesson->status === 'published'
            && $lesson->topic !== null
            && $lesson->topic->status === 'published',
            404,
        );
    }

    private function learner(Request $request): User
    {
        $user = $request->user();
        abort_if($user === null || $user->disabled_at !== null, 403);

        return $user;
    }
}

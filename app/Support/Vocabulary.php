<?php

namespace App\Support;

use App\Models\Lesson;
use App\Models\User;
use App\Models\VocabularyWord;
use Carbon\CarbonInterface;
use Illuminate\Database\QueryException;
use Illuminate\Validation\ValidationException;

/**
 * Vocabulary notebook (VOCAB-01): one deep module behind the word write.
 *
 * Absorbs the caller-owned wiring around the pure SRS math — word_key
 * derivation, case-insensitive dedup, the learning-status guard,
 * glossary reuse, the first-review reset — so the controller becomes a
 * thin adapter (authorize, validate transport, delegate, render).
 *
 * The interface is the test surface (see D5VocabularyNotebookTest):
 * save() and grade() return rows and 422-shaped failures; pure math
 * stays in SpacedRepetition.
 */
final class Vocabulary
{
    public static function key(string $word): string
    {
        return mb_strtolower(trim($word));
    }

    /**
     * @return array{entry: VocabularyWord, created: bool, existingId: int|null}
     */
    public static function save(User $user, string $word, ?string $meaningFa, ?string $exampleEn, ?Lesson $lesson, CarbonInterface $now): array
    {
        $clean = trim($word);
        if ($clean === '') {
            throw ValidationException::withMessages(['word' => 'واژه نمی‌تواند خالی باشد.']);
        }

        $meaning = trim((string) ($meaningFa ?? ''));
        $example = trim((string) ($exampleEn ?? ''));

        if ($lesson !== null) {
            $match = Reading::glossaryMatch($lesson, $clean);
            if ($match !== null) {
                if ($meaning === '' && $match['meaning_fa'] !== '') {
                    $meaning = mb_substr($match['meaning_fa'], 0, 500);
                }
                if ($example === '' && $match['example_en'] !== '') {
                    $example = mb_substr($match['example_en'], 0, 500);
                }
            }
        }

        $existing = VocabularyWord::where('user_id', $user->id)
            ->where('word_key', self::key($clean))
            ->first();
        if ($existing !== null) {
            return ['entry' => $existing, 'created' => false, 'existingId' => $existing->id];
        }

        $initial = SpacedRepetition::initial($now);

        try {
            $entry = VocabularyWord::create([
                'user_id' => $user->id,
                'word' => mb_substr($clean, 0, 120),
                'meaning_fa' => $meaning !== '' ? mb_substr($meaning, 0, 500) : null,
                'example_en' => $example !== '' ? mb_substr($example, 0, 500) : null,
                'lesson_id' => $lesson?->id,
                'topic_id' => $lesson?->topic_id,
                'status' => 'learning',
                'ease_factor' => $initial['ease_factor'],
                'interval_days' => $initial['interval_days'],
                'repetitions' => $initial['repetitions'],
                'lapses' => $initial['lapses'],
                'due_at' => $initial['due_at'],
                'last_reviewed_at' => null,
            ]);
        } catch (QueryException $e) {
            // Concurrent double-submit: the loser hits the (user_id,
            // word_key) unique index. Converge onto the surviving row so
            // the caller renders the idempotent duplicate shape; any
            // other failure (no surviving row) rethrows.
            $surviving = VocabularyWord::where('user_id', $user->id)
                ->where('word_key', self::key($clean))
                ->first();
            if ($surviving === null) {
                throw $e;
            }

            return ['entry' => $surviving, 'created' => false, 'existingId' => $surviving->id];
        }

        return ['entry' => $entry->fresh(), 'created' => true, 'existingId' => null];
    }

    /**
     * @return array{entry: VocabularyWord, remaining: int}
     */
    public static function grade(User $user, VocabularyWord $word, string $grade, CarbonInterface $now): array
    {
        if ((int) $word->user_id !== (int) $user->id) {
            throw ValidationException::withMessages(['word' => 'این واژه متعلق به شما نیست.']);
        }

        if ($word->status !== 'learning') {
            throw ValidationException::withMessages(['word' => 'این واژه در برنامه مرور نیست.']);
        }

        $next = SpacedRepetition::schedule([
            'ease_factor' => (float) $word->ease_factor,
            'interval_days' => (int) $word->interval_days,
            'repetitions' => (int) $word->repetitions,
            'lapses' => (int) $word->lapses,
        ], $grade, $now);

        $word->forceFill([
            'ease_factor' => $next['ease_factor'],
            'interval_days' => $next['interval_days'],
            'repetitions' => $next['repetitions'],
            'lapses' => $next['lapses'],
            'due_at' => $next['due_at'],
            'last_reviewed_at' => $next['last_reviewed_at'],
        ])->save();

        $remaining = VocabularyWord::where('user_id', $user->id)
            ->where('status', 'learning')
            ->where('due_at', '<=', $now)
            ->count();

        return ['entry' => $word->fresh(), 'remaining' => $remaining];
    }

    /**
     * Note/status patch shape: only keys the client actually sent are
     * returned. Pass null for absent keys; empty status means no change.
     * The learning-without-review reset (due now) lives here, not in the
     * controller.
     *
     * @return array<string, mixed>
     */
    public static function noteUpdates(VocabularyWord $word, bool $hasMeaning, ?string $meaningFa, bool $hasExample, ?string $exampleEn, ?string $status, CarbonInterface $now): array
    {
        $updates = [];
        if ($hasMeaning) {
            $meaning = trim((string) $meaningFa);
            $updates['meaning_fa'] = $meaning !== '' ? $meaning : null;
        }
        if ($hasExample) {
            $example = trim((string) $exampleEn);
            $updates['example_en'] = $example !== '' ? $example : null;
        }
        if ($status !== null && $status !== '') {
            $updates['status'] = $status;
            if ($status === 'learning' && $word->last_reviewed_at === null) {
                $updates['due_at'] = $now->copy();
            }
        }

        return $updates;
    }
}

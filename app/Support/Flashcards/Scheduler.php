<?php

namespace App\Support\Flashcards;

use Carbon\CarbonImmutable;
use Carbon\CarbonInterface;
use InvalidArgumentException;

/**
 * Two-grade, Anki-style scheduler shared by every flashcard screen.
 *
 * The learner only reports "درست گفتم" (good) or "درست نگفتم" (again); the
 * scheduler decides the next meeting. New cards walk [1, 10] minute learning
 * steps; a correct answer on the last step graduates to one day. A review
 * card that lapses loses ease, enters relearning at ten minutes and returns
 * to one day after a correct relearning answer. A correct review grows by
 * the current ease, capped at 180 days.
 *
 * Pure on purpose: inputs (state, rating, now, config) -> next state. Tests
 * assert exact timestamps without the clock, the database, or the network.
 */
final class Scheduler
{
    public const RATINGS = ['again', 'good'];

    public const PHASES = ['new', 'learning', 'review', 'relearning'];

    public const DEFAULT_CONFIG = [
        'learning_steps_minutes' => [1, 10],
        'lapse_steps_minutes' => [10],
        'graduating_interval_days' => 1,
        'lapse_interval_days' => 1,
        'minimum_ease' => 1.3,
        'maximum_ease' => 3.0,
        'ease_penalty' => 0.2,
        'max_interval_days' => 180,
    ];

    /**
     * @return array{phase: string, step: int, due_at: CarbonImmutable|null, interval_days: int, ease: float, reps: int, lapses: int, last_rating: string|null, last_reviewed_at: CarbonImmutable|null}
     */
    public static function initial(): array
    {
        return [
            'phase' => 'new',
            'step' => 0,
            'due_at' => null,
            'interval_days' => 0,
            'ease' => 2.5,
            'reps' => 0,
            'lapses' => 0,
            'last_rating' => null,
            'last_reviewed_at' => null,
        ];
    }

    /**
     * @param  array<string, mixed>  $state
     * @param  array<string, mixed>  $config
     * @return array{phase: string, step: int, due_at: CarbonImmutable|null, interval_days: int, ease: float, reps: int, lapses: int, last_rating: string|null, last_reviewed_at: CarbonImmutable|null}
     *
     * @throws InvalidArgumentException
     */
    public static function review(array $state, string $rating, CarbonImmutable $now, array $config = []): array
    {
        if (! in_array($rating, self::RATINGS, true)) {
            throw new InvalidArgumentException('The flashcard rating must be again or good.');
        }

        $c = array_replace(self::DEFAULT_CONFIG, $config);
        $base = array_replace(self::initial(), $state);

        $phase = (string) $base['phase'];
        $step = max(0, (int) $base['step']);
        $interval = max(0, (int) $base['interval_days']);
        $ease = (float) $base['ease'];
        $reps = max(0, (int) $base['reps']);
        $lapses = max(0, (int) $base['lapses']);

        $minimumEase = (float) $c['minimum_ease'];
        $maximumEase = (float) $c['maximum_ease'];
        $maximumInterval = max(1, (int) $c['max_interval_days']);

        if ($rating === 'again') {
            $isReview = $phase === 'review' || $phase === 'relearning';
            $steps = $isReview ? (array) $c['lapse_steps_minutes'] : (array) $c['learning_steps_minutes'];

            return [
                'phase' => $isReview ? 'relearning' : 'learning',
                'step' => 0,
                'due_at' => $now->addMinutes(max(1, (int) ($steps[0] ?? 1))),
                'interval_days' => $isReview ? 0 : $interval,
                'ease' => $phase === 'review'
                    ? self::clampFloat($ease - (float) $c['ease_penalty'], $minimumEase, $maximumEase)
                    : $ease,
                'reps' => $reps,
                // A lapse is counted once, on review -> again. Another
                // "again" inside relearning must not inflate the count.
                'lapses' => $phase === 'review' ? $lapses + 1 : $lapses,
                'last_rating' => 'again',
                'last_reviewed_at' => $now,
            ];
        }

        if ($phase === 'new' || $phase === 'learning') {
            $steps = array_values((array) $c['learning_steps_minutes']);
            $nextStep = $phase === 'new' ? 1 : $step + 1;

            if ($nextStep < count($steps)) {
                return [
                    'phase' => 'learning',
                    'step' => $nextStep,
                    'due_at' => $now->addMinutes(max(1, (int) ($steps[$nextStep] ?? $steps[0] ?? 1))),
                    'interval_days' => 0,
                    'ease' => $ease,
                    'reps' => $reps,
                    'lapses' => $lapses,
                    'last_rating' => 'good',
                    'last_reviewed_at' => $now,
                ];
            }

            $graduating = self::clampInt((int) $c['graduating_interval_days'], 1, $maximumInterval);

            return [
                'phase' => 'review',
                'step' => 0,
                'due_at' => $now->addDays($graduating),
                'interval_days' => $graduating,
                'ease' => $ease,
                'reps' => $reps + 1,
                'lapses' => $lapses,
                'last_rating' => 'good',
                'last_reviewed_at' => $now,
            ];
        }

        if ($phase === 'relearning') {
            $lapseInterval = self::clampInt((int) $c['lapse_interval_days'], 1, $maximumInterval);

            return [
                'phase' => 'review',
                'step' => 0,
                'due_at' => $now->addDays($lapseInterval),
                'interval_days' => $lapseInterval,
                'ease' => $ease,
                'reps' => $reps + 1,
                'lapses' => $lapses,
                'last_rating' => 'good',
                'last_reviewed_at' => $now,
            ];
        }

        $nextInterval = self::clampInt(
            (int) round(max(1, $interval) * $ease),
            1,
            $maximumInterval,
        );

        return [
            'phase' => 'review',
            'step' => 0,
            'due_at' => $now->addDays($nextInterval),
            'interval_days' => $nextInterval,
            'ease' => $ease,
            'reps' => $reps + 1,
            'lapses' => $lapses,
            'last_rating' => 'good',
            'last_reviewed_at' => $now,
        ];
    }

    /**
     * @param  array<string, mixed>  $state
     */
    public static function isDue(array $state, CarbonImmutable $now): bool
    {
        $phase = (string) ($state['phase'] ?? 'new');
        $dueAt = $state['due_at'] ?? null;

        return $phase !== 'new'
            && $dueAt instanceof CarbonInterface
            && $dueAt->lessThanOrEqualTo($now);
    }

    private static function clampInt(int $value, int $minimum, int $maximum): int
    {
        return max($minimum, min($maximum, $value));
    }

    private static function clampFloat(float $value, float $minimum, float $maximum): float
    {
        return round(max($minimum, min($maximum, $value)), 2);
    }
}

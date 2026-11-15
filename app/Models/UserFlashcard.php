<?php

namespace App\Models;

use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Per-learner schedule for one card. `phase`/`step`/`due_at`/`ease_factor`
 * mirror the pure scheduler state; `last_rating` is the source of the
 * "درست گفتم / درست نگفتم" buckets.
 */
class UserFlashcard extends Model
{
    protected $fillable = [
        'user_id',
        'flashcard_id',
        'phase',
        'step',
        'due_at',
        'interval_days',
        'ease_factor',
        'reps',
        'lapses',
        'last_rating',
        'last_reviewed_at',
    ];

    protected function casts(): array
    {
        return [
            'step' => 'integer',
            'due_at' => 'datetime',
            'interval_days' => 'integer',
            'ease_factor' => 'float',
            'reps' => 'integer',
            'lapses' => 'integer',
            'last_reviewed_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function flashcard(): BelongsTo
    {
        return $this->belongsTo(Flashcard::class, 'flashcard_id');
    }

    /** @return array{phase: string, step: int, due_at: CarbonImmutable|null, interval_days: int, ease: float, reps: int, lapses: int, last_rating: string|null, last_reviewed_at: CarbonImmutable|null} */
    public function schedulerState(): array
    {
        return [
            'phase' => (string) $this->phase,
            'step' => (int) $this->step,
            'due_at' => $this->due_at?->toImmutable(),
            'interval_days' => (int) $this->interval_days,
            'ease' => (float) $this->ease_factor,
            'reps' => (int) $this->reps,
            'lapses' => (int) $this->lapses,
            'last_rating' => $this->last_rating,
            'last_reviewed_at' => $this->last_reviewed_at?->toImmutable(),
        ];
    }

    /**
     * Apply a pure scheduler result to this row without saving so the caller
     * can keep the state update and the review-log insert in one transaction.
     *
     * @param  array{phase: string, step: int, due_at: CarbonImmutable|null, interval_days: int, ease: float, reps: int, lapses: int, last_rating: string|null, last_reviewed_at: CarbonImmutable|null}  $state
     */
    public function fillSchedulerState(array $state): void
    {
        $this->forceFill([
            'phase' => $state['phase'],
            'step' => $state['step'],
            'due_at' => $state['due_at'],
            'interval_days' => $state['interval_days'],
            'ease_factor' => $state['ease'],
            'reps' => $state['reps'],
            'lapses' => $state['lapses'],
            'last_rating' => $state['last_rating'],
            'last_reviewed_at' => $state['last_reviewed_at'],
        ]);
    }
}

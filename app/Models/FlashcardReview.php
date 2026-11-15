<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Append-only review event. `client_review_id` is the idempotency key: a
 * network retry with the same id never applies a second schedule. The
 * before/after snapshot is kept for undo/analytics and content QA.
 */
class FlashcardReview extends Model
{
    protected $fillable = [
        'user_id',
        'flashcard_id',
        'client_review_id',
        'session_id',
        'rating',
        'was_new',
        'phase_before',
        'phase_after',
        'interval_before',
        'interval_after',
        'ease_before',
        'ease_after',
        'duration_ms',
        'reviewed_at',
    ];

    protected function casts(): array
    {
        return [
            'was_new' => 'boolean',
            'interval_before' => 'integer',
            'interval_after' => 'integer',
            'ease_before' => 'float',
            'ease_after' => 'float',
            'duration_ms' => 'integer',
            'reviewed_at' => 'datetime',
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
}

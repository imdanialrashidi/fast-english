<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * One stored response. The raw value is whatever the type expects (choice
 * index, text, or token order) and is kept for the result page and audit.
 */
class ExerciseAnswer extends Model
{
    protected $fillable = [
        'attempt_id',
        'item_id',
        'response',
        'is_correct',
    ];

    protected function casts(): array
    {
        return [
            'response' => 'array',
            'is_correct' => 'boolean',
        ];
    }

    public function attempt(): BelongsTo
    {
        return $this->belongsTo(ExerciseAttempt::class, 'attempt_id');
    }

    public function item(): BelongsTo
    {
        return $this->belongsTo(ExerciseItem::class, 'item_id');
    }
}

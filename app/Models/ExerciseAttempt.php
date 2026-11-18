<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * One submitted attempt. Owner-scoped: a learner never sees another
 * learner's attempt, score, or answers.
 */
class ExerciseAttempt extends Model
{
    protected $fillable = [
        'user_id',
        'set_id',
        'score',
        'total',
        'submitted_at',
    ];

    protected function casts(): array
    {
        return [
            'score' => 'integer',
            'total' => 'integer',
            'submitted_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function set(): BelongsTo
    {
        return $this->belongsTo(ExerciseSet::class, 'set_id');
    }

    public function answers(): HasMany
    {
        return $this->hasMany(ExerciseAnswer::class, 'attempt_id');
    }
}

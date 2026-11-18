<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * One exercise question. `options` is the client-facing choice/token list;
 * `answer` is the server-only key (choice index, accepted strings, or the
 * correct sentence). Neither `answer` nor `explanation_fa` may enter a
 * pre-submit payload.
 */
class ExerciseItem extends Model
{
    protected $fillable = [
        'set_id',
        'topic_id',
        'external_id',
        'position',
        'type',
        'prompt',
        'options',
        'answer',
        'explanation_fa',
        'feedback',
        'points',
    ];

    protected function casts(): array
    {
        return [
            'position' => 'integer',
            'options' => 'array',
            'answer' => 'array',
            'feedback' => 'array',
            'points' => 'integer',
        ];
    }

    public function set(): BelongsTo
    {
        return $this->belongsTo(ExerciseSet::class, 'set_id');
    }

    public function topic(): BelongsTo
    {
        return $this->belongsTo(ExerciseTopic::class, 'topic_id');
    }
}

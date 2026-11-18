<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * One grammar topic of a unit's exercise set: the Persian explanation, the
 * sentence formulas and short examples the learner reads before answering
 * the topic's questions. Content only.
 */
class ExerciseTopic extends Model
{
    protected $fillable = [
        'set_id',
        'key',
        'position',
        'title_en',
        'title_fa',
        'use_fa',
        'formulas',
        'examples',
        'notes_fa',
    ];

    protected function casts(): array
    {
        return [
            'position' => 'integer',
            'formulas' => 'array',
            'examples' => 'array',
        ];
    }

    public function set(): BelongsTo
    {
        return $this->belongsTo(ExerciseSet::class, 'set_id');
    }

    public function items(): HasMany
    {
        return $this->hasMany(ExerciseItem::class, 'topic_id')->orderBy('position');
    }
}

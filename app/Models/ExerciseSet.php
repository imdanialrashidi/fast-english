<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * One exercise set for a book unit (or a lesson). Content only: learner
 * attempts live in `exercise_attempts` and never become part of the set.
 */
class ExerciseSet extends Model
{
    protected $fillable = [
        'external_id',
        'unit_id',
        'lesson_id',
        'title',
        'instructions_fa',
        'status',
        'sort_order',
        'source',
    ];

    protected function casts(): array
    {
        return [
            'sort_order' => 'integer',
            'source' => 'array',
        ];
    }

    public function unit(): BelongsTo
    {
        return $this->belongsTo(FlashcardUnit::class, 'unit_id');
    }

    public function lesson(): BelongsTo
    {
        return $this->belongsTo(Lesson::class);
    }

    public function topics(): HasMany
    {
        return $this->hasMany(ExerciseTopic::class, 'set_id')->orderBy('position');
    }

    public function items(): HasMany
    {
        return $this->hasMany(ExerciseItem::class, 'set_id')->orderBy('position');
    }

    public function attempts(): HasMany
    {
        return $this->hasMany(ExerciseAttempt::class, 'set_id');
    }

    /** @param  Builder<ExerciseSet>  $query */
    public function scopePublished(Builder $query): void
    {
        $query->where('status', 'published');
    }
}

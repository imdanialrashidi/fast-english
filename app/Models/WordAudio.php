<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;

/**
 * One approved word clip for flashcard decks. Content, not learner state:
 * the same clip serves every learner and every lesson that lists the word.
 * Files live on the private disk; the route serves bytes only after the
 * subscription gate (owner clarification 2026-11-15).
 */
class WordAudio extends Model
{
    protected $table = 'word_audio';

    protected $fillable = [
        'word_key',
        'path',
        'source',
        'voice',
        'seed',
        'duration_ms',
        'status',
        'checked_by',
        'checked_at',
    ];

    protected function casts(): array
    {
        return [
            'seed' => 'integer',
            'duration_ms' => 'integer',
            'checked_at' => 'datetime',
        ];
    }

    /** @param  Builder<WordAudio>  $query */
    public function scopeApproved(Builder $query): void
    {
        $query->where('status', 'approved');
    }
}

<?php

namespace App\Models;

use App\Support\Vocabulary;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class VocabularyWord extends Model
{
    /** @use HasFactory<VocabularyWordFactory> */
    use HasFactory;

    protected $fillable = [
        'user_id',
        'word',
        'word_key',
        'meaning_fa',
        'example_en',
        'lesson_id',
        'topic_id',
        'status',
        'ease_factor',
        'interval_days',
        'repetitions',
        'lapses',
        'due_at',
        'last_reviewed_at',
    ];

    protected function casts(): array
    {
        return [
            'ease_factor' => 'float',
            'interval_days' => 'integer',
            'repetitions' => 'integer',
            'lapses' => 'integer',
            'due_at' => 'datetime',
            'last_reviewed_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function lesson(): BelongsTo
    {
        return $this->belongsTo(Lesson::class);
    }

    public function topic(): BelongsTo
    {
        return $this->belongsTo(Topic::class);
    }

    public function getIsDueAttribute(): bool
    {
        return $this->status === 'learning'
            && $this->due_at !== null
            && $this->due_at <= now();
    }

    protected static function booted(): void
    {
        static::saving(function (VocabularyWord $entry) {
            $entry->word_key = Vocabulary::key((string) $entry->word);
        });
    }
}

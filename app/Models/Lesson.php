<?php

namespace App\Models;

use App\Support\Glossary;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\Storage;

#[Hidden(['audio_path'])]
class Lesson extends Model
{
    /** @use HasFactory<LessonFactory> */
    use HasFactory;

    protected $fillable = [
        'topic_id',
        'level',
        'title_en',
        'body_en',
        'glossary',
        'audio_path',
        'audio_revision',
        'duration_seconds',
        'estimated_minutes',
        'is_public_sample',
        'status',
        'reviewed_by',
        'reviewed_at',
        'published_at',
    ];

    protected function casts(): array
    {
        return [
            'glossary' => 'array',
            'audio_revision' => 'integer',
            'duration_seconds' => 'integer',
            'estimated_minutes' => 'integer',
            'is_public_sample' => 'boolean',
            'reviewed_at' => 'datetime',
            'published_at' => 'datetime',
        ];
    }

    public function topic(): BelongsTo
    {
        return $this->belongsTo(Topic::class);
    }

    public function reviewer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reviewed_by');
    }

    protected static function booted(): void
    {
        static::saving(function (Lesson $lesson) {
            // Glossary is stored as validated JSON: normalize on write.
            if ($lesson->isDirty('glossary') && $lesson->glossary !== null) {
                $lesson->glossary = Glossary::validate($lesson->glossary);
            }

            // Scope §9.3: replacing the audio file increments the revision;
            // a title change or typo fix leaves it untouched.
            if ($lesson->exists && $lesson->isDirty('audio_path')) {
                $lesson->audio_revision = ((int) $lesson->getOriginal('audio_revision')) + 1;
            }
        });

        // Same archive-instead-of-delete rule as topics: only a draft that
        // was never published may be deleted; its private audio is removed.
        static::deleting(function (Lesson $lesson) {
            if ($lesson->status !== 'draft' || $lesson->published_at !== null) {
                throw new \RuntimeException(
                    'A lesson that was published cannot be deleted; archive it instead.'
                );
            }

            if (is_string($lesson->audio_path) && $lesson->audio_path !== '') {
                Storage::disk('local')->delete($lesson->audio_path);
            }
        });
    }
}

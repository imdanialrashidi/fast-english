<?php

namespace App\Models;

use App\Support\TedContent;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\Storage;

/**
 * One TED Talk in the seventh reader tab (owner request 2026-11-21).
 *
 * A talk is content attached to at most one published topic; it is not a
 * CEFR lesson. Audio lives on the private disk and is served through the
 * policy-checked media route. `segments` is the sentence/cue stream the
 * reader highlights; it never travels before authorization.
 */
#[Hidden(['audio_path'])]
class TedTalk extends Model
{
    /** @use HasFactory<TedTalkFactory> */
    use HasFactory;

    protected $fillable = [
        'topic_id',
        'slug',
        'title_en',
        'speaker',
        'area',
        'duration_seconds',
        'audio_path',
        'audio_revision',
        'cover_path',
        'segments',
        'words',
        'source_url',
        'source_license',
        'license_note',
        'status',
        'reviewed_by',
        'reviewed_at',
        'published_at',
    ];

    protected function casts(): array
    {
        return [
            'segments' => 'array',
            'words' => 'array',
            'duration_seconds' => 'integer',
            'audio_revision' => 'integer',
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

    /**
     * @param  Builder<TedTalk>  $query
     * @return Builder<TedTalk>
     */
    public function scopePublished(Builder $query): Builder
    {
        return $query->where('status', 'published');
    }

    public function isPublished(): bool
    {
        return $this->status === 'published' && $this->published_at !== null;
    }

    public function estimatedMinutes(): int
    {
        return max(1, (int) round($this->duration_seconds / 60));
    }

    protected static function booted(): void
    {
        static::saving(function (TedTalk $talk) {
            if ($talk->isDirty('segments')) {
                $talk->segments = TedContent::segments($talk->segments);
            }
            if ($talk->isDirty('words')) {
                $talk->words = TedContent::words($talk->words);
            }

            // Replacing the audio is a new version; a text or metadata edit
            // keeps the same revision and therefore the same progress row.
            if ($talk->exists && $talk->isDirty('audio_path')) {
                $talk->audio_revision = ((int) $talk->getOriginal('audio_revision')) + 1;
            }
        });

        static::deleting(function (TedTalk $talk) {
            if ($talk->status !== 'draft' || $talk->published_at !== null) {
                throw new \RuntimeException('A published TED talk cannot be deleted; archive it instead.');
            }

            if (is_string($talk->audio_path) && $talk->audio_path !== '') {
                Storage::disk('local')->delete($talk->audio_path);
            }
            if (is_string($talk->cover_path) && $talk->cover_path !== '') {
                Storage::disk('public')->delete($talk->cover_path);
            }
        });
    }
}

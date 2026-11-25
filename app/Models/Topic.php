<?php

namespace App\Models;

use App\Support\CoverImage;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Support\Facades\Storage;

class Topic extends Model
{
    /** @use HasFactory<TopicFactory> */
    use HasFactory;

    protected $fillable = [
        'category_id',
        'slug',
        'title_en',
        'summary_public',
        'summary_a1_en',
        'cover_path',
        'source_note',
        'status',
        'published_at',
    ];

    protected function casts(): array
    {
        return [
            'published_at' => 'datetime',
        ];
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(Category::class);
    }

    public function lessons(): HasMany
    {
        return $this->hasMany(Lesson::class);
    }

    public function bookmarks(): HasMany
    {
        return $this->hasMany(Bookmark::class);
    }

    /**
     * The seventh reader tab. One published talk per topic at most; the
     * unique index on ted_talks.topic_id owns that rule.
     */
    public function tedTalk(): HasOne
    {
        return $this->hasOne(TedTalk::class);
    }

    protected static function booted(): void
    {
        // Every cover write re-encodes through GD (metadata stripped).
        // Deleting the cover (null) removes the stored file instead.
        static::saving(function (Topic $topic) {
            if (! $topic->isDirty('cover_path')) {
                return;
            }

            $original = $topic->getOriginal('cover_path');

            if ($topic->cover_path === null || trim($topic->cover_path) === '') {
                $topic->cover_path = null;
                if (is_string($original) && $original !== '') {
                    Storage::disk('public')->delete($original);
                }

                return;
            }

            CoverImage::reencode($topic->cover_path);

            if (is_string($original) && $original !== '' && $original !== $topic->cover_path) {
                Storage::disk('public')->delete($original);
            }
        });

        // Scope §9: archive instead of delete once a topic has usage
        // history. Only a draft that was never published may be deleted:
        // anything published or archived (or stamped with a publication
        // time) is refused here and must be archived instead.
        static::deleting(function (Topic $topic) {
            if ($topic->status !== 'draft' || $topic->published_at !== null) {
                throw new \RuntimeException(
                    'A topic that was published cannot be deleted; archive it instead.'
                );
            }

            foreach ($topic->lessons()->get() as $lesson) {
                $lesson->delete();
            }
            if (is_string($topic->cover_path) && $topic->cover_path !== '') {
                Storage::disk('public')->delete($topic->cover_path);
            }
        });
    }
}

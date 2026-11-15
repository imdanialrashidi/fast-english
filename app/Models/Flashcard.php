<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * One picture-prompt vocabulary card. The image is the prompt (front only);
 * the word, IPA and Persian meaning are revealed after three seconds and the
 * audio is played. Cards are content, not user state.
 */
class Flashcard extends Model
{
    protected $fillable = [
        'unit_id',
        'external_id',
        'word',
        'display',
        'phonetic',
        'translation_fa',
        'definition_en',
        'example_en',
        'part_of_speech',
        'lesson_code',
        'topic',
        'image_path',
        'audio_path',
        'sort_order',
    ];

    protected function casts(): array
    {
        return [
            'sort_order' => 'integer',
        ];
    }

    public function unit(): BelongsTo
    {
        return $this->belongsTo(FlashcardUnit::class, 'unit_id');
    }

    public function states(): HasMany
    {
        return $this->hasMany(UserFlashcard::class, 'flashcard_id');
    }

    public function reviews(): HasMany
    {
        return $this->hasMany(FlashcardReview::class, 'flashcard_id');
    }

    /** The revealed label: the dataset's `display` when present, else the headword. */
    public function label(): string
    {
        $display = trim((string) ($this->display ?? ''));

        return $display !== '' ? $display : (string) $this->word;
    }
}

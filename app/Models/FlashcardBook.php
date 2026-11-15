<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasManyThrough;

/**
 * One book of flashcards (AEF Starter first). Units hang off the book and
 * cards hang off the units; user progress lives in user_flashcards so a
 * content re-import never resets a learner's schedule.
 */
class FlashcardBook extends Model
{
    protected $fillable = [
        'slug',
        'title_en',
        'title_fa',
        'level',
        'edition',
        'cover_path',
        'study_config',
        'status',
        'sort_order',
    ];

    protected function casts(): array
    {
        return [
            'study_config' => 'array',
        ];
    }

    public function units(): HasMany
    {
        return $this->hasMany(FlashcardUnit::class, 'book_id');
    }

    public function cards(): HasManyThrough
    {
        return $this->hasManyThrough(Flashcard::class, FlashcardUnit::class, 'book_id', 'unit_id');
    }

    /**
     * UI study settings imported from the dataset, with safe defaults.
     *
     * @return array{reveal_delay_ms: int, auto_play_audio: bool, show_phonetic: bool, show_translation: bool}
     */
    public function studyConfig(): array
    {
        $stored = is_array($this->study_config) ? $this->study_config : [];

        return [
            'reveal_delay_ms' => self::intSetting($stored, 'revealDelayMs', (int) config('flashcards.reveal_delay_ms', 3000)),
            'auto_play_audio' => self::boolSetting($stored, 'autoPlayAudio', true),
            'show_phonetic' => self::boolSetting($stored, 'showPhonetic', true),
            'show_translation' => self::boolSetting($stored, 'showTranslation', true),
        ];
    }

    /** @param array<string, mixed> $stored */
    private static function intSetting(array $stored, string $key, int $default): int
    {
        return isset($stored[$key]) && is_numeric($stored[$key]) ? (int) $stored[$key] : $default;
    }

    /** @param array<string, mixed> $stored */
    private static function boolSetting(array $stored, string $key, bool $default): bool
    {
        return isset($stored[$key]) ? (bool) $stored[$key] : $default;
    }
}

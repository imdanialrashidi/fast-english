<?php

namespace App\Support\Flashcards;

use App\Models\FlashcardBook;
use App\Models\FlashcardUnit;
use App\Models\VocabularyWord;
use App\Models\WordAudio;

/**
 * One shape per books payload. The shelf, the book page and the unit hub
 * read the same keys, so a change lands in all three at once.
 */
final class FlashcardPresenter
{
    /**
     * @param  array<string, mixed>|null  $exercise
     * @return array<string, mixed>
     */
    public static function book(FlashcardBook $book, int $unitsCount, ?array $exercise = null): array
    {
        return [
            'slug' => (string) $book->slug,
            'title_en' => (string) $book->title_en,
            'title_fa' => $book->title_fa,
            'level' => $book->level,
            'edition' => $book->edition,
            'units_count' => $unitsCount,
            'exercise' => $exercise,
            'cover_url' => self::coverUrl((string) $book->slug),
            'url' => route('flashcards.book', ['book' => $book->slug]),
        ];
    }

    /**
     * Real coursebook cover when the owner-supplied asset exists; null keeps
     * the quiet typographic fallback instead of inventing a cover.
     */
    private static function coverUrl(string $slug): ?string
    {
        $name = str_replace('aef-3e-', '', $slug);
        $relative = "/images/books/aef/{$name}.webp";

        return is_file(public_path(ltrim($relative, '/'))) ? $relative : null;
    }

    /**
     * One glossary card on an article deck. Cards are vocabulary state, not
     * book content: the same word keeps one schedule wherever it appears.
     * A word without an approved clip is still a valid card; the player
     * simply hides the speaker action.
     *
     * @param  array{word: string, meaning_fa: string, example_en: ?string}  $entry
     * @return array<string, mixed>
     */
    public static function vocabCard(
        array $entry,
        string $key,
        int $position,
        ?VocabularyWord $state = null,
        ?WordAudio $audio = null,
    ): array {
        return [
            'id' => $position,
            'word_key' => $key,
            'word' => (string) $entry['word'],
            'headword' => (string) $entry['word'],
            'phonetic' => null,
            'translation_fa' => (string) $entry['meaning_fa'],
            'definition_en' => null,
            'example_en' => $entry['example_en'] ?? null,
            'part_of_speech' => null,
            'audio_url' => $audio !== null ? route('media.word.audio', ['wordAudio' => $audio->id]) : null,
            'status' => $state?->status ?? 'new',
            'last_rating' => null,
            'phase' => $state?->status,
            'due_at' => $state?->due_at?->toIso8601String(),
            'is_new' => $state === null,
        ];
    }

    /**
     * @param  array<string, mixed>|null  $exercise
     * @return array<string, mixed>
     */
    public static function unit(FlashcardUnit $unit, ?array $exercise = null): array
    {
        return [
            'number' => (int) $unit->number,
            'title_en' => (string) $unit->title_en,
            'title_fa' => $unit->title_fa,
            'subtitle' => $unit->subtitle,
            'exercise' => $exercise,
            'hub_url' => route('books.unit', [
                'book' => $unit->book->slug,
                'unit' => $unit->number,
            ]),
        ];
    }
}

<?php

namespace App\Support\Flashcards;

use App\Models\Flashcard;
use App\Models\FlashcardBook;
use App\Models\FlashcardUnit;
use App\Models\UserFlashcard;
use App\Models\VocabularyWord;
use App\Models\WordAudio;

/**
 * One shape per flashcard payload. Controllers never hand-build card or
 * summary arrays, so the player, the book list and the results screen always
 * agree on field names and URL routes.
 */
final class FlashcardPresenter
{
    /**
     * @param  array{total: int, known: int, unknown: int, due: int, fresh: int}  $counts
     * @return array<string, mixed>
     */
    public static function book(FlashcardBook $book, array $counts, int $unitsCount = 0, ?array $exercise = null): array
    {
        return [
            'slug' => (string) $book->slug,
            'title_en' => (string) $book->title_en,
            'title_fa' => $book->title_fa,
            'level' => $book->level,
            'edition' => $book->edition,
            'cover_url' => $book->cover_path !== null
                ? route('media.flashcard.cover', ['book' => $book->slug])
                : null,
            'units_count' => $unitsCount,
            'cards_count' => $counts['total'],
            'known_count' => $counts['known'],
            'unknown_count' => $counts['unknown'],
            'due_count' => $counts['due'],
            'fresh_count' => $counts['fresh'],
            'exercise' => $exercise,
            'url' => route('flashcards.book', ['book' => $book->slug]),
        ];
    }

    /**
     * @param  array{total: int, known: int, unknown: int, due: int, fresh: int}  $counts
     * @return array<string, mixed>
     */
    public static function unit(FlashcardUnit $unit, array $counts, ?array $exercise = null): array
    {
        return [
            'number' => (int) $unit->number,
            'title_en' => (string) $unit->title_en,
            'title_fa' => $unit->title_fa,
            'subtitle' => $unit->subtitle,
            'cards_count' => $counts['total'],
            'known_count' => $counts['known'],
            'unknown_count' => $counts['unknown'],
            'due_count' => $counts['due'],
            'fresh_count' => $counts['fresh'],
            'exercise' => $exercise,
            'url' => route('flashcards.unit', [
                'book' => $unit->book->slug,
                'unit' => $unit->number,
            ]),
            'hub_url' => route('books.unit', [
                'book' => $unit->book->slug,
                'unit' => $unit->number,
            ]),
            'results_url' => route('flashcards.results', [
                'book' => $unit->book->slug,
                'unit' => $unit->number,
            ]),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public static function card(Flashcard $card, ?UserFlashcard $state = null): array
    {
        return [
            'id' => (int) $card->id,
            'word' => $card->label(),
            'headword' => (string) $card->word,
            'phonetic' => $card->phonetic,
            'translation_fa' => (string) $card->translation_fa,
            'definition_en' => $card->definition_en,
            'example_en' => $card->example_en,
            'part_of_speech' => $card->part_of_speech,
            'audio_url' => route('media.flashcard.audio', ['flashcard' => $card->id]),
            'last_rating' => $state?->last_rating,
            'phase' => $state?->phase,
            'due_at' => $state?->due_at?->toIso8601String(),
            'is_new' => $state === null || $state->phase === 'new',
        ];
    }

    /**
     * One glossary card on a lesson deck. Cards are vocabulary state, not
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

    /** @return array{total: int, known: int, unknown: int, due: int, fresh: int} */
    public static function emptyCounts(): array
    {
        return ['total' => 0, 'known' => 0, 'unknown' => 0, 'due' => 0, 'fresh' => 0];
    }
}

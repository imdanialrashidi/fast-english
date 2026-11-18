<?php

namespace Tests\Support;

use App\Models\Flashcard;
use App\Models\FlashcardBook;
use App\Models\FlashcardUnit;
use Illuminate\Support\Facades\Storage;

/**
 * Real book/unit/card rows with real (fake-disk) media bytes. Feature tests
 * exercise the same routes and storage boundary as the app; no model mocks.
 */
final class FlashcardFixtures
{
    /** @param array<string, mixed> $overrides */
    public static function book(array $overrides = []): FlashcardBook
    {
        return FlashcardBook::create(array_merge([
            'slug' => 'test-book',
            'title_en' => 'Test Book',
            'title_fa' => 'کتاب تست',
            'level' => 'A1',
            'edition' => 'Test edition',
            'status' => 'published',
            'sort_order' => 0,
            'study_config' => [
                'revealDelayMs' => 3000,
                'autoPlayAudio' => true,
                'showPhonetic' => true,
                'showTranslation' => true,
            ],
        ], $overrides));
    }

    /** @param array<string, mixed> $overrides */
    public static function unit(FlashcardBook $book, array $overrides = []): FlashcardUnit
    {
        return FlashcardUnit::create(array_merge([
            'book_id' => $book->id,
            'number' => 1,
            'title_en' => 'A cappuccino, please',
            'title_fa' => 'یک کاپوچینو، لطفاً',
            'subtitle' => 'Numbers and café basics',
            'sort_order' => 1,
        ], $overrides));
    }

    /** @param array<string, mixed> $overrides */
    public static function card(FlashcardUnit $unit, array $overrides = []): Flashcard
    {
        $external = (string) ($overrides['external_id'] ?? 'test-u01-001');
        $imagePath = "flashcards/test/u01/{$external}.webp";
        $audioPath = "flashcards/test/u01/{$external}.mp3";

        Storage::disk('local')->put($imagePath, 'fake-webp-bytes');
        Storage::disk('local')->put($audioPath, 'fake-mp3-bytes');

        return Flashcard::create(array_merge([
            'unit_id' => $unit->id,
            'external_id' => $external,
            'word' => 'zero',
            'display' => 'zero',
            'phonetic' => '/ˈzɪroʊ/',
            'translation_fa' => 'صفر',
            'definition_en' => 'the number 0',
            'example_en' => 'My phone number starts with zero.',
            'part_of_speech' => 'number',
            'lesson_code' => '1A',
            'topic' => 'Numbers 0–10',
            'image_path' => $imagePath,
            'audio_path' => $audioPath,
            'sort_order' => 1,
        ], $overrides));
    }

    /**
     * @return array{0: FlashcardBook, 1: FlashcardUnit, 2: list<Flashcard>}
     */
    public static function deck(int $count = 3): array
    {
        $book = self::book();
        $unit = self::unit($book);
        $cards = [];

        for ($i = 1; $i <= $count; $i++) {
            $cards[] = self::card($unit, [
                'external_id' => 'test-u01-00'.$i,
                'word' => 'word'.$i,
                'display' => 'word'.$i,
                'translation_fa' => 'واژه'.$i,
                'sort_order' => $i,
            ]);
        }

        return [$book, $unit, $cards];
    }
}

<?php

namespace Tests\Support;

use App\Models\FlashcardBook;
use App\Models\FlashcardUnit;

/**
 * Real book and unit rows for feature tests. Unit content is added by each
 * test (exercise sets); book vocabulary decks no longer exist.
 */
final class BookFixtures
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

    /**
     * The second element is kept for callers that destructure three names;
     * it is an empty list because a book has no cards anymore.
     *
     * @return array{0: FlashcardBook, 1: FlashcardUnit, 2: list<never>}
     */
    public static function deck(int $count = 1): array
    {
        $book = self::book();
        $unit = self::unit($book);

        return [$book, $unit, []];
    }
}

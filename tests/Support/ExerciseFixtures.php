<?php

namespace Tests\Support;

use App\Models\ExerciseItem;
use App\Models\ExerciseSet;
use App\Models\ExerciseTopic;
use App\Models\FlashcardBook;
use App\Models\FlashcardUnit;

/**
 * Real grammar-first exercise rows for feature tests: one set per unit with
 * two topics and three questions (choice, matching, choice). No mocks; the
 * same routes, marking and progress the app uses.
 */
final class ExerciseFixtures
{
    public static function set(
        FlashcardBook $book,
        FlashcardUnit $unit,
        array $overrides = [],
    ): ExerciseSet {
        $set = ExerciseSet::create(array_merge([
            'external_id' => 'test-exercise-set',
            'unit_id' => $unit->id,
            'lesson_id' => null,
            'title' => 'تمرین تست',
            'instructions_fa' => 'به سؤال‌ها جواب بده.',
            'status' => 'published',
            'sort_order' => 0,
            'source' => ['student_book' => 'Starter', 'lessons' => ['1A']],
        ], $overrides));

        $first = self::topic($set, 't1', 1, [
            'title_en' => 'verb be (singular): I and you',
            'title_fa' => 'فعل be: I و you',
        ]);
        $second = self::topic($set, 't2', 2, [
            'title_en' => 'verb be (singular): he, she, it',
            'title_fa' => 'فعل be: he، she و it',
        ]);

        self::choice($set, $first, 1, [
            'prompt' => 'How ___ you?',
            'options' => ['am', 'is', 'are'],
            'answer' => ['index' => 2],
            'feedback' => ['0' => 'با I از am استفاده می‌کنیم.', '1' => 'is برای he/she/it است.'],
        ]);
        self::matching($set, $first, 2);
        self::choice($set, $second, 3, [
            'prompt' => 'She ___ from Spain.',
            'options' => ['is', 'are'],
            'answer' => ['index' => 0],
        ]);

        return $set;
    }

    public static function topic(ExerciseSet $set, string $key, int $position, array $overrides = []): ExerciseTopic
    {
        return ExerciseTopic::create(array_merge([
            'set_id' => $set->id,
            'key' => $key,
            'position' => $position,
            'title_en' => 'verb be',
            'title_fa' => 'فعل be',
            'use_fa' => 'برای معرفی و توصیف از فعل be استفاده می‌کنیم.',
            'formulas' => [['label_fa' => 'مثبت', 'text' => "I am\nYou are"]],
            'examples' => [['en' => "I'm Anna.", 'fa' => 'من آنا هستم.']],
            'notes_fa' => null,
        ], $overrides));
    }

    public static function choice(ExerciseSet $set, ?ExerciseTopic $topic, int $position, array $overrides = []): ExerciseItem
    {
        return ExerciseItem::create(array_merge([
            'set_id' => $set->id,
            'topic_id' => $topic?->id,
            'external_id' => 'choice-'.$position,
            'position' => $position,
            'type' => 'choice',
            'prompt' => 'How ___ you?',
            'options' => ['am', 'is', 'are'],
            'answer' => ['index' => 2],
            'explanation_fa' => 'با you از are استفاده می‌کنیم.',
            'feedback' => null,
            'points' => 1,
        ], $overrides));
    }

    public static function matching(ExerciseSet $set, ?ExerciseTopic $topic, int $position, array $overrides = []): ExerciseItem
    {
        return ExerciseItem::create(array_merge([
            'set_id' => $set->id,
            'topic_id' => $topic?->id,
            'external_id' => 'matching-'.$position,
            'position' => $position,
            'type' => 'matching',
            'prompt' => 'هر عبارت را به جوابش وصل کن.',
            'options' => [
                'left' => ['How are you?', 'Are you Anna?', 'Where is she from?'],
                'right' => ["I'm fine, thanks.", 'Yes, I am.', 'She is from Spain.'],
            ],
            'answer' => ['map' => [0, 1, 2]],
            'explanation_fa' => 'هر سؤال جواب کوتاه خودش را دارد.',
            'feedback' => null,
            'points' => 1,
        ], $overrides));
    }
}

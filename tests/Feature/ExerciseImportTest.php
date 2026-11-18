<?php

use App\Models\ExerciseItem;
use App\Models\ExerciseSet;
use App\Models\ExerciseTopic;
use Illuminate\Support\Str;
use Tests\Support\BookFixtures;

// Exercise content import (owner request 2026-11-16): one reviewed JSON per
// unit, grammar topics plus choice/matching items, upserted by stable keys.

function exerciseImportFile(array $data): string
{
    $dir = storage_path('framework/testing/exercises-'.Str::uuid());
    mkdir($dir, 0777, true);
    $path = $dir.'/set.json';
    file_put_contents($path, json_encode($data, JSON_THROW_ON_ERROR));

    return $path;
}

function exerciseImportPayload(array $overrides = []): array
{
    return array_merge([
        'external_id' => 'test-book-u01',
        'book' => 'test-book',
        'unit' => 1,
        'title' => 'تمرین یونیت ۱',
        'instructions_fa' => 'به سؤال‌ها جواب بده.',
        'source' => ['student_book' => 'Starter', 'grammar_bank' => 'p.92'],
        'topics' => [
            [
                'key' => 't1',
                'title_en' => 'verb be: I and you',
                'title_fa' => 'فعل be',
                'use_fa' => 'برای معرفی خودمان.',
                'formulas' => [['label_fa' => 'مثبت', 'text' => "I am\nYou are"]],
                'examples' => [['en' => "I'm Anna.", 'fa' => 'من آنا هستم.']],
                'notes_fa' => 'شکل کوتاه I’m رایج است.',
            ],
        ],
        'items' => [
            [
                'external_id' => 'u01-e01',
                'topic' => 't1',
                'type' => 'choice',
                'prompt' => 'How ___ you?',
                'options' => ['am', 'is', 'are'],
                'answer' => 2,
                'feedback' => ['0' => 'با I از am استفاده می‌کنیم.'],
                'explanation_fa' => 'با you از are استفاده می‌کنیم.',
            ],
            [
                'external_id' => 'u01-e02',
                'topic' => 't1',
                'type' => 'matching',
                'prompt' => 'جفت‌ها را وصل کن.',
                'pairs' => [
                    ['left' => 'How are you?', 'right' => "I'm fine."],
                    ['left' => 'Are you Anna?', 'right' => 'Yes, I am.'],
                ],
            ],
        ],
    ], $overrides);
}

test('a reviewed file writes topics, choice and matching items', function () {
    BookFixtures::deck(1);

    $this->artisan('exercises:import', ['source' => exerciseImportFile(exerciseImportPayload())])
        ->assertSuccessful();

    $set = ExerciseSet::query()->where('external_id', 'test-book-u01')->firstOrFail();
    $topic = ExerciseTopic::query()->where('set_id', $set->id)->firstOrFail();
    $items = ExerciseItem::query()->where('set_id', $set->id)->orderBy('position')->get();

    expect($set->instructions_fa)->toBe('به سؤال‌ها جواب بده.')
        ->and($set->source['grammar_bank'])->toBe('p.92')
        ->and($topic->title_en)->toBe('verb be: I and you')
        ->and($topic->formulas[0]['label_fa'])->toBe('مثبت')
        ->and($items)->toHaveCount(2)
        ->and($items[0]->type)->toBe('choice')
        ->and($items[0]->answer)->toBe(['index' => 2])
        ->and($items[0]->feedback['0'])->toContain('am')
        ->and($items[1]->type)->toBe('matching')
        ->and($items[1]->options['left'])->toHaveCount(2)
        ->and($items[1]->answer)->toBe(['map' => [0, 1]])
        ->and($items[0]->topic_id)->toBe($topic->id);
});

test('a re-import upserts by stable ids and does not duplicate', function () {
    BookFixtures::deck(1);
    $path = exerciseImportFile(exerciseImportPayload());

    $this->artisan('exercises:import', ['source' => $path])->assertSuccessful();
    $payload = exerciseImportPayload(['title' => 'تمرین اصلاح‌شده']);
    file_put_contents($path, json_encode($payload, JSON_THROW_ON_ERROR));
    $this->artisan('exercises:import', ['source' => $path])->assertSuccessful();

    expect(ExerciseSet::query()->count())->toBe(1)
        ->and(ExerciseTopic::query()->count())->toBe(1)
        ->and(ExerciseItem::query()->count())->toBe(2)
        ->and(ExerciseSet::query()->first()->title)->toBe('تمرین اصلاح‌شده');
});

test('a matching set with duplicate right side is refused and writes nothing', function () {
    BookFixtures::deck(1);
    $payload = exerciseImportPayload();
    $payload['items'][1]['pairs'] = [
        ['left' => 'A', 'right' => 'same'],
        ['left' => 'B', 'right' => 'same'],
    ];

    $this->artisan('exercises:import', ['source' => exerciseImportFile($payload)])
        ->assertExitCode(1);

    expect(ExerciseSet::query()->count())->toBe(0);
});

test('an unknown topic is refused', function () {
    BookFixtures::deck(1);
    $payload = exerciseImportPayload();
    $payload['items'][0]['topic'] = 'missing';

    $this->artisan('exercises:import', ['source' => exerciseImportFile($payload)])
        ->assertExitCode(1);

    expect(ExerciseSet::query()->count())->toBe(0);
});

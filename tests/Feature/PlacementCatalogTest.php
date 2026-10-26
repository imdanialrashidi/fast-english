<?php

use App\Models\PlacementQuestion;
use App\Models\PlacementTest;
use App\Support\PlacementLevel;
use Database\Seeders\PlacementCatalogSeeder;

// The public placement test (owner launch input 2026-10-26): 20 real items,
// four per CEFR band, balanced answer positions, published as current.

test('the catalog has 20 well-formed items with balanced answer positions', function () {
    $items = PlacementCatalogSeeder::items();

    expect($items)->toHaveCount(20);

    $byLevel = [];
    $byAnswer = [0, 0, 0, 0];

    foreach ($items as $item) {
        expect(trim($item['prompt']))->not->toBe('')
            ->and($item['options'])->toHaveCount(4)
            ->and(array_unique($item['options']))->toHaveCount(4)
            ->and($item['answer'])->toBeGreaterThanOrEqual(0)
            ->and($item['answer'])->toBeLessThanOrEqual(3)
            ->and($item['prompt'])->toContain('____');

        $byLevel[$item['level']] = ($byLevel[$item['level']] ?? 0) + 1;
        $byAnswer[$item['answer']]++;
    }

    expect($byLevel)->toBe(['A1' => 4, 'A2' => 4, 'B1' => 4, 'B2' => 4, 'C1' => 4])
        ->and($byAnswer)->toBe([5, 5, 5, 5]);
});

test('the seeder publishes one current version and is idempotent', function () {
    $this->seed(PlacementCatalogSeeder::class);

    $test = PlacementTest::where('version', PlacementCatalogSeeder::VERSION)->firstOrFail();
    expect($test->status)->toBe(PlacementTest::STATUS_PUBLISHED)
        ->and($test->is_current)->toBeTrue();
    expect(PlacementQuestion::where('test_id', $test->id)->count())->toBe(20);

    $this->seed(PlacementCatalogSeeder::class);

    expect(PlacementTest::where('version', PlacementCatalogSeeder::VERSION)->count())->toBe(1)
        ->and(PlacementTest::where('is_current', true)->count())->toBe(1)
        ->and(PlacementQuestion::where('test_id', $test->id)->count())->toBe(20);
});

test('the placement suggestion maps every band with a C1 ceiling', function () {
    expect(PlacementLevel::forScore(0))->toBe('A1')
        ->and(PlacementLevel::forScore(3))->toBe('A1')
        ->and(PlacementLevel::forScore(4))->toBe('A2')
        ->and(PlacementLevel::forScore(8))->toBe('B1')
        ->and(PlacementLevel::forScore(12))->toBe('B2')
        ->and(PlacementLevel::forScore(16))->toBe('C1')
        ->and(PlacementLevel::forScore(20))->toBe('C1');
});

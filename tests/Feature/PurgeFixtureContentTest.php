<?php

use App\Models\Category;
use App\Models\PlacementTest;
use App\Models\Topic;
use Database\Seeders\S1SampleSeeder;
use Database\Seeders\S3SampleSeeder;
use Database\Seeders\S5PaymentFixtureSeeder;
use Database\Seeders\S7PlacementFixtureSeeder;

test('fixture purge reports first and only deletes with --force', function () {
    $this->seed(S1SampleSeeder::class);
    $this->seed(S3SampleSeeder::class);
    $this->seed(S5PaymentFixtureSeeder::class);
    $this->seed(S7PlacementFixtureSeeder::class);

    $fixtureSlugs = [
        'city-park',
        'night-trains',
        'morning-market',
        'rainy-day',
        'draft-notebook',
        'empty-shelf',
        'archived-whisper',
    ];

    expect(Topic::whereIn('slug', $fixtureSlugs)->count())->toBe(7)
        ->and(Category::whereIn('slug', ['story', 'everyday'])->count())->toBe(2)
        ->and(PlacementTest::where('version', 's7-fixture-v1')->exists())->toBeTrue();

    // Dry run: reports but changes nothing.
    $this->artisan('content:purge-fixtures')
        ->expectsOutputToContain('Dry run only')
        ->assertSuccessful();

    expect(Topic::whereIn('slug', $fixtureSlugs)->count())->toBe(7)
        ->and(PlacementTest::where('version', 's7-fixture-v1')->exists())->toBeTrue();

    // Real run: fixture topics/categories and the unpinned S7 version go.
    $this->artisan('content:purge-fixtures --force')
        ->expectsOutputToContain('Purged')
        ->assertSuccessful();

    expect(Topic::whereIn('slug', $fixtureSlugs)->count())->toBe(0)
        ->and(Category::whereIn('slug', ['story', 'everyday'])->count())->toBe(0)
        ->and(PlacementTest::where('version', 's7-fixture-v1')->exists())->toBeFalse();
});

test('fixture purge is a safe no-op on a clean database', function () {
    $this->artisan('content:purge-fixtures --force')
        ->expectsOutputToContain('No fixture content found')
        ->assertSuccessful();
});

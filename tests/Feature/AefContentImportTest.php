<?php

use App\Models\FlashcardBook;
use App\Models\FlashcardUnit;

// The AEF catalog (owner request 2026-11-16): six books and their real unit
// titles, idempotent on every run so a release import can be repeated.

test('the catalog creates the six books and their titled units', function () {
    $this->artisan('aef:import-catalog')->assertSuccessful();

    expect(FlashcardBook::query()->count())->toBe(6)
        ->and(FlashcardBook::query()->where('slug', 'aef-3e-5')->exists())->toBeTrue()
        ->and(FlashcardBook::query()->where('slug', 'aef-3e-starter')->first()->units()->count())->toBe(12)
        ->and(FlashcardBook::query()->where('slug', 'aef-3e-3')->first()->units()->count())->toBe(10)
        ->and(FlashcardUnit::query()->count())->toBe(66)
        ->and(FlashcardUnit::query()
            ->whereHas('book', fn ($query) => $query->where('slug', 'aef-3e-starter'))
            ->where('number', 1)
            ->value('title_en'))->toBe('A cappuccino, please')
        ->and(FlashcardUnit::query()
            ->whereHas('book', fn ($query) => $query->where('slug', 'aef-3e-starter'))
            ->where('number', 1)
            ->value('title_fa'))->toBe('یک کاپوچینو، لطفاً');
});

test('a second catalog run refreshes titles without duplicating units', function () {
    $this->artisan('aef:import-catalog')->assertSuccessful();

    $unit = FlashcardUnit::query()->where('title_en', 'A cappuccino, please')->firstOrFail();
    $unit->forceFill(['title_en' => 'Edited by staff'])->save();

    $this->artisan('aef:import-catalog')->assertSuccessful();

    expect(FlashcardBook::query()->count())->toBe(6)
        ->and(FlashcardUnit::query()->count())->toBe(66)
        ->and($unit->fresh()->title_en)->toBe('A cappuccino, please');
});

<?php

use App\Models\Flashcard;
use App\Models\FlashcardBook;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Tests\Support\FlashcardFixtures;

// The AEF catalog plus the per-unit deck import (owner request 2026-11-16):
// six books with unit shells, and a text-first deck whose audio is copied
// into the private flashcard folder.

test('the catalog creates the six books and their unit shells', function () {
    $this->artisan('aef:import-catalog')->assertSuccessful();

    expect(FlashcardBook::query()->count())->toBe(6)
        ->and(FlashcardBook::query()->where('slug', 'aef-3e-5')->exists())->toBeTrue()
        ->and(FlashcardBook::query()->where('slug', 'aef-3e-starter')->first()->units()->count())->toBe(12)
        ->and(FlashcardBook::query()->where('slug', 'aef-3e-3')->first()->units()->count())->toBe(10);
});

test('a unit deck is imported with its audio and no image', function () {
    [$book, $unit] = FlashcardFixtures::deck(0);

    $audioDir = storage_path('framework/testing/aef-audio-'.Str::uuid());
    mkdir($audioDir, 0777, true);
    file_put_contents($audioDir.'/card.mp3', 'fake-mp3-bytes');

    $deck = [
        'book' => ['slug' => $book->slug],
        'unit' => ['number' => $unit->number, 'title_en' => 'A cappuccino, please', 'title_fa' => 'کاپوچینو'],
        'cards' => [[
            'external_id' => 'aef3s-u01-001',
            'word' => 'zero',
            'phonetic' => '/ˈzɪroʊ/',
            'translation_fa' => 'صفر',
            'definition_en' => 'the number 0',
            'example_en' => 'Zero, one, two.',
            'part_of_speech' => 'number',
            'lesson_code' => '1A',
            'topic' => 'numbers',
            'audio' => 'card.mp3',
        ]],
    ];
    $path = $audioDir.'/deck.json';
    file_put_contents($path, json_encode($deck, JSON_THROW_ON_ERROR));

    $this->artisan('flashcards:import-aef', ['file' => $path, '--audio' => $audioDir])
        ->assertSuccessful();

    $card = Flashcard::query()->where('external_id', 'aef3s-u01-001')->firstOrFail();

    expect($card->unit_id)->toBe($unit->id)
        ->and($card->translation_fa)->toBe('صفر')
        ->and($card->image_path)->toBeNull()
        ->and($card->audio_path)->toBe('flashcards/test-book/u01/aef3s-u01-001.mp3');

    Storage::disk('local')->assertExists('flashcards/test-book/u01/aef3s-u01-001.mp3');
});

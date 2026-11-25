<?php

use App\Support\Lexicon;

// Owner instruction 2026-11-25: the reader surfaces share one lexicon for
// B2+ highlighting, short Persian meanings, optional simple synonyms, and
// the shared pronunciation route.

test('the lexicon resolves b2 words and annotates in text order with utf16 offsets', function () {
    expect(Lexicon::isB2OrAbove('tariff'))->toBeTrue()
        ->and(Lexicon::entry('tariffs'))->not->toBeNull()
        ->and(Lexicon::entry('the'))->toBeNull();

    $rows = Lexicon::annotate('Tariffs backfired; a tariff can be remarkable.');
    $starts = array_column($rows, 'start_utf16');
    $sorted = $starts;
    sort($sorted);
    expect($starts)->toBe($sorted);
    foreach ($rows as $row) {
        expect($row['end_utf16'])->toBeGreaterThan($row['start_utf16'])
            ->and($row['meaning_fa'])->not->toBe('');
    }
});

test('a talk receives only the b2 words that occur in its transcript', function () {
    $map = Lexicon::mapFor('A tariff can backfire. A tariff is a tax.');
    expect($map)->toHaveKey('tariff')
        ->and($map['tariff']['audio_url'])->toContain('/media/words/');
    expect($map)->not->toHaveKey('can');
});

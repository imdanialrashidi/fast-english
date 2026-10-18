<?php

use App\Models\Lesson;
use App\Support\Glossary;
use Illuminate\Validation\ValidationException;
use Inertia\Testing\AssertableInertia;
use Tests\Support\ContentFixtures;

// Glossary (READ-02): validated JSON, at most 12 entries, word + meaning_fa
// required, example_en optional. Shown on the reader for the active lesson
// only, escaped like every other staff-entered string.

test('a valid glossary normalizes and an invalid one is refused with keys', function () {
    $normalized = Glossary::validate([
        ['word' => '  crowded ', 'meaning_fa' => ' شلوغ ', 'example_en' => null],
        ['word' => 'fresh', 'meaning_fa' => 'تازه', 'example_en' => 'Fresh bread.'],
    ]);

    expect($normalized)->toBe([
        ['word' => 'crowded', 'meaning_fa' => 'شلوغ', 'example_en' => null],
        ['word' => 'fresh', 'meaning_fa' => 'تازه', 'example_en' => 'Fresh bread.'],
    ]);
});

test('more than twelve entries are refused', function () {
    $entries = array_map(
        fn ($i) => ['word' => "word{$i}", 'meaning_fa' => "معنی {$i}"],
        range(1, 13)
    );

    try {
        Glossary::validate($entries);
        $this->fail('Thirteen entries should have been refused.');
    } catch (ValidationException $e) {
        expect($e->errors())->toHaveKey('glossary');
    }
});

test('entries missing the word or the meaning are refused with specific keys', function () {
    try {
        Glossary::validate([['word' => '', 'meaning_fa' => 'شلوغ']]);
        $this->fail('A wordless entry should have been refused.');
    } catch (ValidationException $e) {
        expect($e->errors())->toHaveKey('glossary.0.word');
    }

    try {
        Glossary::validate([['word' => 'crowded', 'meaning_fa' => '  ']]);
        $this->fail('A meaning-less entry should have been refused.');
    } catch (ValidationException $e) {
        expect($e->errors())->toHaveKey('glossary.0.meaning_fa');
    }
});

test('the reader shows the active lesson glossary only, escaped', function () {
    $topic = ContentFixtures::publishedTopic(['slug' => 's3-gloss', 'title_en' => 'S3 Gloss']);
    Lesson::factory()->for($topic)->create([
        'level' => 'A2', 'status' => 'published', 'published_at' => now(),
        'is_public_sample' => true,
        'glossary' => [['word' => 'A2word', 'meaning_fa' => 'معنی آ۲', 'example_en' => null]],
    ]);
    Lesson::factory()->for($topic)->create([
        'level' => 'B1', 'status' => 'published', 'published_at' => now(),
        'is_public_sample' => true,
        'glossary' => [['word' => 'B1word', 'meaning_fa' => 'معنی ب۱', 'example_en' => 'A <b>bold</b> example.']],
    ]);

    // Paid-only slice: flagged lessons resolve through the public
    // sample experience; the active-lesson glossary travels with it.
    $a2Redirect = $this->get(route('reader.show', ['topic' => 's3-gloss', 'level' => 'A2']))->assertRedirect();
    $a2 = $this->followRedirects($a2Redirect)->assertOk();
    // M1 note: Persian copy travels unicode-escaped in the encoded page,
    // so raw assertSee only fits ASCII; the decoded props carry the claim.
    $a2->assertSee('A2word');
    $a2->assertDontSee('B1word');
    $a2->assertInertia(fn (AssertableInertia $page) => $page
        ->where('glossary.0.word', 'A2word')
        ->where('glossary.0.meaning_fa', 'معنی آ۲'));

    $b1Redirect = $this->get(route('reader.show', ['topic' => 's3-gloss', 'level' => 'B1']))->assertRedirect();
    $b1 = $this->followRedirects($b1Redirect)->assertOk();
    $b1->assertSee('B1word');
    // Staff-entered HTML in the example travels raw in props and is
    // escaped at render time by React (proven in the browser journey).
    $b1->assertInertia(fn (AssertableInertia $page) => $page
        ->where('glossary.0.example_en', 'A <b>bold</b> example.'));
    $b1->assertDontSee('A2word');
});

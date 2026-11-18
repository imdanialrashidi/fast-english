<?php

use App\Models\Flashcard;
use App\Models\FlashcardBook;
use App\Models\FlashcardReview;
use App\Models\FlashcardUnit;
use App\Models\UserFlashcard;
use App\Support\Flashcards\Importer;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\Support\ContentFixtures;
use Tests\Support\FlashcardFixtures;

// Book flashcards (owner request 2026-11-15): paid-only pages, the
// two-grade schedule, idempotent answers, the results buckets, private
// media and the dataset importer.

test('guests are redirected and non-subscribers get the locked state', function () {
    [$book] = FlashcardFixtures::deck(1);

    $this->get(route('flashcards.index'))->assertRedirect();

    $student = ContentFixtures::student();
    $this->actingAs($student)->get(route('flashcards.index'))->assertForbidden();
    $this->actingAs($student)->get(route('flashcards.book', ['book' => $book->slug]))->assertForbidden();
});

test('a subscriber sees books, units and cards in order', function () {
    [$book, $unit, $cards] = FlashcardFixtures::deck(3);
    $student = ContentFixtures::subscribedStudent();

    $this->actingAs($student)
        ->get(route('flashcards.index'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Flashcards/Index')
            ->has('books', 1)
            ->where('books.0.slug', $book->slug)
            ->where('books.0.cards_count', 3)
            ->where('books.0.fresh_count', 3)
            ->where('books.0.units_count', 1)
            ->where('review.due', 0));

    $this->actingAs($student)
        ->get(route('flashcards.book', ['book' => $book->slug]))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Flashcards/Book')
            ->has('units', 1)
            ->where('units.0.number', $unit->number)
            ->where('units.0.cards_count', 3));

    $this->actingAs($student)
        ->get(route('flashcards.unit', ['book' => $book->slug, 'unit' => $unit->number]))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Flashcards/Unit')
            ->has('cards', 3)
            ->where('cards.0.id', $cards[0]->id)
            ->where('cards.1.id', $cards[1]->id)
            ->where('cards.0.last_rating', null)
            ->missing('cards.0.image_url')
            ->where('study.reveal_delay_ms', 3000));
});

test('good walks the learning steps then graduates; again stays due in a minute', function () {
    [$book, $unit, $cards] = FlashcardFixtures::deck(2);
    $student = ContentFixtures::subscribedStudent();

    $payload = [
        'flashcard_id' => $cards[0]->id,
        'rating' => 'good',
        'client_review_id' => (string) Str::uuid(),
        'session_id' => (string) Str::uuid(),
        'duration_ms' => 1500,
    ];

    $this->actingAs($student)
        ->postJson(route('flashcards.reviews.store'), $payload)
        ->assertOk()
        ->assertJsonPath('last_rating', 'good')
        ->assertJsonPath('phase', 'learning');

    $state = UserFlashcard::where('user_id', $student->id)->where('flashcard_id', $cards[0]->id)->firstOrFail();
    expect($state->phase)->toBe('learning')
        ->and($state->step)->toBe(1)
        ->and($state->due_at->diffInMinutes(now()))->toBeLessThanOrEqual(10)
        ->and(FlashcardReview::where('user_id', $student->id)->count())->toBe(1);

    // The second good graduates to one day.
    $this->actingAs($student)
        ->postJson(route('flashcards.reviews.store'), [
            'flashcard_id' => $cards[0]->id,
            'rating' => 'good',
            'client_review_id' => (string) Str::uuid(),
        ])
        ->assertOk()
        ->assertJsonPath('phase', 'review');

    expect($state->fresh()->interval_days)->toBe(1);

    $this->actingAs($student)
        ->postJson(route('flashcards.reviews.store'), [
            'flashcard_id' => $cards[1]->id,
            'rating' => 'again',
            'client_review_id' => (string) Str::uuid(),
        ])
        ->assertOk()
        ->assertJsonPath('phase', 'learning')
        ->assertJsonPath('last_rating', 'again');
});

test('a replayed client review id is idempotent', function () {
    [, , $cards] = FlashcardFixtures::deck(1);
    $student = ContentFixtures::subscribedStudent();
    $clientReviewId = (string) Str::uuid();

    $payload = [
        'flashcard_id' => $cards[0]->id,
        'rating' => 'good',
        'client_review_id' => $clientReviewId,
    ];

    $this->actingAs($student)->postJson(route('flashcards.reviews.store'), $payload)->assertOk();
    $this->actingAs($student)
        ->postJson(route('flashcards.reviews.store'), $payload)
        ->assertOk()
        ->assertJsonPath('duplicate', true);

    expect(FlashcardReview::where('user_id', $student->id)->count())->toBe(1)
        ->and(UserFlashcard::where('user_id', $student->id)->count())->toBe(1);
});

test('the daily review queue returns only due learning cards', function () {
    [, , $cards] = FlashcardFixtures::deck(2);
    $student = ContentFixtures::subscribedStudent();

    $this->actingAs($student)->postJson(route('flashcards.reviews.store'), [
        'flashcard_id' => $cards[0]->id,
        'rating' => 'again',
        'client_review_id' => (string) Str::uuid(),
    ])->assertOk();

    $this->travel(2)->minutes();

    $this->actingAs($student)
        ->get(route('flashcards.review'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Flashcards/Review')
            ->has('cards', 1)
            ->where('cards.0.id', $cards[0]->id)
            ->where('counts.due_total', 1));
});

test('the results buckets reflect the latest self report', function () {
    [$book, $unit, $cards] = FlashcardFixtures::deck(3);
    $student = ContentFixtures::subscribedStudent();

    foreach ([[$cards[0], 'good'], [$cards[1], 'again']] as [$card, $rating]) {
        $this->actingAs($student)->postJson(route('flashcards.reviews.store'), [
            'flashcard_id' => $card->id,
            'rating' => $rating,
            'client_review_id' => (string) Str::uuid(),
        ])->assertOk();
    }

    $this->actingAs($student)
        ->get(route('flashcards.results', ['book' => $book->slug, 'unit' => $unit->number]))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Flashcards/Results')
            ->has('known', 1)
            ->has('unknown', 1)
            ->where('known.0.id', $cards[0]->id)
            ->where('unknown.0.id', $cards[1]->id)
            ->where('counts.known', 1)
            ->where('counts.unknown', 1));
});

test('one learner never sees another learner state', function () {
    [$book, $unit, $cards] = FlashcardFixtures::deck(1);
    $studentA = ContentFixtures::subscribedStudent();
    $studentB = ContentFixtures::subscribedStudent();

    $this->actingAs($studentA)->postJson(route('flashcards.reviews.store'), [
        'flashcard_id' => $cards[0]->id,
        'rating' => 'good',
        'client_review_id' => (string) Str::uuid(),
    ])->assertOk();

    $this->actingAs($studentB)
        ->get(route('flashcards.unit', ['book' => $book->slug, 'unit' => $unit->number]))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->where('cards.0.last_rating', null)
            ->where('counts.known', 0)
            ->where('counts.fresh', 1));
});

test('card media is private, published-only, and has no image route', function () {
    [$book, $unit, $cards] = FlashcardFixtures::deck(1);
    $student = ContentFixtures::subscribedStudent();

    $this->actingAs($student)
        ->get(route('media.flashcard.audio', ['flashcard' => $cards[0]->id]))
        ->assertOk()
        ->assertHeader('Content-Type', 'audio/mpeg')
        ->assertHeader('Cache-Control', 'no-store, private');

    // Owner clarification 2026-11-15: cards are text-first, so the image
    // route is gone instead of serving an unused asset.
    $this->actingAs($student)
        ->get("/media/flashcards/{$cards[0]->id}/image")
        ->assertNotFound();

    $book->forceFill(['status' => 'draft'])->save();

    $this->actingAs($student)
        ->get(route('media.flashcard.audio', ['flashcard' => $cards[0]->id]))
        ->assertNotFound();
});

test('the importer is idempotent and prepares clean card media', function () {
    Storage::fake('local');

    $base = sys_get_temp_dir().'/flashcards-import-'.Str::random(8);
    mkdir($base.'/units', 0777, true);
    copy(public_path('audio/silence.mp3'), $base.'/word.mp3');

    $image = imagecreatetruecolor(80, 80);
    imagefill($image, 0, 0, imagecolorallocate($image, 240, 230, 210));
    ob_start();
    imagejpeg($image);
    $jpeg = ob_get_clean();
    imagedestroy($image);
    file_put_contents($base.'/front.jpg', $jpeg);

    file_put_contents($base.'/manifest.json', json_encode([
        'book' => ['id' => 'import-test', 'title' => 'Import Test', 'level' => 'A1', 'edition' => 'Test'],
        'units' => [['unit' => 1, 'title' => 'Unit one', 'file' => 'units/unit-01.json']],
        'study' => ['revealDelayMs' => 3000, 'autoPlayAudio' => true],
    ]));
    file_put_contents($base.'/units/unit-01.json', json_encode([
        'unit' => 1,
        'title' => 'Unit one',
        'subtitle' => 'Test unit',
        'cards' => [[
            'id' => 'import-u01-001',
            'order' => 1,
            'word' => 'zero',
            'display' => 'zero',
            'phonetic' => '/ˈzɪroʊ/',
            'translationFa' => 'صفر',
            'definitionEn' => 'the number 0',
            'exampleEn' => 'My phone number starts with zero.',
            'partOfSpeech' => 'number',
            'lesson' => '1A',
            'topic' => 'Numbers',
            'images' => ['front' => 'front.jpg'],
            'audio' => ['file' => 'word.mp3'],
        ]],
    ]));

    $dry = (new Importer($base, dryRun: true))->run();
    expect($dry['cards'])->toBe(1)
        ->and(FlashcardBook::count())->toBe(0);

    $report = (new Importer($base))->run();
    expect($report['units'])->toBe(1)
        ->and($report['cards'])->toBe(1)
        ->and(FlashcardBook::count())->toBe(1)
        ->and(Flashcard::count())->toBe(1);

    expect(Storage::disk('local')->exists('flashcards/import-test/u01/import-u01-001.webp'))->toBeTrue()
        ->and(Storage::disk('local')->exists('flashcards/import-test/u01/import-u01-001.mp3'))->toBeTrue();

    (new Importer($base))->run();
    expect(FlashcardBook::count())->toBe(1)
        ->and(FlashcardUnit::count())->toBe(1)
        ->and(Flashcard::count())->toBe(1);

    unlink($base.'/front.jpg');
    unlink($base.'/word.mp3');
    unlink($base.'/manifest.json');
    unlink($base.'/units/unit-01.json');
    rmdir($base.'/units');
    rmdir($base);
});

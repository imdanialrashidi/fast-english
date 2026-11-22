<?php

use App\Models\Lesson;
use App\Models\TedTalk;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia;
use Tests\Support\ContentFixtures;

/**
 * The seventh reader tab (owner request 2026-11-21): access, payload,
 * private audio and the "no talk → no tab" rule.
 */
beforeEach(function () {
    $this->topic = ContentFixtures::publishedTopic(['slug' => 'ted-topic']);
    $this->lesson = Lesson::factory()->for($this->topic)->create([
        'level' => 'B1',
        'status' => 'published',
        'published_at' => now(),
    ]);
    $this->talk = TedTalk::factory()->for($this->topic)->create([
        'status' => 'published',
        'published_at' => now(),
    ]);
    $this->subscriber = ContentFixtures::subscribedStudent();
});

test('an eligible subscriber reads the talk with its cues and words', function () {
    $this->actingAs($this->subscriber)
        ->get(route('ted.show', $this->topic))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('Reader/Ted')
            ->where('talk.id', $this->talk->id)
            ->where('talk.title_en', $this->talk->title_en)
            ->where('talk.audio_url', route('media.ted.audio', $this->talk))
            ->where('talk.source_license', 'CC BY-NC-ND 4.0')
            ->where('availableLevels', ['B1'])
            ->has('talk.segments', 1)
            ->has('talk.segments.0', 2)
            ->where('talk.segments.0.0.text', 'This is the first sentence of the talk.')
            ->has('talk.words', 2)
            ->where('talk.words.0.word', 'tariff'));
});

test('guests and ineligible accounts get the locked page without premium text', function () {
    $this->get(route('ted.show', $this->topic))
        ->assertForbidden()
        ->assertInertia(fn (AssertableInertia $page) => $page->component('Locked/Index'))
        ->assertDontSee('This is the first sentence of the talk.');

    $this->actingAs(ContentFixtures::student())
        ->get(route('ted.show', $this->topic))
        ->assertForbidden()
        ->assertInertia(fn (AssertableInertia $page) => $page->component('Locked/Index'));

    // Staff pass without a subscription.
    $this->actingAs(ContentFixtures::staff())
        ->get(route('ted.show', $this->topic))
        ->assertOk();
});

test('a draft talk or draft topic is not found for anyone', function () {
    $this->talk->update(['status' => 'draft', 'published_at' => null]);

    $this->actingAs(ContentFixtures::staff())
        ->get(route('ted.show', $this->topic))
        ->assertNotFound();

    $this->talk->update(['status' => 'published', 'published_at' => now()]);
    $this->topic->update(['status' => 'draft', 'published_at' => null]);

    $this->actingAs(ContentFixtures::staff())
        ->get(route('ted.show', $this->topic))
        ->assertNotFound();
});

test('private audio is range-aware, no-store, and policy checked', function () {
    $url = route('media.ted.audio', $this->talk);

    $this->actingAs($this->subscriber)
        ->get($url)
        ->assertOk()
        ->assertHeader('content-type', 'audio/mpeg')
        ->assertHeader('accept-ranges', 'bytes');

    $response = $this->actingAs($this->subscriber)->get($url, ['Range' => 'bytes=0-99']);
    $response->assertStatus(206);
    expect((int) $response->headers->get('Content-Length'))->toBe(100);
    expect($response->headers->get('Cache-Control'))->toContain('no-store');

    $this->actingAs($this->subscriber)
        ->get($url, ['Range' => 'bytes=999999999-'])
        ->assertStatus(416);

    $this->talk->update(['status' => 'draft', 'published_at' => null]);
    $this->actingAs(ContentFixtures::staff())->get($url)->assertNotFound();
});

test('the private audio route refuses guests', function () {
    $this->get(route('media.ted.audio', $this->talk))->assertForbidden();
});

test('the reader shows the TED tab only when a published talk exists', function () {
    $this->actingAs($this->subscriber)
        ->get(route('reader.show', ['topic' => $this->topic->slug, 'level' => 'B1']))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->where('ted.url', route('ted.show', $this->topic))
            ->where('ted.minutes', 11));

    $this->talk->update(['status' => 'archived', 'published_at' => null]);

    $this->actingAs($this->subscriber)
        ->get(route('reader.show', ['topic' => $this->topic->slug, 'level' => 'B1']))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page->where('ted', null));
});

test('content validation rejects bad cues and more than ten words', function () {
    $talk = new TedTalk([
        'topic_id' => $this->topic->id,
        'slug' => 'bad-talk',
        'title_en' => 'Bad talk',
        'area' => 'tech',
        'audio_path' => 'ted/bad.mp3',
        'source_url' => 'https://www.ted.com/talks/bad',
        'segments' => [[['t' => 500, 'text' => 'First.'], ['t' => 100, 'text' => 'Backwards.']]],
        'words' => [],
    ]);

    expect(fn () => $talk->save())->toThrow(InvalidArgumentException::class);

    $talk->segments = [[['t' => 0, 'text' => 'First.']]];
    $talk->words = array_fill(0, 11, ['word' => 'x', 'en' => 'y', 'fa' => null]);
    expect(fn () => $talk->save())->toThrow(InvalidArgumentException::class);
});

test('one topic can hold only one talk at the database level', function () {
    expect(fn () => TedTalk::factory()->for($this->topic)->create())
        ->toThrow(QueryException::class);
});

test('the import command is idempotent, draft-first, and records a staff reviewer', function () {
    $topic = ContentFixtures::publishedTopic(['slug' => 'import-topic']);
    $staff = ContentFixtures::staff();
    $root = storage_path('framework/testing/ted-pack-'.uniqid());
    $folder = $root.'/talks/imported-talk';
    mkdir($folder, 0777, true);

    copy(database_path('seeders/fixtures/s1-a2-tone-fixture.mp3'), $folder.'/audio.mp3');

    $image = imagecreatetruecolor(1600, 900);
    imagejpeg($image, $folder.'/cover.jpg', 85);
    imagedestroy($image);

    file_put_contents($folder.'/final.json', json_encode([
        'paragraphs' => [[
            ['t' => 0, 'text' => 'The imported first sentence.'],
            ['t' => 4200, 'text' => 'The imported second sentence.'],
        ]],
        'words' => [
            ['word' => 'tariff', 'en' => 'a tax on imports', 'fa' => 'تعرفه'],
            ['word' => 'customs', 'en' => 'the office that checks goods', 'fa' => null],
        ],
    ]));

    file_put_contents($root.'/manifest.json', json_encode([
        'talks' => [[
            'slug' => 'imported-talk',
            'topic_slug' => $topic->slug,
            'area' => 'politics',
            'title_en' => 'Imported talk',
            'speaker' => 'A Speaker',
            'duration_seconds' => 620,
            'audio' => 'talks/imported-talk/audio.mp3',
            'cover' => 'talks/imported-talk/cover.jpg',
            'final' => 'talks/imported-talk/final.json',
            'source_url' => 'https://www.ted.com/talks/imported',
            'source_license' => 'CC BY-NC-ND 4.0',
            'license_note' => 'test',
        ]],
    ]));

    $this->artisan('ted:import', ['path' => $root])->assertExitCode(0);

    $talk = TedTalk::where('slug', 'imported-talk')->firstOrFail();
    expect($talk->status)->toBe('draft')
        ->and($talk->topic_id)->toBe($topic->id)
        ->and($talk->words)->toHaveCount(2)
        ->and(Storage::disk('local')->exists($talk->audio_path))->toBeTrue()
        ->and(Storage::disk('public')->exists($talk->cover_path))->toBeTrue();

    $this->artisan('ted:import', ['path' => $root, '--publish' => true, '--reviewer' => $staff->email])
        ->assertExitCode(0);

    $talk->refresh();
    expect($talk->status)->toBe('published')
        ->and($talk->reviewed_by)->toBe($staff->id)
        ->and($talk->published_at)->not->toBeNull();

    // A later content import without an explicit review sends it back to draft.
    $this->artisan('ted:import', ['path' => $root])->assertExitCode(0);
    expect($talk->fresh()->status)->toBe('draft')
        ->and(TedTalk::where('slug', 'imported-talk')->count())->toBe(1);
});

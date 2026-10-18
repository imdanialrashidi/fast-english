<?php

use App\Models\Category;
use App\Models\Lesson;
use App\Models\Topic;
use Inertia\Testing\AssertableInertia;
use Tests\Support\ContentFixtures;

// S3-4: level/category filters and title search return the correct subset;
// an empty result shows a clear message with a way back; filter state is
// held in the URL (plain GET), so reload and back navigation preserve it.

beforeEach(function () {
    $this->catA = Category::factory()->create(['slug' => 's3-cata', 'name_fa' => 'دسته آ']);
    $this->catB = Category::factory()->create(['slug' => 's3-catb', 'name_fa' => 'دسته ب']);

    $alpha = ContentFixtures::publishedTopic([
        'slug' => 's3-alpha', 'title_en' => 'S3 Alpha Park', 'category_id' => $this->catA->id,
    ]);
    Lesson::factory()->for($alpha)->create(['level' => 'A1', 'status' => 'published', 'published_at' => now()]);
    Lesson::factory()->for($alpha)->create(['level' => 'B1', 'status' => 'published', 'published_at' => now()]);

    $beta = ContentFixtures::publishedTopic([
        'slug' => 's3-beta', 'title_en' => 'S3 Beta Trains', 'category_id' => $this->catB->id,
    ]);
    Lesson::factory()->for($beta)->create(['level' => 'B2', 'status' => 'published', 'published_at' => now()]);

    $gamma = ContentFixtures::publishedTopic([
        'slug' => 's3-gamma', 'title_en' => 'S3 Gamma Market', 'category_id' => $this->catA->id,
    ]);
    Lesson::factory()->for($gamma)->create(['level' => 'A1', 'status' => 'published', 'published_at' => now()]);

    // Paid-only slice: the library needs an active subscription.
    $this->actingAs(ContentFixtures::subscribedStudent());
});

test('level filter returns only topics with a published lesson at that level', function () {
    $response = $this->get('/app?level=A1')->assertOk();

    $response->assertSee('S3 Alpha Park');
    $response->assertSee('S3 Gamma Market');
    $response->assertDontSee('S3 Beta Trains');
});

test('category filter returns only topics in that category', function () {
    $response = $this->get('/app?category=s3-catb')->assertOk();

    $response->assertSee('S3 Beta Trains');
    $response->assertDontSee('S3 Alpha Park');
    $response->assertDontSee('S3 Gamma Market');
});

test('title search is case-insensitive and ignores other fields', function () {
    $response = $this->get('/app?q=alpha')->assertOk();

    $response->assertSee('S3 Alpha Park');
    $response->assertDontSee('S3 Beta Trains');
    $response->assertDontSee('S3 Gamma Market');
});

test('combined filters intersect and an empty result explains itself with a reset', function () {
    // M1 port: the empty message + reset render client-side (proven in
    // tests/browser/s3-library.spec.ts); HTTP asserts the empty row set.
    $this->get('/app?level=B2&category=s3-cata')
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('Library/Index')
            ->has('topics', 0)
            ->where('pagination.total', 0)
            ->where('hasFilters', true));
});

test('the active filter state is rendered back from the URL', function () {
    // M1 port: pills + search input render client-side from these props
    // (proven in tests/browser/s3-library.spec.ts).
    $response = $this->get('/app?level=B2&category=s3-catb&q=beta')->assertOk();

    $response->assertInertia(fn (AssertableInertia $page) => $page
        ->where('activeLevel', 'B2')
        ->where('activeCategory', 's3-catb')
        ->where('activeQuery', 'beta')
        ->where('hasFilters', true));
    $response->assertSee('S3 Beta Trains');
});

test('the library exposes metadata only, never bodies or private paths', function () {
    $alpha = Topic::where('slug', 's3-alpha')->firstOrFail();
    $body = Lesson::where('topic_id', $alpha->id)->where('level', 'A1')->firstOrFail()->body_en;

    $html = $this->get('/app')->assertOk()->getContent();

    expect($html)->not->toContain($body)
        ->and($html)->not->toContain('lessons/')
        ->and($html)->not->toContain('audio_path');
});

<?php

use App\Models\Lesson;
use Illuminate\Support\Facades\DB;
use Inertia\Testing\AssertableInertia;
use Tests\Support\ContentFixtures;

// S3-3: one card per topic. A topic with two published lessons renders a
// single card listing both levels; pagination returns 12 per page with the
// correct total; the query count stays constant as topics grow.

test('a topic with published A1 and B2 lessons renders one card with both levels', function () {
    $topic = ContentFixtures::publishedTopic(['slug' => 's3-two-level', 'title_en' => 'S3 Two Level']);
    Lesson::factory()->for($topic)->create([
        'level' => 'A1', 'status' => 'published', 'published_at' => now(), 'is_public_sample' => true,
    ]);
    Lesson::factory()->for($topic)->create([
        'level' => 'B2', 'status' => 'published', 'published_at' => now(), 'is_public_sample' => false,
    ]);

    // M1 port (ADR-0002): cards render client-side (proven in
    // tests/browser/s3-library.spec.ts); HTTP asserts one row for the
    // topic naming both levels on the decoded props.
    // Paid-only slice: the library needs an active subscription.
    $this->actingAs(ContentFixtures::subscribedStudent())->get('/app')
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('Library/Index')
            ->has('topics', 1)
            ->where('topics.0.slug', 's3-two-level')
            ->where('topics.0.levels', ['A1', 'B2']));
});

test('pagination returns 12 per page with the correct total', function () {
    for ($i = 1; $i <= 13; $i++) {
        $topic = ContentFixtures::publishedTopic([
            'slug' => "s3-page-{$i}", 'title_en' => "S3 Page {$i}",
        ]);
        Lesson::factory()->for($topic)->create([
            'level' => 'A1', 'status' => 'published', 'published_at' => now(),
        ]);
    }

    // M1 port: counts travel as decoded props (cards render client-side).
    // Paid-only slice: the library needs an active subscription.
    $page1 = $this->actingAs(ContentFixtures::subscribedStudent())->get('/app')->assertOk();
    $page1->assertInertia(fn (AssertableInertia $page) => $page
        ->where('pagination.total', 13)
        ->has('topics', 12));

    $page2 = $this->get('/app?page=2')->assertOk();
    $page2->assertInertia(fn (AssertableInertia $page) => $page
        ->has('topics', 1));

    // A stale deep link clamps to the real last page, not an empty screen.
    $this->get('/app?page=99')->assertRedirect('/app?page=2');
});

test('an out-of-range or malformed page redirects with filters intact', function () {
    $student = ContentFixtures::subscribedStudent();

    for ($i = 1; $i <= 3; $i++) {
        $topic = ContentFixtures::publishedTopic(['slug' => "s3-clamp-{$i}", 'title_en' => "S3 Clamp {$i}"]);
        Lesson::factory()->for($topic)->create([
            'level' => 'B1', 'status' => 'published', 'published_at' => now(),
        ]);
    }

    $this->actingAs($student)->get('/app?level=B1&page=9')->assertRedirect('/app?level=B1');
    $this->actingAs($student)->get('/app?level=B1&page=abc')->assertRedirect('/app?level=B1');
    $this->actingAs($student)->get('/app?level=B1&page=0')->assertRedirect('/app?level=B1');
});

test('array query params are treated as absent, never a 500', function () {
    $student = ContentFixtures::subscribedStudent();

    $this->actingAs($student)
        ->get('/app?level[]=x&category[]=y&q[]=z')
        ->assertOk();

    $this->actingAs($student)
        ->get('/app/words?tab[]=x&q[]=y')
        ->assertOk();

    // No public sample is seeded in this suite: the neutral 404 is fine;
    // an array-to-string 500 is not.
    expect($this->get('/sample?level[]=x&topic[]=y')->status())->toBeIn([200, 404]);
});

test('the library query count stays constant as topics grow (no N+1)', function () {
    $build = function (int $count, string $prefix): void {
        for ($i = 1; $i <= $count; $i++) {
            $topic = ContentFixtures::publishedTopic([
                'slug' => "{$prefix}-{$i}", 'title_en' => "Topic {$prefix} {$i}",
            ]);
            foreach (['A1', 'B1'] as $level) {
                Lesson::factory()->for($topic)->create([
                    'level' => $level, 'status' => 'published', 'published_at' => now(),
                ]);
            }
        }
    };

    $build(6, 's3-small');

    // The budget is about app queries, not the session store. The test
    // env pins the array driver; force it here so a developer .env.testing
    // with the database driver cannot add a per-request session write.
    config(['session.driver' => 'array']);

    // Paid-only slice: the library needs an active subscription (one
    // constant-cost gate: fresh user + subscription lookup on both legs).
    $this->actingAs(ContentFixtures::subscribedStudent());
    DB::enableQueryLog();
    DB::flushQueryLog();
    $this->get('/app')->assertOk();
    $small = count(DB::getQueryLog());

    $build(12, 's3-large');

    DB::flushQueryLog();
    $this->get('/app')->assertOk();
    $large = count(DB::getQueryLog());
    DB::disableQueryLog();

    // 6 topics (12 lessons) vs 18 topics (36 lessons): identical budgets.
    expect($large)->toBe($small)->and($small)->toBeLessThanOrEqual(10);
});

<?php

use App\Filament\Resources\Topics\TopicResource;
use App\Models\Lesson;
use App\Models\Topic;
use Tests\Support\ContentFixtures;

// S3-1: drafts, archived lessons, and lesson-less topics are invisible to
// anonymous visitors and non-staff users across browse, search, filter,
// and direct URLs. Staff sees the draft only inside the panel.

beforeEach(function () {
    $this->student = ContentFixtures::student();
    $this->staff = ContentFixtures::staff();

    $this->draftTopic = Topic::factory()->create([
        'slug' => 's3-hidden-draft', 'title_en' => 'S3 Hidden Draft',
        'status' => 'draft', 'published_at' => null,
    ]);
    Lesson::factory()->for($this->draftTopic)->create([
        'level' => 'A2', 'status' => 'published', 'is_public_sample' => true,
    ]);

    $this->archivedTopic = ContentFixtures::publishedTopic([
        'slug' => 's3-archived-only', 'title_en' => 'S3 Archived Only',
    ]);
    Lesson::factory()->for($this->archivedTopic)->create([
        'level' => 'B2', 'status' => 'archived', 'is_public_sample' => true,
    ]);

    $this->emptyTopic = ContentFixtures::publishedTopic([
        'slug' => 's3-empty-shelf', 'title_en' => 'S3 Empty Shelf',
    ]);

    $this->visibleTopic = ContentFixtures::publishedTopic([
        'slug' => 's3-visible', 'title_en' => 'S3 Visible',
    ]);
    Lesson::factory()->for($this->visibleTopic)->create([
        'level' => 'A2', 'status' => 'published', 'is_public_sample' => true,
    ]);
});

test('draft topics are absent from browse, search, filter, and direct URLs', function () {
    // Paid-only slice: anonymous browsing bounces to login; a subscribed
    // learner sees the list with drafts excluded.
    $this->get('/app')->assertRedirect(route('login'));

    $this->actingAs(ContentFixtures::subscribedStudent());
    foreach ([$this->get('/app'), $this->get('/app?q=Hidden'), $this->get('/app?level=A2')] as $response) {
        $response->assertOk();
        $response->assertDontSee('S3 Hidden Draft');
        $response->assertDontSee('s3-hidden-draft', false);
    }

    $this->get(route('reader.show', ['topic' => 's3-hidden-draft', 'level' => 'A2']))->assertNotFound();
    $this->actingAs($this->student)
        ->get(route('reader.show', ['topic' => 's3-hidden-draft', 'level' => 'A2']))
        ->assertNotFound();
});

test('archived lessons and lesson-less topics never appear in the library', function () {
    $response = $this->actingAs(ContentFixtures::subscribedStudent())->get('/app');
    $response->assertOk();
    $response->assertDontSee('S3 Archived Only');
    $response->assertDontSee('S3 Empty Shelf');
    $response->assertSee('S3 Visible');

    $this->get(route('reader.show', ['topic' => 's3-archived-only', 'level' => 'B2']))->assertNotFound();
    $this->get(route('reader.show', ['topic' => 's3-empty-shelf', 'level' => 'A2']))->assertNotFound();
    $this->actingAs($this->student)
        ->get(route('reader.show', ['topic' => 's3-archived-only', 'level' => 'B2']))
        ->assertNotFound();
});

test('staff cannot open the draft on the public reader either', function () {
    $this->actingAs($this->staff)
        ->get(route('reader.show', ['topic' => 's3-hidden-draft', 'level' => 'A2']))
        ->assertNotFound();
});

test('staff can preview the draft only inside the panel', function () {
    $url = TopicResource::getUrl('view', ['record' => $this->draftTopic]);

    $this->get($url)->assertRedirect('/admin/login');
    $this->actingAs($this->student)->get($url)->assertForbidden();
    $this->actingAs($this->staff)->get($url)->assertOk()->assertSee('S3 Hidden Draft');
});

<?php

use App\Models\Lesson;
use App\Models\User;
use Database\Seeders\S1SampleSeeder;

// S2 pre-slice correction 3: every private HTML family and every media
// response sends `Cache-Control: private, no-store` (scope §16). One test
// per route family, each with two users where a session exists.
//
// The assertion is directive-based (private + no-store present), not an
// exact string match: Livewire's back-button middleware legitimately merges
// extra no-cache/must-revalidate directives on component pages, which only
// strengthens the header. What must never happen is a cacheable response.
function assertPrivateNoStore($response): void
{
    $directives = collect(explode(',', strtolower((string) $response->headers->get('Cache-Control'))))
        ->map(fn ($directive) => trim($directive));

    expect($directives)->toContain('private')->and($directives)->toContain('no-store');
}

test('account HTML responses are private and uncacheable', function () {
    $user = User::factory()->create(['email' => 'account-a@example.com']);
    User::factory()->create(['email' => 'account-b@example.com']);

    $response = $this->actingAs($user)->get(route('account'));

    $response->assertOk();
    assertPrivateNoStore($response);
});

test('admin HTML responses are private and uncacheable', function () {
    // Guest leg first: an authenticated staff visit redirects to /admin.
    $login = $this->get('/admin/login');
    $login->assertOk();
    assertPrivateNoStore($login);

    $staff = User::factory()->create(['email' => 'staff-a@example.com', 'is_staff' => true]);
    User::factory()->create(['email' => 'staff-b@example.com', 'is_staff' => true]);

    $response = $this->actingAs($staff)->get('/admin');
    $response->assertOk();
    assertPrivateNoStore($response);
});

test('livewire update responses are private and uncacheable', function () {
    $user = User::factory()->create(['email' => 'lw-a@example.com']);
    User::factory()->create(['email' => 'lw-b@example.com']);

    $uri = route('default-livewire.update', [], false);

    $response = $this->actingAs($user)->postJson($uri, ['_token' => csrf_token()]);

    assertPrivateNoStore($response);
});

test('media responses are private and uncacheable', function () {
    $this->seed(S1SampleSeeder::class);
    $other = \Tests\Support\ContentFixtures::subscribedStudent();

    $lesson = Lesson::where('level', 'A2')
        ->whereHas('topic', fn ($q) => $q->where('slug', 'city-park'))
        ->firstOrFail();

    $response = $this->actingAs($other)->get(route('media.lesson.audio', $lesson));

    $response->assertOk();
    assertPrivateNoStore($response);
});

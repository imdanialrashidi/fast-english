<?php

use App\Models\Lesson;
use App\Models\User;
use Database\Seeders\S1SampleSeeder;
use Inertia\Testing\AssertableInertia;
use Livewire\Features\SupportAutoInjectedAssets\SupportAutoInjectedAssets;

// S1-1: anonymous sample journey. Each level view shows only that lesson's
// body text and audio source, with Persian RTL chrome + English LTR body.
beforeEach(function () {
    $this->seed(S1SampleSeeder::class);
    $this->a2 = Lesson::where('level', 'A2')
        ->whereHas('topic', fn ($q) => $q->where('slug', 'city-park'))
        ->firstOrFail();
    $this->b1 = Lesson::where('level', 'B1')
        ->whereHas('topic', fn ($q) => $q->where('slug', 'city-park'))
        ->firstOrFail();
});

test('anonymous visitor reads the A2 sample lesson with only its body and audio', function () {
    // M1 port (ADR-0002): the same no-mixing claims through the Inertia
    // transport. Persian copy and LTR attributes render client-side and
    // are proven in tests/browser/s1-journey.spec.ts; HTTP asserts the
    // root document direction plus the exact decoded props.
    // Paid-only slice: the learner URL redirects to the public sample
    // experience (owner requirement); the claims hold on the followed page.
    $redirect = $this->get(route('reader.show', ['topic' => 'city-park', 'level' => 'A2']))
        ->assertRedirect(route('sample', ['topic' => 'city-park', 'level' => 'A2']));
    $response = $this->followRedirects($redirect);

    $response->assertOk()
        ->assertSee('lang="fa" dir="rtl"', false);

    $a2Audio = route('media.lesson.audio', $this->a2);
    $response->assertInertia(fn (AssertableInertia $page) => $page
        ->component('Sample/Show')
        ->where('lesson.level', 'A2')
        ->where('lesson.audio_url', $a2Audio)
        ->where('topic.slug', 'city-park'));

    $props = $response->inertiaProps();
    expect(implode("\n", $props['paragraphs']))->toContain('On Saturday morning, Sara walks')
        ->and(implode("\n", $props['paragraphs']))->not->toContain('Sara loves Saturday mornings')
        ->and($response->getContent())->not->toContain(route('media.lesson.audio', $this->b1, false));

    // The B1 lesson's body and audio are absent: no cross-level mixing.
    $response->assertDontSee('Sara loves Saturday mornings');
});

test('anonymous visitor reads the B1 sample lesson with only its body and audio', function () {
    $redirect = $this->get(route('reader.show', ['topic' => 'city-park', 'level' => 'B1']))
        ->assertRedirect(route('sample', ['topic' => 'city-park', 'level' => 'B1']));
    $response = $this->followRedirects($redirect);

    $b1Audio = route('media.lesson.audio', $this->b1);
    $response->assertOk()->assertInertia(fn (AssertableInertia $page) => $page
        ->component('Sample/Show')
        ->where('lesson.level', 'B1')
        ->where('lesson.audio_url', $b1Audio));

    $props = $response->inertiaProps();
    expect(implode("\n", $props['paragraphs']))->toContain('Sara loves Saturday mornings')
        ->and(implode("\n", $props['paragraphs']))->not->toContain('On Saturday morning, Sara walks');

    $response->assertSee('Sara loves Saturday mornings');
    $response->assertDontSee('On Saturday morning, Sara walks');
});

test('sample audio bytes differ per level so a mix-up is detectable', function () {
    $a2 = $this->get(route('media.lesson.audio', $this->a2));
    $b1 = $this->get(route('media.lesson.audio', $this->b1));

    $a2->assertOk();
    $b1->assertOk();

    expect($a2->headers->get('Content-Length'))
        ->not->toBe($b1->headers->get('Content-Length'));
});

test('learner shell loads no Filament assets and binds exactly one audio source', function () {
    // M1 port (ADR-0002): the persistent player moved from Blade
    // @persist + reader-player.js to the React persistent layout. The
    // root document carries no Filament/Livewire/Alpine payload; the
    // single audio binding travels as exactly one authorized audio_url
    // prop for the active level (the element itself renders client-side
    // and is proven singular in tests/browser/s1-journey.spec.ts).
    // Static reset: Livewire's auto-injection flag persists across tests
    // in one process (set by Filament panel tests); a real HTTP request
    // starts clean, so the test resets it to prove the shell itself.
    if (class_exists(SupportAutoInjectedAssets::class)) {
        SupportAutoInjectedAssets::$hasRenderedAComponentThisRequest = false;
        SupportAutoInjectedAssets::$forceAssetInjection = false;
    }

    $redirect = $this->get(route('reader.show', ['topic' => 'city-park', 'level' => 'A2']))
        ->assertRedirect(route('sample', ['topic' => 'city-park', 'level' => 'A2']));
    $html = $this->followRedirects($redirect)
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('Sample/Show')
            ->where('lesson.audio_url', route('media.lesson.audio', $this->a2)))
        ->getContent();

    expect($html)->not->toContain('filament')
        ->and($html)->not->toContain('alpinejs')
        ->and($html)->not->toContain('livewire');

    // Structural backstop: the React surface references no second audio
    // owner and no admin stack at the source level.
    $sources = '';
    foreach (new RecursiveIteratorIterator(new RecursiveDirectoryIterator(resource_path('js'))) as $file) {
        if ($file->isFile() && in_array($file->getExtension(), ['ts', 'tsx'], true)) {
            $sources .= (string) file_get_contents($file->getPathname());
        }
    }
    expect(strtolower($sources))->not->toContain('filament')
        ->and(strtolower($sources))->not->toContain('alpine');
});

test('two users see the same public sample without leaking each other', function () {
    User::factory()->create(['email' => 'student-a@example.com']);
    User::factory()->create(['email' => 'student-b@example.com']);

    // Paid-only slice: ineligible learners resolve the sample through
    // the public experience (redirect); the followed page carries only
    // the viewer's own shared user, never the other account.
    $redirect = $this->actingAs(User::where('email', 'student-a@example.com')->first())
        ->get(route('reader.show', ['topic' => 'city-park', 'level' => 'A2']))
        ->assertRedirect(route('sample', ['topic' => 'city-park', 'level' => 'A2']));
    $followed = $this->followRedirects($redirect)->assertOk();
    $props = $followed->inertiaProps();
    expect(implode("\n", $props['paragraphs']))->toContain('On Saturday morning, Sara walks')
        ->and($followed->getContent())->not->toContain('student-b@example.com');
});

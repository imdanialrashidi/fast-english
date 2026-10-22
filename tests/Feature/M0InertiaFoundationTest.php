<?php

use App\Models\Lesson;
use Database\Seeders\S5PaymentFixtureSeeder;
use Illuminate\Support\Arr;
use Inertia\Testing\AssertableInertia;
use Tests\Support\ContentFixtures;

// M0 Inertia foundation (ADR-0002): the Laravel → Inertia → React path.
// Every test here observes the protocol over HTTP on PostgreSQL — no mocks
// of the adapter, no blurred transport. Failure model: middleware missing
// or misordered, wrong root view, shared props leaking secrets, missing
// error page, palette drift in the new surface.

beforeEach(function () {
    $this->seed(S5PaymentFixtureSeeder::class);
});

test('landing serves the inertia root template with fa rtl and permanent light', function () {
    $html = $this->get(route('landing'))->assertOk()->getContent();

    expect($html)->toContain('lang="fa"')
        ->and($html)->toContain('dir="rtl"')
        ->and($html)->toContain('rel="canonical"')
        // Permanent light theme: no theme switching code anywhere in the
        // first paint — no data-theme, no fe-theme storage, no pre-paint
        // script choosing a theme.
        ->and($html)->not->toContain('data-theme')
        ->and($html)->not->toContain('fe-theme')
        ->and($html)->not->toContain('prefers-color-scheme')
        ->and($html)->toContain('content="#F7F4EE"')
        // The Inertia mount point with the encoded page.
        ->and($html)->toContain('id="app"')
        ->and($html)->toContain('data-page');
});

test('inertia protocol response carries the landing component and version', function () {
    $version = $this->get(route('landing'))->assertOk()->inertiaPage()['version'];
    expect($version)->not->toBeEmpty();

    // A versioned XHR visit gets the JSON protocol response.
    $response = $this->get(route('landing'), [
        'X-Inertia' => 'true',
        'X-Inertia-Version' => $version,
    ]);

    $response->assertOk()->assertHeader('X-Inertia', 'true');

    $page = $response->json();
    expect($page['component'])->toBe('Landing/Index');
    expect($page)->toHaveKeys(['component', 'props', 'url', 'version']);
    expect($page['props'])->toHaveKeys(['auth', 'flash', 'sampleParagraphs', 'plans', 'urls']);

    // A stale asset version forces a full reload instead of JSON.
    $this->get(route('landing'), [
        'X-Inertia' => 'true',
        'X-Inertia-Version' => 'stale-version',
    ])->assertConflict();

    // The file behind the component name really exists (the adapter
    // re-checks this inside assertInertia via ensure_pages_exist).
    $this->get(route('landing'))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $assert) => $assert->component('Landing/Index'));
});

test('shared props expose only the user allowlist and flash', function () {
    // Guest: null user, null flash.
    $this->get(route('landing'))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->where('auth.user', null)
            ->missing('auth.user.password')
            ->where('flash.success', null)
            ->where('flash.error', null));

    // Signed in: the landing is guest-only now (owner separation), so the
    // same allowlist is observed on the canonical account page.
    $student = ContentFixtures::student();
    $this->actingAs($student)->get(route('landing'))->assertRedirect(route('today.index'));

    $props = $this->get(route('app.account'))
        ->assertOk()
        ->inertiaProps('auth');

    expect($props['user'])->toBe([
        'id' => $student->id,
        'name' => $student->name,
        'email' => $student->email,
    ]);
});

test('landing props expose only the public sample media and an allowlisted key set', function () {
    $topic = ContentFixtures::publishedTopic();
    $sample = Lesson::factory()->for($topic)->create([
        'level' => 'A2',
        'status' => 'published',
        'published_at' => now(),
        'is_public_sample' => true,
    ]);

    $props = $this->get(route('landing'))->assertOk()->inertiaProps();

    // The public sample's own stream is the only media URL allowed here.
    expect($props['sampleAudioUrl'])->toBe(route('media.lesson.audio', $sample))
        ->and($props['sampleParagraphs'])->not->toBeEmpty();

    // Assert the prop keys, not raw HTML text: the old substring check
    // could not tell a legitimate public sample URL from a premium leak.
    $keys = array_keys(Arr::dot($props));

    $audioKeys = array_values(array_filter($keys, fn (string $key) => str_contains(strtolower($key), 'audio')));
    expect($audioKeys)->toBe(['sampleAudioUrl']);

    foreach ($keys as $key) {
        foreach (['body_en', 'glossary', 'price_toman', 'amount_toman', 'receipt', 'password', 'internal_note', 'bank_reference', 'sender_last4'] as $needle) {
            expect(str_contains(strtolower($key), $needle))->toBeFalse("landing prop [{$key}] leaks [{$needle}]");
        }
    }

    // The shared topic-card module owns the featured shape.
    expect(array_keys($props['featured'][0]))->toBe([
        'slug',
        'title_en',
        'cover_url',
        'category_name',
        'levels',
        'first_level',
        'extra_levels',
        'minutes',
    ]);

    // The guest landing never receives an authenticated-app URL.
    expect($keys)->not->toContain('featured.0.reader_url');
});

test('unknown inertia route renders the react error page with shared data', function () {
    // Initial visit (no XHR): the handler renders the root view with the
    // ErrorPage component plus the shared props (withSharedData).
    $this->get('/app/topics/no-such-topic-xyz')
        ->assertNotFound()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('ErrorPage')
            ->where('status', 404)
            ->has('auth'));
});

test('sessionless unknown path renders the error page with a null user', function () {
    // Regression: the exception handler resolves this middleware outside
    // the web group, where there is no session — share() must stay null
    // instead of throwing (broke S3StaffUploadTest's /storage probe).
    $this->get('/favicon-missing-xyz-123')
        ->assertNotFound()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('ErrorPage')
            ->where('status', 404)
            ->where('auth.user', null));
});

test('inertia stylesheet owns the exact owner palette with no dark code', function () {
    $css = (string) file_get_contents(resource_path('css/inertia.css'));

    // Exact DESIGN.md Premium editorial hexes (2026-10-10, canonical).
    foreach ([
        '--color-canvas' => '#F7F4EE',
        '--color-surface' => '#FFFFFF',
        '--color-ink' => '#101B33',
        '--color-muted' => '#55607A',
        '--color-line' => '#E4DED2',
        '--color-field' => '#7C8798',
        '--color-primary' => '#1F3B82',
        '--color-primary-hover' => '#172F69',
        '--color-accent' => '#0E8F8A',
        '--color-accent-strong' => '#0B6E6A',
        '--color-success' => '#1B7F4B',
        '--color-danger' => '#B42318',
    ] as $token => $hex) {
        expect($css)->toContain("{$token}: {$hex};");
    }

    // Permanent light only: no dark variant, no theme switching, no storage.
    expect($css)->not->toContain('dark:')
        ->and($css)->not->toContain('data-theme')
        ->and($css)->not->toContain('fe-theme');

    // No hex literal lives in the React sources — tokens only.
    $tsx = '';
    foreach (new RecursiveIteratorIterator(new RecursiveDirectoryIterator(resource_path('js'))) as $file) {
        if ($file->isFile() && in_array($file->getExtension(), ['ts', 'tsx'], true)) {
            $tsx .= (string) file_get_contents($file->getPathname());
        }
    }
    expect($tsx)->not->toMatch('/#[0-9a-fA-F]{6}/');
    expect($tsx)->not->toContain('fe-theme');
});

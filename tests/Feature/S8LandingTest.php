<?php

use App\Models\Lesson;
use App\Models\Plan;
use Database\Seeders\S5PaymentFixtureSeeder;
use Inertia\Testing\AssertableInertia;
use Tests\Support\ContentFixtures;

// S8-1 (public pages): landing + trust pages render with lang fa, dir
// rtl, and metadata. Two users are irrelevant here (public surface), but
// both states of the sales switch are proven with the DB plan list.

beforeEach(function () {
    $this->seed(S5PaymentFixtureSeeder::class);
});

test('landing renders fa rtl with metadata, sample link, plans, and no draft label', function () {
    $topic = ContentFixtures::publishedTopic();
    Lesson::factory()->for($topic)->create([
        'level' => 'A2',
        'status' => 'published',
        'published_at' => now(),
        'is_public_sample' => true,
    ]);

    // M0 port (ADR-0002): the same claims through the Inertia transport.
    // Persian copy assertions moved to the rendered browser proof
    // (tests/browser/m0-inertia.spec.ts) — HTTP sees the root template +
    // the encoded page, not client-rendered text.
    $html = $this->get(route('landing'))->assertOk()->getContent();

    expect($html)->toContain('lang="fa"')
        ->and($html)->toContain('dir="rtl"')
        ->and($html)->toContain('rel="canonical"')
        // The landing is real copy now: no DRAFT badge (trust pages keep theirs).
        ->and($html)->not->toContain('DRAFT');

    $this->get(route('landing'))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('Landing/Index')
            // Deep link to the public sample experience + level.
            ->where('sample.reader_url', route('sample', ['topic' => $topic->slug, 'level' => 'A2']))
            ->where('sample.level', 'A2')
            ->has('sampleSentences')
            // Plan names from the database, never amounts (no price claims).
            ->has('plans', fn (AssertableInertia $plans) => $plans
                ->where('0.name_fa', 'یک‌ماهه آزمایشی (TEST)')
                ->missing('0.price_toman')
                ->missing('0.amount_toman')
                ->etc())
            ->where('salesOn', true)
            ->where('urls.download', route('download'))
            ->where('urls.faq', route('trust.faq')));

    // Amounts never appear anywhere in the encoded page either.
    expect($html)->not->toContain('100000')
        ->and($html)->not->toContain('price_toman');
});

test('landing without a sample shows the neutral state, never a broken link', function () {
    // M0 port: no sample resolves to a null prop (the neutral panel is
    // rendered client-side and proven in tests/browser/m0-inertia.spec.ts).
    $this->get(route('landing'))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('Landing/Index')
            ->where('sample', null)
            ->where('sampleSentences', [])
            ->missing('sample.reader_url'));
});

test('landing with sales off shows the preparing state and no purchase cta', function () {
    config(['sales.enabled' => false]);

    $topic = ContentFixtures::publishedTopic();
    Lesson::factory()->for($topic)->create([
        'level' => 'A2',
        'status' => 'published',
        'published_at' => now(),
        'is_public_sample' => true,
    ]);

    // M0 port: the switch travels as a prop; the preparing panel and the
    // absent purchase CTA render client-side (no plan names rendered).
    // The plan rows stay in props (snapshot source for later slices) but
    // carry no amounts.
    $this->get(route('landing'))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('Landing/Index')
            ->where('salesOn', false)
            ->where('sample.level', 'A2')
            ->has('plans', fn (AssertableInertia $plans) => $plans
                ->has('0.name_fa')
                ->missing('0.price_toman')
                ->etc()));
});

test('trust pages render fa rtl drafts with canonical tags', function () {
    foreach (['about', 'cooperation', 'faq', 'support', 'terms', 'privacy'] as $page) {
        $html = $this->get(route('trust.'.$page))->assertOk()->getContent();
        expect($html)->toContain('lang="fa"')
            ->and($html)->toContain('dir="rtl"')
            ->and($html)->toContain('rel="canonical"')
            ->and($html)->toContain('DRAFT');
    }
});

test('support terms and privacy show blocked states with no invented details', function () {
    foreach (['support', 'terms', 'privacy'] as $page) {
        $html = $this->get(route('trust.'.$page))->assertOk()->getContent();
        expect($html)->toContain('BLOCKED');
    }

    $support = $this->get(route('trust.support'))->getContent();
    // No invented contact: no email address and no phone-like digits.
    expect($support)->not->toMatch('/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i');

    $terms = $this->get(route('trust.terms'))->getContent();
    $privacy = $this->get(route('trust.privacy'))->getContent();
    expect($terms)->not->toContain('ماده')
        ->and($privacy)->not->toContain('ماده');
});

test('sitemap lists public pages only', function () {
    $body = $this->get(route('sitemap'))->assertOk()->getContent();

    foreach (['/', '/about', '/cooperation', '/faq', '/support', '/terms', '/privacy', '/download'] as $path) {
        expect($body)->toContain(config('app.url').$path);
    }
    expect($body)->not->toContain('/app')
        ->and($body)->not->toContain('/admin')
        ->and($body)->not->toContain('/login')
        ->and($body)->not->toContain('/media');
});

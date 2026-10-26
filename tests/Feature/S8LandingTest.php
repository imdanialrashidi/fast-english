<?php

use App\Models\Lesson;
use App\Models\Plan;
use App\Models\User;
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
    $sample = Lesson::factory()->for($topic)->create([
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
        // The landing is real copy now: no internal workflow labels anywhere
        // in the public surface (trust pages included, 2026-10-25).
        ->and($html)->not->toContain('DRAFT');

    $this->get(route('landing'))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('Landing/Index')
            // Deep link to the public sample experience + level.
            ->where('sample.reader_url', route('sample', ['topic' => $topic->slug, 'level' => 'A2']))
            ->where('sample.level', 'A2')
            ->has('sampleParagraphs')
            // The preview plays the public sample's own stream and uses
            // the server's cue-usability flag (no client re-derivation).
            ->where('sampleAudioUrl', route('media.lesson.audio', $sample))
                        // The shared topic-card module owns the featured shape.
            ->has('featured', fn (AssertableInertia $featured) => $featured
                ->where('0.slug', $topic->slug)
                ->missing('0.reader_url')
                ->etc())
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
            ->where('sampleParagraphs', [])
            ->where('sampleAudioUrl', null)
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

test('trust pages render public fa rtl copy with canonical tags', function () {
    foreach (['about', 'cooperation', 'faq', 'support', 'terms', 'privacy', 'refund'] as $page) {
        $html = $this->get(route('trust.'.$page))->assertOk()->getContent();
        expect($html)->toContain('lang="fa"')
            ->and($html)->toContain('dir="rtl"')
            ->and($html)->toContain('rel="canonical"')
            // Owner instruction 2026-10-25: no internal workflow labels.
            ->and($html)->not->toContain('DRAFT')
            ->and($html)->not->toContain('BLOCKED')
            ->and($html)->not->toContain('نیازمند بازبینی');
    }
});

test('trust pages publish the owner contact channel and legal copy', function () {
    $support = $this->get(route('trust.support'))->assertOk();
    $support->assertInertia(fn (AssertableInertia $page) => $page
        ->component('Trust/Show')
        ->where('page', 'support')
        ->where('contact.support_channel', 'support@fastenglish.ir')
        ->where('contact.support_href', 'mailto:support@fastenglish.ir')
        ->where('contact.cooperation_channel', 'support@fastenglish.ir'));

    foreach (['terms' => 'این شرایط', 'privacy' => 'حریم خصوصی', 'refund' => 'بازگشت وجه'] as $name => $needle) {
        $response = $this->get(route('trust.'.$name))->assertOk();
        $response->assertInertia(fn (AssertableInertia $page) => $page
            ->component('Trust/Show')
            ->where('page', $name)
            ->where('legal', fn ($legal): bool => is_string($legal) && str_contains($legal, $needle)));
        expect($response->getContent())->not->toContain('DRAFT')
            ->and($response->getContent())->not->toContain('BLOCKED');
    }

    // The cooperation page exposes the configured channel, not an invented one.
    $this->get(route('trust.cooperation'))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->where('contact.cooperation_channel', 'support@fastenglish.ir')
            ->where('contact.cooperation_href', 'mailto:support@fastenglish.ir'));
});

test('sitemap lists public pages only', function () {
    $body = $this->get(route('sitemap'))->assertOk()->getContent();

    foreach (['/', '/about', '/cooperation', '/faq', '/support', '/terms', '/privacy', '/refund', '/download', '/install'] as $path) {
        expect($body)->toContain(config('app.url').$path);
    }
    expect($body)->not->toContain('/app')
        ->and($body)->not->toContain('/admin')
        ->and($body)->not->toContain('/login')
        ->and($body)->not->toContain('/media');
});

test('landing ships crawler-ready metadata and FAQ structured data', function () {
    ContentFixtures::publishedTopic();

    $html = $this->get(route('landing'))->assertOk()->getContent();

    expect($html)->toContain('<meta name="description"')
        ->and($html)->toContain('property="og:title"')
        ->and($html)->toContain('property="og:url"')
        ->and($html)->toContain('application/ld+json')
        ->and($html)->toContain('FAQPage')
        ->and($html)->toContain('SoftwareApplication');
});

test('signed-in visitors are redirected from every marketing page into the app', function () {
    $user = User::factory()->create();

    $this->actingAs($user);

    foreach (['landing', 'trust.about', 'trust.cooperation', 'trust.faq', 'trust.support', 'trust.terms', 'trust.privacy', 'trust.refund', 'download'] as $route) {
        $this->get(route($route))->assertRedirect(route('today.index'));
    }

    // The install guide is outside that boundary on purpose: Account links
    // to it for iPhone users, who never see the in-app install card.
    $this->get(route('install'))->assertOk();

    // The public sample is deliberately outside the marketing boundary:
    // the in-app locked state links to it as the free path.
    $topic = ContentFixtures::publishedTopic();
    Lesson::factory()->for($topic)->create([
        'level' => 'A2',
        'status' => 'published',
        'published_at' => now(),
        'is_public_sample' => true,
    ]);
    $this->get(route('sample'))->assertOk();
});

test('landing URL bag never exposes authenticated app destinations', function () {
    $urls = $this->get(route('landing'))->assertOk()->inertiaProps('urls');

    expect(array_keys($urls))->toBe(['sample', 'register', 'download', 'faq']);
});

test('sitemap includes the public sample only while one exists', function () {
    $topic = ContentFixtures::publishedTopic(['slug' => 'sitemap-sample']);
    Lesson::factory()->for($topic)->create([
        'level' => 'A2',
        'status' => 'published',
        'published_at' => now(),
        'is_public_sample' => true,
    ]);

    $body = $this->get(route('sitemap'))->assertOk()->getContent();
    expect($body)->toContain(config('app.url').'/sample');
});

test('public sample ships canonical, description, and Article structured data', function () {
    $topic = ContentFixtures::publishedTopic(['slug' => 'sample-seo', 'summary_public' => 'یک نمونه عمومی.']);
    Lesson::factory()->for($topic)->create([
        'level' => 'A2',
        'status' => 'published',
        'published_at' => now(),
        'is_public_sample' => true,
    ]);

    $html = $this->get(route('sample', ['topic' => $topic->slug, 'level' => 'A2']))
        ->assertOk()
        ->getContent();

    expect($html)->toContain('<link rel="canonical" href="'.route('sample').'">')
        ->and($html)->toContain('<meta name="description"')
        ->and($html)->toContain('"@type":"Article"')
        ->and($html)->toContain('"isAccessibleForFree":true')
        ->and($html)->not->toContain('canonical" href="'.route('sample').'?');
});

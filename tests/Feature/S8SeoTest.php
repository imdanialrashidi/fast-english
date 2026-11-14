<?php

use App\Http\Middleware\NormalizeTrailingSlash;
use Database\Seeders\S1SampleSeeder;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Tests\Support\ContentFixtures;

// Public SEO contract: each page owns its server-rendered title,
// description, canonical, social image, and structured data. The client
// SeoHead mirrors these tags during Inertia visits; the HTTP assertions
// below prove the crawler/no-JS first paint.

test('trust pages ship unique titles descriptions and one social image', function () {
    $titles = [];
    $descriptions = [];

    foreach (['about', 'cooperation', 'faq', 'support', 'terms', 'privacy', 'refund'] as $page) {
        $html = $this->get(route('trust.'.$page))->assertOk()->getContent();

        preg_match('/<title inertia>(.*?)<\/title>/s', $html, $title);
        preg_match('/<meta name="description"[^>]*content="([^"]*)"/', $html, $description);

        expect($title[1] ?? '')->not->toBe('')
            ->and($description[1] ?? '')->not->toBe('')
            ->and($html)->toContain('data-inertia="description"')
            ->and($html)->toContain('property="og:image" data-inertia="og:image"')
            ->and($html)->toContain('images/og/fast-english-1200x630.png')
            ->and($html)->toContain('<link rel="canonical" data-inertia="canonical" href="'.route('trust.'.$page).'">');

        $titles[] = $title[1];
        $descriptions[] = $description[1];
    }

    expect(array_unique($titles))->toHaveCount(7)
        ->and(array_unique($descriptions))->toHaveCount(7);
});

test('landing ships organization faq and social metadata in the first paint', function () {
    ContentFixtures::publishedTopic();

    $html = $this->get(route('landing'))->assertOk()->getContent();

    expect($html)->toContain('property="og:image" data-inertia="og:image"')
        ->and($html)->toContain('name="twitter:card" data-inertia="twitter:card" content="summary_large_image"')
        ->and($html)->toContain('"@type":"Organization"')
        ->and($html)->toContain('"@type":"WebSite"')
        ->and($html)->toContain('"@type":"FAQPage"')
        ->and($html)->toContain('"@id":"'.route('landing').'#organization"');
});

test('faq page emits faqpage structured data from the same server list', function () {
    $html = $this->get(route('trust.faq'))->assertOk()->getContent();
    $props = $this->get(route('trust.faq'))->assertOk()->inertiaProps();

    expect($html)->toContain('"@type":"FAQPage"')
        ->and($html)->toContain('آیا بدون حساب می‌توانم نمونه را ببینم؟')
        ->and($html)->toContain('سطح‌ها چه معنایی دارند؟')
        ->and($props['faqs'])->toHaveCount(4);
});

test('public trailing slashes redirect to the canonical slashless url', function () {
    $middleware = new NormalizeTrailingSlash;

    $about = $middleware->handle(Request::create('/about/'), fn () => response('ok'));
    expect($about->getStatusCode())->toBe(301)
        ->and($about->headers->get('Location'))->toEndWith('/about');

    $sample = $middleware->handle(Request::create('/sample/?level=A1'), fn () => response('ok'));
    expect($sample->getStatusCode())->toBe(301)
        ->and($sample->headers->get('Location'))->toEndWith('/sample?level=A1');

    // Private/application paths keep their own routing.
    expect($middleware->handle(Request::create('/app/'), fn () => response('ok'))->getStatusCode())->toBe(200);
});

test('google site verification meta is opt-in', function () {
    config(['services.google.site_verification' => 'verify-token-123']);

    expect($this->get(route('landing'))->assertOk()->getContent())
        ->toContain('<meta name="google-site-verification" content="verify-token-123">');

    config(['services.google.site_verification' => null]);

    expect($this->get(route('landing'))->assertOk()->getContent())
        ->not->toContain('google-site-verification');
});

test('the root template preloads the LCP font and the hero cover', function () {
    $this->seed(S1SampleSeeder::class);

    $html = $this->get(route('sample'))->assertOk()->getContent();

    expect($html)->toContain('rel="preload" as="font"')
        ->and($html)->toContain('vazirmatn-arabic-variable.woff2')
        ->and($html)->toContain('rel="preload" as="image"')
        ->and($html)->toContain('fetchpriority="high"');

    // A page with no hero must not preload an unrelated image.
    expect($this->get(route('trust.faq'))->assertOk()->getContent())
        ->not->toContain('rel="preload" as="image"');
});

test('a public page reads the settings table once', function () {
    DB::enableQueryLog();

    try {
        $this->get(route('trust.faq'))->assertOk();
    } finally {
        $queries = DB::getQueryLog();
        DB::disableQueryLog();
    }

    $settingsQueries = collect($queries)
        ->pluck('query')
        ->filter(fn (string $sql) => str_contains($sql, 'from "settings"'))
        ->count();

    expect($settingsQueries)->toBe(1);
});

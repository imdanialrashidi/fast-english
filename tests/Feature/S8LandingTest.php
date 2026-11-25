<?php

use App\Models\Lesson;
use App\Models\User;
use App\Support\Toman;
use Database\Seeders\S5PaymentFixtureSeeder;
use Illuminate\Support\Arr;
use Inertia\Testing\AssertableInertia;
use Tests\Support\ContentFixtures;

// S8-1 public pages, rewritten for the owner instruction of 2026-11-25:
// the landing sells one monthly subscription, shows exactly three summary
// claims, offers mixed podcast/TED content metadata, and never links to the
// retired public sample. Trust pages keep the confirmed support phone and
// the Bale/Telegram actions; the refund page is gone.

beforeEach(function () {
    $this->seed(S5PaymentFixtureSeeder::class);
});

test('landing renders fa rtl with the three claims, monthly offer, and support paths', function () {
    $html = $this->get(route('landing'))->assertOk()->getContent();

    expect($html)->toContain('lang="fa"')
        ->and($html)->toContain('dir="rtl"')
        ->and($html)->toContain('rel="canonical"')
        ->and($html)->not->toContain('DRAFT');

    $this->get(route('landing'))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('Landing/Index')
            ->where('stats.learners', 16355)
            ->where('stats.levels', 6)
            ->has('stats.listeningHours')
            ->where('offer.price_label', Toman::format(641000))
            ->where('offer.compare_label', Toman::format(990000))
            ->where('offer.discount_percent', 35)
            ->missing('offer.per_day_label')
            ->missing('offer.duration_days')
            ->has('podcasts')
            ->has('talks')
            ->missing('sample')
            ->missing('sampleAudioUrl')
            ->missing('sampleParagraphs')
            ->missing('plans')
            ->where('urls.start', route('login'))
            ->where('urls.login', route('login'))
            ->where('urls.register', route('register'))
            ->where('urls.download', route('download'))
            ->where('urls.install', route('install'))
            ->where('urls.faq', route('trust.faq'))
            ->where('urls.support', route('trust.support'))
            ->where('faqs.0.q', 'فست انگلیش برای چه کسی ساخته شده؟')
            ->where('faqs.0.a', 'برای افرادی که می‌خواهند انگلیسی را به‌صورت جذاب، اصولی و متناسب با سطح خودشان یاد بگیرند.'));
});

test('landing props expose no premium, media, or authenticated-app key', function () {
    $props = $this->get(route('landing'))->assertOk()->inertiaProps();
    $keys = array_keys(Arr::dot($props));

    foreach (['body_en', 'glossary', 'audio_url', 'audioUrl', 'price_toman', 'amount_toman', 'receipt', 'password', 'internal_note', 'bank_reference', 'sender_last4'] as $needle) {
        foreach ($keys as $key) {
            expect(str_contains(strtolower($key), strtolower($needle)))->toBeFalse("landing prop [{$key}] leaks [{$needle}]");
        }
    }

    expect($keys)->not->toContain('urls.app')
        ->and($keys)->not->toContain('podcasts.0.reader_url');
});

test('landing never links to the retired public sample', function () {
    $topic = ContentFixtures::publishedTopic();
    Lesson::factory()->for($topic)->create([
        'level' => 'A2',
        'status' => 'published',
        'published_at' => now(),
        'is_public_sample' => true,
    ]);

    $html = $this->get(route('landing'))->assertOk()->getContent();

    expect($html)->not->toContain('شروع با نمونه رایگان')
        ->and($html)->not->toContain('نمونه رایگان')
        ->and($html)->not->toContain('href="/sample"');
    $this->get('/sample')->assertNotFound();
});

test('public /plans sends guests to the offer anchor and learners to checkout', function () {
    $this->get(route('plans'))
        ->assertRedirect(route('landing').'#pricing');

    $student = User::factory()->create();
    $this->actingAs($student)
        ->get(route('plans'))
        ->assertRedirect(route('subscribe.index'));
});

test('trust pages render public fa rtl copy with canonical tags', function () {
    foreach (['about', 'cooperation', 'faq', 'support', 'terms', 'privacy'] as $page) {
        $html = $this->get(route('trust.'.$page))->assertOk()->getContent();
        expect($html)->toContain('lang="fa"')
            ->and($html)->toContain('dir="rtl"')
            ->and($html)->toContain('rel="canonical"')
            ->and($html)->not->toContain('DRAFT')
            ->and($html)->not->toContain('BLOCKED')
            ->and($html)->not->toContain('نیازمند بازبینی');
    }
});

test('trust support publishes 09936908633 and the four owner FAQ rows', function () {
    $this->get(route('trust.support'))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('Trust/Show')
            ->where('page', 'support')
            ->where('contact.support_channel', 'info@fastenglishpodcast.ir')
            ->where('contact.support_href', 'mailto:info@fastenglishpodcast.ir')
            ->where('contact.support_phone', '09936908633')
            ->where('contact.support_phone_href', 'tel:+989936908633')
            ->where('contact.support_messenger', 'بله یا تلگرام')
            ->where('contact.support_bale_url', 'https://ble.ir/+989936908633')
            ->where('contact.support_telegram_url', 'https://t.me/+989936908633')
            ->where('contact.cooperation_channel', 'info@fastenglishpodcast.ir'));

    $this->get(route('trust.faq'))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('Trust/Show')
            ->where('page', 'faq')
            ->has('faqs', 4)
            ->where('faqs.0.q', 'فست انگلیش برای چه کسی ساخته شده؟')
            ->where('faqs.1.q', 'سطح‌ها چه معنی دارند؟')
            ->where('faqs.2.q', 'خرید چگونه انجام می‌شود؟')
            ->where('faqs.3.q', 'چگونه اپلیکیشن را نصب کنم؟'));

    foreach (['terms', 'privacy'] as $name) {
        $response = $this->get(route('trust.'.$name))->assertOk();
        $response->assertInertia(fn (AssertableInertia $page) => $page
            ->component('Trust/Show')
            ->where('page', $name)
            ->where('legal', fn ($legal): bool => is_string($legal) && $legal !== ''));
        expect($response->getContent())->not->toContain('DRAFT')
            ->and($response->getContent())->not->toContain('BLOCKED');
    }

    $this->get(route('trust.terms'))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->where('legal', fn ($legal): bool => is_string($legal)
                && str_contains($legal, 'اپلیکیشن یادگیری زبان انگلیسی با پادکست')
                && ! str_contains($legal, 'بازگشت وجه')));
});

test('sitemap lists public pages only and never the retired sample or refund', function () {
    $body = $this->get(route('sitemap'))->assertOk()->getContent();

    foreach (['/', '/about', '/cooperation', '/faq', '/support', '/terms', '/privacy', '/download', '/install'] as $path) {
        expect($body)->toContain(config('app.url').$path);
    }
    expect($body)->not->toContain('/sample')
        ->and($body)->not->toContain('/refund')
        ->and($body)->not->toContain('/app')
        ->and($body)->not->toContain('/admin')
        ->and($body)->not->toContain('/login')
        ->and($body)->not->toContain('/media');
});

test('landing ships crawler-ready metadata and FAQ structured data', function () {
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

    foreach (['landing', 'trust.about', 'trust.cooperation', 'trust.faq', 'trust.support', 'trust.terms', 'trust.privacy'] as $route) {
        $this->get(route($route))->assertRedirect(route('today.index'));
    }

    // Download and install stay public utilities for signed-in learners.
    $this->get(route('download'))->assertOk();
    $this->get(route('install'))->assertOk();
});

test('landing URL bag never exposes authenticated app destinations', function () {
    $urls = $this->get(route('landing'))->assertOk()->inertiaProps('urls');

    expect(array_keys($urls))->toBe(['start', 'login', 'register', 'download', 'install', 'faq', 'support']);
});

test('landing download link follows the real release metadata', function () {
    $this->get(route('landing'))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->where('releasePublished', false)
            ->where('downloadUrl', null));

    $artifact = config('release.artifact');
    config([
        'release.version_name' => $artifact['version_name'],
        'release.version_code' => $artifact['version_code'],
        'release.release_date' => $artifact['release_date'],
        'release.size_bytes' => $artifact['size_bytes'],
        'release.sha256' => $artifact['sha256'],
        'release.file_url' => $artifact['file_url'],
    ]);

    $this->get(route('landing'))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->where('releasePublished', true)
            ->where('downloadUrl', $artifact['file_url']));
});

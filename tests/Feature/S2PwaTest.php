<?php

use App\Support\PublicAssets;
use Database\Seeders\S1SampleSeeder;
use Illuminate\Support\Facades\File;
use Tests\Support\ContentFixtures;

// S2 PWA shell + TWA association (scope §18). Staging installability itself
// is BLOCKED without an HTTPS host; these tests lock the served shape that
// Chromium will evaluate once staging exists.

test('manifest is installable-shaped with Persian RTL and both icon types', function () {
    $response = $this->get('/manifest.webmanifest');

    $response->assertOk();
    expect($response->headers->get('Content-Type'))->toContain('application/manifest+json');

    $manifest = $response->json();
    expect($manifest['name'])->toContain('Fast English')
        ->and($manifest['lang'])->toBe('fa')
        ->and($manifest['dir'])->toBe('rtl')
        ->and($manifest['display'])->toBe('standalone')
        ->and($manifest['start_url'])->toBe('/app')
        ->and($manifest['scope'])->toBe('/');

    $purposes = array_map(
        fn ($icon) => ($icon['sizes'] ?? '').'|'.($icon['purpose'] ?? 'any'),
        $manifest['icons']
    );
    expect($purposes)->toContain('192x192|any')
        ->and($purposes)->toContain('512x512|maskable');

    foreach ($manifest['icons'] as $icon) {
        // Static files are served by the web server, not the test kernel:
        // assert presence and raster dimensions on disk.
        $path = public_path(ltrim(parse_url($icon['src'], PHP_URL_PATH), '/'));
        expect(is_file($path))->toBeTrue($icon['src'].' missing from public/');
        [$width, $height] = array_pad((array) getimagesize($path), 2, 0);
        [$want] = explode('x', $icon['sizes']);
        expect([$width, $height])->toBe([(int) $want, (int) $want]);
    }
});

test('service worker is versioned, uncacheable, and allowlist-only', function () {
    $response = $this->get('/sw.js');

    $response->assertOk();
    expect($response->headers->get('Content-Type'))->toContain('application/javascript')
        ->and($response->headers->get('Service-Worker-Allowed'))->toBe('/')
        ->and($response->headers->get('Cache-Control'))->toContain('no-store');

    $body = $response->getContent();
    expect($body)->toContain('fe-public-s2-v1')
        ->and($body)->toContain('FE_SKIP_WAITING')
        ->and($body)->toContain('/offline');

    foreach (['/media/', 'livewire', '/admin', 'account', 'receipt', 'progress', 'placement'] as $private) {
        expect($body)->not->toContain($private);
    }
});

test('precache allowlist contains only public entries', function () {
    $paths = PublicAssets::precache();

    expect($paths)->not->toBeEmpty()
        ->and($paths)->toContain('/offline');

    foreach ($paths as $path) {
        $public = str_starts_with($path, '/build/')
            || str_starts_with($path, '/icons/')
            || str_starts_with($path, '/fonts/')
            || in_array($path, ['/offline', '/manifest.webmanifest'], true);

        expect($public)->toBeTrue("precache entry [{$path}] is not public allowlisted");

        foreach (['media', 'livewire', 'admin', 'account', 'receipt', 'progress', 'placement'] as $private) {
            expect(str_contains(strtolower($path), $private))->toBeFalse();
        }
    }
});

test('precache is complete for the shared public-asset allowlist', function () {
    $allowlist = PublicAssets::allowlist();
    $manifestPath = public_path('build/manifest.json');

    // The PHP lane is not guaranteed to have frontend assets; the check
    // runs wherever `npm run build` has produced a manifest.
    if (! is_file($manifestPath)) {
        $this->markTestSkipped('Build assets first (npm run build) to verify precache completeness.');
    }

    $manifest = json_decode((string) File::get($manifestPath), true);
    expect(is_array($manifest))->toBeTrue();

    $precache = PublicAssets::precache();

    foreach ($allowlist['viteInputs'] as $entry) {
        $file = $manifest[$entry['path']]['file'] ?? null;
        expect($file)->not->toBeNull("missing build manifest entry [{$entry['path']}]");

        if ($entry['precache']) {
            expect($precache)->toContain('/build/'.$file);
        } else {
            expect($precache)->not->toContain('/build/'.$file);
        }
    }
});

test('offline page shows the exact Persian message with a retry control', function () {
    $response = $this->get('/offline');

    $response->assertOk();
    $response->assertSee('برای ادامه به اینترنت وصل شوید', false);
    expect($response->getContent())->toContain('id="fe-offline-retry"');

    // Never a premium fallback: no lesson body may leak into this page.
    expect($response->getContent())->not->toContain('Leila');
});

test('app start_url resolves', function () {
    // Since S3 /app is the real library: it resolves and lists seeded content.
    // Paid-only slice: anonymous installs bounce to login; a subscribed
    // learner resolves the start_url with the seeded topic listed.
    $this->seed(S1SampleSeeder::class);

    $this->get('/app')->assertRedirect(route('login'));

    $this->actingAs(ContentFixtures::subscribedStudent())->get('/app')
        ->assertOk()
        ->assertSee('city-park', false);
});

test('assetlinks is empty until package and fingerprint are configured', function () {
    $this->get('/.well-known/assetlinks.json')
        ->assertOk()
        ->assertExactJson([]);
});

test('assetlinks lists the package and certificate exactly when configured', function () {
    config()->set('pwa.twa_package', 'com.fastenglishpodcast.app');
    config()->set('pwa.twa_fingerprint', 'AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99');

    $response = $this->get('/.well-known/assetlinks.json');

    $response->assertOk();
    $statement = $response->json()[0];
    expect($statement['target']['namespace'])->toBe('android_app')
        ->and($statement['target']['package_name'])->toBe('com.fastenglishpodcast.app')
        ->and($statement['target']['sha256_cert_fingerprints'])->toBe(['AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99']);
});

test('robots keeps non-production out of the index', function () {
    $this->get('/robots.txt')
        ->assertOk()
        ->assertSee('Disallow: /', false);
});

test('robots allows production', function () {
    $this->app['env'] = 'production';

    $body = $this->get('/robots.txt')->assertOk()->getContent();
    $lines = array_map('trim', explode("\n", trim($body)));
    // S8: production disallows private surfaces per path, never the
    // whole site (no blanket `Disallow: /` line).
    expect($lines)->not->toContain('Disallow: /')
        ->and($body)->toContain('Disallow: /app')
        ->and($body)->toContain('Disallow: /admin');
});

test('non-production HTML carries a noindex robots header', function () {
    $this->seed(S1SampleSeeder::class);

    // Paid-only slice: the sample resolves through the public
    // experience; the noindex blanket holds on the followed page.
    $redirect = $this->get(route('reader.show', ['topic' => 'city-park', 'level' => 'A2']))->assertRedirect();
    $response = $this->followRedirects($redirect);

    $response->assertOk();
    expect($response->headers->get('X-Robots-Tag'))->toBe('noindex, nofollow');
});

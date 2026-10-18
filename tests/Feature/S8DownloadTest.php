<?php

use Inertia\Testing\AssertableInertia;

// S8-5 (download): the not-yet-published state appears with no file,
// link, or checksum. The metadata template renders only from real values.

test('download shows not-published state with no file link or checksum', function () {
    config([
        'release.version_name' => null,
        'release.version_code' => null,
        'release.release_date' => null,
        'release.size_bytes' => null,
        'release.sha256' => null,
        'release.file_url' => null,
    ]);

    // Public-slice port (ADR-0002): the same unpublished claims through
    // the Inertia transport. The unpublished state renders client-side
    // (proven in the browser); HTTP asserts the root template, the
    // component, and the decoded release props — every value null.
    $response = $this->get(route('download'))->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('Download/Index')
            ->where('published', false));
    $html = $response->getContent();

    expect($html)->toContain('lang="fa"')
        ->and($html)->toContain('dir="rtl"')
        ->and($html)->toContain('rel="canonical"');
    $props = $response->inertiaProps();
    expect($props['published'])->toBeFalse();
    foreach (['version_name', 'version_code', 'release_date', 'size_bytes', 'sha256', 'file_url'] as $key) {
        expect($props['release'][$key])->toBeNull();
    }
    // No APK file, no link to one, no checksum hex anywhere in props.
    $encoded = (string) json_encode($props['release']);
    expect($encoded)->not->toMatch('/\.apk/i')
        ->and($encoded)->not->toMatch('/\b[0-9a-f]{64}\b/i');
});

test('download metadata template fills only from real values', function () {
    config([
        'release.version_name' => '1.0.0-test',
        'release.version_code' => '3',
        'release.release_date' => '2026-10-01',
        'release.size_bytes' => '12345678',
        'release.sha256' => str_repeat('a', 63).'b',
        'release.file_url' => '/releases/test-app.apk',
    ]);

    // Public-slice port (ADR-0002): metadata fills only from the real
    // release values, asserted on the decoded props.
    $response = $this->get(route('download'))->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('Download/Index')
            ->where('published', true));
    $props = $response->inertiaProps();
    expect($props['release']['version_name'])->toBe('1.0.0-test')
        ->and((string) $props['release']['size_bytes'])->toBe('12345678');
});

test('download with partial metadata stays unpublished', function () {
    config([
        'release.version_name' => '1.0.0-test',
        'release.version_code' => null,
        'release.release_date' => null,
        'release.size_bytes' => null,
        'release.sha256' => null,
        'release.file_url' => null,
    ]);

    // Public-slice port (ADR-0002): partial metadata keeps the
    // unpublished state — the real value never leaks early.
    $response = $this->get(route('download'))->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('Download/Index')
            ->where('published', false));
    expect($response->inertiaProps()['published'])->toBeFalse();
});

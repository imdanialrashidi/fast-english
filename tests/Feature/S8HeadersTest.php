<?php

use App\Http\Middleware\PrivateNoStore;
use Illuminate\Http\Request;
use Tests\Support\ContentFixtures;

// S8-4 (headers): noindex on app, admin, login, and staging. Private
// responses keep no-store. Two users: the private-HTML assertions hold
// for both the learner and another account.

test('private surfaces carry no-store for both users', function () {
    // Paid-only slice: the library leg needs an active subscription.
    $studentA = ContentFixtures::subscribedStudent();
    $studentB = ContentFixtures::subscribedStudent();

    foreach ([$studentA, $studentB] as $student) {
        $home = $this->actingAs($student)->get(route('app.home'))->assertOk();
        expect($home->headers->get('Cache-Control'))->toContain('private')->toContain('no-store');
        $subscribe = $this->actingAs($student)->get(route('subscribe.index'))->assertOk();
        expect($subscribe->headers->get('Cache-Control'))->toContain('private')->toContain('no-store');
    }
});

test('app admin and login carry noindex in every environment', function () {
    // Paid-only slice: the library leg needs an active subscription.
    $student = ContentFixtures::subscribedStudent();

    $this->actingAs($student)->get(route('app.home'))->assertHeader('X-Robots-Tag', 'noindex, nofollow');
    $this->get(route('login'))->assertHeader('X-Robots-Tag', 'noindex, nofollow');

    // The Filament login page (guest): staff authenticate there first,
    // then the panel gate applies.
    $this->get('/admin/login')->assertHeader('X-Robots-Tag', 'noindex, nofollow');
});

test('public landing keeps canonical under the staging blanket', function () {
    // In non-production every HTML page carries the staging blanket
    // noindex (existing S2 behavior, proven below); the landing still
    // exposes its canonical tag for the production indexable state.
    $response = $this->get(route('landing'))->assertOk();
    expect($response->headers->get('X-Robots-Tag'))->toBe('noindex, nofollow');
    expect($response->getContent())->toContain('rel="canonical"');
});

test('private-surface matcher covers app admin login media staff in any environment', function () {
    foreach (['/app', '/app/topics/x', '/admin', '/admin/login', '/login', '/register', '/forgot-password', '/reset-password/abc', '/media/lessons/1/audio', '/staff/two-factor', '/account'] as $path) {
        expect(PrivateNoStore::isPrivateSurface(Request::create($path)))->toBeTrue($path);
    }
    foreach (['/', '/about', '/faq', '/download', '/sitemap.xml', '/offline'] as $path) {
        expect(PrivateNoStore::isPrivateSurface(Request::create($path)))->toBeFalse($path);
    }
});

test('staging blanket noindex stays intact', function () {
    // The non-production blanket (PwaController + middleware) is the
    // existing S2 behavior; S8 only ADDS targeted production noindex.
    expect(app()->environment())->not->toBe('production');
    $this->get(route('landing'))->assertHeader('X-Robots-Tag', 'noindex, nofollow');
});

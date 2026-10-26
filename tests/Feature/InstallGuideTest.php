<?php

use App\Models\User;
use Inertia\Testing\AssertableInertia;

// Install guide (owner 2026-10-26): public for guests, reachable by
// signed-in learners from Account, and indexable. iOS Safari never fires
// beforeinstallprompt, so this page — not a fake button — is the iPhone path.

test('the install guide is public and canonical', function () {
    $this->get(route('install'))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('Install/Index')
            ->where('seo.canonical', route('install'))
            ->where('seo.title', 'نصب Fast English روی گوشی و کامپیوتر'));

    expect(route('install'))->toBe(url('/install'));
});

test('a signed-in learner can open the install guide from the app', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->get(route('install'))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page->component('Install/Index'));
});

test('the install route is not a redirect to the download page anymore', function () {
    $this->get(route('install'))->assertOk();
    $this->get(route('download'))->assertOk();
});

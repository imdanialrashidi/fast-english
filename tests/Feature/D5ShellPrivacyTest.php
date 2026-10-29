<?php

use App\Http\Middleware\HandleInertiaRequests;
use App\Support\PublicAssets;
use Database\Seeders\S1SampleSeeder;
use Tests\Support\ContentFixtures;

// D5 shell + privacy (C5): the seams that stop the next copy.
// Layout binding is a route-level contract; Inertia JSON carries the
// same private discipline as HTML; the SW precache never holds private
// paths or the dead server stylesheet.
test('learner pages mount the learner shell and public pages the public shell', function () {
    $this->seed(S1SampleSeeder::class);
    $student = ContentFixtures::subscribedStudent();

    // Component proves the route; layout binding is asserted on the
    // compiled page modules below (one grep, not one test per page).
    // Header form is directive-based (middleware may order directives).
    // Guest marketing is observed before actingAs: signed-in visitors
    // are redirected away from the landing by owner decision.
    $this->get(route('landing'))->assertOk();
    $this->get(route('sample'))->assertOk();

    $home = $this->actingAs($student)->get(route('app.home'))->assertOk();
    $directives = collect(explode(',', strtolower((string) $home->headers->get('Cache-Control'))))
        ->map(fn ($directive) => trim($directive));
    expect($directives)->toContain('private')->and($directives)->toContain('no-store');
});

test('page modules bind exactly one shell each', function () {
    $pages = glob(resource_path('js/pages/**/*.tsx')) ?: [];
    expect($pages)->not->toBeEmpty();

    $public = ['Landing/Index', 'Sample/Show', 'Trust/Show', 'Download/Index', 'Install/Index', 'Auth/Login', 'Auth/Register', 'Auth/ForgotPassword', 'Auth/ResetPassword', 'Auth/VerifyEmail'];
    $errors = [];
    foreach ($pages as $file) {
        $relative = str_replace(resource_path('js/pages/'), '', $file);
        $name = preg_replace('/\.tsx$/', '', $relative);
        if (in_array($name, ['Auth/Frame', 'ErrorPage'], true)) {
            // Auth/Frame is a shared frame, not a route page. ErrorPage owns
            // its dedicated chrome-less ErrorLayout (a guest 404 must not
            // show learner tabs that bounce to login).
            continue;
        }
        $source = (string) file_get_contents($file);
        $hasApp = str_contains($source, "from '@/layouts/AppLayout'") || str_contains($source, 'from "@/layouts/AppLayout"');
        $hasPublic = str_contains($source, 'publicLayout') || str_contains($source, 'authLayout');

        if ($hasApp && $hasPublic) {
            $errors[] = "{$name} binds both shells";
        } elseif (! $hasApp && ! $hasPublic) {
            $errors[] = "{$name} binds no shell";
        } elseif (in_array($name, $public, true) && ! $hasPublic) {
            $errors[] = "{$name} should mount the public shell";
        } elseif (! in_array($name, array_merge($public, ['ErrorPage']), true) && ! $hasApp) {
            $errors[] = "{$name} should mount the learner shell";
        }
    }

    expect($errors)->toBe([]);
});

test('inertia protocol responses are private no-store', function () {
    $this->seed(S1SampleSeeder::class);
    $student = ContentFixtures::subscribedStudent();

    // Same asset version as the server sends (else Inertia 409s by
    // design); the X-Inertia header triggers the JSON protocol branch.
    $version = (string) (new HandleInertiaRequests)->version(request());
    $response = $this->actingAs($student)->get(route('today.index'), ['X-Inertia' => 'true', 'X-Inertia-Version' => $version]);
    $response->assertOk();
    expect(strtolower((string) $response->headers->get('Cache-Control')))->toContain('no-store');
});

test('precache holds no private paths and no dead server css', function () {
    $paths = PublicAssets::precache();

    expect($paths)->not->toBeEmpty();
    foreach ($paths as $path) {
        foreach (['media', 'livewire', 'admin', 'account', 'receipt', 'progress', 'placement', 'app.css'] as $private) {
            expect(str_contains(strtolower($path), $private))->toBeFalse("precache entry [{$path}] must stay public");
        }
    }
});

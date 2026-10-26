<?php

use App\Filament\Resources\Categories\CategoryResource;
use App\Filament\Resources\Lessons\LessonResource;
use App\Filament\Resources\PaymentRequests\PaymentRequestResource;
use App\Filament\Resources\Plans\PlanResource;
use App\Filament\Resources\Topics\TopicResource;
use App\Filament\Resources\Users\UserResource;
use App\Models\User;
use Filament\Facades\Filament;
use Illuminate\Support\Facades\Schema;

// S0-4: staff reaches the panel.
test('staff user reaches the admin panel', function () {
    $staff = User::factory()->create(['is_staff' => true]);

    $this->actingAs($staff)->get('/admin')->assertOk();
});

// S0-4 negative path: non-staff is refused server-side.
test('non-staff user is refused by the server-side panel policy', function () {
    $student = User::factory()->create(['is_staff' => false]);

    $this->actingAs($student)->get('/admin')->assertForbidden();
});

// S0-4 negative path: suspended staff loses panel access.
test('suspended staff cannot use the admin panel', function () {
    $staff = User::factory()->create(['is_staff' => true, 'disabled_at' => now()]);

    $response = $this->actingAs($staff)->get('/admin');

    expect($response->status())->toBeIn([302, 403]);
});

// S0-4: no fake data. Since S3 the panel exposes the three content
// resources (Category/Topic/Lesson). S5 added the payment TABLES
// (plans/destinations/requests) with no financial Filament resources.
// S6 adds the staff payment queue (PaymentRequestResource, scope §21 —
// financial resources arrive with S5/S6). The owner catalog (2026-10-25)
// adds the Plans resource so prices are editable without a deploy.
// The admin review adds a read-only Users resource for support/suspension
// and the audited grant/revoke actions (ADM-02). Subscriptions are still
// managed only through those actions: no resource exposes a free-text
// expires_at editor.
test('admin panel exposes only content resources and no persisted fake data', function () {
    $staff = User::factory()->create(['is_staff' => true]);
    $this->actingAs($staff);

    $resources = Filament::getPanel('admin')->getResources();
    sort($resources);

    expect($resources)->toBe([
        CategoryResource::class,
        LessonResource::class,
        PaymentRequestResource::class,
        PlanResource::class,
        TopicResource::class,
        UserResource::class,
    ]);

    foreach (['subscriptions', 'subscription_events', 'plans', 'payment_destinations', 'payment_requests'] as $table) {
        expect(Schema::hasTable($table))->toBeTrue();
    }
});

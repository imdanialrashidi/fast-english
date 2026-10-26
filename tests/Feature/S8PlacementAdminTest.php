<?php

use App\Actions\PublishPlacementTest;
use App\Models\PlacementTest;
use Database\Seeders\S7PlacementFixtureSeeder;
use Tests\Support\ContentFixtures;

// S8 placement management (scope §5: staff مدیریت آزمون): a Filament page
// lists placement versions and previews questions with the answer key
// visible only to staff. Publishing goes through the same shared action
// the placement:publish CLI uses. Two staff-shaped actors + student denial.

beforeEach(function () {
    $this->seed(S7PlacementFixtureSeeder::class);
    $this->staffA = ContentFixtures::staff();
    $this->staffB = ContentFixtures::staff();
    $this->student = ContentFixtures::student();
});

test('staff sees versions with the answer key on the panel page', function () {
    $draft = PublishPlacementTest::createDraft('s8-admin-confirm');
    foreach (range(1, 20) as $position) {
        PublishPlacementTest::addQuestion($draft, $position, "S8 FIXTURE prompt {$position} (TEST)", ['aa', 'bb', 'cc', 'dd'], $position % 4);
    }

    $html = $this->actingAs($this->staffA)->get('/admin/placement-overview')->assertOk()->getContent();

    expect($html)->toContain('s7-fixture-v1')
        ->and($html)->toContain('(correct)')
        ->and($html)->toContain('confirm(');
});

test('student is refused the panel page and the publish route', function () {
    $draft = PublishPlacementTest::createDraft('s8-admin-draft');
    foreach (range(1, 20) as $position) {
        PublishPlacementTest::addQuestion($draft, $position, "S8 FIXTURE prompt {$position} (TEST)", ['aa', 'bb', 'cc', 'dd'], $position % 4);
    }

    $this->actingAs($this->student)->get('/admin/placement-overview')->assertForbidden();
    $this->actingAs($this->student)->post(route('staff.placement.publish', $draft))->assertForbidden();
    expect($draft->fresh()->status)->toBe(PlacementTest::STATUS_DRAFT);
});

test('staff publish route and cli share the same action', function () {
    $draft = PublishPlacementTest::createDraft('s8-admin-shared');
    foreach (range(1, 20) as $position) {
        PublishPlacementTest::addQuestion($draft, $position, "S8 FIXTURE prompt {$position} (TEST)", ['aa', 'bb', 'cc', 'dd'], $position % 4);
    }

    // Staff B publishes through the page route...
    $this->actingAs($this->staffB)->post(route('staff.placement.publish', $draft))->assertRedirect();
    expect($draft->fresh()->status)->toBe(PlacementTest::STATUS_PUBLISHED)
        ->and($draft->fresh()->is_current)->toBeTrue();

    // ...and the CLI publishes a second draft through the same action.
    $draft2 = PublishPlacementTest::createDraft('s8-admin-cli');
    foreach (range(1, 20) as $position) {
        PublishPlacementTest::addQuestion($draft2, $position, "S8 FIXTURE prompt {$position} (TEST)", ['aa', 'bb', 'cc', 'dd'], $position % 4);
    }
    $this->artisan('placement:publish', ['id' => $draft2->id])->assertSuccessful();
    expect($draft2->fresh()->status)->toBe(PlacementTest::STATUS_PUBLISHED)
        ->and($draft2->fresh()->is_current)->toBeTrue();
    // Publishing the new current retires the previous one.
    expect($draft->fresh()->is_current)->toBeFalse();
});

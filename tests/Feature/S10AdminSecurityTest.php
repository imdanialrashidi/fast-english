<?php

use App\Filament\Resources\Lessons\Pages\EditLesson;
use App\Http\Middleware\RequireStaffTwoFactor;
use App\Models\PaymentRequest;
use Illuminate\Support\Facades\Storage;
use Livewire\Livewire;
use Livewire\Mechanisms\PersistentMiddleware\PersistentMiddleware;
use Tests\Support\ContentFixtures;

// Admin review regressions: the staff step-up gate must cover every
// privileged surface outside /admin, and the lesson editor must retain the
// hidden private audio path instead of forcing a revision-bumping re-upload.

test('2fa is enforced on staff operations outside the panel', function () {
    config(['staff2fa.enforce' => true]);

    $staff = ContentFixtures::staff();
    $this->actingAs($staff);

    $this->get(route('staff.transfer.safety'))->assertRedirect(route('staff.twofactor.setup'));
    $this->get(route('staff.transfer.export'))->assertRedirect(route('staff.twofactor.setup'));
    $this->post(route('staff.transfer.import'))->assertRedirect(route('staff.twofactor.setup'));

    $request = PaymentRequest::factory()->create([
        'status' => PaymentRequest::STATUS_PENDING,
        'receipt_path' => 'receipts/step-up.jpg',
    ]);
    Storage::disk('local')->put('receipts/step-up.jpg', 'not-an-image-but-enough-for-route');

    $this->get(route('payments.receipt.show', $request))->assertRedirect(route('staff.twofactor.setup'));
});

test('2fa middleware is persistent for panel livewire updates', function () {
    expect(app(PersistentMiddleware::class)->getPersistentMiddleware())
        ->toContain(RequireStaffTwoFactor::class);
});

test('the owner keeps receipt access while the staff branch is gated', function () {
    config(['staff2fa.enforce' => true]);

    $owner = ContentFixtures::student();
    $request = PaymentRequest::factory()->create([
        'user_id' => $owner->id,
        'status' => PaymentRequest::STATUS_PENDING,
        'receipt_path' => 'receipts/owner-step-up.jpg',
    ]);
    Storage::disk('local')->put('receipts/owner-step-up.jpg', 'owner-bytes');

    $this->actingAs($owner)
        ->get(route('payments.receipt.show', $request))
        ->assertOk();
});

test('editing a lesson keeps the hidden audio path and the revision', function () {
    $staff = ContentFixtures::staff();
    $lesson = ContentFixtures::validDraftLesson();

    $this->actingAs($staff);

    Livewire::test(EditLesson::class, ['record' => $lesson->getRouteKey()])
        ->assertSet('data.audio_path', fn ($state) => in_array($lesson->audio_path, (array) $state, true))
        ->set('data.title_en', 'Typo-fixed title')
        ->call('save')
        ->assertHasNoErrors();

    $fresh = $lesson->fresh();
    expect($fresh->title_en)->toBe('Typo-fixed title')
        ->and($fresh->audio_path)->toBe($lesson->audio_path)
        ->and($fresh->audio_revision)->toBe(1);
});

test('staff can preview draft audio but a student cannot', function () {
    $staff = ContentFixtures::staff();
    $student = ContentFixtures::student();
    $lesson = ContentFixtures::validDraftLesson();

    $this->actingAs($staff)
        ->get(route('staff.lesson.audio', $lesson))
        ->assertOk()
        ->assertHeader('Content-Type', 'audio/mpeg');

    $this->actingAs($student)
        ->get(route('staff.lesson.audio', $lesson))
        ->assertForbidden();
});

<?php

use App\Filament\Resources\Lessons\Pages\CreateLesson;
use App\Models\Lesson;
use App\Rules\ActiveStaffReviewer;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Validator;
use Livewire\Livewire;
use Tests\Support\ContentFixtures;

// ADM-01 review ownership: only active staff can be recorded as a content
// reviewer, even if a crafted request posts a learner user id.

test('a crafted lesson form cannot record a learner as reviewer', function () {
    $staff = ContentFixtures::staff();
    $learner = ContentFixtures::student();
    $topic = ContentFixtures::publishedTopic();
    $count = Lesson::count();

    $this->actingAs($staff);

    Livewire::test(CreateLesson::class)
        ->set('data.topic_id', $topic->id)
        ->set('data.level', 'A1')
        ->set('data.title_en', 'Reviewer guard lesson')
        ->set('data.body_en', "Body paragraph.\n\nSecond paragraph.")
        ->set('data.audio_path', UploadedFile::fake()->createWithContent(
            'audio.mp3',
            (string) file_get_contents(database_path('seeders/fixtures/s1-a2-tone-fixture.mp3')),
        ))
        ->set('data.duration_seconds', 20)
        ->set('data.estimated_minutes', 2)
        ->set('data.reviewed_by', $learner->id)
        ->set('data.reviewed_at', now()->format('Y-m-d H:i:s'))
        ->call('create')
        ->assertHasErrors(['data.reviewed_by']);

    expect(Lesson::count())->toBe($count);
});

test('the reviewer rule accepts active staff and rejects learners or suspended staff', function () {
    $staff = ContentFixtures::staff();
    $learner = ContentFixtures::student();
    $suspended = ContentFixtures::staff();
    $suspended->forceFill(['disabled_at' => now()])->save();

    expect(Validator::make(['reviewer' => $staff->id], ['reviewer' => [new ActiveStaffReviewer]])->passes())->toBeTrue()
        ->and(Validator::make(['reviewer' => $learner->id], ['reviewer' => [new ActiveStaffReviewer]])->passes())->toBeFalse()
        ->and(Validator::make(['reviewer' => $suspended->id], ['reviewer' => [new ActiveStaffReviewer]])->passes())->toBeFalse();
});

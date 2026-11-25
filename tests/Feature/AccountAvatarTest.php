<?php

use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\Support\ContentFixtures;

// Owner instruction 2026-11-25: the account tab accepts a personal photo.
// The server validates the bytes, re-encodes through GD (metadata stripped),
// and stores a random name on the public disk; replacing or removing cleans
// the previous file.

test('a learner uploads and removes a profile photo', function () {
    Storage::fake('public');
    $student = ContentFixtures::subscribedStudent();

    $bytes = (string) file_get_contents(database_path('seeders/fixtures/s3-cover-fixture.jpg'));
    $this->actingAs($student)
        ->post(route('account.avatar.update'), [
            'avatar' => UploadedFile::fake()->createWithContent('me.jpg', $bytes),
        ])
        ->assertRedirect();

    $student->refresh();
    expect($student->avatar_path)->toStartWith('avatars/');
    Storage::disk('public')->assertExists($student->avatar_path);

    $old = $student->avatar_path;
    $this->actingAs($student)
        ->delete(route('account.avatar.destroy'))
        ->assertRedirect();

    $student->refresh();
    expect($student->avatar_path)->toBeNull();
    Storage::disk('public')->assertMissing($old);
});

test('a non-image file is refused and no avatar path is written', function () {
    Storage::fake('public');
    $student = ContentFixtures::subscribedStudent();

    $this->actingAs($student)
        ->post(route('account.avatar.update'), [
            'avatar' => UploadedFile::fake()->createWithContent('me.txt', 'not an image'),
        ])
        ->assertSessionHasErrors('avatar');

    expect($student->fresh()->avatar_path)->toBeNull();
    expect(Storage::disk('public')->allFiles('avatars'))->toBe([]);
});

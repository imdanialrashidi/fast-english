<?php

use App\Models\WordAudio;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

// Flashcard word audio workflow (docs/ops/FLASHCARD_AUDIO_FA.md): a
// reviewed manifest is the only entry point. Files must be real MPEG bytes,
// re-runs are idempotent, and a bad batch exits non-zero instead of looking
// successful.

function wordAudioWorkspace(): string
{
    $dir = storage_path('framework/testing/word-audio-'.Str::uuid());
    mkdir($dir, 0777, true);

    return $dir;
}

function wordAudioManifest(string $dir, array $items): string
{
    $path = $dir.'/manifest.json';
    file_put_contents($path, json_encode([
        'version' => 1,
        'voice' => 'woof-one-voice',
        'seed' => 0,
        'items' => $items,
    ], JSON_THROW_ON_ERROR));

    return $path;
}

test('an approved manifest imports clips idempotently', function () {
    $dir = wordAudioWorkspace();
    copy(database_path('seeders/fixtures/s1-a2-tone-fixture.mp3'), $dir.'/alpha.mp3');
    copy(database_path('seeders/fixtures/s1-a2-tone-fixture.mp3'), $dir.'/beta.mp3');

    $manifest = wordAudioManifest($dir, [
        ['word' => 'alpha', 'file' => 'alpha.mp3', 'status' => 'approved', 'duration_ms' => 800],
        ['word' => 'Beta', 'file' => 'beta.mp3', 'status' => 'approved'],
    ]);

    $this->artisan('flashcards:audio:import', ['manifest' => $manifest])->assertSuccessful();
    $this->artisan('flashcards:audio:import', ['manifest' => $manifest])->assertSuccessful();

    expect(WordAudio::count())->toBe(2);

    $alpha = WordAudio::where('word_key', 'alpha')->firstOrFail();
    $beta = WordAudio::where('word_key', 'beta')->firstOrFail();

    expect($alpha->status)->toBe('approved')
        ->and($alpha->duration_ms)->toBe(800)
        ->and($alpha->voice)->toBe('woof-one-voice')
        ->and($beta->status)->toBe('approved')
        ->and(Storage::disk('local')->exists($alpha->path))->toBeTrue()
        ->and(Storage::disk('local')->exists($beta->path))->toBeTrue();

    Storage::disk('local')->delete([$alpha->path, $beta->path]);
    @unlink($dir.'/alpha.mp3');
    @unlink($dir.'/beta.mp3');
    @unlink($manifest);
    @rmdir($dir);
});

test('a non-MPEG file fails the batch and writes no row for it', function () {
    $dir = wordAudioWorkspace();
    file_put_contents($dir.'/bad.mp3', str_repeat('not-an-mp3 ', 40));

    $manifest = wordAudioManifest($dir, [
        ['word' => 'broken', 'file' => 'bad.mp3', 'status' => 'approved'],
    ]);

    $this->artisan('flashcards:audio:import', ['manifest' => $manifest])->assertFailed();

    expect(WordAudio::where('word_key', 'broken')->exists())->toBeFalse();

    @unlink($dir.'/bad.mp3');
    @unlink($manifest);
    @rmdir($dir);
});

test('a dry run validates without writing', function () {
    $dir = wordAudioWorkspace();
    copy(database_path('seeders/fixtures/s1-a2-tone-fixture.mp3'), $dir.'/gamma.mp3');

    $manifest = wordAudioManifest($dir, [
        ['word' => 'gamma', 'file' => 'gamma.mp3', 'status' => 'approved'],
    ]);

    $this->artisan('flashcards:audio:import', ['manifest' => $manifest, '--dry-run' => true])->assertSuccessful();

    expect(WordAudio::count())->toBe(0);

    @unlink($dir.'/gamma.mp3');
    @unlink($manifest);
    @rmdir($dir);
});

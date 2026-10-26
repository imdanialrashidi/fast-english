<?php

use App\Models\User;
use App\Support\DataTransfer;
use Database\Seeders\S1SampleSeeder;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;

// Panel import/export (OPS-01). The archive carries every domain table
// (content, settings, users, subscriptions, payments) plus only the files
// those rows reference; the old whole-directory archive grew to 2.2 GB
// because of orphan lesson MP3s.

/** @return list<string> */
function transferZipEntries(string $absolute): array
{
    $zip = new ZipArchive;
    expect($zip->open($absolute))->toBeTrue();

    $names = [];
    for ($i = 0; $i < $zip->numFiles; $i++) {
        $stat = $zip->statIndex($i);
        if ($stat !== false) {
            $names[] = (string) $stat['name'];
        }
    }
    $zip->close();

    return $names;
}

test('export carries every domain table and only referenced files', function () {
    $this->seed(S1SampleSeeder::class);
    Storage::disk('local')->put('lessons/orphan-test.mp3', 'orphan bytes');
    Storage::disk('local')->put('receipts/orphan-test.jpg', 'orphan bytes');

    $absolute = Storage::disk('local')->path('tmp/export-content.zip');
    $manifest = DataTransfer::exportTo($absolute);

    expect($manifest['format'])->toBe(DataTransfer::FORMAT);
    expect($manifest['tables'])->toHaveKey('settings');
    expect($manifest['tables'])->toHaveKey('users');
    expect($manifest['tables']['lessons'])->toBeGreaterThan(0);

    $names = transferZipEntries($absolute);
    expect($names)->toContain('manifest.json');
    expect($names)->toContain('database/tables.json');
    // Orphans on disk are not part of the data.
    expect($names)->not->toContain('files/private/lessons/orphan-test.mp3');
    expect($names)->not->toContain('files/private/receipts/orphan-test.jpg');
    // Every inventoried file is really in the archive.
    foreach ($manifest['files'] as $entry) {
        expect($names)->toContain($entry['zip']);
    }
    expect(count($manifest['files']))->toBeGreaterThan(0);
});

test('the archive includes owner settings rows', function () {
    $this->seed(S1SampleSeeder::class);
    DB::table('settings')->insert(['key' => 'contact.support_channel', 'value' => '@owner', 'created_at' => now(), 'updated_at' => now()]);

    $absolute = Storage::disk('local')->path('tmp/export-settings.zip');
    DataTransfer::exportTo($absolute);

    $manifest = DataTransfer::validateArchive($absolute);
    expect($manifest['tables']['settings'])->toBe(1);
});

test('import replaces rows and managed files with the archive contents', function () {
    $this->seed(S1SampleSeeder::class);

    $lessonCount = DB::table('lessons')->count();
    $audio = (string) DB::table('lessons')->value('audio_path');
    expect($audio)->not->toBe('');

    $absolute = Storage::disk('local')->path('tmp/round-trip.zip');
    DataTransfer::exportTo($absolute);

    DB::table('lesson_progress')->delete();
    DB::table('bookmarks')->delete();
    DB::table('lessons')->delete();
    DB::table('topics')->delete();
    Storage::disk('local')->deleteDirectory('lessons');
    expect(DB::table('lessons')->count())->toBe(0);

    $manifest = DataTransfer::validateArchive($absolute);
    $stats = DataTransfer::applyArchive($absolute, $manifest);

    expect(DB::table('lessons')->count())->toBe($lessonCount);
    expect(Storage::disk('local')->exists($audio))->toBeTrue();
    expect($stats['files'])->toBeGreaterThan(0);
});

test('import drops managed files the archive does not carry', function () {
    $this->seed(S1SampleSeeder::class);

    $absolute = Storage::disk('local')->path('tmp/prune-orphans.zip');
    DataTransfer::exportTo($absolute);

    Storage::disk('local')->put('lessons/created-after-export.mp3', 'junk');

    $manifest = DataTransfer::validateArchive($absolute);
    DataTransfer::applyArchive($absolute, $manifest);

    expect(Storage::disk('local')->exists('lessons/created-after-export.mp3'))->toBeFalse();
});

test('import rejects an archive whose payload checksum no longer matches', function () {
    $this->seed(S1SampleSeeder::class);

    $absolute = Storage::disk('local')->path('tmp/tampered.zip');
    DataTransfer::exportTo($absolute);

    $zip = new ZipArchive;
    $zip->open($absolute);
    $zip->addFromString('database/tables.json', '{"lessons":[]}');
    $zip->close();

    expect(fn () => DataTransfer::validateArchive($absolute))
        ->toThrow(ValidationException::class);
});

test('import rejects an archive with an unsafe entry', function () {
    $this->seed(S1SampleSeeder::class);

    $absolute = Storage::disk('local')->path('tmp/traversal.zip');
    DataTransfer::exportTo($absolute);

    $zip = new ZipArchive;
    $zip->open($absolute);
    $zip->addFromString('files/private/../../evil.php', '<?php echo 1;');
    $zip->close();

    expect(fn () => DataTransfer::validateArchive($absolute))
        ->toThrow(ValidationException::class);
});

test('import rejects an archive that needs migrations this checkout lacks', function () {
    $this->seed(S1SampleSeeder::class);

    $absolute = Storage::disk('local')->path('tmp/newer.zip');
    $manifest = DataTransfer::exportTo($absolute);
    $manifest['migrations'][] = '2099_01_01_000099_from_the_future.php';

    $zip = new ZipArchive;
    $zip->open($absolute);
    $zip->addFromString('manifest.json', json_encode($manifest, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
    $zip->close();

    expect(fn () => DataTransfer::validateArchive($absolute))
        ->toThrow(ValidationException::class);
});

test('a pre-import safety copy is written and only the newest is kept', function () {
    $this->seed(S1SampleSeeder::class);

    $first = DataTransfer::createSafetyCopy();
    $second = DataTransfer::createSafetyCopy();

    expect(is_file($second))->toBeTrue();
    expect($first === $second)->toBeFalse();
    expect(is_file($first))->toBeFalse();
    expect(DataTransfer::latestSafetyCopy())->toBe($second);
});

test('guests and students cannot export or import', function () {
    $this->get(route('staff.transfer.export'))->assertRedirect();

    $student = User::factory()->create();
    $this->actingAs($student)->get(route('staff.transfer.export'))->assertForbidden();
    $this->actingAs($student)->post(route('staff.transfer.import'), [])->assertForbidden();
});

test('import without the confirmation checkbox changes nothing', function () {
    $this->seed(S1SampleSeeder::class);
    $staff = User::factory()->create(['is_staff' => true]);
    $before = DB::table('lessons')->count();

    $this->actingAs($staff)->post(route('staff.transfer.import'), [
        'archive' => UploadedFile::fake()->create('archive.zip', 16, 'application/zip'),
    ])->assertSessionHasErrors('confirm');

    expect(DB::table('lessons')->count())->toBe($before);
});

test('staff export then import round-trips over HTTP', function () {
    $this->seed(S1SampleSeeder::class);
    $staff = User::factory()->create(['is_staff' => true]);
    $lessonCount = DB::table('lessons')->count();

    $response = $this->actingAs($staff)->get(route('staff.transfer.export'));
    $response->assertOk();
    expect((string) $response->headers->get('Content-Type'))->toContain('zip');

    $path = $response->getFile()->getPathname();
    expect(is_file($path))->toBeTrue();

    DB::table('lesson_progress')->delete();
    DB::table('bookmarks')->delete();
    DB::table('lessons')->delete();
    DB::table('topics')->delete();

    $upload = new UploadedFile($path, 'export.zip', 'application/zip', null, true);

    $this->actingAs($staff)->post(route('staff.transfer.import'), [
        'archive' => $upload,
        'confirm' => '1',
    ])->assertRedirect(route('filament.admin.pages.data-transfer'));

    expect(DB::table('lessons')->count())->toBe($lessonCount);
    expect(DataTransfer::latestSafetyCopy())->not->toBeNull();
});

test('the import page is staff-only', function () {
    $student = User::factory()->create();
    $this->actingAs($student)->get('/admin/data-transfer')->assertForbidden();

    $staff = User::factory()->create(['is_staff' => true]);
    $this->actingAs($staff)->get('/admin/data-transfer')->assertOk();
});

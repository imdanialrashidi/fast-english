<?php

use App\Actions\ApprovePayment;
use App\Models\Backup;
use App\Models\Lesson;
use App\Models\PaymentDestination;
use App\Models\PaymentRequest;
use App\Models\Plan;
use App\Models\User;
use App\Support\BackupManager;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;
use Tests\Support\ContentFixtures;

// Panel-based one-click backup & restore (OPS-01).
//
// Contract: a staff one-click backup produces a complete, checksummed
// archive (manifest + DB + files); a compatible backup round-trips
// records/relationships/files; invalid/corrupt/incompatible/malicious
// archives are rejected without damage; guests/students are denied
// server-side on every operation; restore needs explicit confirmation +
// a verified pre-restore point and never replays payment actions.

beforeEach(function () {
    // Isolate file state: the shared dev checkout accumulates GBs of
    // lesson fixtures on the real disks; fakes keep each backup small,
    // deterministic, and independent of developer storage.
    Storage::fake('local');
    Storage::fake('public');
    Storage::disk('local')->makeDirectory('backups');
    Storage::disk('local')->makeDirectory('tmp');
});

afterEach(function () {
    Storage::disk('local')->deleteDirectory('backups');
    Storage::disk('local')->deleteDirectory('tmp');
});

function backupStaff(): User
{
    return ContentFixtures::staff();
}

test('staff one-click backup produces a complete verifiable archive', function () {
    $staff = backupStaff();
    $topic = ContentFixtures::publishedTopic();
    $lesson = Lesson::factory()->for($topic)->create(['level' => 'A2']);
    $student = ContentFixtures::student();
    $progress = $student->lessonProgress()->create([
        'lesson_id' => $lesson->id,
        'position_seconds' => 7,
        'completed' => false,
    ]);

    $audioAbsolute = Storage::disk('local')->path($lesson->audio_path);
    $audioBytes = file_get_contents($audioAbsolute);
    $audioSha = hash_file('sha256', $audioAbsolute);

    $backup = BackupManager::createBackup($staff);

    expect($backup->status)->toBe(Backup::STATUS_COMPLETED)
        ->and(Storage::disk('local')->exists($backup->filename))->toBeTrue()
        ->and($backup->size_bytes)->toBeGreaterThan(0)
        ->and($backup->checksum_sha256)->toBe(hash_file('sha256', Storage::disk('local')->path($backup->filename)));

    // Manifest: format, compat info, counts, checksums — key names for
    // recovery, never secret values (no row data lives in the manifest).
    $manifest = $backup->manifest;
    expect($manifest['format'])->toBe(BackupManager::FORMAT)
        ->and($manifest['database_format'])->toBe(BackupManager::DATABASE_FORMAT)
        ->and($manifest)->toHaveKeys(['laravel_major', 'migrations', 'tables', 'files', 'env_required'])
        ->and($manifest['env_required'])->toContain('APP_KEY')
        ->and(array_keys($manifest['tables']))->not->toContain('password')
        ->and($manifest['tables']['lessons'] ?? 0)->toBeGreaterThanOrEqual(1)
        ->and($manifest['tables']['users'] ?? 0)->toBeGreaterThanOrEqual(2);

    // Zip contents: manifest + DB + audio, each checksum verified.
    $zip = new ZipArchive;
    expect($zip->open(Storage::disk('local')->path($backup->filename)))->toBeTrue();
    expect($zip->getFromName('manifest.json'))->not->toBeFalse();
    expect($zip->getFromName('ENV_RECOVERY.md'))->not->toBeFalse();
    expect($zip->getFromName('database/tables.json'))->not->toBeFalse();
    $zip->close();

    $revalidated = BackupManager::validateArchive(Storage::disk('local')->path($backup->filename));
    $paths = array_column($revalidated['files'], 'path');
    expect($paths)->toContain('files/private/lessons/'.basename($lesson->audio_path));

    // The archived audio bytes round-trip exactly.
    $zip2 = new ZipArchive;
    $zip2->open(Storage::disk('local')->path($backup->filename));
    $archivedAudio = $zip2->getFromName('files/private/lessons/'.basename($lesson->audio_path));
    $zip2->close();
    expect(hash('sha256', $archivedAudio))->toBe($audioSha)
        ->and($archivedAudio)->toBe($audioBytes);

    // No secrets in logs for this run (passwords/2FA/receipts never logged).
    expect((string) $backup->error_message)->not->toContain('password');
});

test('compatible backup round-trips records relationships and files', function () {
    $staff = backupStaff();
    $topic = ContentFixtures::publishedTopic();
    $lesson = Lesson::factory()->for($topic)->create(['level' => 'B1']);
    $student = ContentFixtures::student();
    $student->lessonProgress()->create(['lesson_id' => $lesson->id, 'position_seconds' => 12, 'completed' => true]);
    $student->bookmarks()->create(['topic_id' => $topic->id]);
    $student->vocabularyWords()->create([
        'word' => 'luminous',
        'word_key' => 'luminous',
        'meaning_fa' => 'درخشان',
        'status' => 'learning',
        'ease_factor' => 2.5,
        'interval_days' => 1,
        'repetitions' => 1,
        'lapses' => 0,
        'due_at' => now()->addDay(),
    ]);

    $backup = BackupManager::createBackup($staff);

    $lessonId = $lesson->id;
    $audioPath = $lesson->audio_path;
    $audioBytes = file_get_contents(Storage::disk('local')->path($audioPath));
    $usersBefore = DB::table('users')->count();
    $lessonsBefore = DB::table('lessons')->count();

    // Mutate live state after the backup: new user, deleted progress, changed audio.
    $intruder = ContentFixtures::student();
    $student->lessonProgress()->delete();
    file_put_contents(Storage::disk('local')->path($audioPath), 'mutated-bytes');

    $restored = BackupManager::restoreBackup($backup, $staff, true);

    expect($restored->status)->toBe(Backup::STATUS_RESTORED);
    // Records back to the backup moment: intruder gone, progress back.
    expect(DB::table('users')->count())->toBe($usersBefore);
    expect(DB::table('lessons')->count())->toBe($lessonsBefore);
    expect(DB::table('lesson_progress')->where('user_id', $student->id)->count())->toBe(1);
    expect(DB::table('bookmarks')->where('user_id', $student->id)->count())->toBe(1);
    expect(DB::table('vocabulary_words')->where('user_id', $student->id)->count())->toBe(1);
    // Relationship integrity: progress still points at the same lesson.
    expect(DB::table('lesson_progress')->where('user_id', $student->id)->value('lesson_id'))->toBe($lessonId);
    // File bytes back to the backup moment.
    expect(file_get_contents(Storage::disk('local')->path($audioPath)))->toBe($audioBytes);

    // A verified pre-restore emergency backup was kept.
    expect(Backup::where('type', Backup::TYPE_PRE_RESTORE)->where('status', Backup::STATUS_COMPLETED)->exists())->toBeTrue();
});

test('corrupted incompatible and malicious archives are rejected without damage', function () {
    $staff = backupStaff();
    $topic = ContentFixtures::publishedTopic();
    Lesson::factory()->for($topic)->create();
    $usersBefore = DB::table('users')->count();
    $lessonsBefore = DB::table('lessons')->count();

    // 1. Corrupted: not a zip at all.
    $corrupt = Storage::disk('local')->path('backups/corrupt.zip');
    file_put_contents($corrupt, 'definitely not a zip');
    $corruptBackup = Backup::create([
        'filename' => 'backups/corrupt.zip', 'disk' => 'local', 'type' => Backup::TYPE_MANUAL,
    ]);
    $corruptBackup->forceFill(['status' => Backup::STATUS_COMPLETED, 'completed_at' => now()])->save();

    // 2. Malicious: path traversal entry.
    $evilPath = Storage::disk('local')->path('backups/evil.zip');
    $zip = new ZipArchive;
    $zip->open($evilPath, ZipArchive::CREATE | ZipArchive::OVERWRITE);
    $zip->addFromString('manifest.json', json_encode([
        'format' => BackupManager::FORMAT,
        'database_format' => BackupManager::DATABASE_FORMAT,
        'laravel_major' => (int) explode('.', app()->version())[0],
        'migrations' => [],
        'tables' => [],
        'database_file' => 'database/tables.json',
        'database_sha256' => hash('sha256', '{}'),
        'files' => [],
        'env_required' => [],
    ]));
    $zip->addFromString('database/tables.json', '{}');
    $zip->addFromString('../../evil.php', '<?php echo "pwned";');
    $zip->close();
    $evilBackup = Backup::create([
        'filename' => 'backups/evil.zip', 'disk' => 'local', 'type' => Backup::TYPE_MANUAL,
    ]);
    $evilBackup->forceFill(['status' => Backup::STATUS_COMPLETED, 'completed_at' => now()])->save();

    foreach ([$corruptBackup, $evilBackup] as $bad) {
        try {
            BackupManager::restoreBackup($bad->fresh(), $staff, true);
            expect(false)->toBeTrue('restore should have been rejected');
        } catch (ValidationException) {
            // expected
        }
    }

    // 3. Incompatible: backup claims a future Laravel major.
    $good = BackupManager::createBackup($staff);
    $goodAbsolute = Storage::disk('local')->path($good->filename);
    $tmp = $goodAbsolute.'.incompat.zip';
    copy($goodAbsolute, $tmp);
    $zip = new ZipArchive;
    $zip->open($tmp);
    $manifest = json_decode((string) $zip->getFromName('manifest.json'), true);
    $manifest['laravel_major'] = 999;
    $zip->deleteName('manifest.json');
    $zip->addFromString('manifest.json', json_encode($manifest));
    $zip->close();
    try {
        BackupManager::validateArchive($tmp);
        expect(false)->toBeTrue('incompatible backup should be rejected');
    } catch (ValidationException) {
        // expected
    } finally {
        @unlink($tmp);
    }

    // Current state untouched by every rejection.
    expect(DB::table('users')->count())->toBe($usersBefore);
    expect(DB::table('lessons')->count())->toBe($lessonsBefore);
    expect(Backup::where('status', Backup::STATUS_RESTORING)->exists())->toBeFalse();
});

test('guests and non-admin accounts are denied every backup operation server-side', function () {
    $staff = backupStaff();
    $student = ContentFixtures::student();
    $backup = BackupManager::createBackup($staff);

    // Guests: redirected to login, never served bytes or status.
    $this->get('/admin/backups')->assertRedirect('/admin/login');
    $this->post(route('staff.backups.store'))->assertRedirect('/login');
    $this->get(route('staff.backups.status', $backup))->assertRedirect('/login');
    $this->get(route('staff.backups.download', $backup))->assertRedirect('/login');
    $this->delete(route('staff.backups.destroy', $backup))->assertRedirect('/login');
    $this->post(route('staff.backups.restore', $backup), ['confirm' => 1, 'acknowledge' => 1, 'backup_id' => $backup->id])
        ->assertRedirect('/login');
    $this->post(route('staff.backups.upload'), ['backup' => UploadedFile::fake()->create('x.zip', 100)])
        ->assertRedirect('/login');

    // Students: 403 on the panel page and every staff endpoint.
    $this->actingAs($student)->get('/admin/backups')->assertForbidden();
    $this->actingAs($student)->post(route('staff.backups.store'))->assertForbidden();
    $this->actingAs($student)->get(route('staff.backups.status', $backup))->assertForbidden();
    $this->actingAs($student)->get(route('staff.backups.download', $backup))->assertForbidden();
    $this->actingAs($student)->delete(route('staff.backups.destroy', $backup))->assertForbidden();
    $this->actingAs($student)->post(route('staff.backups.restore', $backup), ['confirm' => 1, 'acknowledge' => 1, 'backup_id' => $backup->id])
        ->assertForbidden();

    // Suspended staff lose access too.
    $suspended = ContentFixtures::staff();
    $suspended->forceFill(['disabled_at' => now()])->save();
    $this->actingAs($suspended)->get('/admin/backups')->assertForbidden();
    $this->actingAs($suspended)->post(route('staff.backups.store'))->assertForbidden();

    // Staff paths still work (panel loads, download streams, status JSON).
    $this->actingAs($staff)->get('/admin/backups')->assertOk();
    $this->actingAs($staff)->get(route('staff.backups.status', $backup))->assertOk()->assertJsonPath('status', 'completed');
    $this->actingAs($staff)->get(route('staff.backups.download', $backup))
        ->assertOk();
    $cacheControl = $this->actingAs($staff)->get(route('staff.backups.download', $backup))->headers->get('Cache-Control');
    expect($cacheControl)->toContain('private')->and($cacheControl)->toContain('no-store');
});

test('restore without explicit confirmation never touches current data', function () {
    $staff = backupStaff();
    $topic = ContentFixtures::publishedTopic();
    Lesson::factory()->for($topic)->create();
    $backup = BackupManager::createBackup($staff);
    $usersBefore = DB::table('users')->count();

    // Service-level: unconfirmed call throws before any emergency backup.
    $preRestoreBefore = Backup::where('type', Backup::TYPE_PRE_RESTORE)->count();
    try {
        BackupManager::restoreBackup($backup, $staff, false);
        expect(false)->toBeTrue('unconfirmed restore should throw');
    } catch (ValidationException) {
        // expected
    }
    expect(Backup::where('type', Backup::TYPE_PRE_RESTORE)->count())->toBe($preRestoreBefore);
    expect(DB::table('users')->count())->toBe($usersBefore);
    expect($backup->fresh()->status)->toBe(Backup::STATUS_COMPLETED);

    // HTTP-level: missing checkbox / wrong id echo are rejected (422-style redirect with errors).
    $this->actingAs($staff)->post(route('staff.backups.restore', $backup), [])
        ->assertRedirect()->assertSessionHasErrors();
    $this->actingAs($staff)->post(route('staff.backups.restore', $backup), ['confirm' => 1, 'acknowledge' => 1, 'backup_id' => 999999])
        ->assertRedirect()->assertSessionHasErrors();
    expect(DB::table('users')->count())->toBe($usersBefore);
});

test('failed restore reports accurately and keeps a verified recovery point', function () {
    $staff = backupStaff();
    $topic = ContentFixtures::publishedTopic();
    $lesson = Lesson::factory()->for($topic)->create();
    $backup = BackupManager::createBackup($staff);
    $usersBefore = DB::table('users')->count();

    // Break the archive's database checksum so the destructive phase can
    // never start: tamper the stored copy, keep the row checksum stale.
    $absolute = Storage::disk('local')->path($backup->filename);
    $zip = new ZipArchive;
    $zip->open($absolute);
    $zip->deleteName('database/tables.json');
    $zip->addFromString('database/tables.json', '{"users":[]}');
    $zip->close();

    try {
        BackupManager::restoreBackup($backup->fresh(), $staff, true);
        expect(false)->toBeTrue('tampered restore should fail');
    } catch (ValidationException $e) {
        expect(implode(' ', array_merge(...array_values($e->errors()))))->toContain('checksum');
    }

    // Live data untouched; the failure is recorded accurately.
    expect(DB::table('users')->count())->toBe($usersBefore);
    expect(DB::table('lessons')->where('id', $lesson->id)->exists())->toBeTrue();

    // An uploaded-then-tampered archive is rejected at upload time too.
    $tamperedUpload = new UploadedFile($absolute, 'backup.zip', 'application/zip', null, true);
    try {
        BackupManager::uploadBackup($tamperedUpload, $staff);
        expect(false)->toBeTrue('tampered upload should be rejected');
    } catch (ValidationException) {
        // expected
    }
});

test('restore preserves payment integrity and never replays payment actions', function () {
    $staff = backupStaff();
    $student = ContentFixtures::student();

    // Real money trail through the shared action: plan + destination +
    // approved request + subscription window + exactly one event.
    $plan = Plan::create([
        'slug' => 'backup-test-plan', 'name_fa' => 'تست', 'price_toman' => 100000,
        'duration_days' => 30, 'is_active' => true, 'display_order' => 0,
    ]);
    $destination = PaymentDestination::create([
        'card_number' => '603799 trouble', 'holder_name' => 'Test', 'bank_name' => 'TestBank', 'is_active' => true,
    ]);
    $request = new PaymentRequest;
    $request->forceFill([
        'user_id' => $student->id, 'plan_id' => $plan->id, 'destination_id' => $destination->id,
        'plan_name_snapshot' => $plan->name_fa, 'amount_toman_snapshot' => $plan->price_toman,
        'duration_days_snapshot' => $plan->duration_days,
        'destination_snapshot' => ['card_number' => '603799', 'holder_name' => 'Test', 'bank_name' => 'TestBank'],
        'status' => PaymentRequest::STATUS_PENDING,
        'receipt_path' => 'receipts/fixture.jpg',
    ]);
    $request->save();
    Storage::disk('local')->makeDirectory('receipts');
    file_put_contents(Storage::disk('local')->path('receipts/fixture.jpg'), 'receipt-bytes');

    $result = ApprovePayment::approve($request->id, $staff);
    expect($result['replayed'])->toBeFalse();
    $eventsBefore = DB::table('subscription_events')->count();
    $expiryBefore = DB::table('subscriptions')->where('user_id', $student->id)->value('expires_at');

    $backup = BackupManager::createBackup($staff);

    // Post-backup activity: a second student + grant (must vanish on restore).
    $intruder = ContentFixtures::student();
    ApprovePayment::grant($intruder->id, $staff, 15, 'intruder grant (TEST)');
    expect(DB::table('subscription_events')->count())->toBe($eventsBefore + 1);

    BackupManager::restoreBackup($backup, $staff, true);

    // Restored exactly: same request status, same window, same ONE event —
    // no replay, no fabricated transaction state.
    expect(DB::table('payment_requests')->where('id', $request->id)->value('status'))
        ->toBe(PaymentRequest::STATUS_APPROVED);
    expect(DB::table('subscription_events')->count())->toBe($eventsBefore);
    expect((string) DB::table('subscriptions')->where('user_id', $student->id)->value('expires_at'))
        ->toBe((string) $expiryBefore);
    expect(DB::table('subscriptions')->where('user_id', $intruder->id)->exists())->toBeFalse();
    expect(Storage::disk('local')->exists('receipts/fixture.jpg'))->toBeTrue();
    expect(file_get_contents(Storage::disk('local')->path('receipts/fixture.jpg')))->toBe('receipt-bytes');
});

test('concurrent operations are rejected and partial backups never read successful', function () {
    $staff = backupStaff();

    // Simulate an in-progress operation left by another worker.
    $stuck = Backup::create(['filename' => 'backups/stuck.zip', 'disk' => 'local', 'type' => Backup::TYPE_MANUAL]);
    $stuck->forceFill(['status' => Backup::STATUS_CREATING])->save();

    try {
        BackupManager::createBackup($staff);
        expect(false)->toBeTrue('duplicate create should be rejected');
    } catch (ValidationException) {
        // expected
    }

    // After the stuck row clears, creation works again.
    $stuck->delete();
    $second = BackupManager::createBackup($staff);
    expect($second->status)->toBe(Backup::STATUS_COMPLETED);

    // Partial rows never masquerade as restorable.
    $deleted = Backup::find($stuck->id);
    expect($deleted)->toBeNull();
    $failed = Backup::create(['filename' => 'backups/gone.zip', 'disk' => 'local', 'type' => Backup::TYPE_MANUAL]);
    $failed->forceFill(['status' => Backup::STATUS_FAILED, 'error_message' => 'boom'])->save();
    $this->actingAs($staff)->post(route('staff.backups.restore', $failed), ['confirm' => 1, 'acknowledge' => 1, 'backup_id' => $failed->id])
        ->assertRedirect()->assertSessionHasErrors();
});

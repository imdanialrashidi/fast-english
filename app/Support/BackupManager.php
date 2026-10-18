<?php

namespace App\Support;

use App\Models\Backup;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use ZipArchive;

/**
 * Panel-based one-click backup & restore (OPS-01).
 *
 * What is backed up (authoritative locations in this checkout):
 * - Database rows for every persistent domain table (users, categories,
 *   topics, lessons, lesson_progress, bookmarks, plans,
 *   payment_destinations, payment_requests, subscriptions,
 *   subscription_events, placement_*, vocabulary_words) as
 *   `database/tables.json` (`json-tables-v1`). Ephemeral tables
 *   (migrations, jobs, cache, sessions, password resets) are excluded.
 * - Persistent files: private `lessons/` + `receipts/` (local disk) and
 *   public `covers/` (public disk), each with a SHA-256 in the manifest.
 * - `manifest.json` with format version, Laravel major, applied
 *   migration list, per-table counts, per-file checksums, and the list
 *   of required environment keys (names only — never values).
 * - `ENV_RECOVERY.md` with the explicit secure recovery steps for
 *   credentials (APP_KEY stability, DB/mail env, keystore) — the backup
 *   never contains `.env` values, passwords, tokens, or decrypted 2FA.
 *
 * Safety properties:
 * - Backups live on the private disk under `backups/` (never public,
 *   never web-reachable). Every operation requires active staff
 *   server-side; the controller + Filament page both enforce it.
 * - Archives are validated before any destructive step: zip opens,
 *   `manifest.json` parses, format/database-format match, Laravel major
 *   matches, backup migrations are a subset of current code migrations
 *   (a newer backup is rejected), every entry is under an allowlisted
 *   prefix with no `..`/absolute path, and every file SHA-256 matches.
 *   Extraction writes file-by-file via streams (never blind extractTo).
 * - Concurrency: a `backups:operation` cache lock plus a DB check for
 *   `creating`/`restoring` rows rejects duplicates with 422. A partial
 *   archive is never reported successful: the row stays `creating` until
 *   the zip re-opens and all checksums verify, then flips to completed.
 * - Restore: requires explicit confirmation, creates and verifies an
 *   emergency `pre_restore` backup first, then replaces DB + files. On
 *   failure it attempts automatic rollback from the emergency point and
 *   otherwise leaves a `restore_failed` row pointing at the verified
 *   emergency archive plus manual recovery steps. Restore performs pure
 *   data copy — it never calls ApprovePayment, never creates new
 *   subscription events, and never replays external payment actions.
 */
final class BackupManager
{
    public const FORMAT = 'fast-english-backup-v1';

    public const DATABASE_FORMAT = 'json-tables-v1';

    public const LOCK_KEY = 'backups:operation';

    public const MAX_UPLOAD_BYTES = 512 * 1024 * 1024;

    public const MIN_FREE_BYTES = 50 * 1024 * 1024;

    /**
     * Parent-first insert order. Deletion runs in reverse.
     *
     * @var list<string>
     */
    public const BACKUP_TABLES = [
        'users',
        'categories',
        'plans',
        'payment_destinations',
        'placement_tests',
        'topics',
        'lessons',
        'lesson_progress',
        'bookmarks',
        'payment_requests',
        'subscriptions',
        'subscription_events',
        'placement_questions',
        'placement_attempts',
        'placement_answers',
        'vocabulary_words',
    ];

    /** @var list<string> */
    private const ALLOWED_PREFIXES = [
        'manifest.json',
        'ENV_RECOVERY.md',
        'database/',
        'files/private/lessons/',
        'files/private/receipts/',
        'files/public/covers/',
    ];

    /** @var list<string> */
    private const ENV_REQUIRED = [
        'APP_KEY',
        'APP_URL',
        'DB_CONNECTION',
        'DB_HOST',
        'DB_PORT',
        'DB_DATABASE',
        'DB_USERNAME',
        'DB_PASSWORD',
        'MAIL_MAILER',
        'MAIL_HOST',
        'MAIL_USERNAME',
        'MAIL_PASSWORD',
        'FILESYSTEM_DISK',
    ];

    // ------------------------------------------------------------------
    // Creation
    // ------------------------------------------------------------------

    public static function createBackup(User $staff, string $type = Backup::TYPE_MANUAL): Backup
    {
        self::requireActiveStaff($staff);

        if (! in_array($type, [Backup::TYPE_MANUAL, Backup::TYPE_PRE_RESTORE, Backup::TYPE_UPLOADED], true)) {
            $type = Backup::TYPE_MANUAL;
        }

        $lock = Cache::lock(self::LOCK_KEY, 3600);
        if (! $lock->acquire()) {
            throw ValidationException::withMessages([
                'backup' => 'A backup or restore operation is already running. Please wait and refresh.',
            ]);
        }

        try {
            self::assertNoActiveOperation();

            $free = disk_free_space(storage_path());
            if ($free !== false && $free < self::MIN_FREE_BYTES) {
                throw ValidationException::withMessages([
                    'backup' => 'Not enough free disk space to create a backup.',
                ]);
            }

            $filename = 'backups/'.now('UTC')->format('Ymd-His').'-'.((string) Str::ulid()).'.zip';

            $backup = new Backup;
            $backup->forceFill([
                'filename' => $filename,
                'disk' => 'local',
                'status' => Backup::STATUS_CREATING,
                'type' => $type,
                'created_by' => $staff->id,
            ]);
            $backup->save();

            try {
                self::buildArchive($backup);

                $absolute = Storage::disk('local')->path($backup->filename);
                $backup->forceFill([
                    'size_bytes' => filesize($absolute),
                    'checksum_sha256' => hash_file('sha256', $absolute),
                    'status' => Backup::STATUS_COMPLETED,
                    'completed_at' => now('UTC'),
                    'error_message' => null,
                ]);
                $backup->save();

                Log::info('backup created', [
                    'backup_id' => $backup->id,
                    'type' => $type,
                    'size_bytes' => $backup->size_bytes,
                ]);

                return $backup->fresh();
            } catch (\Throwable $e) {
                Storage::disk('local')->delete($backup->filename);
                $backup->forceFill([
                    'status' => Backup::STATUS_FAILED,
                    'error_message' => self::safeMessage($e),
                ]);
                $backup->save();

                Log::warning('backup failed', ['backup_id' => $backup->id, 'type' => $type]);

                if ($e instanceof ValidationException) {
                    throw $e;
                }

                throw ValidationException::withMessages([
                    'backup' => 'Backup failed: '.self::safeMessage($e),
                ]);
            }
        } finally {
            $lock->release();
        }
    }

    // ------------------------------------------------------------------
    // Restore
    // ------------------------------------------------------------------

    /**
     * Restore a completed backup over the current DB + files.
     *
     * Requires $confirmed=true (explicit panel confirmation). Creates and
     * verifies an emergency pre-restore backup first; without a verified
     * recovery point nothing destructive runs.
     */
    public static function restoreBackup(Backup $backup, User $staff, bool $confirmed = false): Backup
    {
        self::requireActiveStaff($staff);

        if (! $confirmed) {
            throw ValidationException::withMessages([
                'restore' => 'Restoring replaces all current data. Tick the confirmation and try again.',
            ]);
        }

        $lock = Cache::lock(self::LOCK_KEY, 3600);
        if (! $lock->acquire()) {
            throw ValidationException::withMessages([
                'restore' => 'A backup or restore operation is already running. Please wait and refresh.',
            ]);
        }

        try {
            self::assertNoActiveOperation($backup->id);

            $backup->refresh();
            if (! $backup->isRestorable()) {
                throw ValidationException::withMessages([
                    'restore' => 'Only a completed backup can be restored.',
                ]);
            }

            $disk = Storage::disk($backup->disk);
            if (! $disk->exists($backup->filename)) {
                throw ValidationException::withMessages([
                    'restore' => 'The backup file is missing from storage.',
                ]);
            }

            $absolute = $disk->path($backup->filename);
            if ($backup->checksum_sha256 !== null && hash_file('sha256', $absolute) !== $backup->checksum_sha256) {
                throw ValidationException::withMessages([
                    'restore' => 'The backup file failed its checksum. It may be corrupted.',
                ]);
            }

            // Validate the selected archive BEFORE touching live data.
            $manifest = self::validateArchive($absolute);

            // Emergency recovery point: created + verified before anything
            // destructive. A failed emergency point aborts the restore.
            $emergency = self::createBackupInternal($staff, Backup::TYPE_PRE_RESTORE);
            if ($emergency->status !== Backup::STATUS_COMPLETED) {
                throw ValidationException::withMessages([
                    'restore' => 'Could not create a verified pre-restore recovery point. Nothing was changed.',
                ]);
            }

            $backup->forceFill(['status' => Backup::STATUS_RESTORING, 'error_message' => null]);
            $backup->save();

            try {
                self::applyArchive($absolute, $manifest);

                $backup->forceFill([
                    'status' => Backup::STATUS_RESTORED,
                    'completed_at' => now('UTC'),
                    'error_message' => null,
                ]);
                $backup->save();

                Log::info('backup restored', [
                    'backup_id' => $backup->id,
                    'emergency_backup_id' => $emergency->id,
                ]);

                return $backup->fresh();
            } catch (\Throwable $e) {
                // Automatic rollback from the verified emergency point.
                $rollbackOk = false;
                try {
                    $emergencyAbsolute = Storage::disk($emergency->disk)->path($emergency->filename);
                    $emergencyManifest = self::validateArchive($emergencyAbsolute);
                    self::applyArchive($emergencyAbsolute, $emergencyManifest);
                    $rollbackOk = true;
                } catch (\Throwable) {
                    $rollbackOk = false;
                }

                $message = self::safeMessage($e)
                    .($rollbackOk
                        ? ' The pre-restore recovery point was re-applied automatically.'
                        : ' Automatic rollback failed — re-apply emergency backup #'.$emergency->id
                        .' ('.$emergency->filename.') manually. See ENV_RECOVERY.md inside the archive.');

                $backup->forceFill([
                    'status' => Backup::STATUS_RESTORE_FAILED,
                    'error_message' => mb_substr($message, 0, 2000),
                ]);
                $backup->save();

                Log::warning('backup restore failed', [
                    'backup_id' => $backup->id,
                    'emergency_backup_id' => $emergency->id,
                    'rolled_back' => $rollbackOk,
                ]);

                if ($e instanceof ValidationException) {
                    throw $e;
                }

                throw ValidationException::withMessages(['restore' => $message]);
            }
        } finally {
            $lock->release();
        }
    }

    // ------------------------------------------------------------------
    // Upload
    // ------------------------------------------------------------------

    public static function uploadBackup(UploadedFile $file, User $staff): Backup
    {
        self::requireActiveStaff($staff);

        if ($file->getSize() === false || $file->getSize() <= 0) {
            throw ValidationException::withMessages(['backup' => 'The uploaded file is empty.']);
        }

        if ($file->getSize() > self::MAX_UPLOAD_BYTES) {
            throw ValidationException::withMessages(['backup' => 'The uploaded backup is too large (max 512 MB).']);
        }

        $realPath = $file->getRealPath();
        if ($realPath === false) {
            throw ValidationException::withMessages(['backup' => 'The uploaded file could not be read.']);
        }

        $finfo = new \finfo(FILEINFO_MIME_TYPE);
        $mime = (string) $finfo->file($realPath);
        if (! in_array($mime, ['application/zip', 'application/x-zip-compressed', 'multipart/x-zip'], true)) {
            throw ValidationException::withMessages(['backup' => 'Only ZIP backup archives can be uploaded.']);
        }

        $lock = Cache::lock(self::LOCK_KEY, 3600);
        if (! $lock->acquire()) {
            throw ValidationException::withMessages([
                'backup' => 'A backup or restore operation is already running. Please wait and refresh.',
            ]);
        }

        try {
            self::assertNoActiveOperation();

            // Validate before storing: a malicious archive never lands in backups/.
            $manifest = self::validateArchive($realPath);

            $filename = 'backups/uploaded-'.now('UTC')->format('Ymd-His').'-'.((string) Str::ulid()).'.zip';
            Storage::disk('local')->makeDirectory('backups');
            $destination = Storage::disk('local')->path($filename);

            if (! @copy($realPath, $destination)) {
                throw ValidationException::withMessages(['backup' => 'The uploaded backup could not be stored.']);
            }

            // Re-validate the stored copy (checksum + manifest round-trip).
            $storedManifest = self::validateArchive($destination);

            $backup = new Backup;
            $backup->forceFill([
                'filename' => $filename,
                'disk' => 'local',
                'size_bytes' => filesize($destination),
                'checksum_sha256' => hash_file('sha256', $destination),
                'status' => Backup::STATUS_COMPLETED,
                'type' => Backup::TYPE_UPLOADED,
                'manifest' => $storedManifest,
                'created_by' => $staff->id,
                'completed_at' => now('UTC'),
            ]);
            $backup->save();

            Log::info('backup uploaded', ['backup_id' => $backup->id, 'size_bytes' => $backup->size_bytes]);

            return $backup->fresh();
        } finally {
            $lock->release();
        }
    }

    // ------------------------------------------------------------------
    // Delete + prune
    // ------------------------------------------------------------------

    public static function deleteBackup(Backup $backup, User $staff): void
    {
        self::requireActiveStaff($staff);

        $backup->refresh();
        if ($backup->isActive()) {
            throw ValidationException::withMessages([
                'backup' => 'A backup that is currently running cannot be deleted.',
            ]);
        }

        Storage::disk($backup->disk)->delete($backup->filename);
        $id = $backup->id;
        $backup->delete();

        Log::info('backup deleted', ['backup_id' => $id]);
    }

    /**
     * Retention: delete completed/failed backups older than $days.
     * The default 30-day window follows scope §19.3. Returns the count.
     */
    public static function prune(int $days = 30): int
    {
        $cutoff = now('UTC')->subDays($days);
        $old = Backup::where('created_at', '<', $cutoff)
            ->whereNotIn('status', [Backup::STATUS_CREATING, Backup::STATUS_RESTORING])
            ->get();

        $count = 0;
        foreach ($old as $backup) {
            Storage::disk($backup->disk)->delete($backup->filename);
            $backup->delete();
            $count++;
        }

        if ($count > 0) {
            Log::info('backups pruned', ['count' => $count, 'older_than_days' => $days]);
        }

        return $count;
    }

    // ------------------------------------------------------------------
    // Archive internals
    // ------------------------------------------------------------------

    private static function buildArchive(Backup $backup): void
    {
        Storage::disk('local')->makeDirectory('backups');
        Storage::disk('local')->makeDirectory('tmp');

        $tmpDir = Storage::disk('local')->path('tmp');
        $workId = 'backup-'.((string) Str::ulid());
        $workDir = $tmpDir.'/'.$workId;
        @mkdir($workDir.'/database', 0770, true);

        try {
            // 1. Database export (read-only).
            $tables = [];
            $counts = [];
            foreach (self::BACKUP_TABLES as $table) {
                if (! Schema::hasTable($table)) {
                    continue;
                }
                $rows = DB::table($table)->orderBy('id')->get()
                    ->map(fn ($row) => self::normalizeRow((array) $row))
                    ->all();
                $tables[$table] = $rows;
                $counts[$table] = count($rows);
            }

            $tablesJson = json_encode($tables, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
            if ($tablesJson === false) {
                throw new \RuntimeException('Database export could not be encoded.');
            }
            file_put_contents($workDir.'/database/tables.json', $tablesJson);

            // 2. File inventory (read-only, checksums first).
            $entries = [];
            $entries = array_merge($entries, self::inventoryDisk('local', 'lessons', 'files/private/lessons'));
            $entries = array_merge($entries, self::inventoryDisk('local', 'receipts', 'files/private/receipts'));
            $entries = array_merge($entries, self::inventoryDisk('public', 'covers', 'files/public/covers'));

            // 3. Manifest (no secrets — key names only).
            $manifest = [
                'format' => self::FORMAT,
                'database_format' => self::DATABASE_FORMAT,
                'created_at' => now('UTC')->toIso8601String(),
                'laravel_version' => app()->version(),
                'laravel_major' => (int) explode('.', app()->version())[0],
                'php_version' => PHP_MAJOR_VERSION.'.'.PHP_MINOR_VERSION.'.'.PHP_RELEASE_VERSION,
                'migrations' => DB::table('migrations')->orderBy('migration')->pluck('migration')->all(),
                'tables' => $counts,
                'database_file' => 'database/tables.json',
                'database_sha256' => hash_file('sha256', $workDir.'/database/tables.json'),
                'files' => $entries,
                'env_required' => self::ENV_REQUIRED,
                'app_key_note' => 'Restore requires the SAME APP_KEY: user passwords verify without it, but encrypted staff 2FA secrets cannot be decrypted after a key change. Recover APP_KEY from the secure server secret store — it is never inside this archive.',
            ];

            file_put_contents($workDir.'/manifest.json', json_encode($manifest, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT));
            file_put_contents($workDir.'/ENV_RECOVERY.md', self::recoveryDoc());

            // 4. Zip assembly.
            $absolute = Storage::disk('local')->path($backup->filename);
            @unlink($absolute);

            $zip = new ZipArchive;
            if ($zip->open($absolute, ZipArchive::CREATE | ZipArchive::EXCL) !== true) {
                throw new \RuntimeException('Backup archive could not be created.');
            }

            $zip->addFile($workDir.'/manifest.json', 'manifest.json');
            $zip->addFile($workDir.'/ENV_RECOVERY.md', 'ENV_RECOVERY.md');
            $zip->addFile($workDir.'/database/tables.json', 'database/tables.json');

            foreach ($entries as $entry) {
                $zip->addFile($entry['absolute'], $entry['path']);
            }

            $zip->close();

            // 5. Verify: reopen + manifest + every checksum.
            $verified = self::validateArchive($absolute);
            if (($verified['database_sha256'] ?? null) !== $manifest['database_sha256']) {
                throw new \RuntimeException('Backup verification failed (database checksum).');
            }

            $backup->forceFill(['manifest' => $verified]);
            $backup->save();
        } finally {
            self::removeDir($workDir);
        }
    }

    /**
     * Validate an archive without touching live data. Returns the manifest.
     *
     * @throws ValidationException on any integrity/compatibility problem.
     */
    public static function validateArchive(string $absolute): array
    {
        if (! is_file($absolute)) {
            throw ValidationException::withMessages(['backup' => 'The backup file is missing.']);
        }

        $zip = new ZipArchive;
        if ($zip->open($absolute) !== true) {
            throw ValidationException::withMessages(['backup' => 'The backup is not a valid ZIP archive.']);
        }

        try {
            $manifestRaw = $zip->getFromName('manifest.json');
            if ($manifestRaw === false) {
                throw ValidationException::withMessages(['backup' => 'The backup has no manifest and cannot be trusted.']);
            }

            $manifest = json_decode($manifestRaw, true);
            if (! is_array($manifest)) {
                throw ValidationException::withMessages(['backup' => 'The backup manifest is corrupted.']);
            }

            if (($manifest['format'] ?? null) !== self::FORMAT) {
                throw ValidationException::withMessages(['backup' => 'This backup format is not supported here.']);
            }

            if (($manifest['database_format'] ?? null) !== self::DATABASE_FORMAT) {
                throw ValidationException::withMessages(['backup' => 'This backup database format is not supported here.']);
            }

            $currentMajor = (int) explode('.', app()->version())[0];
            if ((int) ($manifest['laravel_major'] ?? -1) !== $currentMajor) {
                throw ValidationException::withMessages(['backup' => 'This backup is from an incompatible application version.']);
            }

            // Forward-compatibility: a backup from newer code (migrations
            // this checkout never ran) is rejected. Older backups pass;
            // unknown new columns keep their DB defaults on restore.
            $codeMigrations = self::codeMigrations();
            foreach ((array) ($manifest['migrations'] ?? []) as $name) {
                if (! in_array($name, $codeMigrations, true)) {
                    throw ValidationException::withMessages(['backup' => 'This backup needs newer migrations and cannot be restored here.']);
                }
            }

            // Entry allowlist + traversal guard (checked before any write).
            for ($i = 0; $i < $zip->numFiles; $i++) {
                $stat = $zip->statIndex($i);
                if ($stat === false) {
                    continue;
                }
                $name = (string) $stat['name'];
                self::assertSafeEntry($name);
            }

            // Database payload must exist and match its checksum.
            $dbFile = (string) ($manifest['database_file'] ?? 'database/tables.json');
            self::assertSafeEntry($dbFile);
            $dbRaw = $zip->getFromName($dbFile);
            if ($dbRaw === false) {
                throw ValidationException::withMessages(['backup' => 'The backup database payload is missing.']);
            }
            if (hash('sha256', $dbRaw) !== ($manifest['database_sha256'] ?? '')) {
                throw ValidationException::withMessages(['backup' => 'The backup database failed its checksum.']);
            }

            $tables = json_decode($dbRaw, true);
            if (! is_array($tables)) {
                throw ValidationException::withMessages(['backup' => 'The backup database payload is corrupted.']);
            }

            foreach (self::BACKUP_TABLES as $table) {
                if (array_key_exists($table, $tables) && ! is_array($tables[$table])) {
                    throw ValidationException::withMessages(['backup' => 'The backup database payload is corrupted.']);
                }
            }

            // Every inventoried file must exist in the zip with a matching hash.
            // Streams keep multi-GB media libraries out of PHP memory.
            foreach ((array) ($manifest['files'] ?? []) as $entry) {
                if (! is_array($entry) || ! isset($entry['path'], $entry['sha256'])) {
                    throw ValidationException::withMessages(['backup' => 'The backup file inventory is corrupted.']);
                }
                $path = (string) $entry['path'];
                self::assertSafeEntry($path);
                $stream = $zip->getStream($path);
                if ($stream === false) {
                    throw ValidationException::withMessages(['backup' => 'The backup is missing a file: '.$path]);
                }
                $ctx = hash_init('sha256');
                while (! feof($stream)) {
                    $chunk = fread($stream, 8192);
                    if ($chunk === false) {
                        break;
                    }
                    hash_update($ctx, $chunk);
                }
                fclose($stream);
                if (hash_final($ctx) !== $entry['sha256']) {
                    throw ValidationException::withMessages(['backup' => 'A backup file failed its checksum: '.$path]);
                }
            }

            return $manifest;
        } finally {
            $zip->close();
        }
    }

    /**
     * Apply a validated archive over the current DB + files.
     * The archive MUST have passed validateArchive() first.
     */
    private static function applyArchive(string $absolute, array $manifest): void
    {
        $tmpDir = Storage::disk('local')->path('tmp');
        @mkdir($tmpDir, 0770, true);
        $workDir = $tmpDir.'/restore-'.((string) Str::ulid());
        @mkdir($workDir, 0770, true);

        try {
            // Extract file-by-file via streams (no blind extractTo).
            $zip = new ZipArchive;
            if ($zip->open($absolute) !== true) {
                throw new \RuntimeException('Backup could not be opened for restore.');
            }

            try {
                for ($i = 0; $i < $zip->numFiles; $i++) {
                    $stat = $zip->statIndex($i);
                    if ($stat === false) {
                        continue;
                    }
                    $name = (string) $stat['name'];
                    self::assertSafeEntry($name);

                    // Directories: ensure they exist, nothing to write.
                    if (str_ends_with($name, '/')) {
                        @mkdir($workDir.'/'.$name, 0770, true);

                        continue;
                    }

                    // Only materialize what restore consumes; the manifest
                    // itself is already in memory.
                    if ($name === 'manifest.json' || $name === 'ENV_RECOVERY.md') {
                        continue;
                    }

                    $stream = $zip->getStream($name);
                    if ($stream === false) {
                        throw new \RuntimeException('Backup entry could not be read: '.$name);
                    }

                    $target = $workDir.'/'.$name;
                    $parent = dirname($target);
                    if (! is_dir($parent)) {
                        mkdir($parent, 0770, true);
                    }

                    // Realpath guard: the final path must stay inside workDir.
                    $realBase = realpath($workDir);
                    $realParent = realpath($parent);
                    if ($realBase === false || $realParent === false || ! str_starts_with($realParent, $realBase)) {
                        fclose($stream);
                        throw new \RuntimeException('Unsafe backup entry blocked: '.$name);
                    }

                    $out = fopen($target, 'wb');
                    if ($out === false) {
                        fclose($stream);
                        throw new \RuntimeException('Restore scratch write failed.');
                    }
                    stream_copy_to_stream($stream, $out);
                    fclose($stream);
                    fclose($out);
                }
            } finally {
                $zip->close();
            }

            // Re-verify extracted file checksums before touching live state.
            foreach ((array) ($manifest['files'] ?? []) as $entry) {
                $diskPath = $workDir.'/'.$entry['path'];
                if (! is_file($diskPath) || hash_file('sha256', $diskPath) !== $entry['sha256']) {
                    throw new \RuntimeException('Restored file failed verification: '.$entry['path']);
                }
            }

            $dbFile = $workDir.'/'.($manifest['database_file'] ?? 'database/tables.json');
            if (! is_file($dbFile) || hash_file('sha256', $dbFile) !== ($manifest['database_sha256'] ?? '')) {
                throw new \RuntimeException('Restored database failed verification.');
            }

            $tables = json_decode((string) file_get_contents($dbFile), true);
            if (! is_array($tables)) {
                throw new \RuntimeException('Restored database payload is corrupted.');
            }

            // --- Destructive phase: DB first, then files. ---
            DB::transaction(function () use ($tables) {
                // Child-first wipe (backups + migrations + queues untouched).
                foreach (array_reverse(self::BACKUP_TABLES) as $table) {
                    if (! Schema::hasTable($table)) {
                        continue;
                    }
                    DB::table($table)->delete();
                }

                // Parent-first re-insert (pure data copy — no domain
                // actions, no payment events, no external calls).
                foreach (self::BACKUP_TABLES as $table) {
                    $rows = $tables[$table] ?? null;
                    if (! is_array($rows) || $rows === []) {
                        continue;
                    }
                    if (! Schema::hasTable($table)) {
                        continue;
                    }
                    $columns = Schema::getColumnListing($table);
                    foreach (array_chunk($rows, 500) as $chunk) {
                        $filtered = array_map(
                            fn ($row) => self::filterRow((array) $row, $columns),
                            $chunk
                        );
                        $filtered = array_values(array_filter($filtered, fn ($row) => $row !== []));
                        if ($filtered !== []) {
                            DB::table($table)->insert($filtered);
                        }
                    }
                }

                // Reset Postgres serial sequences so new rows keep working.
                $driver = DB::getDriverName();
                if ($driver === 'pgsql') {
                    foreach (self::BACKUP_TABLES as $table) {
                        if (! Schema::hasTable($table)) {
                            continue;
                        }
                        try {
                            DB::statement(
                                "SELECT setval(pg_get_serial_sequence(?, 'id'), COALESCE((SELECT MAX(id) FROM {$table}), 1))", [$table]
                            );
                        } catch (\Throwable) {
                            // Tables without a serial `id` skip silently.
                        }
                    }
                }
            });

            // Files: swap live dirs from the verified scratch copy.
            // Backup archives under backups/ are never touched.
            self::replaceDir(
                Storage::disk('local')->path('lessons'),
                $workDir.'/files/private/lessons'
            );
            self::replaceDir(
                Storage::disk('local')->path('receipts'),
                $workDir.'/files/private/receipts'
            );
            self::replaceDir(
                Storage::disk('public')->path('covers'),
                $workDir.'/files/public/covers'
            );
        } finally {
            self::removeDir($workDir);
        }
    }

    // ------------------------------------------------------------------
    // Small helpers
    // ------------------------------------------------------------------

    private static function createBackupInternal(User $staff, string $type): Backup
    {
        // Same path as createBackup but the caller already holds the lock.
        $filename = 'backups/'.now('UTC')->format('Ymd-His').'-'.((string) Str::ulid()).'.zip';

        $backup = new Backup;
        $backup->forceFill([
            'filename' => $filename,
            'disk' => 'local',
            'status' => Backup::STATUS_CREATING,
            'type' => $type,
            'created_by' => $staff->id,
        ]);
        $backup->save();

        try {
            self::buildArchive($backup);

            $absolute = Storage::disk('local')->path($backup->filename);
            $backup->forceFill([
                'size_bytes' => filesize($absolute),
                'checksum_sha256' => hash_file('sha256', $absolute),
                'status' => Backup::STATUS_COMPLETED,
                'completed_at' => now('UTC'),
                'error_message' => null,
            ]);
            $backup->save();

            return $backup->fresh();
        } catch (\Throwable $e) {
            Storage::disk('local')->delete($backup->filename);
            $backup->forceFill([
                'status' => Backup::STATUS_FAILED,
                'error_message' => self::safeMessage($e),
            ]);
            $backup->save();

            return $backup->fresh();
        }
    }

    /** @return list<array{path: string, sha256: string, bytes: int, absolute: string}> */
    private static function inventoryDisk(string $disk, string $prefix, string $zipPrefix): array
    {
        $entries = [];
        $files = Storage::disk($disk)->files($prefix);

        foreach ($files as $relative) {
            // Never include other backups or temp work.
            if (str_starts_with($relative, 'backups/') || str_starts_with($relative, 'tmp/')) {
                continue;
            }
            $absolute = Storage::disk($disk)->path($relative);
            if (! is_file($absolute)) {
                continue;
            }
            $entries[] = [
                'path' => $zipPrefix.'/'.basename($relative),
                'sha256' => hash_file('sha256', $absolute),
                'bytes' => filesize($absolute),
                'absolute' => $absolute,
            ];
        }

        return $entries;
    }

    /** @param array<string, mixed> $row */
    private static function normalizeRow(array $row): array
    {
        foreach ($row as $key => $value) {
            if ($value instanceof \DateTimeInterface) {
                $row[$key] = $value->format('Y-m-d H:i:s');
            } elseif (is_bool($value)) {
                $row[$key] = $value;
            } elseif (is_array($value)) {
                $row[$key] = json_encode($value, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
            } elseif (is_object($value)) {
                $row[$key] = (string) $value;
            }
        }

        return $row;
    }

    /**
     * @param  array<string, mixed>  $row
     * @param  list<string>  $columns
     * @return array<string, mixed>
     */
    private static function filterRow(array $row, array $columns): array
    {
        $out = [];
        foreach ($columns as $column) {
            if (array_key_exists($column, $row)) {
                $out[$column] = $row[$column];
            }
        }

        return $out;
    }

    private static function assertSafeEntry(string $name): void
    {
        $clean = trim($name);
        if ($clean === '' || $clean === '/' || str_starts_with($clean, '/') || preg_match('#^[A-Za-z]:#', $clean) === 1) {
            throw ValidationException::withMessages(['backup' => 'The backup contains an unsafe entry and was rejected.']);
        }

        $normalized = str_replace('\\', '/', $clean);
        foreach (explode('/', $normalized) as $segment) {
            if ($segment === '..' || $segment === '') {
                // Empty segments are only legal as a trailing slash for dirs.
                if ($segment === '' && str_ends_with($normalized, '/')) {
                    continue;
                }
                if ($segment === '..') {
                    throw ValidationException::withMessages(['backup' => 'The backup contains an unsafe entry and was rejected.']);
                }
            }
        }

        foreach (self::ALLOWED_PREFIXES as $prefix) {
            if ($normalized === $prefix || str_starts_with($normalized, $prefix)) {
                // Bare prefixes ending in / must be longer than the prefix.
                if (str_ends_with($prefix, '/') && $normalized === $prefix) {
                    continue;
                }

                return;
            }
        }

        throw ValidationException::withMessages(['backup' => 'The backup contains an unexpected entry and was rejected.']);
    }

    /** @return list<string> */
    private static function codeMigrations(): array
    {
        $files = glob(database_path('migrations/*.php')) ?: [];

        return array_map(fn ($path) => basename($path, '.php'), $files);
    }

    private static function replaceDir(string $liveDir, string $sourceDir): void
    {
        if (! is_dir($sourceDir)) {
            return;
        }

        if (! is_dir($liveDir)) {
            @mkdir($liveDir, 0770, true);
        }

        // Remove current payload (archives under backups/ are elsewhere).
        foreach ((array) glob($liveDir.'/*') as $item) {
            if (is_file($item) || is_link($item)) {
                @unlink($item);
            } elseif (is_dir($item)) {
                self::removeDir($item);
            }
        }

        foreach ((array) glob($sourceDir.'/*') as $item) {
            $base = basename($item);
            if ($base === '' || $base === '.' || $base === '..') {
                continue;
            }
            if (is_file($item)) {
                copy($item, $liveDir.'/'.$base);
            }
        }
    }

    private static function removeDir(string $dir): void
    {
        if (! is_dir($dir)) {
            return;
        }
        $items = array_diff((array) scandir($dir), ['.', '..']);
        foreach ($items as $item) {
            $path = $dir.'/'.$item;
            if (is_dir($path)) {
                self::removeDir($path);
            } else {
                @unlink($path);
            }
        }
        @rmdir($dir);
    }

    private static function recoveryDoc(): string
    {
        return <<<'MD'
# Backup recovery — credentials & configuration

This archive holds database rows + uploaded files only. It NEVER contains
`.env` values, APP_KEY, passwords, tokens, or decrypted secrets.

To restore safely you need, from the secure server secret store (never Git):

1. The SAME APP_KEY the backup was taken with. User logins still verify
   after a key change, but encrypted staff 2FA secrets cannot be
   decrypted — staff may need to re-enroll 2FA after a key rotation.
2. Database + mail environment (DB_*, MAIL_*) for the target host.
3. The Android keystore + passwords (kept outside Git with a named owner).

Restore steps: staff-only panel → Backups → pick the archive → confirm
the destructive warning → the panel creates a verified pre-restore
emergency backup first. If the restore fails, the emergency archive
(backups/*, type pre_restore) is re-applied automatically; otherwise
re-apply it manually from the same screen.

Same-server copies do NOT protect against losing the server itself: keep
at least one encrypted copy off the VPS (scope §19.3) with a 30-day
rotation. Verify restores in an empty environment (login + audio +
receipt counts) before trusting a copy.
MD;
    }

    private static function requireActiveStaff(User $staff): void
    {
        $staff->refresh();

        if (! Entitlement::staff($staff)) {
            throw ValidationException::withMessages(['backup' => 'Only active staff can manage backups.']);
        }
    }

    private static function assertNoActiveOperation(?int $exceptId = null): void
    {
        $active = Backup::whereIn('status', [Backup::STATUS_CREATING, Backup::STATUS_RESTORING])
            ->when($exceptId !== null, fn ($query) => $query->where('id', '!=', $exceptId))
            ->exists();

        if ($active) {
            throw ValidationException::withMessages([
                'backup' => 'A backup or restore operation is already running. Please wait and refresh.',
            ]);
        }
    }

    private static function safeMessage(\Throwable $e): string
    {
        if ($e instanceof ValidationException) {
            $messages = [];
            foreach ($e->errors() as $fieldMessages) {
                foreach ((array) $fieldMessages as $message) {
                    $messages[] = (string) $message;
                }
            }

            return mb_substr(implode(' ', $messages), 0, 500);
        }

        // Never leak paths with secrets, SQL values, or traces — callers
        // only need the failure class, not its payload.
        return mb_substr('Operation failed ('.basename(str_replace('\\', '/', $e::class)).').', 0, 200);
    }
}

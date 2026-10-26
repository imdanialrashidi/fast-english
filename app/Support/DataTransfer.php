<?php

namespace App\Support;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use RuntimeException;
use ZipArchive;

/**
 * Staff-only data transfer: one ZIP export, one ZIP import.
 *
 * This replaces the earlier panel backup/restore subsystem. The archive is
 * deliberately small: only the files the database actually references are
 * carried (lesson audio, receipts, topic covers). An earlier version
 * archived whole directories, so 16k orphan test MP3s made every archive
 * ~2.2 GB while the database itself was 100 KB.
 *
 * Contents
 * - `database/tables.json` — every domain table including `settings`
 *   (`json-tables-v1`). Ephemeral tables (cache, sessions, jobs,
 *   migrations, failed_jobs) are never exported.
 * - `files/private/**` + `files/public/**` — only referenced files.
 * - `manifest.json` — format, Laravel major, migration list, per-table
 *   counts, per-file SHA-256, required env names (never values).
 * - `ENV_RECOVERY.md` — the credentials the archive never contains.
 *
 * Safety
 * - Import validates first: zip opens, manifest parses, format/Laravel
 *   major match, backup migrations are a subset of this checkout's, every
 *   entry is allowlisted with no `..`/absolute path, every file checksum
 *   matches. Nothing touches live data before that passes.
 * - Files are extracted to a scratch dir and re-hashed before the swap.
 * - The DB swap runs in one transaction (child-first delete, parent-first
 *   insert, sequence resync). A pre-import safety archive is written to
 *   the private disk before anything is replaced.
 * - Restore is a pure data copy: it never calls ApprovePayment, never
 *   emits subscription events, never replays external actions.
 */
final class DataTransfer
{
    public const FORMAT = 'fast-english-transfer-v2';

    public const DATABASE_FORMAT = 'json-tables-v1';

    public const MAX_UPLOAD_KILOBYTES = 524288; // 512 MB

    public const SAFETY_PREFIX = 'pre-import-';

    private const SAFETY_KEEP = 1;

    /**
     * Parent-first insert order. Deletion runs in reverse.
     *
     * @var list<string>
     */
    public const TABLES = [
        'users',
        'categories',
        'plans',
        'payment_destinations',
        'placement_tests',
        'topics',
        'lessons',
        'placement_questions',
        'lesson_progress',
        'bookmarks',
        'payment_requests',
        'subscriptions',
        'subscription_events',
        'placement_attempts',
        'placement_answers',
        'vocabulary_words',
        'settings',
    ];

    /** Directories the import owns when it replaces files. @var array<string, list<string>> */
    private const MANAGED_DIRS = [
        'local' => ['lessons', 'receipts'],
        'public' => ['covers'],
    ];

    /** @var list<string> */
    private const ALLOWED_PREFIXES = [
        'manifest.json',
        'ENV_RECOVERY.md',
        'database/',
        'files/private/',
        'files/public/',
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

    /**
     * Build a complete archive at $absolute and verify it by re-opening it.
     *
     * @return array<string, mixed> the verified manifest
     */
    public static function exportTo(string $absolute): array
    {
        Storage::disk('local')->makeDirectory('tmp');
        self::pruneTempArchives();
        $work = Storage::disk('local')->path('tmp/export-'.strtolower((string) Str::ulid()));
        @mkdir($work.'/database', 0770, true);

        try {
            [$tables, $counts] = self::dumpTables();

            $tablesJson = json_encode($tables, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
            if ($tablesJson === false) {
                throw new RuntimeException('Database export could not be encoded.');
            }
            file_put_contents($work.'/database/tables.json', $tablesJson);

            $files = self::referencedFiles($tables);

            $manifest = [
                'format' => self::FORMAT,
                'database_format' => self::DATABASE_FORMAT,
                'created_at' => now('UTC')->toIso8601String(),
                'laravel_major' => (int) explode('.', app()->version())[0],
                'php_version' => PHP_MAJOR_VERSION.'.'.PHP_MINOR_VERSION.'.'.PHP_RELEASE_VERSION,
                'migrations' => self::codeMigrations(),
                'tables' => $counts,
                'database_file' => 'database/tables.json',
                'database_sha256' => hash_file('sha256', $work.'/database/tables.json'),
                'files' => $files,
                'env_required' => self::ENV_REQUIRED,
                'app_key_note' => 'Import requires the SAME APP_KEY: passwords verify without it, but encrypted staff 2FA secrets cannot be decrypted after a key change. The key is never inside this archive.',
            ];

            file_put_contents($work.'/manifest.json', json_encode($manifest, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT));
            file_put_contents($work.'/ENV_RECOVERY.md', self::recoveryDoc());

            if (is_file($absolute)) {
                @unlink($absolute);
            }

            $zip = new ZipArchive;
            if ($zip->open($absolute, ZipArchive::CREATE | ZipArchive::EXCL) !== true) {
                throw new RuntimeException('Export archive could not be created.');
            }

            $zip->addFile($work.'/manifest.json', 'manifest.json');
            $zip->addFile($work.'/ENV_RECOVERY.md', 'ENV_RECOVERY.md');
            $zip->addFile($work.'/database/tables.json', 'database/tables.json');

            foreach ($files as $entry) {
                $zip->addFile(Storage::disk($entry['disk'])->path($entry['path']), $entry['zip']);
            }

            $zip->close();

            // Re-open and re-hash before we hand the file to anyone.
            return self::validateArchive($absolute);
        } finally {
            self::removeDir($work);
        }
    }

    /**
     * Validate an archive without touching live data. Returns the manifest.
     *
     * @return array<string, mixed>
     *
     * @throws ValidationException
     */
    public static function validateArchive(string $absolute): array
    {
        if (! is_file($absolute)) {
            throw ValidationException::withMessages(['archive' => 'The archive file is missing.']);
        }

        $zip = new ZipArchive;
        if ($zip->open($absolute) !== true) {
            throw ValidationException::withMessages(['archive' => 'The file is not a valid ZIP archive.']);
        }

        try {
            $manifestRaw = $zip->getFromName('manifest.json');
            if ($manifestRaw === false) {
                throw ValidationException::withMessages(['archive' => 'The archive has no manifest and cannot be trusted.']);
            }

            $manifest = json_decode($manifestRaw, true);
            if (! is_array($manifest)) {
                throw ValidationException::withMessages(['archive' => 'The archive manifest is corrupted.']);
            }

            if (($manifest['format'] ?? null) !== self::FORMAT) {
                throw ValidationException::withMessages(['archive' => 'This archive format is not supported here.']);
            }

            if (($manifest['database_format'] ?? null) !== self::DATABASE_FORMAT) {
                throw ValidationException::withMessages(['archive' => 'This archive database format is not supported here.']);
            }

            $currentMajor = (int) explode('.', app()->version())[0];
            if ((int) ($manifest['laravel_major'] ?? -1) !== $currentMajor) {
                throw ValidationException::withMessages(['archive' => 'This archive comes from an incompatible application version.']);
            }

            // A newer checkout may have run migrations this one never saw;
            // importing its data would drop unknown columns' meaning.
            $codeMigrations = self::codeMigrations();
            foreach ((array) ($manifest['migrations'] ?? []) as $name) {
                if (! in_array($name, $codeMigrations, true)) {
                    throw ValidationException::withMessages(['archive' => 'This archive needs newer migrations and cannot be imported here.']);
                }
            }

            for ($i = 0; $i < $zip->numFiles; $i++) {
                $stat = $zip->statIndex($i);
                if ($stat === false) {
                    continue;
                }
                self::assertSafeEntry((string) $stat['name']);
            }

            $dbFile = (string) ($manifest['database_file'] ?? 'database/tables.json');
            self::assertSafeEntry($dbFile);
            $dbRaw = $zip->getFromName($dbFile);
            if ($dbRaw === false) {
                throw ValidationException::withMessages(['archive' => 'The archive database payload is missing.']);
            }
            if (hash('sha256', $dbRaw) !== ($manifest['database_sha256'] ?? '')) {
                throw ValidationException::withMessages(['archive' => 'The archive database failed its checksum.']);
            }

            $tables = json_decode($dbRaw, true);
            if (! is_array($tables)) {
                throw ValidationException::withMessages(['archive' => 'The archive database payload is corrupted.']);
            }

            foreach (self::TABLES as $table) {
                if (array_key_exists($table, $tables) && ! is_array($tables[$table])) {
                    throw ValidationException::withMessages(['archive' => 'The archive database payload is corrupted.']);
                }
            }

            // Stream-hash every inventoried file: no multi-hundred-MB blob
            // is ever loaded into memory.
            foreach ((array) ($manifest['files'] ?? []) as $entry) {
                if (! is_array($entry) || ! isset($entry['zip'], $entry['sha256'], $entry['path'], $entry['disk'])) {
                    throw ValidationException::withMessages(['archive' => 'The archive file inventory is corrupted.']);
                }
                $zipPath = (string) $entry['zip'];
                self::assertSafeEntry($zipPath);

                $stream = $zip->getStream($zipPath);
                if ($stream === false) {
                    throw ValidationException::withMessages(['archive' => 'The archive is missing a file: '.$zipPath]);
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
                    throw ValidationException::withMessages(['archive' => 'A file failed its checksum: '.$zipPath]);
                }
            }

            return $manifest;
        } finally {
            $zip->close();
        }
    }

    /**
     * Replace the database and managed files with the archive contents.
     * The archive MUST have passed validateArchive() first.
     *
     * @param  array<string, mixed>  $manifest
     * @return array{tables: array<string, int>, files: int}
     */
    public static function applyArchive(string $absolute, array $manifest): array
    {
        $work = Storage::disk('local')->path('tmp/import-'.strtolower((string) Str::ulid()));
        @mkdir($work, 0770, true);

        try {
            $zip = new ZipArchive;
            if ($zip->open($absolute) !== true) {
                throw new RuntimeException('The archive could not be opened for import.');
            }

            try {
                for ($i = 0; $i < $zip->numFiles; $i++) {
                    $stat = $zip->statIndex($i);
                    if ($stat === false) {
                        continue;
                    }
                    $name = (string) $stat['name'];
                    self::assertSafeEntry($name);

                    if (str_ends_with($name, '/') || $name === 'manifest.json' || $name === 'ENV_RECOVERY.md') {
                        continue;
                    }

                    $stream = $zip->getStream($name);
                    if ($stream === false) {
                        throw new RuntimeException('An archive entry could not be read: '.$name);
                    }

                    $target = $work.'/'.$name;
                    $parent = dirname($target);
                    if (! is_dir($parent)) {
                        mkdir($parent, 0770, true);
                    }

                    $realBase = realpath($work);
                    $realParent = realpath($parent);
                    if ($realBase === false || $realParent === false || ! str_starts_with($realParent, $realBase)) {
                        fclose($stream);
                        throw new RuntimeException('An unsafe archive entry was blocked: '.$name);
                    }

                    $out = fopen($target, 'wb');
                    if ($out === false) {
                        fclose($stream);
                        throw new RuntimeException('The import scratch directory is not writable.');
                    }
                    stream_copy_to_stream($stream, $out);
                    fclose($stream);
                    fclose($out);
                }
            } finally {
                $zip->close();
            }

            // Re-verify the extracted bytes before touching live state.
            foreach ((array) ($manifest['files'] ?? []) as $entry) {
                $path = $work.'/'.(string) $entry['zip'];
                if (! is_file($path) || hash_file('sha256', $path) !== $entry['sha256']) {
                    throw new RuntimeException('A restored file failed verification: '.$entry['path']);
                }
            }

            $dbFile = $work.'/'.(string) ($manifest['database_file'] ?? 'database/tables.json');
            if (! is_file($dbFile) || hash_file('sha256', $dbFile) !== ($manifest['database_sha256'] ?? '')) {
                throw new RuntimeException('The restored database failed verification.');
            }

            $tables = json_decode((string) file_get_contents($dbFile), true);
            if (! is_array($tables)) {
                throw new RuntimeException('The restored database payload is corrupted.');
            }

            $counts = self::replaceDatabase($tables);
            $written = self::writeFiles($work, $manifest);

            return ['tables' => $counts, 'files' => $written];
        } finally {
            self::removeDir($work);
        }
    }

    /**
     * Write a safety archive of the current state before a destructive
     * import. Only the newest one is kept.
     */
    public static function createSafetyCopy(): string
    {
        Storage::disk('local')->makeDirectory('backups');

        $name = self::SAFETY_PREFIX.now('UTC')->format('Ymd-His').'-'.strtolower((string) Str::ulid()).'.zip';
        $absolute = Storage::disk('local')->path('backups/'.$name);

        self::exportTo($absolute);
        self::pruneSafetyCopies();

        return $absolute;
    }

    /** Newest pre-import safety archive, if any. */
    public static function latestSafetyCopy(): ?string
    {
        $matches = glob(Storage::disk('local')->path('backups/'.self::SAFETY_PREFIX.'*.zip')) ?: [];
        if ($matches === []) {
            return null;
        }

        sort($matches);

        return (string) end($matches);
    }

    /** Keep only the newest safety archive. */
    public static function pruneSafetyCopies(): void
    {
        $matches = glob(Storage::disk('local')->path('backups/'.self::SAFETY_PREFIX.'*.zip')) ?: [];
        sort($matches);

        while (count($matches) > self::SAFETY_KEEP) {
            @unlink((string) array_shift($matches));
        }
    }

    /** Bytes to a short human string (staff UI only). */
    public static function humanBytes(int $bytes): string
    {
        foreach (['B', 'KB', 'MB', 'GB'] as $unit) {
            if ($bytes < 1024 || $unit === 'GB') {
                return round($bytes, 1).' '.$unit;
            }
            $bytes /= 1024;
        }

        return round($bytes, 1).' GB';
    }

    // ------------------------------------------------------------------
    // Internals
    // ------------------------------------------------------------------

    /**
     * @return array{0: array<string, list<array<string, mixed>>>, 1: array<string, int>}
     */
    private static function dumpTables(): array
    {
        $tables = [];
        $counts = [];

        foreach (self::TABLES as $table) {
            if (! Schema::hasTable($table)) {
                continue;
            }

            $rows = DB::table($table)->orderBy('id')->get()
                ->map(fn ($row) => self::normalizeRow((array) $row))
                ->all();

            $tables[$table] = $rows;
            $counts[$table] = count($rows);
        }

        return [$tables, $counts];
    }

    /**
     * Files referenced by the exported rows. Orphan files on disk are not
     * carried: they are not part of the data and used to dominate archives.
     *
     * @param  array<string, list<array<string, mixed>>>  $tables
     * @return list<array{disk: string, path: string, zip: string, sha256: string, bytes: int}>
     */
    private static function referencedFiles(array $tables): array
    {
        $byDisk = ['local' => [], 'public' => []];

        foreach ((array) ($tables['lessons'] ?? []) as $row) {
            $byDisk['local'][] = $row['audio_path'] ?? null;
        }
        foreach ((array) ($tables['payment_requests'] ?? []) as $row) {
            $byDisk['local'][] = $row['receipt_path'] ?? null;
        }
        foreach ((array) ($tables['topics'] ?? []) as $row) {
            $byDisk['public'][] = $row['cover_path'] ?? null;
        }

        $entries = [];
        $seen = [];

        foreach ($byDisk as $disk => $candidates) {
            foreach (array_unique($candidates) as $candidate) {
                $relative = self::normalizeRelative(is_string($candidate) ? $candidate : '');
                if ($relative === null) {
                    continue;
                }

                $key = $disk.':'.$relative;
                if (isset($seen[$key])) {
                    continue;
                }
                $seen[$key] = true;

                $absolute = Storage::disk($disk)->path($relative);
                if (! is_file($absolute)) {
                    continue;
                }

                $entries[] = [
                    'disk' => $disk,
                    'path' => $relative,
                    'zip' => 'files/'.($disk === 'local' ? 'private' : 'public').'/'.$relative,
                    'sha256' => (string) hash_file('sha256', $absolute),
                    'bytes' => (int) (filesize($absolute) ?: 0),
                ];
            }
        }

        return $entries;
    }

    /**
     * @param  array<string, list<array<string, mixed>>>  $tables
     * @return array<string, int>
     */
    private static function replaceDatabase(array $tables): array
    {
        $counts = [];

        DB::transaction(function () use ($tables, &$counts) {
            foreach (array_reverse(self::TABLES) as $table) {
                if (Schema::hasTable($table)) {
                    DB::table($table)->delete();
                }
            }

            foreach (self::TABLES as $table) {
                $rows = $tables[$table] ?? [];
                if (! is_array($rows) || $rows === [] || ! Schema::hasTable($table)) {
                    $counts[$table] = 0;

                    continue;
                }

                $columns = Schema::getColumnListing($table);
                $inserted = 0;

                foreach (array_chunk($rows, 500) as $chunk) {
                    $filtered = [];
                    foreach ($chunk as $row) {
                        $row = self::filterRow((array) $row, $columns);
                        if ($row !== []) {
                            $filtered[] = $row;
                        }
                    }
                    if ($filtered !== []) {
                        DB::table($table)->insert($filtered);
                        $inserted += count($filtered);
                    }
                }

                $counts[$table] = $inserted;
            }

            if (DB::getDriverName() === 'pgsql') {
                foreach (self::TABLES as $table) {
                    if (! Schema::hasTable($table)) {
                        continue;
                    }
                    try {
                        DB::statement(
                            "SELECT setval(pg_get_serial_sequence(?, 'id'), COALESCE((SELECT MAX(id) FROM {$table}), 1))",
                            [$table]
                        );
                    } catch (\Throwable) {
                        // Tables without a serial `id` are skipped silently.
                    }
                }
            }
        });

        return $counts;
    }

    /**
     * Copy verified scratch files into the managed directories, then drop
     * files the archive did not carry so the tree matches the restored rows.
     *
     * @param  array<string, mixed>  $manifest
     */
    private static function writeFiles(string $work, array $manifest): int
    {
        $written = 0;
        $kept = ['local' => [], 'public' => []];

        foreach ((array) ($manifest['files'] ?? []) as $entry) {
            $disk = ($entry['disk'] ?? '') === 'public' ? 'public' : 'local';
            $relative = self::normalizeRelative((string) ($entry['path'] ?? ''));
            if ($relative === null) {
                continue;
            }

            $source = $work.'/'.(string) $entry['zip'];
            if (! is_file($source)) {
                continue;
            }

            $target = Storage::disk($disk)->path($relative);
            $parent = dirname($target);
            if (! is_dir($parent)) {
                @mkdir($parent, 0770, true);
            }

            if (copy($source, $target)) {
                $written++;
            }
            $kept[$disk][] = $relative;
        }

        foreach (self::MANAGED_DIRS as $disk => $dirs) {
            foreach ($dirs as $dir) {
                $root = Storage::disk($disk)->path($dir);
                if (! is_dir($root)) {
                    continue;
                }

                foreach (self::walkFiles($root) as $absolute) {
                    $relative = $dir.'/'.ltrim(substr($absolute, strlen($root)), '/');
                    if (! in_array($relative, $kept[$disk], true)) {
                        @unlink($absolute);
                    }
                }
            }
        }

        return $written;
    }

    /** @return list<string> */
    private static function walkFiles(string $root): array
    {
        $out = [];
        $items = @scandir($root) ?: [];

        foreach ($items as $item) {
            if ($item === '.' || $item === '..') {
                continue;
            }
            $path = $root.'/'.$item;
            if (is_dir($path)) {
                $out = array_merge($out, self::walkFiles($path));
            } elseif (is_file($path)) {
                $out[] = $path;
            }
        }

        return $out;
    }

    /**
     * Reject absolute paths, drive letters, `..` segments, and anything
     * outside the allowlisted archive prefixes.
     */
    private static function assertSafeEntry(string $name): void
    {
        $clean = trim($name);
        if ($clean === '' || $clean === '/' || str_starts_with($clean, '/') || preg_match('#^[A-Za-z]:#', $clean) === 1) {
            throw ValidationException::withMessages(['archive' => 'The archive contains an unsafe entry and was rejected.']);
        }

        $normalized = str_replace('\\', '/', $clean);
        foreach (explode('/', $normalized) as $segment) {
            if ($segment === '..') {
                throw ValidationException::withMessages(['archive' => 'The archive contains an unsafe entry and was rejected.']);
            }
            if ($segment === '' && ! str_ends_with($normalized, '/')) {
                throw ValidationException::withMessages(['archive' => 'The archive contains an unsafe entry and was rejected.']);
            }
        }

        foreach (self::ALLOWED_PREFIXES as $prefix) {
            if ($normalized === $prefix || str_starts_with($normalized, $prefix)) {
                return;
            }
        }

        throw ValidationException::withMessages(['archive' => 'The archive contains an unexpected entry and was rejected.']);
    }

    private static function normalizeRelative(string $relative): ?string
    {
        $value = str_replace('\\', '/', trim($relative));
        $value = ltrim($value, '/');

        if ($value === '' || $value === '.' || substr($value, -1) === '/') {
            return null;
        }

        foreach (explode('/', $value) as $segment) {
            if ($segment === '' || $segment === '.' || $segment === '..') {
                return null;
            }
        }

        return $value;
    }

    /** @param array<string, mixed> $row */
    private static function normalizeRow(array $row): array
    {
        foreach ($row as $key => $value) {
            if ($value instanceof \DateTimeInterface) {
                $row[$key] = $value->format('Y-m-d H:i:s');
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

    /** @return list<string> */
    private static function codeMigrations(): array
    {
        $files = glob(database_path('migrations/*.php')) ?: [];

        return array_map(fn ($path) => basename($path, '.php'), $files);
    }

    private static function recoveryDoc(): string
    {
        return <<<'MD'
# Fast English — what this archive does not contain

This ZIP carries database rows (including settings, users, subscriptions and
payment metadata) plus the files those rows reference. It never contains
`.env` values, passwords, tokens, APP_KEY, or the Android keystore.

Before importing on another server:

1. Set the same `APP_KEY` in the target environment. Passwords still verify
   without it, but encrypted staff 2FA secrets cannot be decrypted after a
   key change — every staff account would have to re-enroll TOTP.
2. Set `APP_URL`, `DB_*`, `MAIL_*`, `SESSION_SECURE_COOKIE=true`, and
   `SALES_ENABLED` (keep it false until the destination and legal copy are
   approved).
3. Run the import from the staff panel while the site is in maintenance.
4. After the import: sign in, open one lesson with audio, open one receipt,
   and check `/admin` for plans and settings.
5. Keep this archive private: it contains personal data (users, receipts).
MD;
    }

    /**
     * Exports are streamed from tmp/; if the client aborts before the
     * response finishes, deleteFileAfterSend never runs. Sweep hour-old
     * archives so repeated exports cannot fill the volume.
     */
    private static function pruneTempArchives(): void
    {
        $cutoff = time() - 3600;

        foreach ((array) glob(Storage::disk('local')->path('tmp/*.zip')) as $file) {
            $mtime = @filemtime($file);
            if (is_file($file) && $mtime !== false && $mtime < $cutoff) {
                @unlink($file);
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
}

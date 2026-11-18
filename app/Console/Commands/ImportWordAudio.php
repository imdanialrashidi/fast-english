<?php

namespace App\Console\Commands;

use App\Models\WordAudio;
use App\Support\Flashcards\Mp3;
use App\Support\Vocabulary;
use Carbon\CarbonImmutable;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Throwable;

/**
 * Imports approved flashcard word clips from the manifest produced by the
 * audio workflow (docs/ops/FLASHCARD_AUDIO_FA.md). Content only: nothing
 * here touches a learner schedule.
 *
 * The manifest lives next to its audio files; each item names the word, the
 * file, the review status and optional metadata. A missing, oversized or
 * non-MPEG file is reported and skipped, and the command exits non-zero so
 * a broken batch cannot look successful.
 */
class ImportWordAudio extends Command
{
    protected $signature = 'flashcards:audio:import
        {manifest : Path to the manifest.json written by the audio workflow}
        {--force : Re-copy every file even when it already exists}
        {--dry-run : Validate the manifest and files without writing}';

    protected $description = 'Import reviewed flashcard word audio clips from a manifest.';

    public function handle(): int
    {
        $manifestPath = (string) $this->argument('manifest');
        $dryRun = (bool) $this->option('dry-run');
        $force = (bool) $this->option('force');

        if (! is_file($manifestPath)) {
            $this->error("Manifest not found: {$manifestPath}");

            return self::FAILURE;
        }

        try {
            $manifest = json_decode((string) file_get_contents($manifestPath), true, flags: JSON_THROW_ON_ERROR);
        } catch (Throwable $e) {
            $this->error('Manifest is not valid JSON: '.$e->getMessage());

            return self::FAILURE;
        }

        $items = is_array($manifest) ? ($manifest['items'] ?? null) : null;
        if (! is_array($items) || $items === []) {
            $this->error('Manifest has no items array.');

            return self::FAILURE;
        }

        $baseDir = dirname($manifestPath);
        $voice = self::nullable($manifest['voice'] ?? null);
        $seed = is_numeric($manifest['seed'] ?? null) ? (int) $manifest['seed'] : null;
        $rows = [];
        $errors = 0;
        $written = 0;

        foreach ($items as $index => $item) {
            $row = $this->importItem($item, $index, $baseDir, $voice, $seed, $dryRun, $force, $written);
            if ($row['error'] !== null) {
                $errors++;
            }
            $rows[] = $row;
        }

        $this->table(
            ['#', 'Word', 'Key', 'Status', 'Result'],
            array_map(fn (array $row): array => [
                $row['index'],
                $row['word'],
                $row['key'],
                $row['status'],
                $row['error'] ?? ($dryRun ? 'valid (dry run)' : 'written'),
            ], $rows),
        );

        $this->info(sprintf(
            '%d item(s): %d written, %d error(s)%s.',
            count($items),
            $written,
            $errors,
            $dryRun ? ' (dry run: nothing written)' : '',
        ));

        return $errors === 0 ? self::SUCCESS : self::FAILURE;
    }

    /**
     * @return array{index: int, word: string, key: string, status: string, error: ?string}
     */
    private function importItem(
        mixed $item,
        int $index,
        string $baseDir,
        ?string $voice,
        ?int $seed,
        bool $dryRun,
        bool $force,
        int &$written,
    ): array {
        $position = $index + 1;

        if (! is_array($item)) {
            return $this->failure($position, '', '', 'item', 'Item is not an object.');
        }

        $word = trim((string) ($item['word'] ?? ''));
        $key = Vocabulary::key((string) ($item['key'] ?? $word));
        $status = strtolower(trim((string) ($item['status'] ?? 'approved')));
        $file = trim((string) ($item['file'] ?? ''));

        if ($word === '' || $key === '') {
            return $this->failure($position, $word, $key, $status, 'Missing word.');
        }

        if (! in_array($status, ['draft', 'approved', 'rejected'], true)) {
            return $this->failure($position, $word, $key, $status, 'Status must be draft, approved or rejected.');
        }

        if ($file === '') {
            return $this->failure($position, $word, $key, $status, 'Missing file.');
        }

        $sourcePath = $baseDir.'/'.ltrim($file, '/');
        if (! is_file($sourcePath)) {
            return $this->failure($position, $word, $key, $status, 'File not found: '.$file);
        }

        $bytes = (string) file_get_contents($sourcePath);
        if (! Mp3::looksLike($bytes)) {
            return $this->failure($position, $word, $key, $status, 'Not an MPEG audio file: '.$file);
        }

        if (strlen($bytes) > 2 * 1024 * 1024) {
            return $this->failure($position, $word, $key, $status, 'File is larger than 2 MB: '.$file);
        }

        $target = sprintf('flashcards/words/%s-%s.mp3', Str::slug($key) ?: 'word', substr(sha1($key), 0, 8));

        if (! $dryRun) {
            if ($force || ! Storage::disk('local')->exists($target)) {
                Storage::disk('local')->put($target, $bytes);
            }

            WordAudio::query()->updateOrCreate(
                ['word_key' => $key],
                [
                    'path' => $target,
                    'source' => self::nullable($item['source'] ?? null) ?? 'underdog-woof',
                    'voice' => self::nullable($item['voice'] ?? null) ?? $voice,
                    'seed' => is_numeric($item['seed'] ?? null) ? (int) $item['seed'] : $seed,
                    'duration_ms' => is_numeric($item['duration_ms'] ?? null) ? max(0, (int) $item['duration_ms']) : null,
                    'status' => $status,
                    'checked_by' => self::nullable($item['checked_by'] ?? null),
                    'checked_at' => $this->timestamp($item['checked_at'] ?? null),
                ],
            );

            $written++;
        }

        return [
            'index' => $position,
            'word' => $word,
            'key' => $key,
            'status' => $status,
            'error' => null,
        ];
    }

    /** @return array{index: int, word: string, key: string, status: string, error: string} */
    private function failure(int $index, string $word, string $key, string $status, string $error): array
    {
        $this->warn("Item {$index}: {$error}");

        return [
            'index' => $index,
            'word' => $word,
            'key' => $key,
            'status' => $status,
            'error' => $error,
        ];
    }

    private function timestamp(mixed $value): ?CarbonImmutable
    {
        $text = self::nullable($value);
        if ($text === null) {
            return null;
        }

        try {
            return CarbonImmutable::parse($text);
        } catch (Throwable) {
            return null;
        }
    }

    private static function nullable(mixed $value): ?string
    {
        $text = trim((string) ($value ?? ''));

        return $text === '' ? null : $text;
    }
}

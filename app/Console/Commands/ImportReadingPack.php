<?php

namespace App\Console\Commands;

use App\Models\LibraryNode;
use App\Models\ReadingDocument;
use App\Support\Library\ReadingPackValidator;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;

/**
 * Import one validated content pack. The pack is the only writer of a
 * reading document; the app never parses a PDF at request time. Assets are
 * copied to the private library disk under a revision folder so a new
 * import cannot reuse a stale browser cache.
 */
class ImportReadingPack extends Command
{
    protected $signature = 'library:import
        {path : Directory containing pack.json, audio/ and images/}
        {--publish : Publish the document after a successful import}';

    protected $description = 'Validate and import one story / IELTS / Inside Reading content pack';

    public function handle(): int
    {
        $directory = rtrim((string) $this->argument('path'), '/');
        $packPath = $directory.'/pack.json';

        if (! is_file($packPath)) {
            $this->error('pack.json not found in '.$directory);

            return self::FAILURE;
        }

        $pack = json_decode((string) file_get_contents($packPath), true);
        if (! is_array($pack)) {
            $this->error('pack.json is not valid JSON');

            return self::FAILURE;
        }

        $errors = ReadingPackValidator::validate($pack, $directory);
        if ($errors !== []) {
            $this->error('Import rejected:');
            foreach ($errors as $error) {
                $this->line('  - '.$error);
            }

            return self::FAILURE;
        }

        $track = (string) $pack['track'];
        $slug = (string) $pack['node']['slug'];

        $node = LibraryNode::query()->where('track', $track)->where('slug', $slug)->first();
        if ($node === null) {
            $this->error("Unknown shelf node [$track] $slug. Run `php artisan library:catalog` first.");

            return self::FAILURE;
        }

        $document = $pack['document'];
        $revision = (int) ($node->document?->revision ?? 0) + 1;
        $target = storage_path("app/private/library/$slug/r$revision");

        foreach (['audio', 'images'] as $folder) {
            $source = "$directory/$folder";
            if (! is_dir($source)) {
                continue;
            }
            File::ensureDirectoryExists("$target/$folder");
            foreach (File::files($source) as $file) {
                File::copy($file->getPathname(), "$target/$folder/".$file->getFilename());
            }
        }

        $counts = $this->counts($document);
        $checksum = hash('sha256', (string) json_encode($document, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
        $publish = (bool) $this->option('publish');
        $nodeMeta = array_replace(
            is_array($node->meta) ? $node->meta : [],
            ['pages' => $counts['pages'], 'words' => $counts['words'], 'minutes' => (int) round($counts['duration_ms'] / 60000)],
            is_array($pack['node']['meta'] ?? null) ? $pack['node']['meta'] : [],
        );

        DB::transaction(function () use ($node, $document, $pack, $revision, $checksum, $counts, $publish, $nodeMeta): void {
            $node->fill([
                'title_en' => $pack['node']['title_en'] ?? $node->title_en,
                'title_fa' => $pack['node']['title_fa'] ?? $node->title_fa,
                'subtitle_fa' => $pack['node']['subtitle_fa'] ?? $node->subtitle_fa,
                'level' => $pack['node']['level'] ?? $node->level,
                'cover_path' => $pack['node']['cover'] ?? $node->cover_path,
                'status' => $publish ? 'published' : 'preparing',
                'meta' => $nodeMeta,
            ])->save();

            ReadingDocument::query()->updateOrCreate(
                ['node_id' => $node->id],
                [
                    'schema_version' => (string) ($pack['schema_version'] ?? '1.0'),
                    'revision' => $revision,
                    'document' => $document,
                    'checksum' => $checksum,
                    'page_count' => $counts['pages'],
                    'question_count' => $counts['questions'],
                    'word_count' => $counts['words'],
                    'duration_ms' => $counts['duration_ms'],
                    'published_at' => $publish ? now() : null,
                ],
            );
        });

        $this->info(sprintf(
            '%s %s → revision %d · %d pages · %d words · %d questions · %s',
            $publish ? 'Published' : 'Staged',
            $slug,
            $revision,
            $counts['pages'],
            $counts['words'],
            $counts['questions'],
            $publish ? 'live' : 'not live',
        ));

        return self::SUCCESS;
    }

    /**
     * @param  array<string, mixed>  $document
     * @return array{pages: int, questions: int, words: int, duration_ms: int}
     */
    private function counts(array $document): array
    {
        $pages = [];
        $duration = 0;

        if (is_array($document['chapters'] ?? null)) {
            foreach ($document['chapters'] as $chapter) {
                $chapterDuration = (int) ($chapter['audio']['duration_ms'] ?? 0);
                $chapterPages = (array) ($chapter['pages'] ?? []);

                if ($chapterDuration === 0) {
                    foreach ($chapterPages as $page) {
                        $start = (int) ($page['audio']['start_ms'] ?? 0);
                        $end = (int) ($page['audio']['end_ms'] ?? 0);
                        $chapterDuration += max(0, $end - $start);
                    }
                }

                $duration += $chapterDuration;
                foreach ($chapterPages as $page) {
                    $pages[] = $page;
                }
            }
        }

        if (is_array($document['passage']['paragraphs'] ?? null)) {
            foreach ($document['passage']['paragraphs'] as $paragraph) {
                $pages[] = $paragraph;
                $duration += (int) ($paragraph['audio']['duration_ms'] ?? 0);
            }
        }

        $words = 0;
        foreach ($pages as $page) {
            $words += str_word_count((string) ($page['text_en'] ?? ''));
        }

        $questionCount = 0;
        foreach ((array) ($document['questions'] ?? []) as $question) {
            $questionCount += max(1, (int) ($question['weight'] ?? 1));
        }

        return [
            'pages' => count($pages),
            'questions' => $questionCount,
            'words' => $words,
            'duration_ms' => $duration,
        ];
    }
}

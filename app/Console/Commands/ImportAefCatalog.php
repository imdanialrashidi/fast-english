<?php

namespace App\Console\Commands;

use App\Models\FlashcardBook;
use App\Models\FlashcardUnit;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;

/**
 * Upserts the American English File series catalog: six books and their unit
 * shells. Content (cards, exercises) is imported per unit by the other
 * commands; this one only makes the books and units reachable so a unit page
 * can exist before its content does. Existing unit titles are never
 * overwritten, and no learner row is touched.
 */
class ImportAefCatalog extends Command
{
    protected $signature = 'aef:import-catalog
        {file=database/seeders/fixtures/aef/catalog.json : Catalog JSON path}';

    protected $description = 'Create or update the American English File books and unit shells.';

    public function handle(): int
    {
        $path = (string) $this->argument('file');
        if (! is_file($path)) {
            $this->error("Catalog not found: {$path}");

            return self::FAILURE;
        }

        $data = json_decode((string) file_get_contents($path), true, flags: JSON_THROW_ON_ERROR);
        if (! is_array($data) || ! is_array($data['books'] ?? null)) {
            throw new InvalidArgumentException('The catalog needs a books array.');
        }

        $rows = DB::transaction(function () use ($data): array {
            $edition = (string) ($data['edition'] ?? '3rd');
            $rows = [];

            foreach ($data['books'] as $entry) {
                $slug = (string) ($entry['slug'] ?? '');
                if (preg_match('/^[a-z0-9-]+$/', $slug) !== 1) {
                    throw new InvalidArgumentException("Invalid book slug: {$slug}");
                }

                $book = FlashcardBook::query()->updateOrCreate(
                    ['slug' => $slug],
                    [
                        'title_en' => (string) $entry['title_en'],
                        'title_fa' => $entry['title_fa'] ?? null,
                        'level' => $entry['level'] ?? null,
                        'edition' => $edition,
                        'status' => 'published',
                        'sort_order' => (int) ($entry['sort_order'] ?? 0),
                    ],
                );

                $units = max(0, (int) ($entry['units'] ?? 0));
                $created = 0;

                for ($number = 1; $number <= $units; $number++) {
                    $unit = FlashcardUnit::query()->firstOrCreate(
                        ['book_id' => $book->id, 'number' => $number],
                        [
                            'title_en' => 'File '.$number,
                            'title_fa' => 'یونیت '.$number,
                            'sort_order' => $number,
                        ],
                    );

                    if ($unit->wasRecentlyCreated) {
                        $created++;
                    }
                }

                $rows[] = [$slug, (string) $book->title_en, $units, $created];
            }

            return $rows;
        });

        $this->table(['Book', 'Title', 'Units', 'New units'], $rows);
        $this->info('American English File catalog imported.');

        return self::SUCCESS;
    }
}

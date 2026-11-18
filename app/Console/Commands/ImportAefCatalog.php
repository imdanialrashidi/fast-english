<?php

namespace App\Console\Commands;

use App\Models\FlashcardBook;
use App\Models\FlashcardUnit;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;

/**
 * Upserts the American English File series catalog: six books and their units
 * with the real unit titles. Exercises are imported per unit by
 * `exercises:import`; this command only makes the books and units reachable
 * so a unit page can exist before its exercises do. Titles are content, so a
 * re-run refreshes them from the catalog; no learner row is touched.
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

                $units = self::unitRows($entry['units'] ?? []);
                $created = 0;

                foreach ($units as $number => $unitData) {
                    $unit = FlashcardUnit::query()->updateOrCreate(
                        ['book_id' => $book->id, 'number' => $number],
                        array_filter([
                            'title_en' => $unitData['title_en'],
                            'title_fa' => $unitData['title_fa'],
                            'sort_order' => $number,
                        ], fn (mixed $value): bool => $value !== null),
                    );

                    if ($unit->wasRecentlyCreated) {
                        $created++;
                    }
                }

                $rows[] = [$slug, (string) $book->title_en, count($units), $created];
            }

            return $rows;
        });

        $this->table(['Book', 'Title', 'Units', 'New units'], $rows);
        $this->info('American English File catalog imported.');

        return self::SUCCESS;
    }

    /**
     * Accept both catalog shapes: a plain unit count (legacy) or the
     * enriched list with English/Persian titles.
     *
     * @return array<int, array{title_en: string, title_fa: ?string}>
     */
    private static function unitRows(mixed $units): array
    {
        if (is_numeric($units)) {
            $rows = [];
            for ($number = 1; $number <= (int) $units; $number++) {
                $rows[$number] = ['title_en' => 'File '.$number, 'title_fa' => 'یونیت '.$number];
            }

            return $rows;
        }

        if (! is_array($units)) {
            return [];
        }

        $rows = [];
        foreach ($units as $unit) {
            $number = (int) ($unit['number'] ?? 0);
            $title = trim((string) ($unit['title_en'] ?? ''));
            if ($number < 1 || $title === '') {
                continue;
            }

            $rows[$number] = [
                'title_en' => $title,
                'title_fa' => isset($unit['title_fa']) ? trim((string) $unit['title_fa']) : null,
            ];
        }

        return $rows;
    }
}

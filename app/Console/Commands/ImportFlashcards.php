<?php

namespace App\Console\Commands;

use App\Support\Flashcards\Importer;
use Illuminate\Console\Command;
use Throwable;

/**
 * Imports a curated flashcard dataset into the app. Safe to re-run: cards
 * are upserted by their stable external id and existing media is reused
 * unless --force is passed. Learner schedules live in separate tables and
 * are never touched.
 */
class ImportFlashcards extends Command
{
    protected $signature = 'flashcards:import
        {source : Path to the dataset book folder (the one containing manifest.json)}
        {--force : Re-process every image and audio file}
        {--draft : Import the book as a draft instead of published}
        {--no-crop : Center-crop the image instead of using the inner card square}
        {--dry-run : Validate the dataset and report counts without writing}';

    protected $description = 'Import or update a flashcard book (manifest, units, cards, images, audio).';

    public function handle(): int
    {
        try {
            $report = (new Importer(
                (string) $this->argument('source'),
                (bool) $this->option('force'),
                (bool) $this->option('draft'),
                ! (bool) $this->option('no-crop'),
                (bool) $this->option('dry-run'),
            ))->run();
        } catch (Throwable $e) {
            $this->error($e->getMessage());

            return self::FAILURE;
        }

        $this->table(
            ['Book', 'Units', 'Cards', 'Images written', 'Audio written'],
            [[
                $report['book'],
                $report['units'],
                $report['cards'],
                $report['images'],
                $report['audio'],
            ]],
        );

        if ((bool) $this->option('dry-run')) {
            $this->warn('Dry run: no rows or media were written.');
        }

        return self::SUCCESS;
    }
}

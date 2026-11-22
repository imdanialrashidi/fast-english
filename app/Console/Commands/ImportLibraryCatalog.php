<?php

namespace App\Console\Commands;

use App\Models\LibraryNode;
use Database\Seeders\LibraryCatalogSeeder;
use Illuminate\Console\Command;

/**
 * Idempotent shelf skeleton for the reading tracks. Safe to run on every
 * deploy: it only writes titles, levels, order and cover paths, and never
 * touches an imported document or its publish status.
 */
class ImportLibraryCatalog extends Command
{
    protected $signature = 'library:catalog';

    protected $description = 'Create or refresh the story / IELTS / Inside Reading shelf skeleton';

    public function handle(): int
    {
        (new LibraryCatalogSeeder)->run();

        $counts = LibraryNode::query()
            ->selectRaw('track, count(*) as total')
            ->groupBy('track')
            ->pluck('total', 'track');

        foreach ($counts as $track => $total) {
            $this->line(sprintf('%-16s %d nodes', $track, $total));
        }

        return self::SUCCESS;
    }
}

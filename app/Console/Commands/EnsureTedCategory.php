<?php

namespace App\Console\Commands;

use App\Models\Category;
use Illuminate\Console\Command;

/**
 * The main library needs a real TED Talk category row so the category
 * filter and the article list share one source. Idempotent and safe to run
 * on every release; it never touches the talks themselves.
 */
class EnsureTedCategory extends Command
{
    protected $signature = 'ted:catalog';

    protected $description = 'Create or refresh the TED Talk library category';

    public function handle(): int
    {
        Category::query()->updateOrCreate(
            ['slug' => 'ted-talk'],
            [
                'name_fa' => 'TED Talk',
                'display_order' => 50,
                'is_active' => true,
            ],
        );

        $this->info('TED Talk category is ready.');

        return self::SUCCESS;
    }
}

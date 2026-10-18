<?php

namespace App\Console\Commands;

use App\Support\BackupManager;
use Illuminate\Console\Command;

/**
 * Retention for panel backups (scope §19.3: 30-day rotation).
 * Deletes completed/failed rows + archives older than the window.
 * Never touches in-progress rows. Run daily via the scheduler.
 */
class BackupPrune extends Command
{
    protected $signature = 'backup:prune {--days=30 : Delete backups older than this many days}';

    protected $description = 'Delete panel backups older than the retention window (default 30 days).';

    public function handle(): int
    {
        $days = max(1, (int) $this->option('days'));
        $count = BackupManager::prune($days);

        $this->info("backup:prune ok ({$count} deleted, older than {$days} days)");

        return self::SUCCESS;
    }
}

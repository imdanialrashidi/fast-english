<?php

namespace App\Jobs;

use App\Models\Backup;
use App\Models\User;
use App\Support\BackupManager;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Log;

/**
 * Queued one-click backup (OPS-01).
 *
 * The panel dispatches this job so long-running archives never block the
 * request; the `backups` row lifecycle (creating → completed|failed) plus
 * the `backups:operation` lock is the status mechanism the UI polls.
 * With QUEUE_CONNECTION=sync (tests) the job runs before the response.
 */
class CreateBackupJob implements ShouldQueue
{
    use Queueable;

    public function __construct(
        public int $staffId,
        public string $type = Backup::TYPE_MANUAL,
    ) {}

    public function handle(): void
    {
        $staff = User::find($this->staffId);
        if ($staff === null) {
            return;
        }

        try {
            BackupManager::createBackup($staff, $this->type);
        } catch (\Throwable $e) {
            Log::warning('backup job failed', ['type' => $this->type]);
            throw $e;
        }
    }
}

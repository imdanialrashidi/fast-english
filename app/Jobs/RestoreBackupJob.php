<?php

namespace App\Jobs;

use App\Models\Backup;
use App\Models\User;
use App\Support\BackupManager;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Log;

/**
 * Queued restore (OPS-01).
 *
 * Runs the verified restore path: checksum + manifest validation, a
 * verified pre-restore emergency backup, then the destructive apply with
 * automatic rollback. Never replays payment actions — pure data copy.
 */
class RestoreBackupJob implements ShouldQueue
{
    use Queueable;

    public function __construct(
        public int $backupId,
        public int $staffId,
    ) {}

    public function handle(): void
    {
        $backup = Backup::find($this->backupId);
        $staff = User::find($this->staffId);

        if ($backup === null || $staff === null) {
            return;
        }

        try {
            BackupManager::restoreBackup($backup, $staff, true);
        } catch (\Throwable $e) {
            Log::warning('backup restore job failed', ['backup_id' => $this->backupId]);
            throw $e;
        }
    }
}

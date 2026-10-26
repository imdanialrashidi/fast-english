<?php

namespace App\Console\Commands;

use App\Models\PaymentRequest;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

/**
 * S8 monitoring (scope §19.2): `ops:status` reports the four required
 * fields and nothing else.
 *
 * - pending payments: open pending count + oldest pending age (hours) +
 *   a STALE flag when the oldest pending is older than 48 hours.
 * - free disk space at the private storage path (bytes + human).
 * - failed jobs count (failed_jobs table).
 * - recent errors: production.ERROR log lines in the last 24 h (a proxy
 *   for the recent 5xx count until an access-log counter is wired; the
 *   source is labelled in the output so it is never mistaken for more).
 *   Production uses LOG_CHANNEL=stderr, so there is no file to read: the
 *   line then says `unavailable` instead of a misleading 0, and the
 *   operator reads the container log (Coolify runtime logs).
 *
 * No secret is ever printed: only counts, ages, and byte sizes leave this
 * command. No external alerting service is added (scope: monitoring
 * essentials, no product analytics dashboard).
 */
class OpsStatus extends Command
{
    protected $signature = 'ops:status';

    protected $description = 'Report pending-payment age, free disk space, failed jobs, and recent errors.';

    public function handle(): int
    {
        $pending = PaymentRequest::where('status', PaymentRequest::STATUS_PENDING)
            ->orderBy('created_at')
            ->get(['id', 'created_at']);

        $oldestHours = null;
        if ($pending->isNotEmpty()) {
            $oldestHours = (int) $pending->first()->created_at->diffInHours(now());
        }

        $staleThresholdHours = 48;
        $stale = $oldestHours !== null && $oldestHours > $staleThresholdHours;

        $diskPath = storage_path();
        $freeBytes = disk_free_space($diskPath);
        if ($freeBytes === false) {
            $freeBytes = 0;
        }

        $failedJobs = DB::table('failed_jobs')->count();

        $recentErrors = $this->recentErrorCount();

        $this->line('pending_payments_count='.$pending->count());
        $this->line('pending_oldest_age_hours='.($oldestHours === null ? 'none' : $oldestHours));
        $this->line('pending_stale='.($stale ? 'yes' : 'no'));
        $this->line('disk_free_bytes='.(int) $freeBytes);
        $this->line('disk_free_human='.$this->humanBytes((int) $freeBytes));
        $this->line('disk_path=storage');
        $this->line('failed_jobs_count='.$failedJobs);
        $this->line($recentErrors === null
            ? 'recent_errors_24h=unavailable (no file log; read the container/Coolify log)'
            : 'recent_errors_24h='.$recentErrors.' (source: error log lines)');
        $this->info('ops:status ok');

        return self::SUCCESS;
    }

    /**
     * Error lines in the last 24 h, or null when no file log exists.
     * A 0 would claim "no errors" while the only log sink is stderr.
     */
    private function recentErrorCount(): ?int
    {
        $log = storage_path('logs/laravel.log');
        if (! is_file($log)) {
            return null;
        }

        $cutoff = time() - 24 * 3600;
        $count = 0;
        try {
            $handle = fopen($log, 'r');
            if ($handle === false) {
                return null;
            }
            while (($line = fgets($handle)) !== false) {
                if (! str_contains($line, '.ERROR')) {
                    continue;
                }
                if (preg_match('/^\[(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})\]/', $line, $m) === 1) {
                    if (strtotime($m[1].' UTC') < $cutoff) {
                        continue;
                    }
                }
                $count++;
            }
            fclose($handle);
        } catch (\Throwable) {
            return null;
        }

        return $count;
    }

    private function humanBytes(int $bytes): string
    {
        foreach (['B', 'KB', 'MB', 'GB', 'TB'] as $unit) {
            if ($bytes < 1024 || $unit === 'TB') {
                return round($bytes, 1).' '.$unit;
            }
            $bytes /= 1024;
        }

        return round($bytes, 1).' TB';
    }
}

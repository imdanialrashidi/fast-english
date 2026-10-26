<?php

namespace App\Console\Commands;

use App\Models\Subscription;
use App\Notifications\SubscriptionExpiring;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * Daily renewal reminder (scope §11, owner follow-up 2026-10-22).
 *
 * Sends at most one mail per current window: the marker is written only
 * after a successful notification. Dry-run reports without writing or
 * sending. Disabled, revoked, expired, and not-yet-started windows are
 * skipped. Real SMTP delivery remains a launch prerequisite; the command
 * itself is tested with Notification::fake().
 */
class RemindExpiringSubscriptions extends Command
{
    protected $signature = 'subscriptions:remind-expiring
        {--days=3 : Remind when the window ends within this many days}
        {--dry-run : Report candidates without sending or marking}';

    protected $description = 'Email learners whose active subscription ends soon (idempotent per window).';

    public function handle(): int
    {
        $days = min(30, max(1, (int) $this->option('days')));
        $dryRun = (bool) $this->option('dry-run');
        $now = now();
        $until = $now->copy()->addDays($days);

        $candidates = Subscription::query()
            ->whereNull('revoked_at')
            ->whereNull('renewal_reminder_sent_at')
            ->where('starts_at', '<=', $now)
            ->where('expires_at', '>', $now)
            ->where('expires_at', '<=', $until)
            ->with('user')
            ->orderBy('expires_at')
            ->get();

        $sent = 0;
        $skipped = 0;
        $failed = 0;

        foreach ($candidates as $subscription) {
            $user = $subscription->user;
            if ($user === null || $user->disabled_at !== null) {
                $skipped++;

                continue;
            }

            $daysLeft = max(1, (int) ceil($now->diffInDays($subscription->expires_at)));

            if ($dryRun) {
                $this->line("#{$subscription->id} {$user->email} ({$daysLeft}d)");
                $sent++;

                continue;
            }

            // Claim the window atomically so two scheduler processes
            // cannot both mail the same learner.
            $claimed = Subscription::query()
                ->whereKey($subscription->id)
                ->whereNull('renewal_reminder_sent_at')
                ->update(['renewal_reminder_sent_at' => $now]);

            if ($claimed === 0) {
                $skipped++;

                continue;
            }

            try {
                $user->notify(new SubscriptionExpiring($daysLeft));
                $sent++;
            } catch (Throwable $e) {
                $failed++;
                // Release the claim so the next run can retry. Never log
                // the email body or SMTP credentials.
                Subscription::query()
                    ->whereKey($subscription->id)
                    ->where('renewal_reminder_sent_at', $now)
                    ->update(['renewal_reminder_sent_at' => null]);
                Log::warning('subscription reminder failed', [
                    'subscription_id' => $subscription->id,
                    'error' => $e::class,
                ]);
            }
        }

        $this->info('subscriptions:remind-expiring '.($dryRun ? 'dry-run ' : '')."sent={$sent} skipped={$skipped} failed={$failed}");

        return $failed > 0 ? self::FAILURE : self::SUCCESS;
    }
}

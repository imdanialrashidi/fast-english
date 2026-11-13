<?php

namespace App\Console\Commands;

use App\Models\SmsMessage;
use App\Support\Sms\SmsDeliveryState;
use App\Support\Sms\SmsSender;
use App\Support\Sms\SmsSendFailed;
use App\Support\Sms\SmsStatus;
use Illuminate\Console\Command;

/**
 * Delivery observability for the two transactional messages. The command
 * only *reads* delivery reports; it never resends, because a duplicate
 * login code or activation confirmation is worse than an unconfirmed one.
 *
 * A rejected delivery query (bad credentials, missing API access) stops
 * the run so a scheduled job does not hammer the panel. Timeouts and 5xx
 * are retried on the next schedule tick, bounded by `--max-checks`; rows
 * still unconfirmed after the window are labelled, not guessed.
 */
class CheckSmsDeliveries extends Command
{
    /** How long a message is still worth polling. */
    private const WINDOW_HOURS = 48;

    /** A `pending` row older than this means the worker died mid-send. */
    private const STALE_PENDING_MINUTES = 15;

    protected $signature = 'sms:check-deliveries
        {--limit=50 : Maximum messages to poll in one run}
        {--max-checks=12 : Stop polling one message after this many attempts}';

    protected $description = 'Poll MelliPayamak delivery reports for accepted SMS (never resends).';

    public function handle(SmsSender $sms): int
    {
        if (SmsStatus::driver() !== 'melipayamak' || ! SmsStatus::ready()) {
            $this->warn('SMS delivery checks need the configured melipayamak driver.');

            return self::SUCCESS;
        }

        $limit = min(200, max(1, (int) $this->option('limit')));
        $maxChecks = max(1, (int) $this->option('max-checks'));
        $now = now();
        $windowStart = $now->copy()->subHours(self::WINDOW_HOURS);

        // No receipt means no way to reconcile the send; record that
        // honestly instead of leaving an ambiguous "pending" forever.
        $stale = SmsMessage::query()
            ->where('status', SmsMessage::STATUS_PENDING)
            ->where('created_at', '<', $now->copy()->subMinutes(self::STALE_PENDING_MINUTES))
            ->update([
                'status' => SmsMessage::STATUS_UNCONFIRMED,
                'error_kind' => 'stale_pending',
                'checked_at' => $now,
            ]);

        $expired = SmsMessage::query()
            ->where('status', SmsMessage::STATUS_ACCEPTED)
            ->where('created_at', '<', $windowStart)
            ->update([
                'status' => SmsMessage::STATUS_UNCONFIRMED,
                'checked_at' => $now,
            ]);

        $pending = SmsMessage::query()
            ->where('status', SmsMessage::STATUS_ACCEPTED)
            ->whereNotNull('rec_id')
            ->where('created_at', '>=', $windowStart)
            ->where('check_attempts', '<', $maxChecks)
            ->orderBy('id')
            ->limit($limit)
            ->get();

        $final = 0;
        $waiting = 0;

        foreach ($pending as $message) {
            try {
                $report = $sms->deliveryStatus((string) $message->rec_id);
            } catch (SmsSendFailed $e) {
                if ($e->isRejected()) {
                    // Credentials or API access changed; retrying every
                    // row would only produce more refusals.
                    $this->error('The provider refused the delivery query; check the panel credentials and API access.');

                    return self::FAILURE;
                }

                $message->forceFill([
                    'check_attempts' => $message->check_attempts + 1,
                    'checked_at' => $now,
                ])->save();
                $waiting++;

                continue;
            }

            $status = match ($report->state) {
                SmsDeliveryState::Delivered => SmsMessage::STATUS_DELIVERED,
                SmsDeliveryState::Failed => SmsMessage::STATUS_FAILED,
                SmsDeliveryState::Blocked => SmsMessage::STATUS_BLOCKED,
                SmsDeliveryState::Filtered => SmsMessage::STATUS_FILTERED,
                SmsDeliveryState::Pending, SmsDeliveryState::Unknown => null,
            };

            $attempts = $message->check_attempts + 1;
            if ($status === null && $attempts >= $maxChecks) {
                $status = SmsMessage::STATUS_UNCONFIRMED;
            }

            $message->forceFill([
                'status' => $status ?? SmsMessage::STATUS_ACCEPTED,
                'provider_code' => $report->providerCode,
                'check_attempts' => $attempts,
                'checked_at' => $now,
            ])->save();

            $status === null ? $waiting++ : $final++;
        }

        $this->info(sprintf(
            'SMS delivery: %d polled, %d final, %d waiting; %d stale pending, %d out of window.',
            $pending->count(),
            $final,
            $waiting,
            $stale,
            $expired,
        ));

        return self::SUCCESS;
    }
}

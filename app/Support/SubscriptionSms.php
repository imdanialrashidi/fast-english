<?php

namespace App\Support;

use App\Jobs\SendSubscriptionSms;
use App\Models\PaymentRequest;
use App\Support\Sms\SmsStatus;
use Throwable;

/**
 * The one payment-related SMS: confirmation that the approved payment
 * activated the subscription. Receipt submission and rejection are
 * intentionally silent (owner request 2026-11-13), so learners are not
 * pinged for every review step.
 *
 * `queueActivated` is called after the money/access transaction has
 * committed. A slow or failed SMS therefore cannot change a payment or
 * subscription state, and only a phone-verified learner receives one.
 */
final class SubscriptionSms
{
    public static function queueActivated(PaymentRequest $request): void
    {
        if (! (bool) config('sms.subscription_notifications', true)) {
            return;
        }

        if (! SmsStatus::ready()) {
            return;
        }

        $user = $request->user;
        if ($user === null || $user->phone === null || ! $user->hasVerifiedPhone()) {
            return;
        }

        try {
            SendSubscriptionSms::dispatch($request->id);
        } catch (Throwable $e) {
            // The money/access change is already durable; a queue outage
            // must not turn a successful approval into an error.
            report($e);
        }
    }
}

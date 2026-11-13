<?php

namespace App\Jobs;

use App\Models\PaymentRequest;
use App\Models\Subscription;
use App\Support\Entitlement;
use App\Support\Sms\SmsSender;
use App\Support\Sms\SmsStatus;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Throwable;

/**
 * One subscription-activation SMS. It runs after the approval transaction
 * and re-reads the durable state, so a revoked window, a changed phone, or
 * a disabled account never receives a stale "activated" message.
 *
 * `tries = 1` is deliberate: an unknown send may already have delivered,
 * and an automatic retry would duplicate it. Failures are recorded in
 * `sms_messages` and reported; they never touch access or money.
 */
class SendSubscriptionSms implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 1;

    public function __construct(
        public int $paymentRequestId,
    ) {}

    public function handle(SmsSender $sms): void
    {
        if (! (bool) config('sms.subscription_notifications', true)) {
            return;
        }

        if (! SmsStatus::ready()) {
            return;
        }

        $request = PaymentRequest::query()->with('user')->find($this->paymentRequestId);
        $user = $request?->user;
        if ($request === null || $user === null) {
            return;
        }

        if ($user->phone === null || ! $user->hasVerifiedPhone()) {
            return;
        }

        $subscription = Subscription::query()->where('user_id', $user->id)->first();
        if ($subscription === null || ! Entitlement::windowActive($subscription, null, $user)) {
            return;
        }

        $sms->sendSubscriptionActivated((string) $user->phone, (string) $request->plan_name_snapshot);
    }

    public function failed(Throwable $exception): void
    {
        report($exception);
    }
}

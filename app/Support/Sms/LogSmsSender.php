<?php

namespace App\Support\Sms;

use App\Support\PhoneNumber;
use Illuminate\Support\Facades\Log;

/**
 * Non-production delivery. The code and message are written to the local
 * log so a developer can finish the flow while no provider account is
 * attached; the phone stays masked. Production refuses to use this
 * driver, so a misconfigured deploy fails closed instead of pretending an
 * SMS was sent.
 */
final class LogSmsSender implements SmsSender
{
    public function sendCode(string $phone, string $code): SmsReceipt
    {
        $this->ensureLocal();

        Log::info('SMS code (local log driver)', [
            'phone' => PhoneNumber::mask($phone),
            'code' => $code,
        ]);

        return new SmsReceipt(null);
    }

    public function sendSubscriptionActivated(string $phone, string $planName): SmsReceipt
    {
        $this->ensureLocal();

        Log::info('SMS subscription activation (local log driver)', [
            'phone' => PhoneNumber::mask($phone),
            'plan' => $planName,
        ]);

        return new SmsReceipt(null);
    }

    public function deliveryStatus(string $recId): SmsDeliveryReport
    {
        throw SmsSendFailed::unavailable();
    }

    private function ensureLocal(): void
    {
        if (app()->environment('production')) {
            throw SmsSendFailed::localOnly();
        }
    }
}

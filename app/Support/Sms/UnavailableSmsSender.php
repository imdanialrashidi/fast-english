<?php

namespace App\Support\Sms;

/**
 * The configured-but-disabled driver. Sending fails closed; callers that
 * need a graceful UX check SmsStatus::ready() first.
 */
final class UnavailableSmsSender implements SmsSender
{
    public function sendCode(string $phone, string $code): SmsReceipt
    {
        throw SmsSendFailed::unavailable();
    }

    public function sendSubscriptionActivated(string $phone, string $planName): SmsReceipt
    {
        throw SmsSendFailed::unavailable();
    }

    public function deliveryStatus(string $recId): SmsDeliveryReport
    {
        throw SmsSendFailed::unavailable();
    }
}

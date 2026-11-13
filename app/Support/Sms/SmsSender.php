<?php

namespace App\Support\Sms;

/**
 * The complete SMS vocabulary of the product: a login/verification code
 * and a subscription-activation confirmation. There is deliberately no
 * generic `sendMessage`, so no controller, job, or future feature can turn
 * this boundary into a free-text or bulk channel by accident.
 */
interface SmsSender
{
    /** @throws SmsSendFailed */
    public function sendCode(string $phone, string $code): SmsReceipt;

    /** @throws SmsSendFailed */
    public function sendSubscriptionActivated(string $phone, string $planName): SmsReceipt;

    /** @throws SmsSendFailed */
    public function deliveryStatus(string $recId): SmsDeliveryReport;
}

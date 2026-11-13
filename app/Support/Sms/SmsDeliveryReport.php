<?php

namespace App\Support\Sms;

/** One delivery query result with the raw provider code for the audit row. */
final class SmsDeliveryReport
{
    public function __construct(
        public readonly SmsDeliveryState $state,
        public readonly ?string $providerCode = null,
    ) {}
}

<?php

namespace App\Support;

use App\Models\PaymentDestination;

/**
 * Card-to-card checkout capability.
 *
 * The owner decided on 2026-10-30 that there is no online gateway: the
 * only payment method is a transfer to the single active card destination,
 * followed by a private receipt and staff review. Checkout is open only
 * when staff have replaced the placeholder with a real 16-digit card and
 * holder/bank.
 */
final class PaymentMethods
{
    public static function activeDestination(): ?PaymentDestination
    {
        return PaymentDestination::query()->where('is_active', true)->first();
    }

    public static function cardCheckoutReady(): bool
    {
        return self::activeDestination()?->isConfigured() === true;
    }
}

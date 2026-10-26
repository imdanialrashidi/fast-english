<?php

namespace App\Support;

use App\Models\PaymentDestination;

/**
 * Checkout capability resolution.
 *
 * The live flow is card-to-card. A gateway is only "configured" when the
 * owner has enabled it, named a provider, and that provider has a driver
 * registered in config/payments.php. The map is empty today, so the
 * subscribe page and the payment endpoint agree that card fallback is the
 * only usable method.
 */
final class PaymentMethods
{
    public static function gatewayConfigured(): bool
    {
        if (! SiteSettings::gatewayEnabled()) {
            return false;
        }

        $provider = SiteSettings::gatewayProvider();

        if ($provider === null) {
            return false;
        }

        /** @var array<string, class-string> $drivers */
        $drivers = config('payments.drivers', []);

        return isset($drivers[$provider]) && class_exists($drivers[$provider]);
    }

    public static function activeDestination(): ?PaymentDestination
    {
        return PaymentDestination::query()->where('is_active', true)->first();
    }

    /**
     * The card flow is available only when staff have replaced the
     * placeholder with a real destination and the fallback switch is on.
     */
    public static function cardCheckoutReady(): bool
    {
        if (! SiteSettings::cardFallbackEnabled()) {
            return false;
        }

        return self::activeDestination()?->isConfigured() === true;
    }
}

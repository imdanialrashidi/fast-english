<?php

/**
 * Online-gateway seam. The owner has not chosen a provider yet, so the
 * driver map is intentionally empty and card-to-card remains the only
 * live checkout. When a provider is chosen, add its driver class here;
 * `PaymentMethods::gatewayConfigured()` will then report it.
 *
 * Driver classes are registered when the owner chooses a provider. The
 * payment controller still creates card-to-card requests until the
 * gateway flow is implemented against that provider.
 */
return [
    'drivers' => [
        // 'provider_key' => \App\Payments\Provider\ProviderGateway::class,
    ],
];

<?php

/**
 * SMS delivery (MelliPayamak panel REST, pattern service).
 *
 * Exactly two messages exist, and both are approved MelliPayamak patterns
 * (`BaseServiceNumber`): the six-digit login/verification code and the
 * subscription-activation confirmation. There is no free-text path, so a
 * misconfiguration cannot turn this into a bulk or notice channel.
 *
 * `driver=null` disables the phone surface: registration keeps the email
 * code path and no endpoint can send an SMS. `driver=log` is a
 * non-production convenience only; it refuses to run in production.
 * Production uses `melipayamak` with the panel web-service username and
 * password (when the panel reports `-110`, put its API key in the password
 * field) plus the two approved pattern IDs. All of those values live only
 * in the server environment, never in Git.
 */
return [
    'driver' => env('SMS_DRIVER', 'null'),

    'otp_ttl_minutes' => (int) env('SMS_OTP_TTL_MINUTES', 5),

    'resend_seconds' => (int) env('SMS_RESEND_SECONDS', 60),

    'max_attempts' => (int) env('SMS_MAX_ATTEMPTS', 5),

    // Whether approving a payment also confirms the activated subscription
    // by SMS. The notice is best-effort and never changes money/access.
    'subscription_notifications' => (bool) env('SMS_SUBSCRIPTION_NOTIFICATIONS', true),

    'melipayamak' => [
        'base_url' => (string) env('MELIPAYAMAK_BASE_URL', 'https://rest.payamak-panel.com/api/SendSMS'),
        'username' => env('MELIPAYAMAK_USERNAME'),
        'password' => env('MELIPAYAMAK_PASSWORD'),
        'otp_body_id' => (int) env('MELIPAYAMAK_OTP_BODY_ID', 0),
        'subscription_body_id' => (int) env('MELIPAYAMAK_SUBSCRIPTION_BODY_ID', 0),
        'timeout' => (int) env('MELIPAYAMAK_TIMEOUT', 8),
    ],
];

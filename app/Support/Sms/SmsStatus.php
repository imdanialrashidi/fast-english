<?php

namespace App\Support\Sms;

/**
 * Whether this environment can actually deliver an SMS. The auth surface
 * hides phone login when this is false, registration keeps the email
 * verification path, and no endpoint promises a code that cannot arrive.
 *
 * A pattern-based account needs no sender line: the approved pattern
 * decides it. Both pattern IDs are therefore part of readiness, and a
 * missing one keeps the whole phone surface off instead of sending with
 * an unknown template.
 */
final class SmsStatus
{
    public static function ready(): bool
    {
        return match ((string) config('sms.driver', 'null')) {
            // A non-production convenience only; LogSmsSender enforces it.
            'log' => ! app()->environment('production'),
            'melipayamak' => self::melipayamakConfigured(),
            default => false,
        };
    }

    public static function driver(): string
    {
        return (string) config('sms.driver', 'null');
    }

    private static function melipayamakConfigured(): bool
    {
        $baseUrl = config('sms.melipayamak.base_url');
        if (! is_string($baseUrl) || trim($baseUrl) === '') {
            return false;
        }

        foreach (['username', 'password'] as $key) {
            $value = config('sms.melipayamak.'.$key);
            if (! is_string($value) || trim($value) === '') {
                return false;
            }
        }

        foreach (['otp_body_id', 'subscription_body_id'] as $key) {
            $value = config('sms.melipayamak.'.$key);
            if (! is_numeric($value) || (int) $value < 1) {
                return false;
            }
        }

        return true;
    }
}

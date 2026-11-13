<?php

namespace App\Support;

/**
 * Iranian mobile number normalization.
 *
 * People paste numbers with Persian digits, spaces, `+98`, or `0098`.
 * Every write and lookup uses one canonical form (`09XXXXXXXXX`) so a
 * second account cannot be created for the same phone and a login code
 * cannot be sent to an ambiguous address.
 */
final class PhoneNumber
{
    public static function normalize(?string $value): ?string
    {
        $digits = preg_replace('/\D+/', '', self::latinDigits(trim((string) $value))) ?? '';

        if ($digits === '') {
            return null;
        }

        if (str_starts_with($digits, '0098')) {
            $digits = '0'.substr($digits, 4);
        } elseif (str_starts_with($digits, '98') && strlen($digits) === 12) {
            $digits = '0'.substr($digits, 2);
        } elseif (str_starts_with($digits, '9') && strlen($digits) === 10) {
            $digits = '0'.$digits;
        }

        return strlen($digits) === 11 && str_starts_with($digits, '09') ? $digits : null;
    }

    /** Keep the number recognizable on a code page without publishing it. */
    public static function mask(string $phone): string
    {
        if (strlen($phone) < 8) {
            return '***';
        }

        return substr($phone, 0, 4).'***'.substr($phone, -4);
    }

    /** `tel:` link form; international format works from phones abroad too. */
    public static function telHref(string $phone): string
    {
        return 'tel:+98'.substr($phone, 1);
    }

    private static function latinDigits(string $value): string
    {
        return strtr($value, [
            '۰' => '0', '۱' => '1', '۲' => '2', '۳' => '3', '۴' => '4',
            '۵' => '5', '۶' => '6', '۷' => '7', '۸' => '8', '۹' => '9',
            '٠' => '0', '١' => '1', '٢' => '2', '٣' => '3', '٤' => '4',
            '٥' => '5', '٦' => '6', '٧' => '7', '٨' => '8', '٩' => '9',
        ]);
    }
}

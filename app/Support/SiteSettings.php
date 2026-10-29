<?php

namespace App\Support;

use App\Models\Setting;

/**
 * Typed access to owner-editable operational settings. Keys are stable
 * strings so a staff form, a config default, and a public renderer agree.
 */
final class SiteSettings
{
    public const SUPPORT_CHANNEL = 'contact.support_channel';

    public const SUPPORT_HOURS = 'contact.support_hours';

    public const COOPERATION_CHANNEL = 'contact.cooperation_channel';

    public const GATEWAY_ENABLED = 'payment.gateway_enabled';

    public const GATEWAY_PROVIDER = 'payment.gateway_provider';

    public const GATEWAY_MERCHANT_ID = 'payment.gateway_merchant_id';

    public const GATEWAY_SANDBOX = 'payment.gateway_sandbox';

    public const CARD_FALLBACK = 'payment.card_fallback';

    public static function supportChannel(): string
    {
        return (string) Setting::read(self::SUPPORT_CHANNEL, (string) config('site.support.channel', 'info@fastenglishpodcast.ir'));
    }

    public static function supportHours(): ?string
    {
        $value = Setting::read(self::SUPPORT_HOURS, config('site.support.hours'));

        return $value === null || trim($value) === '' ? null : trim($value);
    }

    public static function cooperationChannel(): string
    {
        return (string) Setting::read(self::COOPERATION_CHANNEL, (string) config('site.cooperation.channel', 'info@fastenglishpodcast.ir'));
    }

    /**
     * A contact handle may be a Telegram-style @handle, an email, or an
     * http(s) URL. Anything else renders as plain text, never a broken
     * or invented link.
     */
    public static function contactHref(?string $channel): ?string
    {
        $value = trim((string) $channel);

        if ($value === '') {
            return null;
        }

        if (str_starts_with($value, '@')) {
            $handle = ltrim($value, '@');

            return preg_match('/^[A-Za-z0-9_]{3,64}$/', $handle) === 1
                ? 'https://t.me/'.$handle
                : null;
        }

        if (filter_var($value, FILTER_VALIDATE_EMAIL)) {
            return 'mailto:'.$value;
        }

        return preg_match('#^https?://#i', $value) === 1 ? $value : null;
    }

    public static function legal(string $page): ?string
    {
        if (! in_array($page, ['terms', 'privacy', 'refund'], true)) {
            return null;
        }

        $value = Setting::read('legal.'.$page, config('site.legal.'.$page));

        return is_string($value) && trim($value) !== '' ? trim($value) : null;
    }

    public static function gatewayEnabled(): bool
    {
        return Setting::flag(self::GATEWAY_ENABLED, (bool) config('site.payment.gateway_enabled', false));
    }

    public static function gatewayProvider(): ?string
    {
        $value = Setting::read(self::GATEWAY_PROVIDER, config('site.payment.gateway_provider'));

        return $value === null || trim($value) === '' ? null : trim($value);
    }

    public static function gatewayMerchantId(): ?string
    {
        $value = Setting::read(self::GATEWAY_MERCHANT_ID, config('site.payment.gateway_merchant_id'));

        return $value === null || trim($value) === '' ? null : trim($value);
    }

    public static function gatewaySandbox(): bool
    {
        return Setting::flag(self::GATEWAY_SANDBOX, (bool) config('site.payment.gateway_sandbox', true));
    }

    public static function cardFallbackEnabled(): bool
    {
        return Setting::flag(self::CARD_FALLBACK, (bool) config('site.payment.card_fallback', true));
    }
}

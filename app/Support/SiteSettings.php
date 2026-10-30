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
}

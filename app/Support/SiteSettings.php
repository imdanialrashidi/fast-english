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

    public const SUPPORT_PHONE = 'contact.support_phone';

    public const SUPPORT_MESSENGER = 'contact.support_messenger';

    public const SUPPORT_HOURS = 'contact.support_hours';

    public const COOPERATION_CHANNEL = 'contact.cooperation_channel';

    /** Legacy primary channel: the support email/address. */
    public static function supportChannel(): string
    {
        return (string) Setting::read(self::SUPPORT_CHANNEL, (string) config('site.support.channel', 'info@fastenglishpodcast.ir'));
    }

    public static function supportPhone(): string
    {
        return (string) Setting::read(self::SUPPORT_PHONE, (string) config('site.support.phone', '09924930667'));
    }

    public static function supportEmail(): string
    {
        return self::supportChannel();
    }

    public static function supportMessenger(): string
    {
        return (string) Setting::read(self::SUPPORT_MESSENGER, (string) config('site.support.messenger', 'بله یا تلگرام'));
    }

    public static function supportHours(): ?string
    {
        $value = Setting::read(self::SUPPORT_HOURS, config('site.support.hours'));

        return $value === null || trim($value) === '' ? null : trim($value);
    }

    /**
     * Direct chat entry for the owner-confirmed messenger. Bale and
     * Telegram both resolve a phone number to a conversation; the URL
     * comes from config so no component invents an address.
     */
    public static function supportTelegramUrl(): ?string
    {
        return self::publicUrl(config('site.support.telegram_url'));
    }

    public static function supportBaleUrl(): ?string
    {
        return self::publicUrl(config('site.support.bale_url'));
    }

    private static function publicUrl(mixed $value): ?string
    {
        if (! is_string($value) || trim($value) === '') {
            return null;
        }

        return preg_match('#^https?://#i', trim($value)) === 1 ? trim($value) : null;
    }

    public static function cooperationChannel(): string
    {
        return (string) Setting::read(self::COOPERATION_CHANNEL, (string) config('site.cooperation.channel', 'info@fastenglishpodcast.ir'));
    }

    /**
     * The support card shown on the support page, the public footer, and
     * the payment/auth notes. A phone is a `tel:` link; Bale and Telegram
     * are the same number and get their own direct chat links.
     *
     * @return array{phone: string, phone_href: ?string, email: string, email_href: ?string, messenger: string, messenger_note: string, telegram_url: ?string, bale_url: ?string, hours: ?string}
     */
    public static function supportContacts(): array
    {
        $phone = trim(self::supportPhone());
        $email = trim(self::supportEmail());
        $normalized = PhoneNumber::normalize($phone);

        return [
            'phone' => $phone,
            'phone_href' => $normalized !== null ? PhoneNumber::telHref($normalized) : null,
            'email' => $email,
            'email_href' => filter_var($email, FILTER_VALIDATE_EMAIL) ? 'mailto:'.$email : null,
            'messenger' => trim(self::supportMessenger()),
            'messenger_note' => (string) config('site.support.messenger_note', 'شمارهٔ پشتیبانی در بله و تلگرام فعال است؛ پیام بده تا سریع راهنمایی کنم.'),
            'telegram_url' => self::supportTelegramUrl(),
            'bale_url' => self::supportBaleUrl(),
            'hours' => self::supportHours(),
        ];
    }

    /**
     * A contact handle may be a phone, a Telegram-style @handle, an email,
     * or an http(s) URL. Anything else renders as plain text, never a
     * broken or invented link.
     */
    public static function contactHref(?string $channel): ?string
    {
        $value = trim((string) $channel);

        if ($value === '') {
            return null;
        }

        $phone = PhoneNumber::normalize($value);
        if ($phone !== null) {
            return PhoneNumber::telHref($phone);
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

<?php

namespace App\Support\Sms;

use RuntimeException;

/**
 * A safe failure at the SMS boundary.
 *
 * `rejected` means the provider explicitly refused the message, so it did
 * not leave the system and an immediate retry is safe. `unknown` means the
 * request may have been accepted (timeout, 5xx, unreadable response): a
 * caller must not resend automatically, because that can deliver the same
 * code or notice twice. The message never carries credentials, the phone,
 * the code, or the provider's raw body.
 */
final class SmsSendFailed extends RuntimeException
{
    public const KIND_REJECTED = 'rejected';

    public const KIND_UNKNOWN = 'unknown';

    public const KIND_UNAVAILABLE = 'unavailable';

    public function __construct(
        string $message,
        public readonly string $kind,
        public readonly ?string $providerCode = null,
        public readonly ?string $detail = null,
    ) {
        parent::__construct($message);
    }

    public static function rejected(?string $providerCode = null): self
    {
        return new self(
            $providerCode === null
                ? 'The SMS provider refused the message.'
                : "The SMS provider refused the message ({$providerCode}).",
            self::KIND_REJECTED,
            $providerCode,
        );
    }

    public static function unknown(?string $detail = null): self
    {
        return new self(
            'The SMS provider did not confirm the send.',
            self::KIND_UNKNOWN,
            null,
            $detail,
        );
    }

    public static function unavailable(): self
    {
        return new self(
            'SMS delivery is not configured.',
            self::KIND_UNAVAILABLE,
        );
    }

    public static function localOnly(): self
    {
        return new self(
            'The log SMS driver is available only outside production.',
            self::KIND_UNAVAILABLE,
            null,
            'log_in_production',
        );
    }

    public function isRejected(): bool
    {
        return $this->kind === self::KIND_REJECTED;
    }

    public function isUnknown(): bool
    {
        return $this->kind === self::KIND_UNKNOWN;
    }
}

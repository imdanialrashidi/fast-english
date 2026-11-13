<?php

namespace App\Support;

use App\Models\PhoneVerificationCode;
use App\Models\User;
use App\Support\Sms\SmsSender;
use App\Support\Sms\SmsSendFailed;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Throwable;

/**
 * Six-digit SMS codes for login and phone verification.
 *
 * - The code is random, valid for TTL_MINUTES, and stored only as a
 *   bcrypt hash.
 * - A resend is allowed after RESEND_SECONDS; routes carry a second
 *   throttle layer.
 * - MAX_ATTEMPTS wrong guesses destroy the code.
 * - A rejected provider send removes the row so the learner can retry
 *   immediately instead of waiting out a cooldown for an SMS that never
 *   left the server. An *unknown* send (timeout, 5xx, unreadable body)
 *   keeps the row: the message may have arrived, so a blind resend could
 *   deliver a second code, and the cooldown still lets the learner enter
 *   what they received.
 */
final class PhoneVerificationCodes
{
    public const PURPOSE_VERIFY = 'verify';

    public const PURPOSE_LOGIN = 'login';

    public const OK = 'ok';

    public const MISSING = 'missing';

    public const EXPIRED = 'expired';

    public const TOO_MANY = 'too_many';

    public const INVALID = 'invalid';

    public static function ttlMinutes(): int
    {
        return max(1, (int) config('sms.otp_ttl_minutes', 5));
    }

    public static function resendSeconds(): int
    {
        return max(0, (int) config('sms.resend_seconds', 60));
    }

    public static function maxAttempts(): int
    {
        return max(1, (int) config('sms.max_attempts', 5));
    }

    /** Create (or replace) the active code and send it. @throws Throwable */
    public static function issue(User $user, string $purpose, ?SmsSender $sms = null): PhoneVerificationCode
    {
        $phone = (string) $user->phone;
        if ($phone === '') {
            throw new \InvalidArgumentException('A phone number is required before issuing a code.');
        }

        $code = str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);

        $row = PhoneVerificationCode::updateOrCreate(
            ['user_id' => $user->id, 'purpose' => $purpose],
            [
                'phone' => $phone,
                'code_hash' => Hash::make($code),
                'attempts' => 0,
                'expires_at' => now()->addMinutes(self::ttlMinutes()),
                'sent_at' => now(),
            ],
        );

        try {
            ($sms ?? app(SmsSender::class))->sendCode($phone, $code);
        } catch (SmsSendFailed $e) {
            if (! $e->isUnknown()) {
                $row->delete();
            }

            throw $e;
        } catch (Throwable $e) {
            $row->delete();

            throw $e;
        }

        return $row;
    }

    /** Seconds the learner must wait before another send (0 when allowed). */
    public static function retryAfter(User $user, string $purpose): int
    {
        $row = PhoneVerificationCode::query()
            ->where('user_id', $user->id)
            ->where('purpose', $purpose)
            ->first();

        if ($row === null) {
            return 0;
        }

        $readyAt = $row->sent_at->getTimestamp() + self::resendSeconds();

        return max(0, $readyAt - now()->getTimestamp());
    }

    /**
     * Check a submitted code. The caller decides what success means (log
     * the learner in, or mark the phone verified).
     *
     * @return one of self::OK, self::MISSING, self::EXPIRED, self::TOO_MANY, self::INVALID
     */
    public static function verify(User $user, string $purpose, string $code): string
    {
        return DB::transaction(function () use ($user, $purpose, $code): string {
            $row = PhoneVerificationCode::query()
                ->where('user_id', $user->id)
                ->where('purpose', $purpose)
                ->lockForUpdate()
                ->first();

            if ($row === null || $row->phone !== (string) $user->phone) {
                if ($row !== null) {
                    $row->delete();
                }

                return self::MISSING;
            }

            if ($row->expires_at->isPast()) {
                $row->delete();

                return self::EXPIRED;
            }

            if ($row->attempts >= self::maxAttempts()) {
                $row->delete();

                return self::TOO_MANY;
            }

            if (! Hash::check($code, $row->code_hash)) {
                $row->attempts++;
                $row->save();

                if ($row->attempts >= self::maxAttempts()) {
                    $row->delete();

                    return self::TOO_MANY;
                }

                return self::INVALID;
            }

            $row->delete();

            return self::OK;
        });
    }

    public static function clear(User $user, ?string $purpose = null): void
    {
        $query = PhoneVerificationCode::query()->where('user_id', $user->id);

        if ($purpose !== null) {
            $query->where('purpose', $purpose);
        }

        $query->delete();
    }
}

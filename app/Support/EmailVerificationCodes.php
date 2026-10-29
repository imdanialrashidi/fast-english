<?php

namespace App\Support;

use App\Mail\VerifyEmailCodeMail;
use App\Models\EmailVerificationCode;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Throwable;

/**
 * Six-digit email verification codes (owner request 2026-10-28).
 *
 * - The code is random, valid for TTL_MINUTES, and stored only as a
 *   bcrypt hash.
 * - A resend is allowed after RESEND_SECONDS; the route throttle is the
 *   second layer.
 * - MAX_ATTEMPTS wrong guesses destroy the code, so a new one must be
 *   requested. Comparison uses Hash::check (constant time).
 * - A failed mail send removes the row so the learner can retry
 *   immediately instead of waiting out a cooldown for a mail that never
 *   left the server.
 */
final class EmailVerificationCodes
{
    public const TTL_MINUTES = 10;

    public const RESEND_SECONDS = 60;

    public const MAX_ATTEMPTS = 5;

    public const OK = 'ok';

    public const MISSING = 'missing';

    public const EXPIRED = 'expired';

    public const TOO_MANY = 'too_many';

    public const INVALID = 'invalid';

    /** Create (or replace) the active code and mail it. @throws Throwable */
    public static function issue(User $user): EmailVerificationCode
    {
        $code = str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);

        $row = EmailVerificationCode::updateOrCreate(
            ['user_id' => $user->id],
            [
                'code_hash' => Hash::make($code),
                'attempts' => 0,
                'expires_at' => now()->addMinutes(self::TTL_MINUTES),
                'sent_at' => now(),
            ],
        );

        try {
            Mail::to($user->email)->send(new VerifyEmailCodeMail(
                (string) $user->name,
                $code,
                self::TTL_MINUTES,
            ));
        } catch (Throwable $e) {
            $row->delete();

            throw $e;
        }

        return $row;
    }

    /** Seconds the learner must wait before another send (0 when allowed). */
    public static function retryAfter(User $user): int
    {
        $row = EmailVerificationCode::where('user_id', $user->id)->first();
        if ($row === null) {
            return 0;
        }

        $readyAt = $row->sent_at->getTimestamp() + self::RESEND_SECONDS;

        return max(0, $readyAt - now()->getTimestamp());
    }

    /**
     * Check a submitted code and mark the account verified on success.
     *
     * @return one of self::OK, self::MISSING, self::EXPIRED, self::TOO_MANY, self::INVALID
     */
    public static function verify(User $user, string $code): string
    {
        return DB::transaction(function () use ($user, $code): string {
            $row = EmailVerificationCode::query()
                ->where('user_id', $user->id)
                ->lockForUpdate()
                ->first();

            if ($row === null) {
                return self::MISSING;
            }

            if ($row->expires_at->isPast()) {
                $row->delete();

                return self::EXPIRED;
            }

            if ($row->attempts >= self::MAX_ATTEMPTS) {
                $row->delete();

                return self::TOO_MANY;
            }

            if (! Hash::check($code, $row->code_hash)) {
                $row->attempts++;
                $row->save();

                if ($row->attempts >= self::MAX_ATTEMPTS) {
                    $row->delete();

                    return self::TOO_MANY;
                }

                return self::INVALID;
            }

            $user->markEmailAsVerified();
            $row->delete();

            return self::OK;
        });
    }

    public static function clear(User $user): void
    {
        EmailVerificationCode::where('user_id', $user->id)->delete();
    }
}

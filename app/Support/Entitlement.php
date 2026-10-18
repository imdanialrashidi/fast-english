<?php

namespace App\Support;

use App\Models\Subscription;
use App\Models\User;
use Carbon\CarbonInterface;

/**
 * Entitlement gate (scope §8): one deep module behind the question "may
 * this learner see this?".
 *
 * - Window predicate: user exists AND disabled_at IS NULL AND
 *   subscription.revoked_at IS NULL AND starts_at <= now_utc < expires_at.
 * - Staff bypass: active staff (is_staff, not disabled) pass without a
 *   subscription. Level is content, never a permission. Pending grants
 *   nothing; expired, revoked, and suspended accounts lose access on the
 *   next request.
 * - Freshness: eligible() re-queries (never a stale in-test cached null)
 *   so approvals and revocations take effect on the next request. Money
 *   code holds row locks and passes the already-locked owner, so no
 *   re-query happens inside transactions.
 *
 * Callers (policy, middleware, planner, reader, money actions) cross this
 * seam — never past it. Tests assert at this interface.
 */
final class Entitlement
{
    /**
     * Active-subscription window on a loaded user. Trusts the loaded
     * relation — use eligible() when freshness matters.
     */
    public static function active(User $user, ?CarbonInterface $now = null): bool
    {
        if ($user->disabled_at !== null) {
            return false;
        }

        $subscription = $user->subscription;
        if ($subscription === null) {
            return false;
        }

        return self::windowActive($subscription, $now, $user);
    }

    /**
     * Window predicate on a bare subscription row with its already-held
     * owner: not revoked, owner not disabled, starts_at <= now <
     * expires_at. Money code calls this inside locked transactions where
     * the owner row is already held — no re-query, no stale relation.
     */
    public static function windowActive(Subscription $subscription, ?CarbonInterface $now = null, ?User $owner = null): bool
    {
        if ($subscription->revoked_at !== null) {
            return false;
        }

        if ($owner !== null && $owner->disabled_at !== null) {
            return false;
        }

        $moment = $now ?? now();

        return $subscription->starts_at <= $moment && $moment < $subscription->expires_at;
    }

    /**
     * Staff bypass + window on a freshly loaded user. Null, disabled, and
     * deleted users are refused; active staff pass without a window.
     */
    public static function eligible(?User $user, ?CarbonInterface $now = null): bool
    {
        if ($user === null || $user->disabled_at !== null) {
            return false;
        }

        if ($user->is_staff) {
            return true;
        }

        $fresh = $user->fresh();
        if ($fresh === null) {
            return false;
        }

        return self::active($fresh, $now);
    }

    /**
     * Active staff only: the single spelling of the staff check used by
     * gates, panels, and actions. Suspended staff are refused.
     */
    public static function staff(?User $user): bool
    {
        return $user !== null && (bool) $user->is_staff && $user->disabled_at === null;
    }

    /**
     * Props for the locked state: one primary CTA (subscribe for
     * signed-in learners, register for guests) plus the public sample
     * link. No premium content, answers, vocabulary, or media URLs travel
     * here.
     *
     * @return array<string, mixed>
     */
    public static function lockedProps(?User $user): array
    {
        return [
            'isGuest' => $user === null,
            'subscribeUrl' => route('subscribe.index'),
            'registerUrl' => route('register'),
            'loginUrl' => route('login'),
            'sampleUrl' => route('sample'),
        ];
    }
}

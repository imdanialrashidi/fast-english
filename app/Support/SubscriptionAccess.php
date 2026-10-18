<?php

namespace App\Support;

use App\Models\User;
use Carbon\CarbonInterface;

/**
 * S6 entitlement (scope §8): server-computed, per request, never cached.
 *
 * eligible = user exists AND disabled_at IS NULL
 *   AND subscription.revoked_at IS NULL
 *   AND starts_at <= now_utc < expires_at
 *
 * Pending grants nothing; expired, revoked, and suspended accounts lose
 * access on the next request. Level is content, never a permission: every
 * published level is allowed to an eligible subscriber.
 */
final class SubscriptionAccess
{
    public static function eligible(User $user, ?CarbonInterface $now = null): bool
    {
        return Entitlement::active($user, $now);
    }
}

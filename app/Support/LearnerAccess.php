<?php

namespace App\Support;

use App\Models\User;

/**
 * Paid-only learner gate (owner requirement): every learner-app route and
 * protected learner mutation recomputes eligibility per request — never
 * client state, never a cached flag. Staff keeps panel preview and
 * learner access via the staff branch (see LessonPolicy); disabled
 * accounts are refused upstream by RejectDisabledUsers on session routes
 * and denied here as a second layer.
 *
 * Thin adapter over Entitlement: the predicate, staff spelling, freshness
 * rule, and locked props all live behind that seam. Kept so existing
 * callers (middleware, reader) need no flag-day rename.
 */
final class LearnerAccess
{
    public static function eligibleOrStaff(?User $user): bool
    {
        return Entitlement::eligible($user);
    }

    /**
     * @return array<string, mixed>
     */
    public static function lockedProps(?User $user): array
    {
        return Entitlement::lockedProps($user);
    }
}

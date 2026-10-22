<?php

namespace App\Policies;

use App\Models\Lesson;
use App\Models\User;
use App\Support\Entitlement;

/**
 * S6 eligibility (scope §8):
 *
 * - Publication is checked by the controllers first: draft, archived, or
 *   otherwise unpublished content is a 404 for everyone, including staff.
 * - A published lesson of a published topic is viewable when it is flagged
 *   as the public sample, when the user is active staff (panel preview),
 *   or when the user holds an eligible subscription window (Entitlement:
 *   not disabled, not revoked, starts_at <= now < expires_at). Level is
 *   content, never a permission: every published level is allowed to an
 *   eligible subscriber.
 * - Pending grants nothing; expired, revoked, and suspended accounts are
 *   denied on the next request.
 */
class LessonPolicy
{
    public function view(?User $user, Lesson $lesson): bool
    {
        if ($lesson->is_public_sample) {
            return true;
        }

        // One seam for "may this learner see this?": the fresh eligibility
        // path already folds in the disabled check and the staff bypass.
        return Entitlement::eligible($user);
    }
}

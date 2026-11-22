<?php

namespace App\Policies;

use App\Models\TedTalk;
use App\Models\User;
use App\Support\Entitlement;

/**
 * The TED tab follows the same paid gate as lessons: a published talk on a
 * published topic is visible to active staff or an eligible subscriber.
 * Guests and lapsed accounts get the locked page, never the transcript.
 */
class TedTalkPolicy
{
    public function view(?User $user, TedTalk $talk): bool
    {
        return Entitlement::eligible($user);
    }
}

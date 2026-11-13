<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Model;

/**
 * One active SMS code per learner and purpose. Only the bcrypt hash is
 * stored; the plain six digits exist in the provider request and nowhere
 * else. A row is deleted on success, on the attempt limit, and on expiry.
 */
#[Fillable(['user_id', 'phone', 'purpose', 'code_hash', 'attempts', 'expires_at', 'sent_at'])]
#[Hidden(['code_hash'])]
class PhoneVerificationCode extends Model
{
    protected function casts(): array
    {
        return [
            'attempts' => 'integer',
            'expires_at' => 'datetime',
            'sent_at' => 'datetime',
        ];
    }
}

<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * One SMS attempt and its provider receipt. This is the audit trail the
 * support desk and `sms:check-deliveries` work from: it never stores the
 * code, the message text, or credentials. `rec_id` is a string because a
 * long receipt id must survive the HTTP → database round trip unchanged.
 */
#[Fillable([
    'user_id', 'kind', 'phone', 'body_id', 'rec_id',
    'status', 'provider_code', 'error_kind', 'check_attempts', 'checked_at',
])]
class SmsMessage extends Model
{
    public const KIND_CODE = 'code';

    public const KIND_SUBSCRIPTION_ACTIVATED = 'subscription_activated';

    public const STATUS_PENDING = 'pending';

    public const STATUS_ACCEPTED = 'accepted';

    public const STATUS_REJECTED = 'rejected';

    public const STATUS_UNKNOWN = 'unknown';

    public const STATUS_DELIVERED = 'delivered';

    public const STATUS_FAILED = 'failed';

    public const STATUS_BLOCKED = 'blocked';

    public const STATUS_FILTERED = 'filtered';

    public const STATUS_UNCONFIRMED = 'unconfirmed';

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    protected function casts(): array
    {
        return [
            'body_id' => 'integer',
            'check_attempts' => 'integer',
            'checked_at' => 'datetime',
        ];
    }
}

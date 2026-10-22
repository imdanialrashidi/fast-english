<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * S6 subscription window (scope §8, §11.1, §14): one current row per user
 * (user_id unique). Access is computed from this window — see
 * App\Support\Entitlement — never from a cached flag on users.
 *
 * Money stays integer toman (scope §8): this table carries no money, only
 * exact-day windows. Timestamps are UTC. Rows are written only by the
 * shared App\Actions\ApprovePayment action; expires_at is never free-form
 * CRUD (scope §11.3).
 */
class Subscription extends Model
{
    use HasFactory;

    /** Server-written only; the action uses forceFill. */
    protected $fillable = [];

    protected function casts(): array
    {
        return [
            'starts_at' => 'datetime',
            'expires_at' => 'datetime',
            'revoked_at' => 'datetime',
            'renewal_reminder_sent_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function events(): HasMany
    {
        return $this->hasMany(SubscriptionEvent::class);
    }
}

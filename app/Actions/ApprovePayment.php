<?php

namespace App\Actions;

use App\Models\PaymentRequest;
use App\Models\Subscription;
use App\Models\SubscriptionEvent;
use App\Models\User;
use App\Support\Entitlement;
use Carbon\Carbon;
use Carbon\CarbonInterface;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * S6 single shared owner of every money/access transition (scope §11.2–11.3).
 *
 * The Filament payment queue AND the `payment:review` CLI both call these
 * methods; the logic is never copied into callers. Fixed lock order in one
 * transaction everywhere: User (owner) → PaymentRequest → Subscription
 * (grant/revoke lock User → Subscription, the same relative order).
 *
 * Window math (scope §11.2): base = current expires_at when the window is
 * active and not revoked, else the approval time; new expiry = base +
 * duration_days_snapshot × 24h. Fresh windows start at approve time and
 * active renewals preserve starts_at; a fresh approve/grant clears
 * revoked_at. A replayed approve of an already-approved request returns
 * the prior result with no new event and no extension — so it can never
 * reactivate a revoked subscription.
 *
 * Refusals throw ValidationException (like PublishLesson) so Filament
 * actions and the CLI report the same specific reason.
 */
final class ApprovePayment
{
    /**
     * Approve a pending request: one event keyed by the request, one
     * window extension, request marked approved with reviewer and time —
     * all in one transaction (scope §11.2).
     *
     * @return array{request: PaymentRequest, subscription: Subscription, event: SubscriptionEvent|null, replayed: bool}
     *
     * @throws ValidationException
     */
    public static function approve(int $requestId, User $staff, ?CarbonInterface $now = null): array
    {
        self::requireActiveStaff($staff);

        $moment = self::moment($now);

        $precheck = PaymentRequest::find($requestId);
        if ($precheck === null) {
            throw ValidationException::withMessages(['request' => 'The payment request was not found.']);
        }
        if ((int) $precheck->user_id === (int) $staff->id) {
            throw ValidationException::withMessages(['request' => 'Staff cannot approve their own payment request.']);
        }

        return DB::transaction(function () use ($requestId, $staff, $moment, $precheck) {
            $owner = User::where('id', $precheck->user_id)->lockForUpdate()->firstOrFail();
            $row = PaymentRequest::where('id', $requestId)->lockForUpdate()->firstOrFail();

            if ((int) $row->user_id === (int) $staff->id) {
                throw ValidationException::withMessages(['request' => 'Staff cannot approve their own payment request.']);
            }

            // Idempotent replay: an already-approved request returns the
            // same result with no new event and no extension.
            if ($row->status === PaymentRequest::STATUS_APPROVED) {
                $subscription = Subscription::where('user_id', $row->user_id)->first();
                if ($subscription === null) {
                    throw ValidationException::withMessages(['request' => 'The approved request has no subscription window.']);
                }
                $event = SubscriptionEvent::where('source_payment_request_id', $row->id)->first();

                return ['request' => $row, 'subscription' => $subscription, 'event' => $event, 'replayed' => true];
            }

            if ($row->status !== PaymentRequest::STATUS_PENDING) {
                throw ValidationException::withMessages(['request' => 'Only a pending request can be approved.']);
            }

            if ($row->receipt_path === null || trim((string) $row->receipt_path) === '') {
                throw ValidationException::withMessages(['request' => 'A request without a receipt cannot be approved.']);
            }

            $duration = (int) $row->duration_days_snapshot;
            if ($duration <= 0) {
                throw ValidationException::withMessages(['request' => 'The snapshot duration is invalid.']);
            }

            $subscription = Subscription::where('user_id', $owner->id)->lockForUpdate()->first();
            if ($subscription !== null) {
                $subscription->setRelation('user', $owner);
            }

            $active = $subscription !== null && Entitlement::windowActive($subscription, $moment);

            $base = $active ? $subscription->expires_at->copy() : $moment->copy();
            $newExpires = $base->copy()->addDays($duration);
            $newStarts = $active ? $subscription->starts_at->copy() : $moment->copy();

            $beforeStarts = $subscription?->starts_at?->copy();
            $beforeExpires = $subscription?->expires_at?->copy();

            if ($subscription === null) {
                $subscription = new Subscription;
                $subscription->forceFill([
                    'user_id' => $owner->id,
                    'starts_at' => $newStarts,
                    'expires_at' => $newExpires,
                    'revoked_at' => null,
                    'renewal_reminder_sent_at' => null,
                ]);
                $subscription->save();
            } else {
                $subscription->forceFill([
                    'starts_at' => $newStarts,
                    'expires_at' => $newExpires,
                    'revoked_at' => null,
                    'renewal_reminder_sent_at' => null,
                ]);
                $subscription->save();
            }

            try {
                $event = new SubscriptionEvent;
                $event->forceFill([
                    'user_id' => $owner->id,
                    'subscription_id' => $subscription->id,
                    'source_payment_request_id' => $row->id,
                    'type' => SubscriptionEvent::TYPE_APPROVED,
                    'before_starts_at' => $beforeStarts,
                    'before_expires_at' => $beforeExpires,
                    'after_starts_at' => $newStarts,
                    'after_expires_at' => $newExpires,
                    'duration_days' => $duration,
                    'actor_id' => $staff->id,
                    'reason' => null,
                    'created_at' => $moment->copy(),
                ]);
                $event->save();
            } catch (QueryException $e) {
                // Backstop: the unique key on source_payment_request_id
                // fired, so this request already produced its one event.
                // Re-read inside the same transaction and replay.
                if (! self::isUniqueViolation($e)) {
                    throw $e;
                }
                $existing = SubscriptionEvent::where('source_payment_request_id', $row->id)->first();
                $current = Subscription::where('user_id', $row->user_id)->firstOrFail();

                return ['request' => $row->fresh(), 'subscription' => $current, 'event' => $existing, 'replayed' => true];
            }

            $row->forceFill([
                'status' => PaymentRequest::STATUS_APPROVED,
                'reviewed_by' => $staff->id,
                'reviewed_at' => $moment->copy(),
            ]);
            $row->save();

            return [
                'request' => $row->fresh(),
                'subscription' => $subscription->fresh(),
                'event' => $event->fresh(),
                'replayed' => false,
            ];
        });
    }

    /**
     * Reject a pending request with a public reason and a separate
     * internal note (scope §11.3). No subscription effect; a prior valid
     * window is preserved untouched. Resubmission creates a new request.
     *
     * @throws ValidationException
     */
    public static function reject(int $requestId, User $staff, string $publicReason, ?string $internalNote = null): PaymentRequest
    {
        self::requireActiveStaff($staff);

        $reason = trim($publicReason);
        if ($reason === '') {
            throw ValidationException::withMessages(['public_reason' => 'A public reason is required to reject a request.']);
        }

        $ownerId = PaymentRequest::where('id', $requestId)->value('user_id');
        if ($ownerId === null) {
            throw ValidationException::withMessages(['request' => 'The payment request was not found.']);
        }
        if ((int) $ownerId === (int) $staff->id) {
            throw ValidationException::withMessages(['request' => 'Staff cannot review their own payment request.']);
        }

        // Fixed lock order User → PaymentRequest, same as approve.
        return DB::transaction(function () use ($requestId, $staff, $reason, $internalNote, $ownerId) {
            User::where('id', $ownerId)->lockForUpdate()->firstOrFail();
            $row = PaymentRequest::where('id', $requestId)->lockForUpdate()->firstOrFail();

            if ((int) $row->user_id === (int) $staff->id) {
                throw ValidationException::withMessages(['request' => 'Staff cannot review their own payment request.']);
            }

            if ($row->status !== PaymentRequest::STATUS_PENDING) {
                throw ValidationException::withMessages(['request' => 'Only a pending request can be rejected.']);
            }

            $row->forceFill([
                'status' => PaymentRequest::STATUS_REJECTED,
                'public_reason' => $reason,
                'internal_note' => $internalNote !== null && trim($internalNote) !== '' ? $internalNote : null,
                'reviewed_by' => $staff->id,
                'reviewed_at' => now(),
            ]);
            $row->save();

            return $row->fresh();
        });
    }

    /**
     * Staff cancellation of a pending request with a mandatory reason
     * (scope §10.1). No subscription effect.
     *
     * @throws ValidationException
     */
    public static function cancel(int $requestId, User $staff, string $reason): PaymentRequest
    {
        self::requireActiveStaff($staff);

        $clean = trim($reason);
        if ($clean === '') {
            throw ValidationException::withMessages(['reason' => 'A reason is required to cancel a request.']);
        }

        $ownerId = PaymentRequest::where('id', $requestId)->value('user_id');
        if ($ownerId === null) {
            throw ValidationException::withMessages(['request' => 'The payment request was not found.']);
        }
        if ((int) $ownerId === (int) $staff->id) {
            throw ValidationException::withMessages(['request' => 'Staff cannot review their own payment request.']);
        }

        // Fixed lock order User → PaymentRequest, same as approve.
        return DB::transaction(function () use ($requestId, $staff, $clean, $ownerId) {
            User::where('id', $ownerId)->lockForUpdate()->firstOrFail();
            $row = PaymentRequest::where('id', $requestId)->lockForUpdate()->firstOrFail();

            if ((int) $row->user_id === (int) $staff->id) {
                throw ValidationException::withMessages(['request' => 'Staff cannot review their own payment request.']);
            }

            if ($row->status !== PaymentRequest::STATUS_PENDING) {
                throw ValidationException::withMessages(['request' => 'Only a pending request can be cancelled by staff.']);
            }

            $row->forceFill([
                'status' => PaymentRequest::STATUS_CANCELLED,
                'public_reason' => $clean,
                'cancelled_by' => $staff->id,
                'cancelled_at' => now(),
            ]);
            $row->save();

            return $row->fresh();
        });
    }

    /**
     * Manual support grant: creates or extends the window from the same
     * base rule as approval, clears a revocation, and writes one
     * granted event (scope §11.3).
     *
     * @return array{subscription: Subscription, event: SubscriptionEvent}
     *
     * @throws ValidationException
     */
    public static function grant(int $userId, User $staff, int $durationDays, string $reason, ?CarbonInterface $now = null): array
    {
        self::requireActiveStaff($staff);

        if ($durationDays <= 0) {
            throw ValidationException::withMessages(['duration_days' => 'The grant duration must be a positive number of days.']);
        }
        $clean = trim($reason);
        if ($clean === '') {
            throw ValidationException::withMessages(['reason' => 'A reason is required for a manual grant.']);
        }

        $moment = self::moment($now);

        if ((int) $userId === (int) $staff->id) {
            throw ValidationException::withMessages(['request' => 'Staff cannot grant or revoke their own subscription.']);
        }

        return DB::transaction(function () use ($userId, $staff, $durationDays, $clean, $moment) {
            $owner = User::where('id', $userId)->lockForUpdate()->firstOrFail();

            if ((int) $owner->id === (int) $staff->id) {
                throw ValidationException::withMessages(['request' => 'Staff cannot grant or revoke their own subscription.']);
            }

            $subscription = Subscription::where('user_id', $owner->id)->lockForUpdate()->first();
            if ($subscription !== null) {
                $subscription->setRelation('user', $owner);
            }

            $active = $subscription !== null && Entitlement::windowActive($subscription, $moment);

            $base = $active ? $subscription->expires_at->copy() : $moment->copy();
            $newExpires = $base->copy()->addDays($durationDays);
            $newStarts = $active ? $subscription->starts_at->copy() : $moment->copy();

            $beforeStarts = $subscription?->starts_at?->copy();
            $beforeExpires = $subscription?->expires_at?->copy();

            if ($subscription === null) {
                $subscription = new Subscription;
                $subscription->forceFill([
                    'user_id' => $owner->id,
                    'starts_at' => $newStarts,
                    'expires_at' => $newExpires,
                    'revoked_at' => null,
                    'renewal_reminder_sent_at' => null,
                ]);
                $subscription->save();
            } else {
                $subscription->forceFill([
                    'starts_at' => $newStarts,
                    'expires_at' => $newExpires,
                    'revoked_at' => null,
                    'renewal_reminder_sent_at' => null,
                ]);
                $subscription->save();
            }

            $event = new SubscriptionEvent;
            $event->forceFill([
                'user_id' => $owner->id,
                'subscription_id' => $subscription->id,
                'source_payment_request_id' => null,
                'type' => SubscriptionEvent::TYPE_GRANTED,
                'before_starts_at' => $beforeStarts,
                'before_expires_at' => $beforeExpires,
                'after_starts_at' => $newStarts,
                'after_expires_at' => $newExpires,
                'duration_days' => $durationDays,
                'actor_id' => $staff->id,
                'reason' => $clean,
                'created_at' => $moment->copy(),
            ]);
            $event->save();

            return ['subscription' => $subscription->fresh(), 'event' => $event->fresh()];
        });
    }

    /**
     * Manual revoke: stops access immediately (revoked_at set) with no
     * automatic refund, and writes one revoked event (scope §11.3).
     *
     * @return array{subscription: Subscription, event: SubscriptionEvent}
     *
     * @throws ValidationException
     */
    public static function revoke(int $userId, User $staff, string $reason, ?CarbonInterface $now = null): array
    {
        self::requireActiveStaff($staff);

        $clean = trim($reason);
        if ($clean === '') {
            throw ValidationException::withMessages(['reason' => 'A reason is required to revoke a subscription.']);
        }
        $moment = self::moment($now);

        if ((int) $userId === (int) $staff->id) {
            throw ValidationException::withMessages(['request' => 'Staff cannot grant or revoke their own subscription.']);
        }

        return DB::transaction(function () use ($userId, $staff, $clean, $moment) {
            $owner = User::where('id', $userId)->lockForUpdate()->firstOrFail();

            if ((int) $owner->id === (int) $staff->id) {
                throw ValidationException::withMessages(['request' => 'Staff cannot grant or revoke their own subscription.']);
            }

            $subscription = Subscription::where('user_id', $owner->id)->lockForUpdate()->firstOrFail();

            if ($subscription->revoked_at !== null) {
                throw ValidationException::withMessages(['subscription' => 'The subscription is already revoked.']);
            }

            $beforeStarts = $subscription->starts_at->copy();
            $beforeExpires = $subscription->expires_at->copy();

            $subscription->forceFill(['revoked_at' => $moment->copy()]);
            $subscription->save();

            $event = new SubscriptionEvent;
            $event->forceFill([
                'user_id' => $owner->id,
                'subscription_id' => $subscription->id,
                'source_payment_request_id' => null,
                'type' => SubscriptionEvent::TYPE_REVOKED,
                'before_starts_at' => $beforeStarts,
                'before_expires_at' => $beforeExpires,
                'after_starts_at' => $subscription->starts_at->copy(),
                'after_expires_at' => $subscription->expires_at->copy(),
                'duration_days' => null,
                'actor_id' => $staff->id,
                'reason' => $clean,
                'created_at' => $moment->copy(),
            ]);
            $event->save();

            return ['subscription' => $subscription->fresh(), 'event' => $event->fresh()];
        });
    }

    private static function requireActiveStaff(User $staff): void
    {
        $staff->refresh();

        if (! Entitlement::staff($staff)) {
            throw ValidationException::withMessages(['staff' => 'Only active staff can review payments.']);
        }
    }

    private static function moment(?CarbonInterface $now): Carbon
    {
        if ($now === null) {
            return now();
        }

        return Carbon::parse($now->toIso8601String(), 'UTC');
    }

    private static function isUniqueViolation(QueryException $e): bool
    {
        $code = (string) $e->getCode();

        return $code === '23505'
            || str_contains(strtolower((string) $e->getMessage()), 'duplicate key')
            || str_contains(strtolower((string) $e->getMessage()), 'unique');
    }
}

<?php

namespace App\Http\Controllers;

use App\Http\Responses\NoStore;
use App\Models\PaymentDestination;
use App\Models\PaymentRequest;
use App\Models\Plan;
use App\Support\Toman;
use Illuminate\Database\QueryException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;

/**
 * S5 payment requests (scope §7.3, §10.1–10.2): snapshot before transfer.
 *
 * - The learner chooses an active plan. The client sends only the plan ID;
 *   amount, duration, destination, and status are never accepted — a
 *   request carrying them is rejected with 422 and nothing is stored.
 * - The server creates the request in awaiting_receipt with an immutable
 *   snapshot: plan name, integer toman amount, duration days, and the
 *   active destination's card number, holder, and bank.
 * - Only one open request (awaiting_receipt/pending) per user is allowed:
 *   an existing open request is returned instead of a new one. To change
 *   the plan before transfer, the draft is cancelled first and a new
 *   request is created. The partial unique index backs the race.
 * - Cancellation by the owner is allowed only while awaiting_receipt.
 *   Pending cancellation is staff-only with a reason — an S6 panel action
 *   explicitly deferred here (cancel on pending is 403).
 * - Rejected and cancelled rows are kept; a new purchase creates a new
 *   request. A pending request grants no access (proven in S5-3; the
 *   LessonPolicy knows nothing about payment_requests).
 */
class PaymentRequestController extends Controller
{
    /** @var list<string> */
    private const FORBIDDEN_CREATE_KEYS = [
        'amount', 'amount_toman', 'amount_toman_snapshot',
        'price', 'price_toman',
        'duration', 'duration_days', 'duration_days_snapshot',
        'destination', 'destination_id', 'destination_snapshot',
        'status', 'plan_name_snapshot',
    ];

    public function store(Request $request)
    {
        $user = $request->user();
        if ($user === null || $user->disabled_at !== null) {
            abort(403);
        }

        // S8 sales switch (scope §25): when sales are off, no payment
        // request can be created — nothing is stored. The subscribe page
        // shows «در دست آماده‌سازی» instead of purchase forms.
        if ((bool) config('sales.enabled', false) !== true) {
            if ($request->expectsJson()) {
                return response()->json([
                    'message' => 'فروش در حال حاضر فعال نیست.',
                ], 422)->withHeaders(NoStore::headers());
            }

            return redirect()->route('subscribe.index')->withErrors([
                'plan_id' => 'فروش در حال حاضر فعال نیست.',
            ]);
        }

        // Tamper boundary: the client owns only the plan choice. Any
        // amount/duration/destination/status key is a 422 with no write.
        // Learner-facing messages are Persian (S7 pre-slice 3).
        foreach (self::FORBIDDEN_CREATE_KEYS as $key) {
            if ($request->exists($key)) {
                return response()->json([
                    'message' => 'درخواست شامل فیلد غیرمجاز سرور است.',
                    'field' => $key,
                ], 422)->withHeaders(NoStore::headers());
            }
        }

        $data = $request->validate([
            'plan_id' => ['required', 'integer', 'exists:plans,id'],
        ], [
            'plan_id.required' => 'انتخاب پلن الزامی است.',
            'plan_id.integer' => 'پلن انتخاب‌شده معتبر نیست.',
            'plan_id.exists' => 'پلن انتخاب‌شده معتبر نیست.',
        ]);

        // A payment-create burst is bounded by the single-open rule plus a
        // light daily cap (scope §16 proposal, tuned for tests): 10/day.
        $todayCount = PaymentRequest::where('user_id', $user->id)
            ->where('created_at', '>=', now()->startOfDay())
            ->count();
        if ($todayCount >= 10) {
            return response()->json([
                'message' => 'امروز درخواست بیش از حد ثبت شده است. لطفاً فردا تلاش کنید.',
            ], 429)->withHeaders(NoStore::headers());
        }

        // Fast path: an existing open request is returned, never doubled.
        $open = PaymentRequest::where('user_id', $user->id)
            ->whereIn('status', PaymentRequest::OPEN_STATUSES)
            ->orderByDesc('id')
            ->first();
        if ($open !== null) {
            return $this->openRedirect($request, $open);
        }

        $plan = Plan::find($data['plan_id']);
        if ($plan === null || ! $plan->is_active) {
            return response()->json(['message' => 'پلن انتخاب‌شده در دسترس نیست.'], 422)
                ->withHeaders(NoStore::headers());
        }

        $destination = PaymentDestination::where('is_active', true)->first();
        if ($destination === null) {
            return response()->json(['message' => 'مقصد پرداخت در دسترس نیست.'], 422)
                ->withHeaders(NoStore::headers());
        }

        try {
            $created = DB::transaction(function () use ($user, $plan, $destination) {
                // Re-check inside the transaction so a concurrent create
                // cannot slip past the fast path above.
                $existing = PaymentRequest::where('user_id', $user->id)
                    ->whereIn('status', PaymentRequest::OPEN_STATUSES)
                    ->lockForUpdate()
                    ->first();
                if ($existing !== null) {
                    return $existing;
                }

                $row = new PaymentRequest;
                $row->forceFill([
                    'user_id' => $user->id,
                    'plan_id' => $plan->id,
                    'destination_id' => $destination->id,
                    'plan_name_snapshot' => $plan->name_fa,
                    'amount_toman_snapshot' => (int) $plan->price_toman,
                    'duration_days_snapshot' => (int) $plan->duration_days,
                    'destination_snapshot' => [
                        'card_number' => $destination->card_number,
                        'holder_name' => $destination->holder_name,
                        'bank_name' => $destination->bank_name,
                    ],
                    'status' => PaymentRequest::STATUS_AWAITING_RECEIPT,
                ]);
                $row->save();

                return $row;
            });
        } catch (QueryException $e) {
            // Race lost on the partial unique index: exactly one open
            // request survives — return it instead of a new one.
            if ($this->isUniqueViolation($e)) {
                $winner = PaymentRequest::where('user_id', $user->id)
                    ->whereIn('status', PaymentRequest::OPEN_STATUSES)
                    ->orderByDesc('id')
                    ->firstOrFail();

                return $this->openRedirect($request, $winner);
            }

            throw $e;
        }

        return $this->openRedirect($request, $created->fresh());
    }

    public function show(Request $request, PaymentRequest $paymentRequest)
    {
        $user = $request->user();
        if ($user === null || $user->disabled_at !== null) {
            abort(403);
        }

        if (Gate::allows('view', $paymentRequest) !== true) {
            abort(403);
        }

        // Reload-safe: a plain GET with the snapshot, the public reason,
        // and the explicit next step per state. Staff-only fields
        // (internal_note, reviewed_by, receipt_path, bank_reference,
        // sender_last4) are never passed to this page. Amounts render
        // server-formatted (Toman) so no raw integer/rial ambiguity
        // reaches the client. Shape owned by PaymentRequest::snapshot().
        $fresh = $paymentRequest->fresh();
        $snapshot = $fresh->snapshot();

        return Inertia::render('Payments/Show', [
            'request' => [
                'id' => $fresh->id,
                'status' => (string) $fresh->status,
                'plan_name' => $snapshot['plan_name'],
                'amount_label' => $snapshot['amount_label'],
                'duration_days' => $snapshot['duration_days'],
                'card_number' => $snapshot['card_number'],
                'holder_name' => $snapshot['holder_name'],
                'bank_name' => $snapshot['bank_name'],
                'public_reason' => $fresh->public_reason,
                'has_receipt' => $fresh->receipt_path !== null && $fresh->receipt_path !== '',
                'receipt_url' => $fresh->receipt_path !== null && $fresh->receipt_path !== ''
                    ? route('payments.receipt.show', $fresh)
                    : null,
            ],
        ]);
    }

    public function cancel(Request $request, PaymentRequest $paymentRequest)
    {
        $user = $request->user();
        if ($user === null || $user->disabled_at !== null) {
            abort(403);
        }

        if (Gate::allows('view', $paymentRequest) !== true) {
            abort(403);
        }

        if (Gate::allows('cancel', $paymentRequest) !== true) {
            // Pending cancellation is staff-only with a reason (S6 panel).
            abort(403);
        }

        DB::transaction(function () use ($paymentRequest, $user) {
            $row = PaymentRequest::where('id', $paymentRequest->id)->lockForUpdate()->firstOrFail();
            if ($row->status !== PaymentRequest::STATUS_AWAITING_RECEIPT) {
                abort(403);
            }
            $row->forceFill([
                'status' => PaymentRequest::STATUS_CANCELLED,
                'cancelled_by' => $user->id,
                'cancelled_at' => now(),
            ])->save();
        });

        if ($request->expectsJson()) {
            return response()->json(['status' => PaymentRequest::STATUS_CANCELLED])
                ->withHeaders(NoStore::headers());
        }

        return redirect()
            ->route('payments.show', $paymentRequest)
            ->with('status', 'درخواست لغو شد.');
    }

    private function openRedirect(Request $request, PaymentRequest $open)
    {
        if ($request->expectsJson()) {
            return response()->json([
                'id' => $open->id,
                'status' => $open->status,
            ])->withHeaders(NoStore::headers());
        }

        return redirect()->route('payments.show', $open);
    }

    private function isUniqueViolation(QueryException $e): bool
    {
        $code = (string) $e->getCode();

        return $code === '23505'
            || str_contains(strtolower((string) $e->getMessage()), 'duplicate key')
            || str_contains(strtolower((string) $e->getMessage()), 'unique');
    }
}

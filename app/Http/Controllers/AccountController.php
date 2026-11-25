<?php

namespace App\Http\Controllers;

use App\Models\PaymentRequest;
use App\Support\ProfilePhoto;
use App\Support\Entitlement;
use App\Support\Toman;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;
use Inertia\Response;

/**
 * S6 account page (scope §6, §17): profile + subscription + payment state.
 *
 * Shows the learner's current subscription window (when one exists) and
 * the open payment request (if any) with one clear CTA, without leaking
 * staff-only or private fields. Private, no-store (scope §16).
 */
class AccountController extends Controller
{
    public function index(Request $request): Response
    {
        $user = $request->user();
        if ($user === null || $user->disabled_at !== null) {
            abort(403);
        }

        $openRequest = PaymentRequest::where('user_id', $user->id)
            ->whereIn('status', PaymentRequest::OPEN_STATUSES)
            ->orderByDesc('id')
            ->first();

        $latestRequest = PaymentRequest::where('user_id', $user->id)
            ->orderByDesc('id')
            ->first();

        $subscription = $user->subscription;
        $subscriptionActive = $subscription !== null && Entitlement::active($user);

        // Public-slice Inertia transport (ADR-0002): the same
        // subscription + open/latest request derivation with one clear
        // CTA. Props are an allowlist — staff-only and private fields
        // (internal_note, receipt_path, bank_reference, sender_last4)
        // never travel to this page. Display-name editing moved here
        // from the retired learner Livewire component (same
        // required/string/255 server rule, same isolation).
        $mapRequest = fn (?PaymentRequest $row) => $row ? [
            'id' => $row->id,
            'status' => (string) $row->status,
            'plan_name' => (string) $row->plan_name_snapshot,
            'url' => route('payments.show', $row),
        ] : null;

        // Recent payment history is the learner's own rows only. The
        // snapshot amount is the one they agreed to; receipt paths,
        // bank references, sender digits, and internal notes never travel.
        $paymentHistory = PaymentRequest::where('user_id', $user->id)
            ->orderByDesc('id')
            ->limit(10)
            ->get()
            ->map(fn (PaymentRequest $row) => [
                'id' => $row->id,
                'status' => (string) $row->status,
                'plan_name' => (string) $row->plan_name_snapshot,
                'amount_label' => Toman::format((int) $row->amount_toman_snapshot),
                'created_at' => $row->created_at?->toIso8601String(),
                'url' => route('payments.show', $row),
            ])->all();

        return Inertia::render('Account/Index', [
            'user' => [
                'name' => (string) $user->name,
                'first_name' => $user->first_name,
                'last_name' => $user->last_name,
                'email' => (string) $user->email,
                'preferred_level' => $user->preferred_level,
                'daily_goal_minutes' => (int) ($user->daily_goal_minutes ?? 10),
                'avatar_url' => $user->avatar_path !== null ? Storage::disk('public')->url($user->avatar_path) : null,
                'profile_completed' => $user->profile_completed_at !== null,
            ],
            'subscription' => $subscription ? [
                'active' => $subscriptionActive,
                // Display state, never a permission: active, expired, or
                // revoked. Access still comes only from Entitlement.
                'state' => $subscriptionActive
                    ? 'active'
                    : ($subscription->revoked_at !== null ? 'revoked' : 'expired'),
                // ISO instant; the client formats it for Asia/Tehran so
                // Persian dates and digits are presentation-owned.
                'expires_at' => $subscription->expires_at?->toIso8601String(),
            ] : null,
            'openRequest' => $mapRequest($openRequest),
            'latestRequest' => $mapRequest($latestRequest),
            'paymentHistory' => $paymentHistory,
        ]);
    }

    public function updateAvatar(Request $request)
    {
        $user = $request->user();
        if ($user === null || $user->disabled_at !== null) {
            abort(403);
        }

        $request->validate([
            'avatar' => ['required', 'file', 'max:4096'],
        ], [
            'avatar.required' => 'یک عکس انتخاب کنید.',
            'avatar.file' => 'فایل انتخاب‌شده معتبر نیست.',
            'avatar.max' => 'حجم عکس بیشتر از ۴ مگابایت است.',
        ]);

        $file = $request->file('avatar');
        if ($file === null) {
            return back()->withErrors(['avatar' => 'یک عکس انتخاب کنید.']);
        }

        $previous = $user->avatar_path;
        $path = ProfilePhoto::store($file);
        $user->forceFill(['avatar_path' => $path])->save();
        ProfilePhoto::delete($previous);

        return back()->with('status', 'عکس پروفایل به‌روز شد.');
    }

    public function deleteAvatar(Request $request)
    {
        $user = $request->user();
        if ($user === null || $user->disabled_at !== null) {
            abort(403);
        }

        $previous = $user->avatar_path;
        $user->forceFill(['avatar_path' => null])->save();
        ProfilePhoto::delete($previous);

        return back()->with('status', 'عکس پروفایل حذف شد.');
    }
}

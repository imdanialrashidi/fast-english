<?php

namespace App\Http\Controllers;

use App\Models\PaymentRequest;
use App\Support\Entitlement;
use Illuminate\Http\Request;
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

        return Inertia::render('Account/Index', [
            'user' => [
                'name' => (string) $user->name,
                'email' => (string) $user->email,
                'preferred_level' => $user->preferred_level,
                'daily_goal_minutes' => (int) ($user->daily_goal_minutes ?? 10),
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
        ]);
    }
}

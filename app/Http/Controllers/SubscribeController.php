<?php

namespace App\Http\Controllers;

use App\Models\Plan;
use App\Support\PaymentMethods;
use App\Support\Toman;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/**
 * S5 subscribe page (scope §6, §17): the student plan list.
 *
 * Reuses the S4 learner layout, card styling, and top navigation. Each
 * active plan shows its Persian name and its integer-toman price rendered
 * with Persian digits (App\Support\Toman). Inactive plans never appear.
 * The response is private, no-store (scope §16).
 *
 * S8 sales switch (scope §25): when sales are off, the page shows
 * «در دست آماده‌سازی» with no purchase forms; creation is refused
 * server-side in PaymentRequestController as well.
 */
class SubscribeController extends Controller
{
    public function index(Request $request)
    {
        $user = $request->user();
        if ($user === null || $user->disabled_at !== null) {
            abort(403);
        }

        $salesOn = (bool) config('sales.enabled', false);

        $plans = $salesOn
            ? Plan::query()
                ->where('is_active', true)
                ->orderBy('display_order')
                ->orderBy('id')
                ->get()
            : collect();

        $paymentReady = PaymentMethods::cardCheckoutReady();

        // Public-slice Inertia transport (ADR-0002): the same plan list
        // with the same sales switch. Plan choice posts the plan ID only;
        // snapshot/ownership rules in PaymentRequestController are
        // unchanged. A placeholder destination keeps the buttons closed
        // and explains why, instead of promising a working checkout.
        return Inertia::render('Subscribe/Index', [
            'plans' => $plans->map(fn (Plan $plan) => [
                'id' => $plan->id,
                'name_fa' => (string) $plan->name_fa,
                'price_label' => Toman::format((int) $plan->price_toman),
                'duration_days' => (int) $plan->duration_days,
            ])->all(),
            'salesOn' => $salesOn,
            'paymentReady' => $paymentReady,
            'paymentNotice' => $paymentReady
                ? null
                : 'روش پرداخت هنوز پیکربندی نشده است. شمارهٔ کارت به‌زودی در همین صفحه اعلام می‌شود.',
        ]);
    }
}

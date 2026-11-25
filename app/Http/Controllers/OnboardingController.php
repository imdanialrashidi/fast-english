<?php

namespace App\Http\Controllers;

use App\Support\Entitlement;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Post-activation onboarding (owner instruction 2026-11-25).
 *
 * After a subscription becomes active the learner sees «اکانت شما فعال
 * شد», «انگلیسی را سریع یاد بگیر» and a short profile form: first name,
 * surname, and a Jalali birth date in three fields. The verified phone is
 * shown read-only. Nothing here grants access; the `subscribed` check is
 * still Entitlement's decision.
 */
class OnboardingController extends Controller
{
    public function show(Request $request): Response|RedirectResponse
    {
        $user = $request->user();
        if ($user === null || $user->disabled_at !== null) {
            abort(403);
        }

        if (! Entitlement::eligible($user)) {
            return redirect()->route('app.home');
        }

        if ($user->profile_completed_at !== null) {
            if ($user->needs_profile) {
                $user->forceFill(['needs_profile' => false])->save();
            }

            return redirect()->route('today.index');
        }

        if (! $user->needs_profile) {
            return redirect()->route('today.index');
        }

        return Inertia::render('Onboarding/Welcome', [
            'user' => [
                'name' => (string) $user->name,
                'first_name' => $user->first_name ?? (string) $user->name,
                'last_name' => $user->last_name,
                'phone' => (string) ($user->phone ?? ''),
                'birth_date_jalali' => $user->birth_date_jalali,
            ],
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $user = $request->user();
        if ($user === null || $user->disabled_at !== null) {
            abort(403);
        }

        if (! Entitlement::eligible($user)) {
            return redirect()->route('app.home');
        }

        $data = $request->validate([
            'first_name' => ['required', 'string', 'max:80'],
            'last_name' => ['required', 'string', 'max:80'],
            'birth_day' => ['required', 'integer', 'min:1', 'max:31'],
            'birth_month' => ['required', 'integer', 'min:1', 'max:12'],
            'birth_year' => ['required', 'integer', 'min:1300', 'max:1420'],
        ], [
            'first_name.required' => 'نام را وارد کنید.',
            'last_name.required' => 'نام خانوادگی را وارد کنید.',
            'birth_day.required' => 'روز تولد را انتخاب کنید.',
            'birth_month.required' => 'ماه تولد را انتخاب کنید.',
            'birth_year.required' => 'سال تولد را وارد کنید.',
            'birth_year.min' => 'سال تولد معتبر نیست.',
            'birth_year.max' => 'سال تولد معتبر نیست.',
        ]);

        $first = trim((string) $data['first_name']);
        $last = trim((string) $data['last_name']);
        $jalali = sprintf('%04d-%02d-%02d', (int) $data['birth_year'], (int) $data['birth_month'], (int) $data['birth_day']);

        $user->forceFill([
            'name' => trim($first.' '.$last),
            'first_name' => $first,
            'last_name' => $last,
            'birth_date_jalali' => $jalali,
            'profile_completed_at' => now(),
            'needs_profile' => false,
        ])->save();

        return redirect()->route('today.index')->with('status', 'اطلاعات حساب کامل شد.');
    }
}

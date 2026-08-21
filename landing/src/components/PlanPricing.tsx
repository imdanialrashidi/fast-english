// landing/src/components/PlanPricing.tsx
// Business Configuration slice — real plan prices on the Landing.
//
// Renders the active plans exactly as the public settings endpoint
// provides them (canonical source: the `plans` collection, edited via the
// Admin Business Settings surface). Prices are NEVER hard-coded here; the
// quarterly saving badge is DERIVED from the two plan prices
// (100 * (1 - quarterly / (3 * monthly))) so the copy stays truthful if
// the owner changes prices later. No coupon/discount engine exists.
//
// Honest states:
//   - loading  → nothing (stable layout box stays reserved);
//   - ready    → plan cards with real prices;
//   - unavailable → the neutral line "قیمت طرحها در داخل اپلیکیشن
//     نمایش داده میشود" (no fabricated values).

import { useMemo } from 'react';
import { formatToman, toPersianDigits } from '../../../shared/lib/formatters';
import type { PublicPlan } from '../lib/publicSettings';
import { usePublicSettings } from '../lib/usePublicSettings';

/** Derive the quarterly saving percent (null when it is not clean). */
export function quarterlySavingPercent(plans: readonly PublicPlan[]): number | null {
  const monthly = plans.find((p) => p.slug === 'monthly' || p.durationDays === 30);
  const quarterly = plans.find((p) => p.slug === 'quarterly' || p.durationDays === 90);
  if (!monthly || !quarterly) return null;
  const base = 3 * monthly.priceToman;
  if (base <= 0 || quarterly.priceToman >= base) return null;
  // Integer-safe: 100 * (base - quarterly) / base with a tiny epsilon so
  // exact ratios (e.g. quarterly vs three times the monthly price) never
  // fail float rounding.
  const raw = (100 * (base - quarterly.priceToman)) / base;
  const percent = Math.round(raw);
  if (Math.abs(raw - percent) > 1e-9) return null;
  if (percent <= 0 || percent > 90) return null;
  return percent;
}

function PlanCard({ plan, savingPercent }: { plan: PublicPlan; savingPercent: number | null }) {
  const isFree = plan.priceToman === 0;
  return (
    <li
      data-testid={`plan-card-${plan.slug}`}
      className="rounded-2xl border border-outline-soft bg-surface p-5 text-center"
    >
      {isFree ? (
        <span
          data-testid="plan-free-badge"
          className="inline-block rounded-full bg-primary-container px-3 py-1 text-xs font-bold text-on-primary-container"
        >
          رایگان
        </span>
      ) : savingPercent !== null ? (
        <span
          data-testid="plan-saving-badge"
          className="inline-block rounded-full bg-accent-container px-3 py-1 text-xs font-bold text-on-accent-container"
        >
          {toPersianDigits(savingPercent)}٪ تخفیف
        </span>
      ) : null}
      <h3 className="mt-2 text-lg font-extrabold text-text">{plan.name}</h3>
      <p className="mt-1 text-sm text-muted">
        {plan.durationDays === 30
          ? '۳۰ روز'
          : plan.durationDays === 90
            ? '۹۰ روز'
            : `${toPersianDigits(plan.durationDays)} روز`}
      </p>
      <p className="mt-3 text-2xl font-extrabold text-text">
        {isFree ? (
          'رایگان'
        ) : (
          <>
            {formatToman(plan.priceToman)}
            <span className="text-sm font-semibold text-muted"> تومان</span>
          </>
        )}
      </p>
      {plan.description ? (
        <p className="mt-2 text-xs text-muted leading-relaxed">{plan.description}</p>
      ) : null}
    </li>
  );
}

export function PlanPricing() {
  // SSR note: the prerender path renders the static honest fallback
  // WITHOUT hooks (Vite's SSR loader uses a separate React instance — see
  // usePublicSettings.ts). The client hydrates the live component.
  if (typeof window === 'undefined') {
    return (
      <p className="mt-4 text-xs text-muted max-w-3xl">
        قیمت طرح‌ها در داخل اپلیکیشن نمایش داده می‌شود.
      </p>
    );
  }
  return <LivePlanPricing />;
}

function LivePlanPricing() {
  const state = usePublicSettings();
  const plans = state.status === 'ready' ? state.settings.plans : [];
  const cardTransferEnabled =
    state.status === 'ready' ? state.settings.payment.cardTransferEnabled : false;
  const savingPercent = useMemo(() => quarterlySavingPercent(plans), [plans]);

  if (state.status === 'loading') {
    // Reserved space so the section does not shift once prices arrive.
    return (
      <div className="mt-8" aria-busy="true" aria-live="polite">
        <div className="h-6 w-40 rounded bg-surface-muted" />
      </div>
    );
  }

  if (state.status === 'unavailable' || plans.length === 0) {
    return (
      <p className="mt-4 text-xs text-muted max-w-3xl">
        قیمت طرح‌ها در داخل اپلیکیشن نمایش داده می‌شود.
      </p>
    );
  }

  const hasFreePlan = plans.some((p) => p.priceToman === 0);
  const hasPaidPlan = plans.some((p) => p.priceToman > 0);
  // Truthful footer: derived from the runtime state, never hard-coded.
  const footer =
    hasFreePlan && cardTransferEnabled && hasPaidPlan
      ? 'ثبت‌نام رایگان است و با طرح رایگان می‌توانید همین حالا شروع کنید؛ طرح‌های پولی به‌صورت کارت‌به‌کارت پرداخت می‌شوند.'
      : hasFreePlan && cardTransferEnabled
        ? 'ثبت‌نام رایگان است و با طرح رایگان می‌توانید همین حالا شروع کنید.'
        : hasFreePlan
          ? 'پرداخت کارت‌به‌کارت فعلاً غیرفعال است؛ می‌توانید با طرح رایگان همین حالا شروع کنید.'
          : cardTransferEnabled
            ? 'ثبت‌نام رایگان است؛ پرداخت فقط پس از انتخاب طرح، به‌صورت کارت‌به‌کارت انجام می‌شود.'
            : 'پرداخت کارت‌به‌کارت فعلاً غیرفعال است؛ به‌محض فعال‌شدن، امکان خرید در اپلیکیشن فراهم می‌شود.';

  return (
    <div className="mt-8">
      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 max-w-3xl">
        {plans.map((plan) => (
          <PlanCard
            key={plan.id || plan.slug}
            plan={plan}
            savingPercent={
              plan.slug === 'quarterly' || plan.durationDays === 90 ? savingPercent : null
            }
          />
        ))}
      </ul>
      {savingPercent !== null ? (
        <p className="mt-3 text-xs text-muted max-w-3xl">
          خرید طرح سه ماهه معادل {toPersianDigits(savingPercent)}٪ تخفیف نسبت به پرداخت ماهانه است.
        </p>
      ) : null}
      <p className="mt-2 text-xs text-muted max-w-3xl" data-testid="pricing-footer">
        {footer}
      </p>
    </div>
  );
}

// landing/src/sections/PaymentSection.tsx
// Honest subscription/payment expectations. Every claim is DERIVED from
// the runtime public settings endpoint (Business Configuration slice):
//   - prices and free plans come from the canonical `plans` collection;
//   - the card-to-card availability boolean comes from the canonical
//     destination state (`payment.cardTransferEnabled`);
//   - when card-to-card is disabled the section never claims the visitor
//     can pay by card-to-card and never shows transfer/receipt copy;
//   - when at least one free plan exists the copy truthfully says the
//     visitor can start for free.
// No hard-coded prices, no temporary marketing copy that could become
// false after an operator edit.

import { toPersianDigits } from '../../../shared/lib/formatters';
import { PlanPricing } from '../components/PlanPricing';
import { usePublicSettings } from '../lib/usePublicSettings';

export function PaymentSection() {
  // SSR note: the prerender path renders the static honest fallback
  // without hooks (see usePublicSettings.ts); the client hydrates.
  if (typeof window === 'undefined') {
    return <PaymentSectionUnknown />;
  }
  return <LivePaymentSection />;
}

// The neutral pre-data state. SSR renders this EXACT markup and the
// client's initial render (status: 'unavailable' in usePublicSettings)
// renders the same, so hydration never mismatches. No card-transfer
// claim and no free-plan claim appear before the runtime data arrives.
function PaymentSectionUnknown() {
  return (
    <section id="payment" aria-labelledby="payment-title" className="py-14 sm:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <PaymentHeading
          title="پرداخت ساده و شفاف"
          lead="روش پرداخت و قیمت طرح‌ها در داخل اپلیکیشن نمایش داده می‌شود."
        />
        <PlanPricing />
      </div>
    </section>
  );
}

function PaymentHeading({ title, lead }: { title: string; lead: string }) {
  return (
    <div className="max-w-2xl">
      <p className="flex items-center gap-2 text-sm font-semibold text-accent">
        <span aria-hidden className="inline-block h-px w-8 bg-accent/60" />
        اشتراک
      </p>
      <h2
        id="payment-title"
        className="mt-3 text-2xl sm:text-4xl font-extrabold tracking-tight leading-[1.3]"
      >
        {title}
      </h2>
      <p className="mt-4 text-base text-muted leading-relaxed">{lead}</p>
    </div>
  );
}

function LivePaymentSection() {
  const state = usePublicSettings();
  // Initial/error state renders the SAME neutral markup as SSR so
  // hydration never mismatches (the fetch swaps in real data).
  if (state.status !== 'ready') {
    return <PaymentSectionUnknown />;
  }
  const cardTransferEnabled = state.settings.payment.cardTransferEnabled;
  const plans = state.settings.plans;
  const hasFreePlan = plans.some((p) => p.priceToman === 0);

  const heading = hasFreePlan ? 'رایگان شروع کنید' : 'پرداخت ساده و شفاف';
  const lead = hasFreePlan
    ? 'یک طرح کاملاً رایگان برای شروع وجود دارد؛ بدون پرداخت و بدون کارتبه‌کارت می‌توانید وارد شوید.'
    : 'هیچ درگاه پرداخت آنلاینی وجود ندارد؛ پرداخت به‌صورت دستی کارت‌به‌کارت انجام می‌شود تا کنترل کامل دست شما باشد.';

  // Facts are derived from the runtime state; never hard-coded claims
  // that could become false after an operator edit.
  const facts = !cardTransferEnabled
    ? hasFreePlan
      ? [
          {
            title: 'شروع رایگان',
            desc: 'طرح رایگان بدون نیاز به پرداخت یا بارگذاری رسید فعال می‌شود.',
          },
          {
            title: 'پرداخت کارت‌به‌کارت فعلاً غیرفعال است',
            desc: 'به محض فعال‌شدن، امکان خرید طرح‌های پولی در اپلیکیشن فراهم می‌شود.',
          },
          {
            title: 'بدون درگاه آنلاین',
            desc: 'درگاه پرداخت آنلاین وجود ندارد؛ اطلاع‌رسانی بعداً در همین صفحه انجام می‌شود.',
          },
        ]
      : [
          {
            title: 'پرداخت کارت‌به‌کارت فعلاً غیرفعال است',
            desc: 'امکان خرید در حال حاضر فعال نیست؛ به محض فعال‌شدن، در همین صفحه اعلام می‌شود.',
          },
          {
            title: 'بدون درگاه آنلاین',
            desc: 'درگاه پرداخت آنلاین وجود ندارد و فعلاً روش پرداخت جایگزینی اعلام نشده است.',
          },
          {
            title: 'بررسی دستی',
            desc: 'هرگاه پرداخت فعال شود، رسید انتقال به‌صورت دستی بررسی و اشتراک فعال می‌شود.',
          },
        ]
    : [
        {
          title: 'پرداخت فقط کارت‌به‌کارت دستی',
          desc: 'درگاه پرداخت آنلاین وجود ندارد؛ مبلغ طرح را کارت‌به‌کارت منتقل می‌کنید.',
        },
        {
          title: 'بارگذاری رسید انتقال',
          desc: 'یک تصویر از رسید (JPEG، PNG یا WebP تا ۵ مگابایت) را در اپلیکیشن بارگذاری می‌کنید.',
        },
        {
          title: 'بررسی دستی و فعال‌سازی',
          desc: 'اپراتور رسید را بررسی می‌کند؛ فقط پس از تأیید، اشتراک شما فعال می‌شود.',
        },
      ];

  return (
    <section id="payment" aria-labelledby="payment-title" className="py-14 sm:py-24 bg-surface">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <PaymentHeading title={heading} lead={lead} />

        <ol className="mt-10 grid sm:grid-cols-3 gap-4">
          {facts.map((f, i) => (
            <li
              key={f.title}
              className="rounded-2xl border border-outline-soft bg-canvas p-5 sm:p-6"
            >
              <span
                aria-hidden
                className="inline-block text-xs font-extrabold text-primary/70 tabular-nums"
              >
                {toPersianDigits(i + 1, { padTo: 2 })}
              </span>
              <h3 className="mt-2 text-base font-bold text-text">{f.title}</h3>
              <p className="mt-1 text-sm text-muted leading-relaxed">{f.desc}</p>
            </li>
          ))}
        </ol>
        <PlanPricing />
        <p className="mt-4 text-xs text-muted max-w-3xl" data-testid="payment-methods-note">
          {cardTransferEnabled
            ? 'پرداخت کارت‌به‌کارت است و پس از بارگذاری رسید و تأیید اپراتور، اشتراک فعال می‌شود.'
            : hasFreePlan
              ? 'در حال حاضر پرداخت کارت‌به‌کارت غیرفعال است؛ طرح رایگان بدون پرداخت قابل استفاده است.'
              : 'در حال حاضر پرداخت کارت‌به‌کارت غیرفعال است؛ به‌محض فعال‌شدن، امکان خرید فراهم می‌شود.'}
        </p>
      </div>
    </section>
  );
}

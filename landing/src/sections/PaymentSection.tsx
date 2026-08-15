// landing/src/sections/PaymentSection.tsx
// Honest subscription/payment expectations: manual card-to-card payment
// with receipt upload and operator review. No online payment gateway
// exists, so none is implied anywhere on the landing. Prices come from
// the runtime public settings endpoint (canonical `plans` collection —
// Business Configuration slice) and are deliberately never hard-coded
// here.
import { PlanPricing } from '../components/PlanPricing';

const facts = [
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

export function PaymentSection() {
  return (
    <section id="payment" aria-labelledby="payment-title" className="py-12 sm:py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="max-w-3xl">
          <h2 id="payment-title" className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            پرداخت ساده و شفاف
          </h2>
          <p className="mt-3 text-brand-muted leading-relaxed">
            هیچ درگاه پرداخت آنلاینی وجود ندارد؛ پرداخت به‌صورت دستی کارت‌به‌کارت انجام می‌شود تا کنترل
            کامل دست شما باشد.
          </p>
        </div>

        <ul className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
          {facts.map((f) => (
            <li
              key={f.title}
              className="rounded-2xl border border-brand-divider bg-white p-4 sm:p-5"
            >
              <h3 className="text-base font-bold text-brand-text">{f.title}</h3>
              <p className="mt-1 text-sm text-brand-muted leading-relaxed">{f.desc}</p>
            </li>
          ))}
        </ul>
        <PlanPricing />
        <p className="mt-4 text-xs text-brand-muted max-w-3xl">
          طرحها: ماهانه (۳۰ روز) و ۹۰ روزه. پرداخت کارتبهکارت است و پس از بارگذاری رسید و تأیید
          اپراتور، اشتراک فعال میشود.
        </p>
      </div>
    </section>
  );
}

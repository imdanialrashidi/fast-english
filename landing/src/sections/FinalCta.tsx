import { AppCta } from '../components/AppCta';

export function FinalCta() {
  return (
    <section aria-labelledby="final-cta-title" className="py-14 sm:py-24 bg-surface">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div
          className="rounded-[24px] p-8 sm:p-14 text-center"
          style={{ background: 'var(--color-midnight)' }}
        >
          <h2
            id="final-cta-title"
            className="text-2xl sm:text-4xl font-extrabold tracking-tight leading-[1.3] text-ice"
          >
            اولین اپیزودت منتظر توست
          </h2>
          <p className="mt-4 text-ice-muted leading-relaxed max-w-xl mx-auto">
            ثبت‌نام رایگان است؛ پرداخت فقط پس از انتخاب طرح انجام می‌شود. نمونهٔ اپیزود را ببین یا
            مستقیم وارد وب‌اپ شو.
          </p>
          <div className="mt-7 flex flex-col sm:flex-row gap-3 justify-center">
            <AppCta
              place="final"
              className="inline-flex items-center justify-center rounded-[10px] bg-primary px-6 py-3 text-sm font-semibold text-on-primary hover:bg-primary-hover min-h-12 shadow-interactive"
            >
              ورود به وب‌اپ
            </AppCta>
            <a
              href="/sample"
              className="inline-flex items-center justify-center rounded-[10px] border border-ice-soft bg-transparent px-6 py-3 text-sm font-semibold text-ice hover:bg-ice-soft min-h-12"
            >
              دیدن نمونهٔ اپیزود
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

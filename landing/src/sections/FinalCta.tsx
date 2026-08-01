import { webAppUrl } from '../lib/siteConfig';

export function FinalCta() {
  return (
    <section aria-labelledby="final-cta-title" className="py-12 sm:py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div
          className="rounded-3xl p-6 sm:p-10 text-center"
          style={{ background: 'var(--color-brand-midnight)', color: '#fff' }}
        >
          <h2 id="final-cta-title" className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            از همین امروز شروع کن
          </h2>
          <p className="mt-3 text-white/75 leading-relaxed max-w-2xl mx-auto">
            ثبت‌نام رایگان است و پرداخت پس از انتخاب طرح انجام می‌شود. نمونهٔ درس را ببینید یا مستقیماً
            وارد وب‌اپ شوید.
          </p>
          <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
            <a
              href={webAppUrl}
              rel="noopener noreferrer"
              target="_blank"
              className="inline-flex items-center justify-center rounded-xl bg-brand-primary px-5 py-3 text-sm font-semibold text-white hover:bg-brand-primary-dark min-h-12"
            >
              ورود به وب‌اپ
            </a>
            <a
              href="/sample"
              className="inline-flex items-center justify-center rounded-xl border border-white/15 bg-white/5 px-5 py-3 text-sm font-semibold text-white hover:bg-white/10 min-h-12"
            >
              دیدن نمونهٔ درس
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

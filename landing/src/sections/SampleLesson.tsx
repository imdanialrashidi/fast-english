import {
  SAMPLE_LEVEL,
  SAMPLE_PARAGRAPHS_EN,
  SAMPLE_TITLE_EN,
  SAMPLE_TITLE_FA,
} from '../content/sampleContent';

export function SampleLesson() {
  return (
    <section id="sample" aria-labelledby="sample-title" className="py-12 sm:py-20 bg-white">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="max-w-3xl">
          <h2 id="sample-title" className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            نمونهٔ یک درس
          </h2>
          <p className="mt-3 text-brand-muted leading-relaxed">
            در هر درس یک موضوع کوتاه، متن سادهٔ انگلیسی و صوت همان متن قرار دارد. اینجا یک نمونه از
            سطح B1 را می‌بینید.
          </p>
        </div>

        <div className="mt-8 grid md:grid-cols-12 gap-4 sm:gap-6">
          <article
            className="md:col-span-7 rounded-2xl border border-brand-divider p-5 sm:p-6"
            lang="en"
            dir="ltr"
          >
            <header className="mb-4">
              <span
                className="inline-flex items-center justify-center rounded-md px-2 py-0.5 text-xs font-bold"
                style={{ background: 'var(--color-cefr-b1-bg)', color: 'var(--color-cefr-b1-fg)' }}
              >
                {SAMPLE_LEVEL}
              </span>
              <h3 className="mt-3 text-xl sm:text-2xl font-bold text-brand-text">
                {SAMPLE_TITLE_EN}
              </h3>
              <p className="text-sm text-brand-muted mt-1">{SAMPLE_TITLE_FA}</p>
            </header>
            <p className="text-brand-text leading-loose">{SAMPLE_PARAGRAPHS_EN[0]}</p>
            <p className="mt-3 text-brand-text leading-loose">{SAMPLE_PARAGRAPHS_EN[1]}</p>
          </article>

          <aside className="md:col-span-5 rounded-2xl border border-brand-divider p-5 sm:p-6 bg-brand-surface">
            <h3 className="text-base font-bold">چه چیزی در یک درس هست</h3>
            <ul className="mt-3 space-y-2 text-sm text-brand-text">
              <li className="flex gap-2">
                <span aria-hidden className="text-brand-primary">
                  ▸
                </span>
                <span>متن کوتاه انگلیسی در سطح مشخص</span>
              </li>
              <li className="flex gap-2">
                <span aria-hidden className="text-brand-primary">
                  ▸
                </span>
                <span>صوت همان متن برای تمرین شنیدن</span>
              </li>
              <li className="flex gap-2">
                <span aria-hidden className="text-brand-primary">
                  ▸
                </span>
                <span>واژه‌های کلیدی با توضیح فارسی</span>
              </li>
              <li className="flex gap-2">
                <span aria-hidden className="text-brand-primary">
                  ▸
                </span>
                <span>ذخیرهٔ پیشرفت برای ادامهٔ بعدی</span>
              </li>
            </ul>
            <p className="mt-4 text-xs text-brand-muted">
              محتوای واقعی پس از فعال‌سازی اشتراک در اپلیکیشن در دسترس قرار می‌گیرد.
            </p>
            <a
              href="/sample"
              className="mt-4 inline-flex items-center justify-center rounded-xl bg-brand-primary px-5 py-3 text-sm font-semibold text-white hover:bg-brand-primary-dark min-h-12"
            >
              مشاهدهٔ صفحهٔ نمونهٔ درس
            </a>
          </aside>
        </div>
      </div>
    </section>
  );
}

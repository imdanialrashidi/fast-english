import { plateFor } from '../components/LevelChip';
import {
  SAMPLE_LEVEL,
  SAMPLE_PARAGRAPHS_EN,
  SAMPLE_TITLE_EN,
  SAMPLE_TITLE_FA,
} from '../content/sampleContent';

export function SampleLesson() {
  const plate = plateFor(SAMPLE_LEVEL);
  return (
    <section id="sample" aria-labelledby="sample-title" className="py-14 sm:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="max-w-2xl">
          <p className="flex items-center gap-2 text-sm font-semibold text-accent">
            <span aria-hidden className="inline-block h-px w-8 bg-accent/60" />
            یک اپیزود واقعی
          </p>
          <h2
            id="sample-title"
            className="mt-3 text-2xl sm:text-4xl font-extrabold tracking-tight leading-[1.3]"
          >
            همین حالا یک اپیزود را ببین
          </h2>
          <p className="mt-4 text-base text-muted leading-relaxed">
            این اپیزودِ نمونه همان چیزی است که در اپلیکیشن می‌بینی — متن واقعی، سطح B1.
          </p>
        </div>

        <div className="mt-10 grid lg:grid-cols-12 gap-6">
          <article
            className="lg:col-span-7 rounded-2xl border border-outline-soft bg-surface p-6 sm:p-8"
            lang="en"
            dir="ltr"
          >
            <header className="mb-5 border-b border-outline-soft pb-4">
              <span
                className="inline-flex items-center justify-center rounded-lg px-2 py-0.5 text-xs font-bold"
                style={{ background: plate.bg, color: plate.fg }}
              >
                {SAMPLE_LEVEL}
              </span>
              <h3 className="mt-3 text-xl sm:text-2xl font-bold text-text">{SAMPLE_TITLE_EN}</h3>
              <p className="text-sm text-muted mt-1" lang="fa" dir="rtl">
                {SAMPLE_TITLE_FA}
              </p>
            </header>
            <p className="text-text leading-loose">{SAMPLE_PARAGRAPHS_EN[0]}</p>
            <p className="mt-3 text-text leading-loose">{SAMPLE_PARAGRAPHS_EN[1]}</p>
            {/* Deck strip: the same listening language as the app. */}
            <div className="mt-6 flex items-center gap-3 rounded-xl bg-surface-strong/70 px-4 py-3">
              <span
                className="grid place-items-center rounded-full shrink-0 text-on-primary"
                style={{ width: 44, height: 44, background: 'var(--color-primary)' }}
                aria-hidden
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <title>پخش</title>
                  <path d="M8 5.5v13l11-6.5-11-6.5z" />
                </svg>
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-text">شروع گوش‌دادن</span>
                  <span className="text-muted" dir="ltr">
                    ۰:۰۰ · ۱۲:۰۰
                  </span>
                </div>
                <div className="mt-2 h-1.5 rounded-full bg-surface-strong">
                  <div className="h-1.5 rounded-full w-0" />
                </div>
              </div>
            </div>
          </article>

          <aside className="lg:col-span-5 rounded-2xl bg-midnight p-6 sm:p-8">
            <h3 className="text-lg font-bold text-ice">در هر اپیزود چه چیزی هست</h3>
            <ul className="mt-4 space-y-3 text-sm text-ice leading-relaxed">
              <li className="flex gap-3">
                <span aria-hidden className="text-accent-container shrink-0">
                  ✓
                </span>
                <span>متن کوتاه انگلیسی در سطح مشخص</span>
              </li>
              <li className="flex gap-3">
                <span aria-hidden className="text-accent-container shrink-0">
                  ✓
                </span>
                <span>صوت همان متن برای تمرین شنیدن</span>
              </li>
              <li className="flex gap-3">
                <span aria-hidden className="text-accent-container shrink-0">
                  ✓
                </span>
                <span>واژه‌های کلیدی با معنی فارسی و تلفظ</span>
              </li>
              <li className="flex gap-3">
                <span aria-hidden className="text-accent-container shrink-0">
                  ✓
                </span>
                <span>ذخیرهٔ پیشرفت برای ادامهٔ بعدی</span>
              </li>
            </ul>
            <p className="mt-5 text-xs text-ice-muted leading-relaxed">
              محتوای واقعی پس از فعال‌سازی اشتراک در اپلیکیشن در دسترس قرار می‌گیرد؛ این صفحه فقط
              نمونه است.
            </p>
            <a
              href="/sample"
              className="mt-5 inline-flex items-center justify-center rounded-[10px] bg-primary px-5 py-3 text-sm font-semibold text-on-primary hover:bg-primary-hover min-h-12"
            >
              مشاهدهٔ صفحهٔ نمونهٔ اپیزود
            </a>
          </aside>
        </div>
      </div>
    </section>
  );
}

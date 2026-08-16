import { AppCta } from '../components/AppCta';
import { PageIntro } from '../components/PageIntro';
import {
  SAMPLE_LEVEL,
  SAMPLE_PARAGRAPHS_EN,
  SAMPLE_TITLE_EN,
  SAMPLE_TITLE_FA,
} from '../content/sampleContent';
import { SITE_NAME } from '../content/siteContent';
import { SiteLayout } from '../layouts/SiteLayout';
import { publicSampleUrl } from '../lib/siteConfig';

export function SamplePage() {
  return (
    <SiteLayout>
      <PageIntro
        title="نمونهٔ درس"
        lead={`یک نمونهٔ درس رایگان از ${SITE_NAME}: متن کوتاه انگلیسی در سطح B1 همراه با صوت همان متن. بدون نیاز به ثبت‌نام.`}
      />
      <div className="mx-auto max-w-6xl px-4 sm:px-6 pb-12 sm:pb-20 space-y-4">
        <article
          className="rounded-2xl border border-outline-soft bg-surface p-5 sm:p-6"
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
            <h2 className="mt-3 text-xl sm:text-2xl font-bold text-text">{SAMPLE_TITLE_EN}</h2>
            <p className="text-sm text-muted mt-1" lang="fa" dir="rtl">
              {SAMPLE_TITLE_FA}
            </p>
          </header>
          {SAMPLE_PARAGRAPHS_EN.map((paragraph, i) => (
            <p
              key={i}
              className={i > 0 ? 'mt-3 text-text leading-loose' : 'text-text leading-loose'}
            >
              {paragraph}
            </p>
          ))}
        </article>

        <section
          aria-labelledby="sample-play"
          className="rounded-2xl border border-outline-soft bg-surface-muted p-5 sm:p-6"
        >
          <h2 id="sample-play" className="text-lg font-extrabold">
            شنیدن صوت و نمونهٔ زنده
          </h2>
          <p className="mt-2 text-sm text-muted leading-relaxed">
            پخش صوت و نسخهٔ زندهٔ همین نمونه درس در صفحهٔ نمونهٔ وب‌اپ در دسترس است:
          </p>
          <div className="mt-4 flex flex-col sm:flex-row gap-3">
            <a
              href={publicSampleUrl}
              rel="noopener noreferrer"
              target="_blank"
              className="inline-flex items-center justify-center rounded-[10px] bg-primary px-5 py-3 text-sm font-semibold text-on-primary hover:bg-primary-hover min-h-12"
            >
              باز کردن نمونهٔ زنده و صوت
            </a>
            <AppCta
              place="sample"
              className="inline-flex items-center justify-center rounded-[10px] border border-outline-soft bg-surface px-5 py-3 text-sm font-semibold text-text hover:bg-surface-strong min-h-12"
            >
              ورود به وب‌اپ
            </AppCta>
          </div>
          <p className="mt-4 text-xs text-muted">
            اگر نمونهٔ زنده در دسترس نباشد، همین صفحه متن نمونه را نمایش می‌دهد؛ محتوای کامل پس از
            فعال‌سازی اشتراک در اپلیکیشن باز می‌شود.
          </p>
        </section>
      </div>
    </SiteLayout>
  );
}

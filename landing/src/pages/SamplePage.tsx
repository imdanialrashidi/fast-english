import { PageIntro } from '../components/PageIntro';
import { SITE_NAME } from '../content/siteContent';
import { SiteLayout } from '../layouts/SiteLayout';
import { publicSampleUrl, webAppUrl } from '../lib/siteConfig';

export function SamplePage() {
  return (
    <SiteLayout>
      <PageIntro
        title="نمونهٔ درس"
        lead={`یک نمونهٔ درس رایگان از ${SITE_NAME}: متن کوتاه انگلیسی در سطح B1 همراه با صوت همان متن. بدون نیاز به ثبت‌نام.`}
      />
      <div className="mx-auto max-w-6xl px-4 sm:px-6 pb-12 sm:pb-20 space-y-4">
        <article
          className="rounded-2xl border border-brand-divider bg-white p-5 sm:p-6"
          lang="en"
          dir="ltr"
        >
          <header className="mb-4">
            <span
              className="inline-flex items-center justify-center rounded-md px-2 py-0.5 text-xs font-bold"
              style={{ background: 'var(--color-cefr-b1-bg)', color: 'var(--color-cefr-b1-fg)' }}
            >
              B1
            </span>
            <h2 className="mt-3 text-xl sm:text-2xl font-bold text-brand-text">
              A Typical Workday
            </h2>
            <p className="text-sm text-brand-muted mt-1" lang="fa" dir="rtl">
              یک روز کاری معمولی
            </p>
          </header>
          <p className="text-brand-text leading-loose">
            Sara starts her day at half past seven. She drinks a cup of tea, checks her email, and
            leaves the house at a quarter to nine. Her office is in the city centre, so she takes
            the metro every morning.
          </p>
          <p className="mt-3 text-brand-text leading-loose">
            In the evening, Sara spends an hour with her English podcast. She listens to one lesson,
            repeats a few sentences, and then writes two short paragraphs in her notebook.
          </p>
        </article>

        <section
          aria-labelledby="sample-play"
          className="rounded-2xl border border-brand-divider bg-brand-surface p-5 sm:p-6"
        >
          <h2 id="sample-play" className="text-lg font-extrabold">
            شنیدن صوت و نمونهٔ زنده
          </h2>
          <p className="mt-2 text-sm text-brand-muted leading-relaxed">
            پخش صوت و نسخهٔ زندهٔ همین نمونه درس در صفحهٔ نمونهٔ وب‌اپ در دسترس است:
          </p>
          <div className="mt-4 flex flex-col sm:flex-row gap-3">
            <a
              href={publicSampleUrl}
              rel="noopener noreferrer"
              target="_blank"
              className="inline-flex items-center justify-center rounded-xl bg-brand-primary px-5 py-3 text-sm font-semibold text-white hover:bg-brand-primary-dark min-h-12"
            >
              باز کردن نمونهٔ زنده و صوت
            </a>
            <a
              href={webAppUrl}
              rel="noopener noreferrer"
              target="_blank"
              className="inline-flex items-center justify-center rounded-xl border border-brand-divider bg-white px-5 py-3 text-sm font-semibold text-brand-text hover:bg-brand-surface min-h-12"
            >
              ورود به وب‌اپ
            </a>
          </div>
          <p className="mt-4 text-xs text-brand-muted">
            اگر نمونهٔ زنده در دسترس نباشد، همین صفحه متن نمونه را نمایش می‌دهد؛ محتوای کامل پس از
            فعال‌سازی اشتراک در اپلیکیشن باز می‌شود.
          </p>
        </section>
      </div>
    </SiteLayout>
  );
}

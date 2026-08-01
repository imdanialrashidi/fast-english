import { PageIntro } from '../components/PageIntro';
import { SiteLayout } from '../layouts/SiteLayout';
import { supportUrl, webAppUrl } from '../lib/siteConfig';

export function ContactPage() {
  const hasSupport = supportUrl !== null;
  return (
    <SiteLayout>
      <PageIntro
        title="تماس و پشتیبانی"
        lead="برای پرسش دربارهٔ حساب، پرداخت یا دسترسی، از کانال‌های زیر استفاده کنید."
      />
      <div className="mx-auto max-w-3xl px-4 sm:px-6 pb-12 sm:pb-20 space-y-4">
        {hasSupport ? (
          <section
            aria-labelledby="contact-support"
            className="rounded-2xl border border-brand-divider bg-white p-5 sm:p-6"
          >
            <h2 id="contact-support" className="text-xl font-extrabold">
              کانال پشتیبانی
            </h2>
            <p className="mt-3 text-sm text-brand-muted leading-relaxed">
              سؤال‌های خود را دربارهٔ ثبت‌نام، پرداخت، تعیین سطح و دسترسی به درس‌ها از این کانال بپرسید.
            </p>
            <a
              href={supportUrl ?? undefined}
              rel="noopener noreferrer"
              target="_blank"
              className="mt-4 inline-flex items-center justify-center rounded-xl bg-brand-primary px-5 py-3 text-sm font-semibold text-white hover:bg-brand-primary-dark min-h-12"
            >
              ارتباط با پشتیبانی
            </a>
          </section>
        ) : (
          <section
            aria-labelledby="contact-support"
            className="rounded-2xl border border-brand-divider bg-white p-5 sm:p-6"
          >
            <h2 id="contact-support" className="text-xl font-extrabold">
              کانال پشتیبانی
            </h2>
            <p className="mt-3 text-sm text-brand-muted leading-relaxed">
              کانال پشتیبانی هنوز اعلام نشده است و به‌زودی در همین صفحه منتشر می‌شود. تا آن زمان
              می‌توانید از راهنمای صفحهٔ «چگونه کار می‌کند» و «نصب» استفاده کنید.
            </p>
            <span className="mt-4 inline-flex items-center justify-center rounded-xl border border-brand-divider bg-white px-5 py-3 text-sm font-semibold text-brand-muted min-h-12">
              کانال پشتیبانی — به‌زودی
            </span>
          </section>
        )}
        <section
          aria-labelledby="contact-app"
          className="rounded-2xl border border-brand-divider bg-white p-5 sm:p-6"
        >
          <h2 id="contact-app" className="text-xl font-extrabold">
            ورود به اپلیکیشن
          </h2>
          <p className="mt-3 text-sm text-brand-muted leading-relaxed">
            ثبت‌نام، پرداخت، آزمون تعیین سطح و درس‌ها در داخل اپلیکیشن انجام می‌شوند.
          </p>
          <a
            href={webAppUrl}
            rel="noopener noreferrer"
            target="_blank"
            className="mt-4 inline-flex items-center justify-center rounded-xl bg-brand-primary px-5 py-3 text-sm font-semibold text-white hover:bg-brand-primary-dark min-h-12"
          >
            باز کردن وب‌اپ
          </a>
        </section>
      </div>
    </SiteLayout>
  );
}

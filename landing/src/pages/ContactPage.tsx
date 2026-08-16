import { AppCta } from '../components/AppCta';
import { PageIntro } from '../components/PageIntro';
import { SupportContact } from '../components/SupportContact';
import { SiteLayout } from '../layouts/SiteLayout';

export function ContactPage() {
  return (
    <SiteLayout>
      <PageIntro
        title="تماس و پشتیبانی"
        lead="برای پرسش دربارهٔ حساب، پرداخت یا دسترسی، از کانال‌های زیر استفاده کنید."
      />
      <div className="mx-auto max-w-3xl px-4 sm:px-6 pb-12 sm:pb-20 space-y-4">
        <section
          aria-labelledby="contact-support"
          className="rounded-2xl border border-outline-soft bg-surface p-5 sm:p-6"
        >
          <h2 id="contact-support" className="text-xl font-extrabold">
            کانال پشتیبانی
          </h2>
          <p className="mt-3 text-sm text-muted leading-relaxed">
            سؤال‌های خود را دربارهٔ ثبت‌نام، پرداخت، تعیین سطح و دسترسی به درس‌ها از این کانال بپرسید.
          </p>
          <SupportContact />
          <p className="mt-3 text-xs text-muted">
            تا زمان اعلام کانال، می‌توانید از راهنمای صفحهٔ «چگونه کار می‌کند» و «نصب» استفاده کنید.
          </p>
        </section>
        <section
          aria-labelledby="contact-app"
          className="rounded-2xl border border-outline-soft bg-surface p-5 sm:p-6"
        >
          <h2 id="contact-app" className="text-xl font-extrabold">
            ورود به اپلیکیشن
          </h2>
          <p className="mt-3 text-sm text-muted leading-relaxed">
            ثبت‌نام، پرداخت، آزمون تعیین سطح و درس‌ها در داخل اپلیکیشن انجام می‌شوند.
          </p>
          <AppCta
            place="contact"
            className="mt-4 inline-flex items-center justify-center rounded-[10px] bg-primary px-5 py-3 text-sm font-semibold text-on-primary hover:bg-primary-hover min-h-12"
          >
            باز کردن وب‌اپ
          </AppCta>
        </section>
      </div>
    </SiteLayout>
  );
}

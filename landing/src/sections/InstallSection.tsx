import { ApkButton } from '../components/ApkButton';
import { AppCta } from '../components/AppCta';

export function InstallSection() {
  return (
    <section id="install" aria-labelledby="install-title" className="py-14 sm:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="rounded-[24px] p-6 sm:p-12" style={{ background: 'var(--color-midnight)' }}>
          <div className="max-w-2xl">
            <p className="text-sm font-semibold text-accent-container">دسترسی</p>
            <h2
              id="install-title"
              className="mt-3 text-2xl sm:text-4xl font-extrabold tracking-tight leading-[1.3] text-ice"
            >
              یادگیری را در اپلیکیشن ادامه دهید
            </h2>
            <p className="mt-4 text-ice-muted leading-relaxed">
              ثبت‌نام، پرداخت، آزمون تعیین سطح و درس‌ها در داخل اپلیکیشن انجام می‌شوند. این صفحه فقط
              محصول را معرفی می‌کند.
            </p>
          </div>
          <div className="mt-8 grid lg:grid-cols-5 gap-3 sm:gap-4">
            <div
              className="lg:col-span-3 rounded-2xl p-5 sm:p-6 flex flex-col"
              style={{ background: 'var(--color-midnight-surface)' }}
            >
              <span className="block text-xs font-semibold text-ice-muted mb-2">
                وب‌اپ — پیشنهاد ما برای شروعِ فوری
              </span>
              <p className="text-sm text-ice leading-relaxed">
                بدون نصب، همین حالا در مرورگر موبایل یا دسکتاپ. همهٔ مراحل — ثبت‌نام، پرداخت، تعیین
                سطح، درس‌ها — همان‌جا انجام می‌شود.
              </p>
              <AppCta
                place="install"
                className="mt-4 inline-flex items-center justify-center rounded-[10px] bg-primary px-5 py-3 text-sm font-semibold text-on-primary hover:bg-primary-hover min-h-12 shadow-interactive"
              >
                باز کردن وب‌اپ — شروع فوری
              </AppCta>
              <p className="mt-3 text-xs text-ice-muted">بدون نیاز به دانلود؛ همیشه در دسترس.</p>
            </div>
            <div className="lg:col-span-2 grid grid-rows-2 gap-3">
              <div
                className="rounded-2xl p-5"
                style={{ background: 'var(--color-midnight-surface)' }}
              >
                <span className="block text-xs font-semibold text-ice-muted mb-1">اندروید</span>
                <p className="text-xs text-ice leading-relaxed">
                  دانلود مستقیم APK فقط از همین وب‌سایت رسمی — نسخهٔ امضاشده.
                </p>
                <span className="mt-3 inline-block">
                  <ApkButton dark />
                </span>
              </div>
              <div
                className="rounded-2xl p-5"
                style={{ background: 'var(--color-midnight-surface)' }}
              >
                <span className="block text-xs font-semibold text-ice-muted mb-1">
                  iPhone / iPad
                </span>
                <p className="text-xs text-ice leading-relaxed">
                  نصب وب‌اپ از سافاری روی صفحهٔ اصلی؛ بدون نسخهٔ فروشگاه اپل.
                </p>
                <a
                  href="/install#ios"
                  className="mt-3 inline-flex items-center justify-center rounded-[10px] bg-ice-soft px-4 py-2 text-xs font-semibold text-ice hover:bg-ice-hover min-h-10"
                >
                  نصب روی iPhone / iPad
                </a>
              </div>
            </div>
          </div>
          <p className="mt-5 text-xs text-ice-muted leading-relaxed">
            فایل اندروید فقط از مسیر{' '}
            <span className="font-mono" dir="ltr">
              fastenglishpodcast.com/releases/
            </span>{' '}
            ارائه می‌شود. راهنمای کاملِ نصب و مجوزِ مرورگر در صفحهٔ «نصب».
          </p>
          <a
            href="/install"
            className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-ice hover:text-accent-container focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus rounded min-h-11 px-1"
          >
            مشاهدهٔ راهنمای کامل نصب <span aria-hidden>←</span>
          </a>
        </div>
      </div>
    </section>
  );
}

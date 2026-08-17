import { ApkButton } from '../components/ApkButton';
import { AppCta } from '../components/AppCta';
import { apkAvailable, apkState } from '../lib/siteConfig';

export function InstallSection() {
  const hasApk = apkAvailable(apkState);
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
          <div className="mt-8 grid sm:grid-cols-3 gap-3 sm:gap-4">
            <div
              className="rounded-2xl p-5 sm:p-6"
              style={{ background: 'var(--color-midnight-surface)' }}
            >
              <span className="block text-xs font-semibold text-ice-muted mb-2">وب‌اپ</span>
              <p className="text-sm text-ice leading-relaxed">
                بدون نصب، در مرورگر موبایل یا دسکتاپ. همین حالا وارد شوید.
              </p>
              <AppCta
                place="install"
                className="mt-4 inline-flex items-center justify-center rounded-[10px] bg-primary px-4 py-2 text-sm font-semibold text-on-primary hover:bg-primary-hover min-h-11"
              >
                باز کردن وب‌اپ
              </AppCta>
            </div>
            <div
              className="rounded-2xl p-5 sm:p-6"
              style={{ background: 'var(--color-midnight-surface)' }}
            >
              <span className="block text-xs font-semibold text-ice-muted mb-2">iPhone / iPad</span>
              <p className="text-sm text-ice leading-relaxed">
                نصب وب‌اپ از سافاری روی صفحهٔ اصلی؛ بدون نسخهٔ فروشگاه اپل.
              </p>
              <a
                href="/install#ios"
                className="mt-4 inline-flex items-center justify-center rounded-[10px] bg-ice-soft px-4 py-2 text-sm font-semibold text-ice hover:bg-ice-hover min-h-11"
              >
                نصب روی iPhone / iPad
              </a>
            </div>
            <div
              className="rounded-2xl p-5 sm:p-6"
              style={{ background: 'var(--color-midnight-surface)' }}
            >
              <span className="block text-xs font-semibold text-ice-muted mb-2">اندروید</span>
              {hasApk ? (
                <p className="text-sm text-ice leading-relaxed">
                  دانلود مستقیم فایل APK فقط از همین وب‌سایت؛ نسخهٔ رسمی امضا شده.
                </p>
              ) : (
                <p className="text-sm text-ice leading-relaxed">
                  نسخهٔ اندروید هنوز منتشر نشده است؛ به‌زودی از همین وب‌سایت ارائه می‌شود.
                </p>
              )}
              <span className="mt-4 inline-block">
                <ApkButton dark />
              </span>
            </div>
          </div>
          <p className="mt-5 text-xs text-ice-muted">
            راهنمای کامل نصب، مجوز نصب از مرورگر و به‌روزرسانی در صفحهٔ «نصب».
          </p>
          <a
            href="/install"
            className="mt-4 inline-flex items-center justify-center rounded-[10px] border border-ice-soft px-4 py-2 text-sm font-semibold text-ice hover:bg-ice-soft min-h-11"
          >
            مشاهدهٔ راهنمای نصب
          </a>
        </div>
      </div>
    </section>
  );
}

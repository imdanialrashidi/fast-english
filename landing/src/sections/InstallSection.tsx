import { ApkButton } from '../components/ApkButton';
import { webAppUrl } from '../lib/siteConfig';

export function InstallSection() {
  return (
    <section id="install" aria-labelledby="install-title" className="py-12 sm:py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div
          className="rounded-3xl p-6 sm:p-10"
          style={{ background: 'var(--color-brand-midnight)', color: '#fff' }}
        >
          <h2 id="install-title" className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            یادگیری را در اپلیکیشن ادامه دهید
          </h2>
          <p className="mt-3 text-white/75 leading-relaxed max-w-2xl">
            ثبت‌نام، پرداخت، آزمون تعیین سطح و درس‌ها در داخل اپلیکیشن انجام می‌شوند. این صفحه فقط
            محصول را معرفی می‌کند.
          </p>
          <div className="mt-6 grid sm:grid-cols-2 gap-3 sm:gap-4">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 sm:p-5">
              <span className="block text-xs font-semibold text-white/60 mb-2">وب‌اپ</span>
              <p className="text-sm text-white/85 leading-relaxed">
                بدون نصب، در مرورگر موبایل یا دسکتاپ. همین حالا وارد شوید.
              </p>
              <a
                href={webAppUrl}
                rel="noopener noreferrer"
                target="_blank"
                className="mt-3 inline-flex items-center justify-center rounded-xl bg-brand-primary px-4 py-2 text-sm font-semibold text-white hover:bg-brand-primary-dark min-h-11"
              >
                باز کردن وب‌اپ
              </a>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 sm:p-5">
              <span className="block text-xs font-semibold text-white/60 mb-2">اندروید</span>
              <p className="text-sm text-white/85 leading-relaxed">
                دانلود مستقیم فایل APK فقط از همین وب‌سایت؛ نسخهٔ رسمی امضا شده.
              </p>
              <span className="mt-3 inline-block">
                <ApkButton />
              </span>
            </div>
          </div>
          <p className="mt-4 text-xs text-white/50">
            راهنمای کامل نصب، مجوز نصب از مرورگر و به‌روزرسانی در صفحهٔ «نصب».
          </p>
          <a
            href="/install"
            className="mt-3 inline-flex items-center justify-center rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10 min-h-11"
          >
            مشاهدهٔ راهنمای نصب
          </a>
        </div>
      </div>
    </section>
  );
}

export function CtaSection() {
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
          <div className="mt-6 grid sm:grid-cols-3 gap-3 sm:gap-4">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 sm:p-5">
              <span className="block text-xs font-semibold text-white/60 mb-2">وب‌اپ</span>
              <p className="text-sm text-white/85 leading-relaxed">
                بدون نصب، در مرورگر موبایل یا دسکتاپ.
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 sm:p-5">
              <span className="block text-xs font-semibold text-white/60 mb-2">PWA</span>
              <p className="text-sm text-white/85 leading-relaxed">
                نصب به‌عنوان اپلیکیشن روی گوشی، بدون فروشگاه.
              </p>
              <span className="mt-3 inline-block text-xs text-white/50">راهنمای نصب — به‌زودی</span>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 sm:p-5">
              <span className="block text-xs font-semibold text-white/60 mb-2">اندروید</span>
              <p className="text-sm text-white/85 leading-relaxed">
                دانلود مستقیم فایل APK با اطلاعات نسخه و checksum.
              </p>
              <span className="mt-3 inline-block text-xs text-white/50">لینک دانلود — به‌زودی</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

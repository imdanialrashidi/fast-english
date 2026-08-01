import { ApkButton } from '../components/ApkButton';
import { PageIntro } from '../components/PageIntro';
import { SiteLayout } from '../layouts/SiteLayout';
import { apkAvailable, apkState, webAppUrl } from '../lib/siteConfig';

const webAppSteps = [
  'در مرورگر موبایل یا دسکتاپ به آدرس وب‌اپ بروید و ثبت‌نام کنید.',
  'برای دسترسی سریع‌تر، صفحهٔ وب‌اپ را به صفحهٔ اصلی مرورگر اضافه کنید.',
  'همهٔ مراحل (پرداخت، تعیین سطح، درس‌ها) در داخل وب‌اپ انجام می‌شود.',
];

const apkSteps = [
  'از همین صفحه دکمهٔ «دانلود نسخهٔ اندروید» را بزنید؛ فایل APK از دامنهٔ fastenglishpodcast.com دانلود می‌شود.',
  'پس از پایان دانلود، روی فایل ضربه بزنید. اندروید ممکن است اجازهٔ نصب از این مرورگر را بخواهد.',
  'در پنجرهٔ «نصب برنامه‌های ناشناخته» فقط اجازهٔ نصب از همان مرورگر (مثلاً Chrome) را بدهید؛ این کار کل سیستم را ناامن نمی‌کند.',
  'پس از نصب، برنامه را باز کنید و با همان حساب وب‌اپ وارد شوید.',
];

const verifySteps = [
  'آدرس صفحه‌ای که از آن دانلود می‌کنید با fastenglishpodcast.com شروع می‌شود.',
  'فایل APK را از وب‌سایت‌ها، کانال‌ها یا گروه‌های ناشناس دریافت نکنید؛ فقط همین وب‌سایت مرجع رسمی است.',
  'پیش از نصب، اطمینان کنید نسخهٔ فایل با نسخهٔ اعلام‌شده در همین صفحه هماهنگ است.',
];

const updateSteps = [
  'گاهی این صفحه را برای انتشار نسخهٔ جدید بررسی کنید.',
  'برای به‌روزرسانی، نسخهٔ جدید را از همین صفحه دانلود کنید و روی فایل ضربه بزنید؛ داده‌های حساب شما روی سرور نگهداری می‌شود و با نصب نسخهٔ جدید از بین نمی‌رود.',
  'اگر اندروید از نصب نسخهٔ جدید جلوگیری کرد، نسخهٔ قدیمی را حذف نکنید؛ ابتدا فایل جدید را از دامنهٔ رسمی دریافت و تلاش کنید.',
];

export function InstallPage() {
  const hasApk = apkAvailable(apkState);
  return (
    <SiteLayout>
      <PageIntro
        title="نصب اپلیکیشن"
        lead="دو راه برای استفاده از فست انگلیش پادکست: وب‌اپ در مرورگر، یا نسخهٔ اندروید به‌صورت مستقیم. هر دو به اتصال اینترنت نیاز دارند."
      />
      <div className="mx-auto max-w-3xl px-4 sm:px-6 pb-12 sm:pb-20 space-y-4">
        <section
          aria-labelledby="install-web"
          className="rounded-2xl border border-brand-divider bg-white p-5 sm:p-6"
        >
          <h2 id="install-web" className="text-xl font-extrabold">
            ۱. وب‌اپ — بدون نصب
          </h2>
          <ol className="mt-3 space-y-2 text-sm text-brand-muted leading-relaxed">
            {webAppSteps.map((s, i) => (
              <li key={s} className="flex gap-2">
                <span className="font-bold text-brand-primary">{i + 1}.</span>
                <span>{s}</span>
              </li>
            ))}
          </ol>
          <a
            href={webAppUrl}
            rel="noopener noreferrer"
            target="_blank"
            className="mt-4 inline-flex items-center justify-center rounded-xl bg-brand-primary px-5 py-3 text-sm font-semibold text-white hover:bg-brand-primary-dark min-h-12"
          >
            باز کردن وب‌اپ
          </a>
        </section>

        <section
          aria-labelledby="install-apk"
          className="rounded-2xl border border-brand-divider bg-white p-5 sm:p-6"
        >
          <h2 id="install-apk" className="text-xl font-extrabold">
            ۲. نسخهٔ اندروید — نصب مستقیم
          </h2>
          {hasApk ? (
            <>
              <p className="mt-3 text-sm text-brand-muted leading-relaxed">
                فایل APK امضاشدهٔ رسمی را از همین صفحه دانلود کنید. مراحل نصب:
              </p>
              <ol className="mt-3 space-y-2 text-sm text-brand-muted leading-relaxed">
                {apkSteps.map((s, i) => (
                  <li key={s} className="flex gap-2">
                    <span className="font-bold text-brand-primary">{i + 1}.</span>
                    <span>{s}</span>
                  </li>
                ))}
              </ol>
              <div className="mt-4">
                <ApkButton />
              </div>
            </>
          ) : (
            <div className="mt-3">
              <ApkButton />
              <p className="mt-3 text-sm text-brand-muted leading-relaxed">
                نسخهٔ اندروید هنوز منتشر نشده است. تا آن زمان می‌توانید از وب‌اپ استفاده کنید؛ پس از
                انتشار، همین صفحه به‌روزرسانی می‌شود.
              </p>
            </div>
          )}
          <p className="mt-3 text-xs text-brand-muted">
            این محصول در فروشگاه‌های اپلیکیشن رسمی (مثل Google Play) در دسترس نیست و تنها مرجع
            دانلود، همین وب‌سایت است.
          </p>
        </section>

        <section
          aria-labelledby="install-permission"
          className="rounded-2xl border border-brand-divider bg-white p-5 sm:p-6"
        >
          <h2 id="install-permission" className="text-xl font-extrabold">
            ۳. وقتی اندروید اجازهٔ نصب از مرورگر را می‌خواهد
          </h2>
          <p className="mt-3 text-sm text-brand-muted leading-relaxed">
            اندروید برای محافظت از شما، نصب برنامه‌های خارج از فروشگاه را به‌صورت پیش‌فرض محدود می‌کند.
            وقتی پنجرهٔ «نصب برنامه‌های ناشناخته» را می‌بینید، فقط اجازهٔ نصب از همان مرورگری که فایل را
            از آن دانلود کرده‌اید بدهید و سپس فایل را اجرا کنید.
          </p>
          <p className="mt-2 text-sm text-brand-muted leading-relaxed">
            هرگز برای نصب این برنامه، محافظ‌های امنیتی اندروید را به‌صورت کلی غیرفعال نکنید.
          </p>
        </section>

        <section
          aria-labelledby="install-verify"
          className="rounded-2xl border border-brand-divider bg-white p-5 sm:p-6"
        >
          <h2 id="install-verify" className="text-xl font-extrabold">
            ۴. بررسی اصالت دانلود
          </h2>
          <ul className="mt-3 space-y-2 text-sm text-brand-muted leading-relaxed">
            {verifySteps.map((s) => (
              <li key={s} className="flex gap-2">
                <span aria-hidden className="text-brand-primary">
                  ▸
                </span>
                <span>{s}</span>
              </li>
            ))}
          </ul>
        </section>

        <section
          aria-labelledby="install-update"
          className="rounded-2xl border border-brand-divider bg-white p-5 sm:p-6"
        >
          <h2 id="install-update" className="text-xl font-extrabold">
            ۵. به‌روزرسانی
          </h2>
          <ul className="mt-3 space-y-2 text-sm text-brand-muted leading-relaxed">
            {updateSteps.map((s) => (
              <li key={s} className="flex gap-2">
                <span aria-hidden className="text-brand-primary">
                  ▸
                </span>
                <span>{s}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </SiteLayout>
  );
}

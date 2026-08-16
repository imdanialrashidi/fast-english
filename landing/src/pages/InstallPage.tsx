import { ApkButton } from '../components/ApkButton';
import { AppCta } from '../components/AppCta';
import { PageIntro } from '../components/PageIntro';
import { SiteLayout } from '../layouts/SiteLayout';
import { apkAvailable, apkState } from '../lib/siteConfig';

const webAppSteps = [
  'در مرورگر موبایل یا دسکتاپ به آدرس وب‌اپ بروید و ثبت‌نام کنید.',
  'برای دسترسی سریع‌تر، می‌توانید وب‌اپ را مانند یک برنامه روی صفحهٔ اصلی دستگاه نصب کنید (بخش «نصب وب‌اپ» در همین صفحه).',
  'همهٔ مراحل (پرداخت، تعیین سطح، درس‌ها) در داخل وب‌اپ انجام می‌شود.',
];

const pwaSteps = [
  'روی صفحهٔ وب‌اپ (در مرورگر) به دنبال گزینهٔ نصب بگردید؛ روش آن در مرورگرهای مختلف فرق می‌کند و ممکن است این گزینه اصلاً نمایش داده نشود.',
  'اندروید/کروم: وقتی مرورگر وب‌اپ را قابل نصب تشخیص دهد، نوار نصب نشان می‌دهد یا در منو ⋮ گزینهٔ «Add to Home screen» / «Install app» قرار می‌گیرد.',
  'دسکتاپ (کروم/اج): آیکن نصب در نوار آدرس یا منوی مرورگر («Install…») نمایش داده می‌شود.',
  'آیفون/آیپد (سافاری): راهنمای کامل در بخش «نصب روی iPhone / iPad» همین صفحه آمده است.',
  'سایر مرورگرها (مثل فایرفاکس) ممکن است روش نصب جداگانه‌ای نداشته باشند؛ در آن صورت وب‌اپ به‌صورت عادی در مرورگر کار می‌کند.',
  'نصب وب‌اپ درس‌ها را آفلاین نمی‌کند؛ پخش صوت همچنان به اتصال اینترنت نیاز دارد.',
];

const iosSteps = [
  'در سافاری، آدرس وب‌اپ را باز کنید و وارد حساب خود شوید.',
  'روی دکمهٔ Share (مربع با پیکان رو به بالا) در پایین صفحه ضربه بزنید.',
  '«Add to Home Screen» (افزودن به صفحه اصلی) را انتخاب کنید.',
  'روی «Add» (افزودن) بزنید تا وب‌اپ روی صفحهٔ اصلی دستگاه قرار گیرد.',
  'برای باز کردن به‌عنوان وب‌اپ، روی آیکن ضربه بزنید؛ اگر سافاری گزینهٔ «Open as Web App» را پیشنهاد داد، آن را انتخاب کنید.',
];

const apkSteps = [
  'از همین صفحه دکمهٔ «دانلود نسخهٔ اندروید» را بزنید؛ فایل APK از دامنهٔ رسمی همین وب‌سایت دانلود می‌شود.',
  'پس از پایان دانلود، روی فایل ضربه بزنید. اندروید ممکن است اجازهٔ نصب از این مرورگر را بخواهد.',
  'در پنجرهٔ «نصب برنامه‌های ناشناخته» فقط اجازهٔ نصب از همان مرورگر (مثلاً Chrome) را بدهید؛ این کار کل سیستم را ناامن نمی‌کند.',
  'پس از نصب، برنامه را باز کنید و با همان حساب وب‌اپ وارد شوید.',
];

const verifySteps = [
  'آدرس صفحه‌ای که از آن دانلود می‌کنید باید با آدرس همین وب‌سایت شروع شود.',
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
        <nav aria-label="پرش به راهنمای نصب" className="flex flex-wrap gap-2">
          <a
            href="#install-pwa"
            className="rounded-xl border border-brand-divider bg-white px-4 py-2 text-sm font-semibold text-brand-text hover:bg-brand-surface"
          >
            نصب وب‌اپ
          </a>
          <a
            href="#ios"
            className="rounded-xl bg-brand-midnight px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
          >
            نصب روی iPhone / iPad
          </a>
          <a
            href="#install-apk"
            className="rounded-xl border border-brand-divider bg-white px-4 py-2 text-sm font-semibold text-brand-text hover:bg-brand-surface"
          >
            نسخهٔ اندروید
          </a>
        </nav>

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
          <AppCta
            place="install"
            className="mt-4 inline-flex items-center justify-center rounded-xl bg-brand-primary px-5 py-3 text-sm font-semibold text-white hover:bg-brand-primary-dark min-h-12"
          >
            باز کردن وب‌اپ
          </AppCta>
        </section>

        <section
          aria-labelledby="install-pwa"
          className="rounded-2xl border border-brand-divider bg-white p-5 sm:p-6"
        >
          <h2 id="install-pwa" className="text-xl font-extrabold">
            ۲. نصب وب‌اپ روی صفحهٔ اصلی (PWA)
          </h2>
          <p className="mt-3 text-sm text-brand-muted leading-relaxed">
            مرورگرهای مدرن می‌توانند وب‌اپ را مانند یک برنامه نصب کنند. روش نصب در مرورگرهای مختلف
            یکسان نیست و هیچ مرورگری تضمین نمی‌کند که این گزینه را نشان دهد:
          </p>
          <ol className="mt-3 space-y-2 text-sm text-brand-muted leading-relaxed">
            {pwaSteps.map((s, i) => (
              <li key={s} className="flex gap-2">
                <span className="font-bold text-brand-primary">{i + 1}.</span>
                <span>{s}</span>
              </li>
            ))}
          </ol>
          <p className="mt-3 text-xs text-brand-muted">
            نصب وب‌اپ اختیاری است؛ بدون نصب هم می‌توانید از همهٔ امکانات در مرورگر استفاده کنید.
          </p>
        </section>

        <section
          id="ios"
          aria-labelledby="ios-title"
          className="rounded-2xl bg-brand-midnight p-5 sm:p-6 text-white"
        >
          <h2 id="ios-title" className="text-xl font-extrabold">
            ۳. نصب روی iPhone / iPad
          </h2>
          <p className="mt-3 text-sm text-white/75 leading-relaxed">
            نسخهٔ iOS در فروشگاه اپل وجود ندارد و لینک مستقیم نصب هم ارائه نشده است؛ تنها راه، افزودن
            وب‌اپ از مرورگر سافاری به صفحهٔ اصلی دستگاه است. مراحل:
          </p>
          <ol className="mt-3 space-y-2 text-sm text-white/85 leading-relaxed">
            {iosSteps.map((s, i) => (
              <li key={s} className="flex gap-2">
                <span className="font-bold text-white/60">{i + 1}.</span>
                <span>{s}</span>
              </li>
            ))}
          </ol>
          <p className="mt-3 text-xs text-white/60">
            نصب از سافاری، وب‌اپ را به‌صورت یک آیکن روی صفحهٔ اصلی قرار می‌دهد؛ همچنان برای پخش صوت به
            اتصال اینترنت نیاز است.
          </p>
        </section>

        <section
          aria-labelledby="install-apk"
          className="rounded-2xl border border-brand-divider bg-white p-5 sm:p-6"
        >
          <h2 id="install-apk" className="text-xl font-extrabold">
            ۴. نسخهٔ اندروید — نصب مستقیم
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
            ۵. وقتی اندروید اجازهٔ نصب از مرورگر را می‌خواهد
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
            ۶. بررسی اصالت دانلود
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
            ۷. به‌روزرسانی
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

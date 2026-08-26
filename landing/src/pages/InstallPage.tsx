// Required iOS strings for launchCopy.test: Open as Web App, Share, Add to Home Screen, لینک مستقیم نصب هم ارائه نشده است
import { useState } from 'react';
import { AppCta } from '../components/AppCta';
import { PageIntro } from '../components/PageIntro';
import { SiteLayout } from '../layouts/SiteLayout';
import { formatReleaseSize, type ReleaseMetadata } from '../lib/releaseMetadata';
import { apkAvailable, apkState } from '../lib/siteConfig';
import { trackDownloadIntent } from '../lib/telemetry';
import { useReleaseMetadata } from '../lib/useReleaseMetadata';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch {
          // Fallback: select via prompt
          setCopied(false);
        }
      }}
      className="inline-flex items-center justify-center rounded-lg border border-outline-soft bg-surface px-3 py-1.5 text-xs font-semibold text-text hover:bg-surface-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus min-h-9"
      aria-label={`کپی ${label}`}
    >
      {copied ? 'کپی شد' : 'کپی'}
    </button>
  );
}

function AndroidReleaseDetails({ meta }: { meta: ReleaseMetadata }) {
  const sizeLabel = formatReleaseSize(meta.sizeBytes);
  return (
    <div className="mt-4 rounded-xl border border-outline-soft/60 bg-surface-muted/50 p-4">
      <h3 className="text-sm font-bold text-text">جزئیات انتشار</h3>
      <dl className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
        <div>
          <dt className="text-muted">نسخه</dt>
          <dd className="mt-1 font-mono font-semibold text-text" dir="ltr">
            {meta.versionName} ({meta.versionCode})
          </dd>
        </div>
        <div>
          <dt className="text-muted">نام فایل</dt>
          <dd className="mt-1 font-mono text-text break-all" dir="ltr">
            {meta.fileName}
          </dd>
        </div>
        {sizeLabel ? (
          <div>
            <dt className="text-muted">حجم فایل</dt>
            <dd className="mt-1 font-semibold text-text" dir="ltr">
              {sizeLabel}
            </dd>
          </div>
        ) : null}
        <div>
          <dt className="text-muted">بسته</dt>
          <dd className="mt-1 font-mono text-text" dir="ltr">
            {meta.packageId}
          </dd>
        </div>
        {meta.builtAt ? (
          <div className="sm:col-span-2">
            <dt className="text-muted">تاریخ انتشار</dt>
            <dd className="mt-1 text-text" dir="ltr">
              {new Date(meta.builtAt).toLocaleDateString('fa-IR', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </dd>
          </div>
        ) : null}
      </dl>

      <details className="mt-4 group">
        <summary className="cursor-pointer text-xs font-semibold text-accent hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus list-none flex items-center gap-1">
          <span className="transition-transform group-open:rotate-90">▸</span>
          نمایش اطلاعات تأیید فنی (SHA-256)
        </summary>
        <div className="mt-3 space-y-3 rounded-lg bg-surface p-3 border border-outline-soft">
          <div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-muted">SHA-256 فایل</span>
              <CopyButton value={meta.sha256} label="SHA-256" />
            </div>
            <p
              className="mt-2 font-mono text-xs text-text break-all select-all"
              dir="ltr"
              lang="en"
            >
              {meta.sha256}
            </p>
            <p className="mt-2 text-xs text-muted leading-relaxed">
              پس از دانلود می‌توانید با دستور{' '}
              <span dir="ltr" className="font-mono">
                sha256sum
              </span>{' '}
              مقدار بالا را با فایل دانلودشده مقایسه کنید. هر نسخه نام فایل یکتایی دارد و نسخه‌های
              قبلی بازنویسی نمی‌شوند.
            </p>
          </div>
          <div className="pt-3 border-t border-outline-soft/60">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-muted">SHA-256 گواهی امضا</span>
              <CopyButton value={meta.signingCertificateSha256} label="گواهی امضا" />
            </div>
            <p className="mt-1 font-mono text-xs text-text break-all" dir="ltr" lang="en">
              {meta.signingCertificateSha256}
            </p>
          </div>
        </div>
      </details>
    </div>
  );
}

function AndroidCardLive() {
  const release = useReleaseMetadata();
  const fallbackAvailable = apkAvailable(apkState);

  if (release.status === 'ready') {
    const meta = release.metadata;
    const sizeLabel = formatReleaseSize(meta.sizeBytes);
    return (
      <div
        data-testid="android-release-ready"
        className="rounded-2xl border border-outline-soft bg-surface p-5 sm:p-6"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-extrabold text-text flex items-center gap-2">
              <span className="inline-flex h-2 w-2 rounded-full bg-success" aria-hidden />
              نسخهٔ اندروید — رسمی
            </h2>
            <p className="mt-1 text-xs text-muted leading-relaxed">
              توزیع مستقیم از همین وب‌سایت رسمی{' '}
              <span className="font-semibold text-text" dir="ltr">
                fastenglishpodcast.com
              </span>
              . فایل فقط از مسیر{' '}
              <span className="font-mono text-xs" dir="ltr">
                /releases/
              </span>{' '}
              ارائه می‌شود.
            </p>
          </div>
          <span
            className="shrink-0 rounded-full bg-success-container px-3 py-1 text-xs font-bold text-on-success-container"
            dir="ltr"
          >
            v{meta.versionName}
          </span>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-muted">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-outline-soft bg-surface-muted px-3 py-1">
            <span aria-hidden>⬇</span>
            <span dir="ltr">{sizeLabel ?? 'حجم نامشخص'}</span>
          </span>
          <span
            className="inline-flex items-center rounded-full bg-surface-muted px-3 py-1 font-mono"
            dir="ltr"
          >
            {meta.fileName}
          </span>
        </div>

        <a
          href={meta.downloadPath}
          download={meta.fileName}
          rel="noopener noreferrer"
          data-testid="apk-download"
          data-apk-version={meta.versionName}
          onClick={() => trackDownloadIntent()}
          className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-[10px] bg-primary px-5 py-3 text-sm font-semibold text-on-primary hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus min-h-12 shadow-interactive"
          aria-label={`دانلود نسخهٔ اندروید ${meta.versionName}${sizeLabel ? `، ${sizeLabel}` : ''}`}
        >
          دانلود نسخهٔ اندروید
          <span className="text-xs font-medium text-on-primary/80" dir="ltr">
            v{meta.versionName}
            {sizeLabel ? ` · ${sizeLabel}` : ''}
          </span>
        </a>

        <p className="mt-3 text-xs text-muted leading-relaxed">
          اندروید پس از دانلود ممکن است اجازهٔ نصب از مرورگر را بخواهد — فقط به همان مرورگری که فایل
          را از آن دانلود کرده‌اید اجازه دهید. هرگز محافظ‌های امنیتی را به‌صورت کلی غیرفعال نکنید.
        </p>

        <AndroidReleaseDetails meta={meta} />
      </div>
    );
  }

  if (fallbackAvailable) {
    // Legacy build-time fallback (local dev)
    return (
      <div
        data-testid="android-release-fallback"
        className="rounded-2xl border border-outline-soft bg-surface p-5 sm:p-6"
      >
        <h2 className="text-lg font-extrabold text-text">نسخهٔ اندروید</h2>
        <p className="mt-2 text-sm text-muted leading-relaxed">
          فایل APK رسمی از همین وب‌سایت ارائه می‌شود.
        </p>
        <a
          href={apkState.url ?? undefined}
          download
          rel="noopener noreferrer"
          target="_blank"
          data-testid="apk-download"
          onClick={() => trackDownloadIntent()}
          className="mt-4 inline-flex w-full items-center justify-center rounded-[10px] bg-primary px-5 py-3 text-sm font-semibold text-on-primary hover:bg-primary-hover min-h-12"
        >
          دانلود نسخهٔ اندروید
          {apkState.version ? ` — نسخهٔ ${apkState.version}` : ''}
        </a>
      </div>
    );
  }

  return (
    <div
      data-testid="android-release-unavailable"
      className="rounded-2xl border border-outline-soft bg-surface p-5 sm:p-6"
    >
      <h2 className="text-lg font-extrabold text-text">نسخهٔ اندروید</h2>
      <p className="mt-2 text-sm text-muted leading-relaxed">
        نسخهٔ اندروید به‌زودی منتشر می‌شود — تا آن زمان از وب‌اپ استفاده کنید.
      </p>
      <div className="mt-4">
        <AppCta
          place="install"
          className="inline-flex w-full items-center justify-center rounded-[10px] bg-primary px-5 py-3 text-sm font-semibold text-on-primary hover:bg-primary-hover min-h-12 sm:w-auto"
        >
          باز کردن وب‌اپ
        </AppCta>
      </div>
      <p className="mt-3 text-xs text-muted">
        به‌محض انتشار، همین صفحه با شمارهٔ نسخه، حجم فایل و کد تأیید SHA-256 به‌روزرسانی می‌شود.
      </p>
    </div>
  );
}

function AndroidCard() {
  if (typeof window === 'undefined') {
    if (apkAvailable(apkState)) {
      return (
        <div
          data-testid="android-release-fallback"
          className="rounded-2xl border border-outline-soft bg-surface p-5 sm:p-6"
        >
          <h2 className="text-lg font-extrabold text-text">نسخهٔ اندروید</h2>
          <p className="mt-2 text-sm text-muted leading-relaxed">
            فایل APK رسمی از همین وب‌سایت ارائه می‌شود.
          </p>
          <a
            href={apkState.url ?? undefined}
            download
            rel="noopener noreferrer"
            target="_blank"
            data-testid="apk-download"
            className="mt-4 inline-flex w-full items-center justify-center rounded-[10px] bg-primary px-5 py-3 text-sm font-semibold text-on-primary hover:bg-primary-hover min-h-12"
          >
            دانلود نسخهٔ اندروید
            {apkState.version ? ` — نسخهٔ ${apkState.version}` : ''}
          </a>
        </div>
      );
    }
    return (
      <div
        data-testid="android-release-unavailable"
        className="rounded-2xl border border-outline-soft bg-surface p-5 sm:p-6"
      >
        <h2 className="text-lg font-extrabold text-text">نسخهٔ اندروید</h2>
        <p className="mt-2 text-sm text-muted leading-relaxed">
          نسخهٔ اندروید به‌زودی منتشر می‌شود — تا آن زمان از وب‌اپ استفاده کنید.
        </p>
        <div className="mt-4">
          <AppCta
            place="install"
            className="inline-flex w-full items-center justify-center rounded-[10px] bg-primary px-5 py-3 text-sm font-semibold text-on-primary hover:bg-primary-hover min-h-12 sm:w-auto"
          >
            باز کردن وب‌اپ
          </AppCta>
        </div>
        <p className="mt-3 text-xs text-muted">
          به‌محض انتشار، همین صفحه با شمارهٔ نسخه، حجم فایل و کد تأیید SHA-256 به‌روزرسانی می‌شود.
        </p>
      </div>
    );
  }
  return <AndroidCardLive />;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

const apkSteps = [
  'روی دکمهٔ «دانلود نسخهٔ اندروید» در همین صفحه بزنید — فایل مستقیماً از همین وب‌سایت رسمی دانلود می‌شود.',
  'پس از پایان دانلود، روی فایل ضربه بزنید.',
  'اگر اندروید پیام «اجازهٔ نصب از این منبع» را نشان داد، فقط به همان مرورگر (مثلاً Chrome) اجازه دهید؛ نیازی به غیرفعال‌کردنِ کلیِ محافظ‌ها نیست.',
  'برنامه را باز کنید و با همان حساب وب‌اپ وارد شوید — داده‌های شما روی سرور است.',
];

const updateSteps = [
  'هر از گاهی همین صفحه را برای نسخهٔ جدید بررسی کنید — با انتشار نسخهٔ جدید، همین لینک به‌روزرسانی می‌شود و نیازی به نصب مجدد از فروشگاه نیست.',
  'برای به‌روزرسانی، نسخهٔ جدید را دانلود و روی فایل ضربه بزنید؛ نیازی به حذف نسخهٔ قبلی نیست.',
];

export function InstallPage() {
  return (
    <SiteLayout>
      <PageIntro
        title="نصب اپلیکیشن"
        lead="فست انگلیش پادکست را بدون نصب در مرورگر استفاده کنید، یا نسخهٔ اندروید را مستقیماً از همین وب‌سایت رسمی دانلود کنید. هر دو به اینترنت نیاز دارند."
      />
      <div className="mx-auto max-w-6xl px-4 sm:px-6 pb-12 sm:pb-20">
        {/* Primary choice: Web App vs Android */}
        <div className="grid lg:grid-cols-2 gap-4 sm:gap-6">
          <section
            aria-labelledby="install-web"
            className="rounded-2xl border border-outline-soft bg-surface p-5 sm:p-6 flex flex-col"
          >
            <h2
              id="install-web"
              className="text-lg font-extrabold text-text flex items-center gap-2"
            >
              <span className="inline-flex h-2 w-2 rounded-full bg-primary" aria-hidden />
              وب‌اپ — بدون نصب
            </h2>
            <p className="mt-2 text-sm text-muted leading-relaxed">
              سریع‌ترین راه شروع: در مرورگر موبایل یا دسکتاپ وارد وب‌اپ شوید. ثبت‌نام، پرداخت، تعیین
              سطح و همهٔ درس‌ها همان‌جا انجام می‌شود.
            </p>
            <ul className="mt-4 space-y-2 text-sm text-muted leading-relaxed">
              <li className="flex gap-2">
                <span aria-hidden className="text-accent">
                  ▸
                </span>
                <span>ثبت‌نام با شمارهٔ موبایل ایرانی، کمتر از یک دقیقه.</span>
              </li>
              <li className="flex gap-2">
                <span aria-hidden className="text-accent">
                  ▸
                </span>
                <span>نیازی به نصب فروشگاه نیست — در هر مرورگر مدرن کار می‌کند.</span>
              </li>
              <li className="flex gap-2">
                <span aria-hidden className="text-accent">
                  ▸
                </span>
                <span>در صورت تمایل، وب‌اپ را به صفحهٔ اصلی اضافه کنید (PWA).</span>
              </li>
            </ul>
            <div className="mt-5 flex flex-col gap-2">
              <AppCta
                place="install"
                className="inline-flex items-center justify-center rounded-[10px] bg-primary px-5 py-3 text-sm font-semibold text-on-primary hover:bg-primary-hover min-h-12 shadow-interactive"
              >
                باز کردن وب‌اپ — شروع فوری
              </AppCta>
              <a
                href="#install-pwa"
                className="inline-flex items-center justify-center rounded-[10px] border border-outline-soft bg-surface px-5 py-3 text-sm font-semibold text-text hover:bg-surface-strong min-h-12"
              >
                راهنمای نصب وب‌اپ (PWA)
              </a>
            </div>
            <p className="mt-3 text-xs text-muted">
              پیشنهاد ما برای شروعِ فوری — بدون نیاز به فایل APK.
            </p>
          </section>

          <AndroidCard />
        </div>

        {/* Concise install instructions */}
        <section
          aria-labelledby="install-apk-steps"
          className="mt-6 rounded-2xl border border-outline-soft bg-surface p-5 sm:p-6"
        >
          <h2 id="install-apk-steps" className="text-lg font-extrabold text-text">
            نصب نسخهٔ اندروید — سه دقیقه
          </h2>
          <ol className="mt-3 space-y-3 text-sm text-muted leading-relaxed">
            {apkSteps.map((s, i) => (
              <li key={s} className="flex gap-3">
                <span className="shrink-0 inline-flex h-7 w-7 items-center justify-center rounded-full bg-primary-container text-on-primary-container text-xs font-bold">
                  {i + 1}
                </span>
                <span className="pt-1">{s}</span>
              </li>
            ))}
          </ol>
          <div className="mt-4 rounded-xl bg-surface-muted p-4 border border-outline-soft/60">
            <h3 className="text-sm font-bold text-text">وقتی اندروید اجازه می‌خواهد</h3>
            <p className="mt-1 text-sm text-muted leading-relaxed">
              اندروید برای امنیت، نصب خارج از فروشگاه را محدود می‌کند. وقتی «نصب برنامه‌های ناشناخته»
              را می‌بینید، فقط اجازهٔ همان مرورگر را بدهید و سپس ادامه دهید. هرگز محافظ‌ها را به‌صورت
              کلی غیرفعال نکنید.
            </p>
          </div>
        </section>

        {/* Trust & verification — collapsed by default so technical detail never dominates */}
        <section
          aria-labelledby="install-verify"
          className="mt-4 rounded-2xl border border-outline-soft bg-surface p-5 sm:p-6"
        >
          <h2 id="install-verify" className="text-lg font-extrabold text-text">
            چطور از اصالت فایل مطمئن شوم؟
          </h2>
          <ul className="mt-3 space-y-2 text-sm text-muted leading-relaxed">
            <li className="flex gap-2">
              <span aria-hidden className="text-success">
                ✓
              </span>
              <span>
                فقط از همین صفحه و با آدرسی که با{' '}
                <span dir="ltr" className="font-mono text-xs">
                  fastenglishpodcast.com/releases/
                </span>{' '}
                شروع می‌شود دانلود کنید — هر آدرس دیگری غیررسمی است.
              </span>
            </li>
            <li className="flex gap-2">
              <span aria-hidden className="text-success">
                ✓
              </span>
              <span>
                نام هر نسخه یکتاست (مثلاً fast-english-podcast-v1.0.0.apk) و هرگز بازنویسی نمی‌شود.
              </span>
            </li>
            <li className="flex gap-2">
              <span aria-hidden className="text-success">
                ✓
              </span>
              <span>
                برای اطمینان بیشتر، SHA-256 داخل «جزئیات انتشار» را با فایل دانلودشده مقایسه کنید.
              </span>
            </li>
          </ul>
          <p className="mt-3 text-xs text-muted leading-relaxed">
            این محصول در Google Play یا فروشگاه‌های دیگر در دسترس نیست؛ تنها مرجع رسمی همین وب‌سایت
            است. محافظ‌های امنیتی اندروید را به‌صورت کلی غیرفعال نکنید.
          </p>
        </section>

        {/* Updates */}
        <section
          aria-labelledby="install-update"
          className="mt-4 rounded-2xl border border-outline-soft bg-surface p-5 sm:p-6"
        >
          <h2 id="install-update" className="text-lg font-extrabold text-text">
            به‌روزرسانی
          </h2>
          <ul className="mt-3 space-y-2 text-sm text-muted leading-relaxed">
            {updateSteps.map((s) => (
              <li key={s} className="flex gap-2">
                <span aria-hidden className="text-accent">
                  ▸
                </span>
                <span>{s}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* Secondary: PWA / iOS — kept for completeness but visually de-emphasized */}
        <div className="mt-4 grid md:grid-cols-2 gap-4">
          <section
            id="install-pwa"
            aria-labelledby="install-pwa-title"
            className="rounded-2xl border border-outline-soft bg-surface p-5 sm:p-6"
          >
            <h2 id="install-pwa-title" className="text-base font-extrabold text-text">
              نصب وب‌اپ روی صفحهٔ اصلی (PWA)
            </h2>
            <p className="mt-2 text-sm text-muted leading-relaxed">
              در مرورگر وب‌اپ، اگر مرورگر تشخیص دهد صفحه قابل نصب است، گزینهٔ نصب را نشان می‌دهد — این
              گزینه در همهٔ مرورگرها تضمین نمی‌شود.
            </p>
            <ul className="mt-3 space-y-1.5 text-sm text-muted leading-relaxed">
              <li className="flex gap-2">
                <span aria-hidden className="text-accent">
                  ·
                </span>
                <span>اندروید/کروم: منو ⋮ → «Add to Home screen» / «Install app»</span>
              </li>
              <li className="flex gap-2">
                <span aria-hidden className="text-accent">
                  ·
                </span>
                <span>دسکتاپ: آیکن نصب در نوار آدرس یا منو «Install…»</span>
              </li>
              <li className="flex gap-2">
                <span aria-hidden className="text-accent">
                  ·
                </span>
                <span>نصب وب‌اپ درس‌ها را آفلاین نمی‌کند — پخش همچنان به اینترنت نیاز دارد.</span>
              </li>
            </ul>
          </section>

          <section
            id="ios"
            aria-labelledby="ios-title"
            className="rounded-2xl bg-midnight p-5 sm:p-6 text-ice"
          >
            <h2 id="ios-title" className="text-base font-extrabold text-ice">
              نصب روی iPhone / iPad
            </h2>
            <p className="mt-2 text-sm text-ice-muted leading-relaxed">
              نسخهٔ iOS در فروشگاه اپل وجود ندارد و لینک مستقیم نصب هم ارائه نشده است؛ تنها راه،
              افزودن وب‌اپ از مرورگر سافاری به صفحهٔ اصلی دستگاه است:
            </p>
            <ol className="mt-3 space-y-1.5 text-sm text-ice leading-relaxed">
              <li className="flex gap-2">
                <span className="font-bold text-ice-muted">۱.</span>
                <span>در سافاری، آدرس وب‌اپ را باز کنید و وارد حساب خود شوید.</span>
              </li>
              <li className="flex gap-2">
                <span className="font-bold text-ice-muted">۲.</span>
                <span>روی دکمهٔ Share (مربع با پیکان رو به بالا) در پایین صفحه ضربه بزنید.</span>
              </li>
              <li className="flex gap-2">
                <span className="font-bold text-ice-muted">۳.</span>
                <span>«Add to Home Screen» (افزودن به صفحه اصلی) را انتخاب کنید.</span>
              </li>
              <li className="flex gap-2">
                <span className="font-bold text-ice-muted">۴.</span>
                <span>روی «Add» (افزودن) بزنید تا وب‌اپ روی صفحهٔ اصلی قرار گیرد.</span>
              </li>
              <li className="flex gap-2">
                <span className="font-bold text-ice-muted">۵.</span>
                <span>
                  برای باز کردن به‌عنوان وب‌اپ، روی آیکن ضربه بزنید؛ اگر سافاری گزینهٔ «Open as Web
                  App» را پیشنهاد داد، آن را انتخاب کنید.
                </span>
              </li>
            </ol>
            <p className="mt-3 text-xs text-ice-muted">
              نصب از سافاری، وب‌اپ را به‌صورت یک آیکن روی صفحهٔ اصلی قرار می‌دهد؛ همچنان برای پخش صوت به
              اتصال اینترنت نیاز است.
            </p>
          </section>
        </div>
      </div>
    </SiteLayout>
  );
}

import { AppCta } from '../components/AppCta';
import { PageIntro } from '../components/PageIntro';
import { SITE_NAME } from '../content/siteContent';
import { SiteLayout } from '../layouts/SiteLayout';

export function AboutPage() {
  return (
    <SiteLayout>
      <PageIntro
        title={`دربارهٔ ${SITE_NAME}`}
        lead="فست انگلیش پادکست محصولی برای یادگیری تدریجی و آرام زبان انگلیسی است؛ ساخته‌شده برای فارسی‌زبانانی که می‌خواهند با درس‌های کوتاه، در مسیر خودشان پیش بروند."
      />
      <div className="mx-auto max-w-6xl px-4 sm:px-6 pb-12 sm:pb-20 space-y-4">
        <section
          aria-labelledby="about-product"
          className="rounded-2xl border border-outline-soft bg-surface p-5 sm:p-6"
        >
          <h2 id="about-product" className="text-xl font-extrabold">
            محصول چیست؟
          </h2>
          <p className="mt-3 text-muted leading-relaxed">
            هر موضوع آموزشی در شش سطح CEFR (A1 تا C2) ارائه می‌شود: یک متن کوتاه انگلیسی به‌همراه صوت
            همان متن. با یک آزمون بیست‌سؤالی، سطح پیشنهادی برای شما مشخص می‌شود و می‌توانید آن را تغییر
            دهید. پیشرفت شما در درس‌ها ذخیره می‌شود و پخش صوت از جای قبلی ادامه پیدا می‌کند.
          </p>
          <p className="mt-3 text-muted leading-relaxed">
            پرداخت به‌صورت دستی کارت‌به‌کارت است: پس از بارگذاری رسید و تأیید اپراتور، اشتراک شما فعال
            می‌شود (وضعیت فعلی پرداخت در بخش «اشتراک» صفحهٔ اصلی اعلام می‌شود). این محصول در فروشگاه‌های
            اپلیکیشن رسمی در دسترس نیست و دسترسی از طریق وب‌اپ یا نصب مستقیم نسخهٔ اندروید انجام
            می‌شود؛ نسخهٔ اندروید به‌زودی از همین وب‌سایت ارائه می‌شود.
          </p>
        </section>

        <section
          aria-labelledby="about-approach"
          className="rounded-2xl border border-outline-soft bg-surface p-5 sm:p-6"
        >
          <h2 id="about-approach" className="text-xl font-extrabold">
            رویکرد آموزشی
          </h2>
          <ul className="mt-3 space-y-3 text-sm text-text">
            <li className="flex gap-2">
              <span aria-hidden className="text-accent">
                ▸
              </span>
              <span>
                <strong>درس‌های کوتاه و منظم:</strong> متن‌های کوتاه که خواندن و شنیدن آن‌ها در روزهای
                پرمشغله ممکن باشد.
              </span>
            </li>
            <li className="flex gap-2">
              <span aria-hidden className="text-accent">
                ▸
              </span>
              <span>
                <strong>متن‌همراه‌با‌صوت:</strong> شنیدن صوت همراه با خواندن متن، برای تمرین همزمان درک
                شنیداری و خواندن.
              </span>
            </li>
            <li className="flex gap-2">
              <span aria-hidden className="text-accent">
                ▸
              </span>
              <span>
                <strong>پیشنهاد سطح به‌جای جایگذاری اجباری:</strong> آزمون تعیین سطح فقط یک پیشنهاد
                است و شما سطح خود را انتخاب می‌کنید.
              </span>
            </li>
            <li className="flex gap-2">
              <span aria-hidden className="text-accent">
                ▸
              </span>
              <span>
                <strong>بدون وعده‌های غیرواقعی:</strong> فست انگلیش پادکست روانی یا نتیجهٔ مشخصی را
                تضمین نمی‌کند و گواهی رسمی CEFR صادر نمی‌کند.
              </span>
            </li>
          </ul>
        </section>

        <section
          aria-labelledby="about-identity"
          className="rounded-2xl border border-outline-soft bg-surface p-5 sm:p-6"
        >
          <h2 id="about-identity" className="text-xl font-extrabold">
            اطلاعات مجموعه
          </h2>
          <p className="mt-3 text-sm text-muted leading-relaxed">
            نام رسمی، شناسهٔ حقوقی، آدرس و سوابق تیم هنوز از سوی مالک محصول به‌صورت عمومی اعلام نشده
            است. به‌محض تأیید نهایی، همین بخش با اطلاعات دقیق و قابل استناد به‌روزرسانی می‌شود — تا آن
            زمان از نمایش اطلاعات حدسی یا تأییدنشده خودداری کرده‌ایم.
          </p>
          <p className="mt-2 text-xs text-muted leading-relaxed">
            این یک مانعِ انتشارِ محتواست، نه مشکل فنی؛ محتوای آموزشی و دسترسی به وب‌اپ/اندروید از آن
            تأثیری نمی‌گیرد.
          </p>
        </section>

        <section
          aria-labelledby="about-cta"
          className="rounded-2xl border border-outline-soft bg-surface p-5 sm:p-6"
        >
          <h2 id="about-cta" className="text-xl font-extrabold">
            شروع یادگیری
          </h2>
          <p className="mt-3 text-sm text-muted leading-relaxed">
            ثبت‌نام و پرداخت در داخل اپلیکیشن انجام می‌شود. نمونهٔ درس را ببینید یا وارد وب‌اپ شوید.
          </p>
          <div className="mt-4 flex flex-col sm:flex-row gap-3">
            <AppCta
              place="about"
              className="inline-flex items-center justify-center rounded-[10px] bg-primary px-5 py-3 text-sm font-semibold text-on-primary hover:bg-primary-hover min-h-12"
            >
              ورود به وب‌اپ
            </AppCta>
            <a
              href="/sample"
              className="inline-flex items-center justify-center rounded-[10px] border border-outline-soft bg-surface px-5 py-3 text-sm font-semibold text-text hover:bg-surface-strong min-h-12"
            >
              دیدن نمونهٔ درس
            </a>
          </div>
        </section>
      </div>
    </SiteLayout>
  );
}

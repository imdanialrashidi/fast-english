import { PageIntro } from '../components/PageIntro';
import { BUSINESS_IDENTITY_PLACEHOLDERS, SITE_NAME } from '../content/siteContent';
import { SiteLayout } from '../layouts/SiteLayout';
import { webAppUrl } from '../lib/siteConfig';

const identityItems = [
  { label: 'بنیان‌گذاران', value: BUSINESS_IDENTITY_PLACEHOLDERS.founders },
  { label: 'ثبت شرکت', value: BUSINESS_IDENTITY_PLACEHOLDERS.registration },
  { label: 'اعتبارنامهٔ آموزشی تیم', value: BUSINESS_IDENTITY_PLACEHOLDERS.teachingCredentials },
  { label: 'آدرس دفتر', value: BUSINESS_IDENTITY_PLACEHOLDERS.officeAddress },
  { label: 'تعداد کاربران', value: BUSINESS_IDENTITY_PLACEHOLDERS.userCount },
  { label: 'افتخارات و جوایز', value: BUSINESS_IDENTITY_PLACEHOLDERS.awards },
];

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
          className="rounded-2xl border border-brand-divider bg-white p-5 sm:p-6"
        >
          <h2 id="about-product" className="text-xl font-extrabold">
            محصول چیست؟
          </h2>
          <p className="mt-3 text-brand-muted leading-relaxed">
            هر موضوع آموزشی در شش سطح CEFR (A1 تا C2) ارائه می‌شود: یک متن کوتاه انگلیسی به‌همراه صوت
            همان متن. با یک آزمون بیست‌سؤالی، سطح پیشنهادی برای شما مشخص می‌شود و می‌توانید آن را تغییر
            دهید. پیشرفت شما در درس‌ها ذخیره می‌شود و پخش صوت از جای قبلی ادامه پیدا می‌کند.
          </p>
          <p className="mt-3 text-brand-muted leading-relaxed">
            پرداخت به‌صورت دستی کارت‌به‌کارت است: پس از بارگذاری رسید و تأیید اپراتور، اشتراک شما فعال
            می‌شود. این محصول در فروشگاه‌های اپلیکیشن رسمی در دسترس نیست و دسترسی از طریق وب‌اپ یا نصب
            مستقیم نسخهٔ اندروید انجام می‌شود.
          </p>
        </section>

        <section
          aria-labelledby="about-approach"
          className="rounded-2xl border border-brand-divider bg-white p-5 sm:p-6"
        >
          <h2 id="about-approach" className="text-xl font-extrabold">
            رویکرد آموزشی
          </h2>
          <ul className="mt-3 space-y-3 text-sm text-brand-text">
            <li className="flex gap-2">
              <span aria-hidden className="text-brand-primary">
                ▸
              </span>
              <span>
                <strong>درس‌های کوتاه و منظم:</strong> متن‌های کوتاه که خواندن و شنیدن آن‌ها در روزهای
                پرمشغله ممکن باشد.
              </span>
            </li>
            <li className="flex gap-2">
              <span aria-hidden className="text-brand-primary">
                ▸
              </span>
              <span>
                <strong>متن‌همراه‌با‌صوت:</strong> شنیدن صوت همراه با خواندن متن، برای تمرین همزمان درک
                شنیداری و خواندن.
              </span>
            </li>
            <li className="flex gap-2">
              <span aria-hidden className="text-brand-primary">
                ▸
              </span>
              <span>
                <strong>پیشنهاد سطح به‌جای جایگذاری اجباری:</strong> آزمون تعیین سطح فقط یک پیشنهاد
                است و شما سطح خود را انتخاب می‌کنید.
              </span>
            </li>
            <li className="flex gap-2">
              <span aria-hidden className="text-brand-primary">
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
          className="rounded-2xl border border-brand-divider bg-white p-5 sm:p-6"
        >
          <h2 id="about-identity" className="text-xl font-extrabold">
            اطلاعات هویتی
          </h2>
          <p className="mt-3 text-sm text-brand-muted leading-relaxed">
            برخی اطلاعات مربوط به هویت حقوقی مجموعه هنوز از سوی مالک محصول اعلام نشده است و به‌محض
            مشخص‌شدن در همین صفحه منتشر می‌شود:
          </p>
          <dl className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
            {identityItems.map((item) => (
              <div key={item.label} className="rounded-xl bg-brand-surface p-3">
                <dt className="text-xs font-semibold text-brand-muted">{item.label}</dt>
                <dd className="mt-1 text-sm font-bold text-brand-text">{item.value}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section
          aria-labelledby="about-cta"
          className="rounded-2xl border border-brand-divider bg-white p-5 sm:p-6"
        >
          <h2 id="about-cta" className="text-xl font-extrabold">
            شروع یادگیری
          </h2>
          <p className="mt-3 text-sm text-brand-muted leading-relaxed">
            ثبت‌نام و پرداخت در داخل اپلیکیشن انجام می‌شود. نمونهٔ درس را ببینید یا وارد وب‌اپ شوید.
          </p>
          <div className="mt-4 flex flex-col sm:flex-row gap-3">
            <a
              href={webAppUrl}
              rel="noopener noreferrer"
              target="_blank"
              className="inline-flex items-center justify-center rounded-xl bg-brand-primary px-5 py-3 text-sm font-semibold text-white hover:bg-brand-primary-dark min-h-12"
            >
              ورود به وب‌اپ
            </a>
            <a
              href="/sample"
              className="inline-flex items-center justify-center rounded-xl border border-brand-divider bg-white px-5 py-3 text-sm font-semibold text-brand-text hover:bg-brand-surface min-h-12"
            >
              دیدن نمونهٔ درس
            </a>
          </div>
        </section>
      </div>
    </SiteLayout>
  );
}

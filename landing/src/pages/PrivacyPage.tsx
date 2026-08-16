import { LegalNotice } from '../components/LegalNotice';
import { PageIntro } from '../components/PageIntro';
import { SupportContact } from '../components/SupportContact';
import { SITE_NAME } from '../content/siteContent';
import { SiteLayout } from '../layouts/SiteLayout';

const topics = [
  {
    title: 'شمارهٔ موبایل (اجباری)',
    body: 'برای ساخت حساب، شمارهٔ موبایل ایرانی به‌صورت عادی‌شده (فرمت +98) ذخیره می‌شود و هویت حساب شماست. این شماره به‌صورت عمومی نمایش داده نمی‌شود.',
  },
  {
    title: 'ایمیل (اختیاری)',
    body: 'ایمیل فقط در صورتی ذخیره می‌شود که خودتان وارد کنید و برای بازیابی حساب استفاده نمی‌شود.',
  },
  {
    title: 'تصویر رسید پرداخت',
    body: 'تصویر رسید کارت‌به‌کارت فقط برای بررسی دستی اپراتور بارگذاری می‌شود. رسیدها به‌صورت محافظت‌شده ذخیره می‌شوند، آدرس عمومی ندارند و فقط اپراتور مجاز می‌تواند آن‌ها را ببیند.',
  },
  {
    title: 'وضعیت حساب و اشتراک',
    body: 'وضعیت حساب (در انتظار پرداخت، فعال، ردشده، منقضی یا معلق) و بازهٔ اشتراک شما برای کنترل دسترسی به درس‌ها نگهداری می‌شود.',
  },
  {
    title: 'پاسخ‌ها و امتیاز آزمون تعیین سطح',
    body: 'پاسخ‌های آزمون بیست‌سؤالی و امتیاز محاسبه‌شده ذخیره می‌شود تا سطح پیشنهادی مشخص شود. پاسخ‌های درست هرگز به مرورگر شما ارسال نمی‌شوند.',
  },
  {
    title: 'سطح انتخابی',
    body: 'سطح انتخابی شما برای نمایش درس‌های مناسب ذخیره می‌شود و می‌توانید آن را تغییر دهید.',
  },
  {
    title: 'پیشرفت درس‌ها',
    body: 'درس‌های شروع‌شده، جای پخش صوت و درس‌های کامل‌شده ذخیره می‌شوند تا پیشرفت شما در دستگاه‌های مختلف حفظ شود.',
  },
  {
    title: 'گزارش‌های عملیاتی',
    body: 'گزارش‌های فنی و عملیاتی (مانند خطاهای سرور) ممکن است نگهداری شوند؛ این گزارش‌ها حاوی محتوای خصوصی شما نیستند.',
  },
  {
    title: 'توکن‌های صوت محافظت‌شده',
    body: 'دسترسی به صوت درس‌ها از طریق توکن کوتاه‌مدت انجام می‌شود که در هر بار پخش بررسی می‌شود و در دستگاه شما ذخیره نمی‌شود.',
  },
  {
    title: 'امنیت حساب',
    body: 'رمز عبور شما به‌صورت رمزنگاری‌شده نگهداری می‌شود. بازیابی خودکار رمز عبور وجود ندارد و برای بازیابی باید با پشتیبانی تماس بگیرید.',
  },
  {
    title: 'کانال تماس',
    body: 'برای درخواست‌های حریم خصوصی، از کانال پشتیبانی استفاده کنید.',
  },
];

export function PrivacyPage() {
  return (
    <SiteLayout>
      <PageIntro
        title="حریم خصوصی"
        lead={`این صفحه توضیح می‌دهد ${SITE_NAME} چه داده‌هایی را جمع‌آوری می‌کند و چگونه از آن‌ها محافظت می‌کند.`}
      />
      <div className="mx-auto max-w-3xl px-4 sm:px-6 pb-12 sm:pb-20 space-y-4">
        <LegalNotice />
        {topics.map((t) => (
          <section
            key={t.title}
            className="rounded-2xl border border-outline-soft bg-surface p-5 sm:p-6"
          >
            <h2 className="text-lg font-extrabold">{t.title}</h2>
            <p className="mt-2 text-sm text-muted leading-relaxed">{t.body}</p>
          </section>
        ))}
        <section className="rounded-2xl border border-outline-soft bg-surface p-5 sm:p-6">
          <h2 className="text-lg font-extrabold">موارد در انتظار تصمیم مالک</h2>
          <ul className="mt-3 space-y-2 text-sm text-muted leading-relaxed">
            <li className="flex gap-2">
              <span aria-hidden className="text-accent">
                ▸
              </span>
              <span>مدت نگهداری رسیدها و داده‌های حساب — به‌زودی</span>
            </li>
            <li className="flex gap-2">
              <span aria-hidden className="text-accent">
                ▸
              </span>
              <span>وضعیت حقوقی و نهاد مسئول (شخص یا شرکت) — به‌زودی</span>
            </li>
            <li className="flex gap-2">
              <span aria-hidden className="text-accent">
                ▸
              </span>
              <span>حوزهٔ قضایی و قوانین قابل اعمال — به‌زودی</span>
            </li>
            <li className="flex gap-2">
              <span aria-hidden className="text-accent">
                ▸
              </span>
              <span>حقوق قانونی کاربر و ادعاهای انطباق با مقررات — به‌زودی</span>
            </li>
          </ul>
          <SupportContact />
        </section>
      </div>
    </SiteLayout>
  );
}

import { LegalNotice } from '../components/LegalNotice';
import { PageIntro } from '../components/PageIntro';
import { SITE_NAME } from '../content/siteContent';
import { SiteLayout } from '../layouts/SiteLayout';

const topics = [
  {
    title: 'مسئولیت حساب',
    body: 'شما مسئول حفظ امنیت رمز عبور و فعالیت‌های حساب خود هستید. شمارهٔ موبایل باید متعلق به خودتان باشد و هر حساب فقط برای یک کاربر است.',
  },
  {
    title: 'پرداخت دستی کارت‌به‌کارت',
    body: 'پرداخت به‌صورت دستی کارت‌به‌کارت انجام می‌شود و هیچ پرداخت آنلاین خودکاری وجود ندارد. بارگذاری رسید جعلی یا انتقال ناموفق می‌تواند منجر به رد درخواست یا تعلیق حساب شود.',
  },
  {
    title: 'فعال‌سازی پس از تأیید اپراتور',
    body: 'اشتراک فقط پس از بررسی و تأیید دستی رسید توسط اپراتور فعال می‌شود. بارگذاری رسید به‌تنهایی فعال‌سازی را تضمین نمی‌کند.',
  },
  {
    title: 'مدت دسترسی',
    body: 'دسترسی به درس‌ها تا پایان دورهٔ اشتراک فعال است (ماهانه ۳۰ روز یا ۹۰ روزه) و پس از پایان دوره نیاز به تمدید دارد.',
  },
  {
    title: 'مالکیت محتوا',
    body: 'همهٔ درس‌ها، متن‌ها، صوت‌ها و اجزای محصول متعلق به مالک فست انگلیش پادکست است و استفاده از آن‌ها فقط در چارچوب همین سرویس مجاز است.',
  },
  {
    title: 'ممنوعیت بازتوزیع',
    body: 'کپی‌کردن، دانلود انبوه، ضبط و بازنشر متن یا صوت درس‌ها در هر کانالی بدون اجازه ممنوع است.',
  },
  {
    title: 'استفادهٔ قابل‌قبول',
    body: 'استفاده از سرویس برای هرگونه فعالیت غیرقانونی، مزاحمت، سوءاستفاده از حساب‌های دیگران یا تلاش برای دسترسی غیرمجاز ممنوع است.',
  },
  {
    title: 'دسترس‌پذیری و نگهداری',
    body: 'سرویس ممکن است برای به‌روزرسانی یا نگهداری موقتاً در دسترس نباشد. برای شنیدن درس‌ها به اتصال اینترنت نیاز است و پخش آفلاین ارائه نشده است.',
  },
  {
    title: 'قطع یا تعلیق',
    body: 'در صورت نقض این شرایط یا تصمیم مالک، دسترسی به حساب ممکن است به‌صورت موقت یا دائم قطع شود.',
  },
  {
    title: 'تغییرات سرویس',
    body: 'امکانات، طرح‌ها و این شرایط ممکن است تغییر کنند؛ تغییرات مهم از طریق همین صفحات اعلام می‌شوند.',
  },
];

export function TermsPage() {
  return (
    <SiteLayout>
      <PageIntro
        title="شرایط استفاده"
        lead={`شرایط استفاده از ${SITE_NAME} را پیش از ثبت‌نام بخوانید.`}
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
              <span>نام و هویت حقوقی ارائه‌دهندهٔ سرویس — به‌زودی</span>
            </li>
            <li className="flex gap-2">
              <span aria-hidden className="text-accent">
                ▸
              </span>
              <span>سیاست بازپرداخت — به‌زودی</span>
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
        </section>
      </div>
    </SiteLayout>
  );
}

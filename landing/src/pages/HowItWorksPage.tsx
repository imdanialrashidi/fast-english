import { AppCta } from '../components/AppCta';
import { PageIntro } from '../components/PageIntro';
import { SiteLayout } from '../layouts/SiteLayout';

const steps = [
  {
    title: '۱. ساخت حساب',
    desc: 'در وب‌اپ با شمارهٔ موبایل ایرانی، نام و رمز عبور ثبت‌نام می‌کنید. شمارهٔ موبایل هویت حساب شماست و ایمیل اختیاری است. بازیابی رمز عبور به‌صورت خودکار وجود ندارد و از طریق پشتیبانی انجام می‌شود.',
  },
  {
    title: '۲. پرداخت کارت‌به‌کارت و بارگذاری رسید',
    desc: 'طرح ماهانه (۳۰ روز) یا ۹۰ روزه را انتخاب می‌کنید و مبلغ را کارت‌به‌کارت منتقل می‌کنید. سپس یک تصویر از رسید انتقال (JPEG، PNG یا WebP تا حداکثر ۵ مگابایت) بارگذاری می‌کنید. هیچ پرداخت آنلاین خودکاری وجود ندارد. وضعیت فعلی پرداخت (فعال یا غیرفعال بودن) در بخش «اشتراک» صفحهٔ اصلی اعلام می‌شود.',
  },
  {
    title: '۳. تأیید اپراتور',
    desc: 'اپراتور رسید را با اطلاعات بانکی بیرونی مقایسه و بررسی می‌کند. پس از تأیید، اشتراک شما فعال می‌شود و اگر مشکلی باشد، دلیل رد شدن در حساب شما نمایش داده می‌شود.',
  },
  {
    title: '۴. آزمون تعیین سطح',
    desc: 'آزمون بیست‌سؤالی با چهار گزینه برای هر سؤال. پاسخ‌ها در هر بار ذخیره می‌شوند و پس از ارسال نهایی، سطح پیشنهادی از روی پاسخ‌ها محاسبه می‌شود. نتیجه فقط یک پیشنهاد است.',
  },
  {
    title: '۵. انتخاب سطح',
    desc: 'سطح پیشنهادی را می‌پذیرید یا سطح دیگری را از A1 تا C2 برای درس‌ها انتخاب می‌کنید.',
  },
  {
    title: '۶. درس‌ها و پیگیری پیشرفت',
    desc: 'درس‌های سطح خود را می‌خوانید و می‌شنوید. پیشرفت شما ذخیره می‌شود و پخش صوت از جای قبلی ادامه پیدا می‌کند. دسترسی به درس‌ها تا پایان دورهٔ اشتراک فعال است.',
  },
];

export function HowItWorksPage() {
  return (
    <SiteLayout>
      <PageIntro
        title="چگونه کار می‌کند؟"
        lead="از ساخت حساب تا اولین درس: مسیر کامل استفاده از فست انگلیش پادکست. همهٔ مراحل در داخل اپلیکیشن انجام می‌شود."
      />
      <div className="mx-auto max-w-3xl px-4 sm:px-6 pb-12 sm:pb-20 space-y-4">
        {steps.map((step) => (
          <section
            key={step.title}
            className="rounded-2xl border border-outline-soft bg-surface p-5 sm:p-6"
          >
            <h2 className="text-lg font-extrabold">{step.title}</h2>
            <p className="mt-2 text-sm text-muted leading-relaxed">{step.desc}</p>
          </section>
        ))}
        <div className="rounded-2xl bg-midnight p-5 sm:p-6 text-ice">
          <h2 className="text-lg font-extrabold">شروع کنید</h2>
          <p className="mt-2 text-sm text-ice-muted leading-relaxed">
            ثبت‌نام در وب‌اپ رایگان است؛ هزینه فقط پس از انتخاب طرح پرداخت می‌شود.
          </p>
          <AppCta
            place="how-it-works"
            className="mt-4 inline-flex items-center justify-center rounded-[10px] bg-primary px-5 py-3 text-sm font-semibold text-on-primary hover:bg-primary-hover min-h-12"
          >
            ورود به وب‌اپ
          </AppCta>
        </div>
      </div>
    </SiteLayout>
  );
}

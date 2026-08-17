// landing/src/sections/HowItWorks.tsx
import { toPersianDigits } from '../lib/persianDigits';

// The activation journey in four honest steps. The runtime-truthful
// payment states live in PaymentSection (card-to-card availability and
// free plans come from the public settings endpoint); this section
// describes the standard paid journey without ever promising automation.
const steps = [
  {
    title: 'حساب می‌سازی',
    desc: 'ثبت‌نام با شمارهٔ موبایل ایرانی، نام و رمز عبور؛ ایمیل اختیاری است. کمتر از یک دقیقه.',
  },
  {
    title: 'اشتراکت را فعال می‌کنی',
    desc: 'طرح ماهانه یا سهماهه را انتخاب می‌کنی؛ پرداخت کارت‌به‌کارت دستی است و رسید را در اپ بارگذاری می‌کنی. پس از بررسی اپراتور، اشتراک فعال می‌شود. وضعیت فعلی پرداخت در بخش «اشتراک» همین صفحه اعلام می‌شود.',
  },
  {
    title: 'سطحت را پیدا می‌کنی',
    desc: 'یک آزمون بیست‌سؤالی سطح پیشنهادی را مشخص می‌کند. نتیجه فقط یک پیشنهاد است؛ می‌توانی آن را بپذیری یا سطح دیگری انتخاب کنی.',
  },
  {
    title: 'گوش می‌دهی و جلو می‌روی',
    desc: 'اپیزودها در سطح تو، با متن، واژه‌های کلیدی و تلفظ. پیشرفت هر اپیزود ذخیره می‌شود و دفعهٔ بعد از همان‌جا ادامه می‌دهی.',
  },
] as const;

export function HowItWorks() {
  return (
    <section id="how" aria-labelledby="how-title" className="py-14 sm:py-24 bg-surface">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="max-w-2xl">
          <p className="flex items-center gap-2 text-sm font-semibold text-accent">
            <span aria-hidden className="inline-block h-px w-8 bg-accent/60" />
            مسیر شروع
          </p>
          <h2
            id="how-title"
            className="mt-3 text-2xl sm:text-4xl font-extrabold tracking-tight leading-[1.3]"
          >
            از ثبت‌نام تا اولین اپیزود، چهار گام
          </h2>
          <p className="mt-4 text-base text-muted leading-relaxed">
            همهٔ مراحل داخل اپلیکیشن انجام می‌شود؛ این صفحه فقط مسیر را نشان می‌دهد.
          </p>
        </div>

        <ol className="mt-10 divide-y divide-outline-soft/70 border-y border-outline-soft">
          {steps.map((s, i) => (
            <li key={s.title} className="grid sm:grid-cols-12 gap-2 sm:gap-6 py-6">
              <span
                className="sm:col-span-2 text-3xl font-extrabold tabular-nums text-primary/70"
                aria-hidden
              >
                {toPersianDigits(i + 1, 2)}
              </span>
              <div className="sm:col-span-10">
                <h3 className="text-lg font-bold text-text">{s.title}</h3>
                <p className="mt-1 text-sm text-muted leading-relaxed max-w-xl">{s.desc}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

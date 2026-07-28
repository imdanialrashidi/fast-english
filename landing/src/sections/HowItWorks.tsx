const steps = [
  {
    n: '۱',
    title: 'ثبت‌نام با شمارهٔ موبایل',
    desc: 'فقط با شمارهٔ موبایل ایرانی، نام و رمز عبور. بدون نیاز به ایمیل یا پیامک تأیید.',
  },
  {
    n: '۲',
    title: 'پرداخت دستی و بارگذاری رسید',
    desc: 'طرح ماهانه، ۹۰ روزه یا ۳۶۵ روزه را انتخاب کنید، رسید کارت‌به‌کارت را بارگذاری کنید.',
  },
  {
    n: '۳',
    title: 'تأیید توسط اپراتور',
    desc: 'پس از بررسی، اشتراک شما فعال می‌شود و به درس‌ها و صوت‌ها دسترسی پیدا می‌کنید.',
  },
  {
    n: '۴',
    title: 'تعیین سطح و شروع یادگیری',
    desc: 'آزمون بیست‌سؤالی سطح پیشنهادی را مشخص می‌کند. می‌توانید آن را تغییر دهید.',
  },
];

export function HowItWorks() {
  return (
    <section id="how" aria-labelledby="how-title" className="py-12 sm:py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="max-w-3xl">
          <h2 id="how-title" className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            چگونه شروع کنم؟
          </h2>
          <p className="mt-3 text-brand-muted leading-relaxed">
            چهار گام ساده برای شروع یادگیری. تمام مراحل در داخل اپلیکیشن انجام می‌شود.
          </p>
        </div>

        <ol className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {steps.map((s) => (
            <li key={s.n} className="rounded-2xl border border-brand-divider bg-white p-4 sm:p-5">
              <span
                className="inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold"
                style={{ background: 'var(--color-brand-primary)', color: '#fff' }}
                aria-hidden
              >
                {s.n}
              </span>
              <h3 className="mt-3 text-base font-bold text-brand-text">{s.title}</h3>
              <p className="mt-1 text-sm text-brand-muted leading-relaxed">{s.desc}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

const steps = [
  {
    n: '۱',
    title: 'ساخت حساب',
    desc: 'ثبت‌نام با شمارهٔ موبایل ایرانی، نام و رمز عبور. ایمیل اختیاری است.',
  },
  {
    n: '۲',
    title: 'پرداخت کارت‌به‌کارت و بارگذاری رسید',
    desc: 'طرح ماهانه، ۹۰ روزه یا ۳۶۵ روزه را انتخاب کنید و رسید انتقال را بارگذاری کنید.',
  },
  {
    n: '۳',
    title: 'تأیید اپراتور',
    desc: 'اپراتور رسید را بررسی می‌کند؛ پس از تأیید، اشتراک شما فعال می‌شود.',
  },
  {
    n: '۴',
    title: 'آزمون تعیین سطح',
    desc: 'آزمون بیست‌سؤالی، سطح پیشنهادی را مشخص می‌کند؛ نتیجه فقط یک پیشنهاد است.',
  },
  {
    n: '۵',
    title: 'انتخاب سطح',
    desc: 'سطح پیشنهادی را می‌پذیرید یا سطح دیگری را برای درس‌ها انتخاب می‌کنید.',
  },
  {
    n: '۶',
    title: 'درس‌ها و پیگیری پیشرفت',
    desc: 'متن و صوت درس‌ها را در سطح خود دنبال کنید؛ پیشرفت شما ذخیره می‌شود.',
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
            شش گام ساده برای شروع یادگیری. تمام مراحل در داخل اپلیکیشن انجام می‌شود.
          </p>
        </div>

        <ol className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
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

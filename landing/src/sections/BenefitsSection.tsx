const benefits = [
  {
    title: 'شش سطح CEFR',
    desc: 'از A1 تا C2؛ هر موضوع در شش سطح منتشر می‌شود تا با سطح شما پیش بروید.',
  },
  {
    title: 'متن و صوت هر درس',
    desc: 'متن کوتاه انگلیسی همراه با صوت همان متن برای تمرین شنیدن.',
  },
  {
    title: 'ادامهٔ پخش از جای قبلی',
    desc: 'پخش صوت از آخرین جای درس ادامه پیدا می‌کند.',
  },
  {
    title: 'پیگیری پیشرفت',
    desc: 'درس‌های شروع‌شده و کامل‌شده در حساب شما ذخیره می‌شوند.',
  },
  {
    title: 'وب‌اپ و اندروید',
    desc: 'در مرورگر موبایل و دسکتاپ، یا با نسخهٔ اندروید از همین صفحه.',
  },
];

export function BenefitsSection() {
  return (
    <section id="benefits" aria-labelledby="benefits-title" className="py-12 sm:py-20 bg-white">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="max-w-3xl">
          <h2 id="benefits-title" className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            چه چیزی در محصول هست
          </h2>
          <p className="mt-3 text-brand-muted leading-relaxed">
            درس‌های کوتاه و منظم، بدون وعده‌های غیرواقعی: پیشرفت شما با تمرین مستمر ساخته می‌شود.
          </p>
        </div>

        <ul className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {benefits.map((b) => (
            <li
              key={b.title}
              className="rounded-2xl border border-brand-divider bg-brand-surface p-4 sm:p-5"
            >
              <h3 className="text-base font-bold text-brand-text">{b.title}</h3>
              <p className="mt-1 text-sm text-brand-muted leading-relaxed">{b.desc}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

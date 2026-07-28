interface Level {
  label: string;
  name: string;
  desc: string;
  bg: string;
  fg: string;
}

const levels: Level[] = [
  {
    label: 'A1',
    name: 'مبتدی',
    desc: 'جمله‌های کوتاه و کلمات پرکاربرد برای موقعیت‌های روزمره.',
    bg: 'var(--color-cefr-a1-bg)',
    fg: 'var(--color-cefr-a1-fg)',
  },
  {
    label: 'A2',
    name: 'پایه',
    desc: 'مکالمه‌های ساده دربارهٔ خانواده، کار و خرید.',
    bg: 'var(--color-cefr-a2-bg)',
    fg: 'var(--color-cefr-a2-fg)',
  },
  {
    label: 'B1',
    name: 'متوسط',
    desc: 'بیان نظر و توضیح دربارهٔ موضوعات آشنا با جمله‌های مرتبط.',
    bg: 'var(--color-cefr-b1-bg)',
    fg: 'var(--color-cefr-b1-fg)',
  },
  {
    label: 'B2',
    name: 'میانی بالا',
    desc: 'متن‌های پیچیده‌تر و گفت‌وگوهای حرفه‌ای.',
    bg: 'var(--color-cefr-b2-bg)',
    fg: 'var(--color-cefr-b2-fg)',
  },
  {
    label: 'C1',
    name: 'پیشرفته',
    desc: 'استفادهٔ روان و انعطاف‌پذیر در زمینه‌های اجتماعی و حرفه‌ای.',
    bg: 'var(--color-cefr-c1-bg)',
    fg: 'var(--color-cefr-c1-fg)',
  },
  {
    label: 'C2',
    name: 'تسلط',
    desc: 'درک ظریف‌ها و بیان دقیق در موقعیت‌های دشوار.',
    bg: 'var(--color-cefr-c2-bg)',
    fg: 'var(--color-cefr-c2-fg)',
  },
];

export function CefrSection() {
  return (
    <section id="levels" aria-labelledby="levels-title" className="py-12 sm:py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="max-w-3xl">
          <h2 id="levels-title" className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            شش سطح، یک مسیر روشن
          </h2>
          <p className="mt-3 text-brand-muted leading-relaxed">
            هر موضوع در شش سطح CEFR منتشر می‌شود. سطح پیشنهادی با یک آزمون بیست‌سؤالی مشخص می‌شود و شما
            می‌توانید آن را تغییر دهید.
          </p>
        </div>

        <ul className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {levels.map((l) => (
            <li
              key={l.label}
              className="rounded-2xl border border-brand-divider bg-white p-4 sm:p-5"
            >
              <div className="flex items-center gap-2">
                <span
                  className="inline-flex items-center justify-center rounded-lg px-2 py-1 text-sm font-bold"
                  style={{ background: l.bg, color: l.fg }}
                >
                  {l.label}
                </span>
                <span className="text-sm font-semibold text-brand-text">{l.name}</span>
              </div>
              <p className="mt-2 text-sm text-brand-muted leading-relaxed">{l.desc}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

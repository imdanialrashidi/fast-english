// landing/src/sections/CefrSection.tsx
// The CEFR ladder as an editorial list — six levels, one clear path.
// Level pairs come from the shared CEFR tokens (AA foreground/background).
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
    <section id="levels" aria-labelledby="levels-title" className="py-14 sm:py-24 bg-surface">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="max-w-2xl">
          <p className="flex items-center gap-2 text-sm font-semibold text-accent">
            <span aria-hidden className="inline-block h-px w-8 bg-accent/60" />
            چارچوب CEFR
          </p>
          <h2
            id="levels-title"
            className="mt-3 text-2xl sm:text-4xl font-extrabold tracking-tight leading-[1.3]"
          >
            شش سطح، یک مسیر روشن
          </h2>
          <p className="mt-4 text-base text-muted leading-relaxed">
            هر اپیزود در شش سطح منتشر می‌شود. سطح پیشنهادی با یک آزمون بیست‌سؤالی مشخص می‌شود و تو
            می‌توانی آن را تغییر دهی.
          </p>
        </div>

        <ol className="mt-10 divide-y divide-outline-soft/70 border-y border-outline-soft">
          {levels.map((l) => (
            <li key={l.label} className="grid sm:grid-cols-12 gap-2 sm:gap-6 py-5 items-baseline">
              <span
                className="sm:col-span-2 inline-flex items-center justify-center rounded-lg px-2.5 py-1 text-sm font-bold w-fit"
                style={{ background: l.bg, color: l.fg }}
              >
                {l.label}
              </span>
              <h3 className="sm:col-span-3 text-base font-bold text-text">{l.name}</h3>
              <p className="sm:col-span-7 text-sm text-muted leading-relaxed">{l.desc}</p>
            </li>
          ))}
        </ol>

        <p className="mt-6 text-xs text-muted max-w-3xl leading-relaxed">
          مرور و شنیدن درس‌ها در همهٔ سطوح آزاد است؛ سطح پیشنهادی و سطح پیش‌فرض فقط نقطهٔ شروع تو هستند
          و با مرور سطح دیگر تغییر نمی‌کنند. سطوح بر پایهٔ چارچوب مرجع مشترک اروپایی (CEFR) هستند. فست
          انگلیش پادکست هیچ گواهی یا مدرک رسمی CEFR صادر نمی‌کند و روانی یا نتیجهٔ مشخصی را تضمین
          نمی‌کند؛ سطح پیشنهادی نیز فقط یک پیشنهاد است.
        </p>
      </div>
    </section>
  );
}

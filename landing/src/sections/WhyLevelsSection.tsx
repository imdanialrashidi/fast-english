// landing/src/sections/WhyLevelsSection.tsx
// «یک اپیزود، در شش سطح» — the core product story: one Episode exists as
// level-specific Variants across A1–C2, the learner gets a recommended
// level without turning level into an access restriction, and browsing
// other levels never changes the recommendation or progress.
import { LevelPlate } from '../components/LevelChip';
import { SAMPLE_TITLE_EN, SAMPLE_TITLE_FA } from '../content/sampleContent';

const REASONS = [
  {
    title: 'محتوایی که با سطح امروز تو تنظیم است',
    desc: 'یک موضوع در نسخه‌های A1 تا C2 منتشر می‌شود؛ نسخه‌ای را گوش می‌دهی که برای سطح فعلی‌ات قابل‌فهم است، نه آن‌قدر ساده که حوصله‌ات سر برود و نه آن‌قدر سخت که رها کنی.',
  },
  {
    title: 'سطح پیشنهادی، نه محدودیت',
    desc: 'آزمون تعیین سطح فقط یک پیشنهاد می‌دهد. مرور و گوش‌دادن در همهٔ سطوح آزاد است و انتخاب سطح دیگر، سطح پیشنهادی یا پیشرفت تو را تغییر نمی‌دهد.',
  },
  {
    title: 'یک موضوع، چند دید',
    desc: 'با هر اپیزود می‌توانی همان موضوع را در سطح بالاتر هم بشنوی — راهی طبیعی برای دیدنِ پیشرفتت در یک موضوع واقعی.',
  },
] as const;

export function WhyLevelsSection() {
  return (
    <section id="why-levels" aria-labelledby="why-levels-title" className="py-14 sm:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="grid lg:grid-cols-12 gap-10 lg:gap-14 items-start">
          {/* Editorial copy */}
          <div className="lg:col-span-6">
            <p className="flex items-center gap-2 text-sm font-semibold text-accent">
              <span aria-hidden className="inline-block h-px w-8 bg-accent/60" />
              چرا یک اپیزود، در شش سطح؟
            </p>
            <h2
              id="why-levels-title"
              className="mt-3 text-2xl sm:text-4xl font-extrabold tracking-tight leading-[1.3]"
            >
              همیشه یک نسخه از اپیزود هست که «همین حالا» برای تو باشد
            </h2>
            <p className="mt-4 text-base text-muted leading-relaxed max-w-xl">
              بیشتر منابع انگلیسی برای همهٔ زبان‌آموزها یکسان‌اند — و برای همین، یا خیلی ساده‌اند یا
              خیلی سخت. در فست انگلیش، هر اپیزود یک موضوع واقعی است که در شش نسخهٔ سطح‌بندی‌شده منتشر
              می‌شود؛ تو نسخه‌ای را گوش می‌دهی که با سطح امروزت تنظیم شده است.
            </p>
            <ul className="mt-8 space-y-6">
              {REASONS.map((r) => (
                <li key={r.title} className="flex gap-4">
                  <span
                    aria-hidden
                    className="mt-1.5 inline-block w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ background: 'var(--color-accent)' }}
                  />
                  <div>
                    <h3 className="text-base font-bold text-text">{r.title}</h3>
                    <p className="mt-1 text-sm text-muted leading-relaxed max-w-lg">{r.desc}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {/* The same Episode, six editions — the record-jacket idea. */}
          <div className="lg:col-span-6">
            <div
              className="rounded-[24px] p-5 sm:p-7"
              style={{ background: 'var(--color-midnight)' }}
              aria-hidden
            >
              <div className="flex items-center justify-between mb-5">
                <span className="text-xs font-semibold text-ice-muted">اپیزود نمونه</span>
                <span className="text-xs text-ice-muted" dir="ltr">
                  A Typical Workday
                </span>
              </div>
              {/* Artwork tile */}
              <div
                className="rounded-[16px] p-6"
                style={{ background: 'var(--color-midnight-deep)' }}
              >
                <p className="text-xl font-bold text-ice leading-snug">{SAMPLE_TITLE_FA}</p>
                <p className="mt-1 text-xs text-ice-muted" dir="ltr">
                  {SAMPLE_TITLE_EN}
                </p>
                <div className="mt-5 flex items-end gap-[3px] h-8">
                  {WAVE.map((h, i) => (
                    <span
                      key={i}
                      className="block w-1 rounded-sm"
                      style={{ height: `${h}px`, background: 'rgba(228, 237, 241, 0.35)' }}
                    />
                  ))}
                </div>
              </div>
              {/* Six editions of the same Episode: five available, one
                  current (the learner's suggested level is filled). */}
              <div className="mt-5 flex items-start justify-between gap-2">
                {['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].map((lvl) => (
                  <LevelPlate
                    key={lvl}
                    label={lvl}
                    size="sm"
                    tone="dark"
                    filled={lvl === 'B1'}
                    marker={lvl === 'B1' ? 'سطح تو' : undefined}
                  />
                ))}
              </div>
              <p className="mt-4 text-xs text-ice-muted leading-relaxed">
                هر اپیزود در شش سطح منتشر می‌شود؛ همهٔ سطوح برای مرور آزاد هستند.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

const WAVE = [12, 18, 24, 16, 28, 20, 14, 26, 18, 12, 22, 16, 20, 24, 14, 18, 26, 16, 22, 12];

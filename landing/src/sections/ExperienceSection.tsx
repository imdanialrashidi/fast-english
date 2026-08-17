// landing/src/sections/ExperienceSection.tsx
// «داخل اپلیکیشن چه خبر است» — the actual Student experience expressed
// with the canonical product language (ادامهٔ گوش‌دادن، کلمات کلیدی، متن
// اپیزود، پیشرفت). Every element shown here exists in the real app; no
// invented functionality, no user data.
import { LevelPlate } from '../components/LevelChip';

export function ExperienceSection() {
  return (
    <section id="experience" aria-labelledby="experience-title" className="py-14 sm:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="max-w-2xl">
          <p className="flex items-center gap-2 text-sm font-semibold text-accent">
            <span aria-hidden className="inline-block h-px w-8 bg-accent/60" />
            تجربهٔ گوش‌دادن
          </p>
          <h2
            id="experience-title"
            className="mt-3 text-2xl sm:text-4xl font-extrabold tracking-tight leading-[1.3]"
          >
            شنیدن، خواندن و یادآوری — همه در یک جا
          </h2>
          <p className="mt-4 text-base text-muted leading-relaxed">
            اپیزود فقط صوت نیست: متن همان اپیزود، واژه‌های کلیدی با تلفظ و پیشرفت تو کنار هم در یک
            صفحه‌اند — بدون جابه‌جایی بین چند برنامه.
          </p>
        </div>

        <div className="mt-10 grid lg:grid-cols-3 gap-4 sm:gap-6">
          {/* Continue Listening */}
          <article className="rounded-2xl border border-outline-soft bg-surface p-5 sm:p-6">
            <header className="flex items-center justify-between">
              <h3 className="text-base font-bold text-text">ادامهٔ گوش‌دادن</h3>
              <LevelPlate label="B1" size="sm" filled />
            </header>
            <p className="mt-3 text-sm font-semibold text-text">یک روز کاری معمولی</p>
            <p className="text-xs text-muted" dir="ltr">
              A Typical Workday
            </p>
            <div className="mt-4">
              <div className="flex items-center justify-between text-xs text-muted">
                <span>ادامه از ۰۴:۱۲</span>
                <span dir="ltr">۲۱٪</span>
              </div>
              <div className="mt-2 h-1.5 rounded-full bg-surface-strong">
                <div
                  className="h-1.5 rounded-full"
                  style={{ width: '21%', background: 'var(--color-primary)' }}
                />
              </div>
            </div>
            <p className="mt-4 text-xs text-muted leading-relaxed">
              هر بار اپ را باز می‌کنی، از همان‌جایی ادامه می‌دهی که رها کرده‌ای.
            </p>
          </article>

          {/* Vocabulary */}
          <article className="rounded-2xl border border-outline-soft bg-surface p-5 sm:p-6">
            <header className="flex items-center justify-between">
              <h3 className="text-base font-bold text-text">کلمات کلیدی · ۳</h3>
              <span
                className="rounded-lg px-2 py-1 text-xs font-bold"
                style={{
                  background: 'var(--color-cefr-b1-bg)',
                  color: 'var(--color-cefr-b1-fg)',
                }}
              >
                B1
              </span>
            </header>
            <ul className="mt-3 divide-y divide-outline-soft/60">
              {[
                { term: 'typical', phonetic: '/ˈtɪpɪkl/', fa: 'معمولی، عادی' },
                { term: 'quarter', phonetic: '/ˈkwɔːtə/', fa: 'ربع (ساعت)' },
                { term: 'metro', phonetic: '/ˈmetrəʊ/', fa: 'مترو' },
              ].map((w) => (
                <li key={w.term} className="py-2.5">
                  <div className="flex items-baseline gap-2">
                    <span className="text-sm font-bold text-text" dir="ltr">
                      {w.term}
                    </span>
                    <span className="text-xs text-muted" dir="ltr">
                      {w.phonetic}
                    </span>
                  </div>
                  <p className="text-xs text-muted mt-0.5">{w.fa}</p>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-muted leading-relaxed">
              واژه‌های کلیدی هر اپیزود با معنی فارسی، تلفظ و جملهٔ نمونه.
            </p>
          </article>

          {/* Transcript + progress */}
          <article className="rounded-2xl border border-outline-soft bg-surface p-5 sm:p-6">
            <header className="flex items-center justify-between">
              <h3 className="text-base font-bold text-text">متن اپیزود</h3>
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-success">
                <span
                  aria-hidden
                  className="inline-block w-2 h-2 rounded-full"
                  style={{ background: 'var(--color-success)' }}
                />
                ذخیره شد
              </span>
            </header>
            <p className="mt-3 text-sm leading-relaxed text-text" dir="ltr">
              Sara starts her day at half past seven. She drinks a cup of tea, checks her email…
            </p>
            <p className="mt-4 text-xs text-muted leading-relaxed">
              متن اپیزود دقیقاً همان چیزی است که می‌شنوی؛ برای خواندن هم‌زمان با صدا یا مرور بعدی.
            </p>
          </article>
        </div>

        <p className="mt-6 text-xs text-muted max-w-2xl">
          پیشرفت هر اپیزود جداگانه ذخیره می‌شود و مرور سطح‌های دیگر، سطح پیشنهادی یا پیشرفتت را تغییر
          نمی‌دهد.
        </p>
      </div>
    </section>
  );
}

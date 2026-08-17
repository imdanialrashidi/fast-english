import { AppCta } from '../components/AppCta';
import { LevelPlate } from '../components/LevelChip';
import { SAMPLE_TITLE_EN, SAMPLE_TITLE_FA } from '../content/sampleContent';

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      {/* A restrained midnight/primary wash at the top edge — tokenized
          (--color-wash-primary), never a decorative gradient wall. */}
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-72 -z-10"
        style={{
          background:
            'radial-gradient(900px 420px at 85% -10%, var(--color-wash-primary) 0%, transparent 65%)',
        }}
      />
      <div className="mx-auto max-w-6xl px-4 sm:px-6 pt-10 sm:pt-16 pb-14 sm:pb-20">
        <div className="grid lg:grid-cols-12 gap-10 lg:gap-8 items-center">
          {/* Copy column (RTL start) */}
          <div className="lg:col-span-6">
            <p className="flex items-center gap-2 text-sm font-semibold text-accent mb-4">
              <span aria-hidden className="inline-block h-px w-8 bg-accent/60" />
              پادکست یادگیری انگلیسی برای فارسی‌زبانان
            </p>
            <h1 className="text-[2rem] leading-[1.25] sm:text-5xl sm:leading-[1.2] font-extrabold tracking-tight text-text">
              یک موضوع، شش سطح — <span className="text-primary">متناسب با سطح تو</span>
            </h1>
            <p className="mt-5 text-base sm:text-lg text-muted leading-relaxed max-w-xl">
              هر اپیزود کوتاه انگلیسی در شش سطح A1 تا C2 منتشر می‌شود؛ سطح پیشنهادی‌ات را با یک آزمون
              کوتاه پیدا کن و از همان‌جایی ادامه بده که رها کرده‌ای.
            </p>
            <div className="mt-7 flex flex-col sm:flex-row gap-3">
              <AppCta
                place="hero"
                className="inline-flex items-center justify-center rounded-[10px] bg-primary px-6 py-3 text-sm font-semibold text-on-primary hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus min-h-12 shadow-interactive"
              >
                ورود به وب‌اپ — شروع یادگیری
              </AppCta>
              <a
                href="/sample"
                className="inline-flex items-center justify-center rounded-[10px] border border-outline-soft bg-surface px-6 py-3 text-sm font-semibold text-text hover:bg-surface-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus min-h-12"
              >
                دیدن نمونهٔ اپیزود
              </a>
            </div>
            <p className="mt-4 text-xs text-muted">
              ثبت‌نام، تعیین سطح و پرداخت داخل اپلیکیشن انجام می‌شود؛ این صفحه فقط محصول را معرفی
              می‌کند.
            </p>
          </div>

          {/* Product-native visual: the episode jacket (artwork + edition
              rail + deck) — the accepted Episode composition from the
              Student App, rendered as a real composition, not a screenshot. */}
          <div className="lg:col-span-6">
            <HeroJacket />
          </div>
        </div>
      </div>
    </section>
  );
}

function HeroJacket() {
  return (
    <div
      className="rounded-[24px] p-4 sm:p-6"
      style={{ background: 'var(--color-midnight)' }}
      aria-hidden
    >
      <div className="flex items-center justify-between mb-4">
        <span className="inline-flex items-center gap-2 text-xs font-medium text-ice-muted">
          <span
            className="inline-block w-2 h-2 rounded-full"
            style={{ background: 'var(--color-success)' }}
          />
          پیش‌نمایش محصول
        </span>
        <span className="text-xs font-semibold text-ice-muted" dir="ltr">
          B1 · متوسط
        </span>
      </div>

      {/* Artwork — a deterministic CSS composition (no external imagery). */}
      <div
        className="relative mx-auto max-w-[260px] rounded-[16px] overflow-hidden"
        style={{ background: 'var(--color-midnight-deep)' }}
      >
        <div className="aspect-square p-5 flex flex-col justify-between">
          <div className="flex items-start justify-between text-[0.6875rem] font-medium text-ice-muted">
            <span>اپیزود نمونه</span>
            <span dir="ltr">۱۲ دقیقه</span>
          </div>
          <div>
            <p className="text-lg font-bold text-ice leading-snug">{SAMPLE_TITLE_FA}</p>
            <p className="mt-1 text-xs text-ice-muted" dir="ltr">
              {SAMPLE_TITLE_EN}
            </p>
          </div>
          <div className="flex items-end gap-[3px] h-8">
            {WAVEFORM_HEIGHTS.map((h, i) => (
              <span
                key={i}
                className={`block w-1 rounded-sm ${i >= 7 && i <= 9 ? 'animate-wave' : ''}`}
                style={{
                  height: `${h}px`,
                  background:
                    i >= 7 && i <= 9 ? 'var(--color-accent)' : 'rgba(228, 237, 241, 0.35)',
                }}
              />
            ))}
          </div>
        </div>
        {/* Edition stripe (4px, level pair) — the CEFR-stripe motif. */}
        <div className="h-1" style={{ background: 'var(--color-cefr-b1-fg)' }} />
      </div>

      {/* Edition rail — the CEFR ladder with the current plate filled. */}
      <div className="mt-4 flex items-start justify-center gap-2 sm:gap-3">
        {['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].map((lvl) => (
          <LevelPlate
            key={lvl}
            label={lvl}
            size="sm"
            tone="dark"
            filled={lvl === 'B1'}
            marker={lvl === 'B1' ? 'پیشنهادی' : undefined}
          />
        ))}
      </div>

      {/* Deck — the player strip. */}
      <div
        className="mt-4 rounded-[16px] px-4 py-3"
        style={{ background: 'var(--color-midnight-surface)' }}
      >
        <div className="flex items-center gap-3">
          <span
            className="grid place-items-center rounded-full shrink-0"
            style={{
              width: 48,
              height: 48,
              background: 'var(--color-primary)',
              color: 'var(--color-on-primary)',
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" role="img">
              <title>پخش</title>
              <path d="M8 5.5v13l11-6.5-11-6.5z" />
            </svg>
          </span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-ice">ادامه از ۰۴:۱۲</span>
              <span className="text-ice-muted" dir="ltr">
                ۲۱٪
              </span>
            </div>
            <div
              className="mt-2 h-1.5 rounded-full"
              style={{ background: 'rgba(228, 237, 241, 0.15)' }}
            >
              <div
                className="h-1.5 rounded-full"
                style={{
                  width: '21%',
                  background: 'var(--color-primary)',
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Deterministic waveform motif. Heights are not random.
const WAVEFORM_HEIGHTS = [
  10, 16, 22, 14, 26, 20, 12, 28, 24, 30, 16, 22, 12, 18, 26, 14, 20, 24, 12, 16,
];

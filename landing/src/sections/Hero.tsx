import { ApkButton } from '../components/ApkButton';
import { AppCta } from '../components/AppCta';

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div
        aria-hidden
        className="absolute inset-0 -z-10"
        style={{
          background:
            'radial-gradient(1200px 600px at 80% -10%, rgba(124, 58, 237, 0.10) 0%, transparent 60%), radial-gradient(900px 500px at 0% 0%, rgba(37, 99, 235, 0.10) 0%, transparent 60%)',
        }}
      />
      <div className="mx-auto max-w-6xl px-4 sm:px-6 pt-10 sm:pt-16 pb-12 sm:pb-20">
        <div className="grid md:grid-cols-12 gap-8 items-center">
          <div className="md:col-span-7">
            <p className="text-sm font-semibold text-brand-primary mb-3">
              برای فارسی‌زبانان، در شش سطح
            </p>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold leading-[1.2] tracking-tight">
              یک موضوع، شش سطح، یادگیری متناسب با تو
            </h1>
            <p className="mt-4 text-base sm:text-lg text-brand-muted leading-relaxed max-w-2xl">
              متن و صوت کوتاه در سطوح A1 تا C2، پیشنهاد سطح با آزمون بیست‌سؤالی، و پیگیری پیشرفت در
              اپلیکیشن وب و اپلیکیشن اندروید.
            </p>
            <div className="mt-6 flex flex-col sm:flex-row gap-3">
              <AppCta
                place="hero"
                className="inline-flex items-center justify-center rounded-xl bg-brand-primary px-5 py-3 text-sm font-semibold text-white hover:bg-brand-primary-dark min-h-12"
              >
                ورود به وب‌اپ
              </AppCta>
              <ApkButton />
              <a
                href="/sample"
                className="inline-flex items-center justify-center rounded-xl border border-brand-divider bg-white px-5 py-3 text-sm font-semibold text-brand-text hover:bg-brand-surface min-h-12"
              >
                دیدن نمونه درس
              </a>
            </div>
            <p className="mt-3 text-xs text-brand-muted">
              ثبت‌نام و پرداخت در داخل اپلیکیشن انجام می‌شود. این صفحه فقط محصول را معرفی می‌کند.
            </p>
          </div>
          <div className="md:col-span-5">
            <HeroVisual />
          </div>
        </div>
      </div>
    </section>
  );
}

// A small original abstract visual: a midnight tile with stacked level
// stripes and a waveform motif. No external imagery, no autoplay video.
function HeroVisual() {
  const stripes = [
    { label: 'A1', bg: 'var(--color-cefr-a1-bg)', fg: 'var(--color-cefr-a1-fg)' },
    { label: 'A2', bg: 'var(--color-cefr-a2-bg)', fg: 'var(--color-cefr-a2-fg)' },
    { label: 'B1', bg: 'var(--color-cefr-b1-bg)', fg: 'var(--color-cefr-b1-fg)' },
    { label: 'B2', bg: 'var(--color-cefr-b2-bg)', fg: 'var(--color-cefr-b2-fg)' },
    { label: 'C1', bg: 'var(--color-cefr-c1-bg)', fg: 'var(--color-cefr-c1-fg)' },
    { label: 'C2', bg: 'var(--color-cefr-c2-bg)', fg: 'var(--color-cefr-c2-fg)' },
  ];
  return (
    <div
      className="rounded-2xl p-5 sm:p-6 shadow-sm"
      style={{ background: 'var(--color-brand-midnight)' }}
      aria-hidden
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2 text-white/80 text-xs">
          <span
            className="inline-block w-2 h-2 rounded-full"
            style={{ background: '#22c55e' }}
            aria-hidden
          />
          <span>اپلیکیشن — پیش‌نمایش</span>
        </div>
        <span className="text-white/60 text-xs">B1</span>
      </div>
      <div className="space-y-2">
        {stripes.map((s) => (
          <div
            key={s.label}
            className="flex items-center gap-3 rounded-lg px-3 py-2"
            style={{ background: 'rgba(255,255,255,0.06)' }}
          >
            <span
              className="inline-flex items-center justify-center rounded-md px-2 py-0.5 text-xs font-bold"
              style={{ background: s.bg, color: s.fg }}
            >
              {s.label}
            </span>
            <div
              className="flex-1 h-1.5 rounded-full"
              style={{ background: 'rgba(255,255,255,0.10)' }}
            >
              <div
                className="h-1.5 rounded-full"
                style={{
                  background: s.fg,
                  width: s.label === 'B1' ? '72%' : s.label === 'A2' ? '45%' : '20%',
                  opacity: 0.85,
                }}
              />
            </div>
            <span className="text-white/60 text-xs">
              {s.label === 'B1' ? '۷۲٪' : s.label === 'A2' ? '۴۵٪' : '۲۰٪'}
            </span>
          </div>
        ))}
      </div>
      <Waveform />
    </div>
  );
}

function Waveform() {
  // Deterministic CSS-only waveform motif. Heights are not random.
  const heights = [12, 18, 24, 16, 28, 22, 14, 30, 20, 10, 26, 18, 12, 22, 16, 24, 14, 20, 28, 12];
  return (
    <div className="mt-5 flex items-end gap-1 h-10" aria-hidden>
      {heights.map((h, i) => (
        <span
          key={i}
          className="block w-1.5 rounded-sm"
          style={{ height: `${h}px`, background: 'rgba(255,255,255,0.55)' }}
        />
      ))}
    </div>
  );
}

// landing/src/components/LevelChip.tsx
// CEFR level plate — the landing echo of the Student App's LevelBadge
// (shared/ui/tokens/cefr.ts pairs; icon+text semantics; never color alone).
// Used by the hero jacket, the edition rail and the level ladder.

export const CEFR_LEVELS = [
  { label: 'A1', bg: 'var(--color-cefr-a1-bg)', fg: 'var(--color-cefr-a1-fg)' },
  { label: 'A2', bg: 'var(--color-cefr-a2-bg)', fg: 'var(--color-cefr-a2-fg)' },
  { label: 'B1', bg: 'var(--color-cefr-b1-bg)', fg: 'var(--color-cefr-b1-fg)' },
  { label: 'B2', bg: 'var(--color-cefr-b2-bg)', fg: 'var(--color-cefr-b2-fg)' },
  { label: 'C1', bg: 'var(--color-cefr-c1-bg)', fg: 'var(--color-cefr-c1-fg)' },
  { label: 'C2', bg: 'var(--color-cefr-c2-bg)', fg: 'var(--color-cefr-c2-fg)' },
] as const;

export type CefrPlate = (typeof CEFR_LEVELS)[number];

export function plateFor(label: string): CefrPlate {
  return CEFR_LEVELS.find((p) => p.label === label) ?? CEFR_LEVELS[2];
}

/**
 * A single CEFR plate. `filled` renders the level pair as background; the
 * outlined variant is the neutral non-current state. Always carries the
 * label text (color is never the only carrier of meaning).
 */
export function LevelPlate({
  label,
  filled = false,
  size = 'md',
  marker,
  tone = 'light',
  className = '',
}: {
  label: string;
  filled?: boolean;
  size?: 'sm' | 'md' | 'lg';
  /** Optional quiet marker under/next to the plate (e.g. «پیشنهادی»). */
  marker?: string;
  /** `dark` renders the outlined variant for midnight panels (ice-muted). */
  tone?: 'light' | 'dark';
  className?: string;
}) {
  const plate = plateFor(label);
  const sizeClass =
    size === 'lg'
      ? 'min-w-12 h-12 text-sm'
      : size === 'sm'
        ? 'min-w-8 h-8 text-xs'
        : 'min-w-10 h-10 text-sm';
  const outlineColor = tone === 'dark' ? 'var(--color-ice-muted)' : 'var(--color-muted)';
  const outlineBorder = tone === 'dark' ? 'rgba(228, 237, 241, 0.25)' : 'var(--color-outline-soft)';
  return (
    <span className={`inline-flex flex-col items-center gap-1 ${className}`}>
      <span
        className={`inline-flex items-center justify-center rounded-lg font-bold ${sizeClass}`}
        style={
          filled
            ? { background: plate.bg, color: plate.fg }
            : {
                background: 'transparent',
                color: outlineColor,
                boxShadow: `inset 0 0 0 1px ${outlineBorder}`,
              }
        }
      >
        {label}
      </span>
      {marker ? (
        <span
          className={`text-[0.6875rem] font-semibold leading-none ${tone === 'dark' ? 'text-ice-muted' : 'text-muted'}`}
        >
          {marker}
        </span>
      ) : null}
    </span>
  );
}

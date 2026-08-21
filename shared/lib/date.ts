// shared/lib/date.ts
// Single source for Persian date/duration. Locale fa-IR only (product is Persian-first).
// Fallback is explicit via options; callers must choose '—' vs '' vs iso.

const PERSIAN_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];

function toPersianDigitsInline(n: number | string): string {
  const s = String(n);
  let out = '';
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch >= '0' && ch <= '9') out += PERSIAN_DIGITS[Number(ch)];
    else out += ch;
  }
  return out;
}

export function formatDateTime(
  value: string | Date | null | undefined,
  opts?: { style?: 'short' | 'long'; fallback?: string },
): string {
  const fallback = opts?.fallback ?? '—';
  if (!value) return fallback;
  try {
    const d = typeof value === 'string' ? new Date(value) : value;
    if (Number.isNaN(d.getTime())) return fallback;
    if (opts?.style === 'long') {
      return new Intl.DateTimeFormat('fa-IR', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(d);
    }
    return new Intl.DateTimeFormat('fa-IR', {
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(d);
  } catch {
    return fallback;
  }
}

export function formatDate(
  value: string | Date | null | undefined,
  opts?: { fallback?: string },
): string {
  const fallback = opts?.fallback ?? '—';
  if (!value) return fallback;
  try {
    const d = typeof value === 'string' ? new Date(value) : value;
    if (Number.isNaN(d.getTime())) return fallback;
    return new Intl.DateTimeFormat('fa-IR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(d);
  } catch {
    return fallback;
  }
}

export function formatDuration(
  totalSeconds: number | null | undefined,
  opts?: { fallback?: string },
): string {
  const fallback = opts?.fallback ?? '—';
  if (totalSeconds === null || totalSeconds === undefined) return fallback;
  if (typeof totalSeconds !== 'number' || !Number.isFinite(totalSeconds) || totalSeconds < 0)
    return fallback;
  const m = Math.floor(totalSeconds / 60);
  const s = Math.floor(totalSeconds % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function formatDurationDays(
  days: number | null | undefined,
  opts?: { fallback?: string },
): string {
  const fallback = opts?.fallback ?? '';
  if (typeof days !== 'number' || !Number.isFinite(days) || days <= 0) return fallback;
  const n = Math.trunc(days);
  return `${toPersianDigitsInline(n)} روز`;
}

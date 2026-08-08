// shared/lib/formatters.ts
// Formatting utilities shared by the Student and Admin applications
// (Podcast Slice 1). Student-only formatters stay in their feature.

const PERSIAN_DIGITS: readonly string[] = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];

function toPersianDigits(input: string | number | null | undefined): string {
  if (input === null || input === undefined) return '';
  const s = String(input);
  let out = '';
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch >= '0' && ch <= '9') {
      out += PERSIAN_DIGITS[Number(ch)];
    } else {
      out += ch;
    }
  }
  return out;
}

/**
 * Human-readable file size in Persian. Used for the receipt card
 * preview. Always returns a non-empty string for non-zero inputs.
 */
export function formatFileSize(bytes: number | null | undefined): string {
  if (typeof bytes !== 'number' || !Number.isFinite(bytes) || bytes < 0) return '';
  if (bytes === 0) return '۰ بایت';
  const units = ['بایت', 'کیلوبایت', 'مگابایت'];
  let n = bytes;
  let i = 0;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i++;
  }
  const rounded = i === 0 ? Math.trunc(n) : Math.round(n * 10) / 10;
  return `${toPersianDigits(rounded)} ${units[i]}`;
}

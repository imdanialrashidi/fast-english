// shared/lib/formatters.ts
// Formatting utilities shared by the Student and Admin applications
// (Podcast Slice 1). Student-only formatters stay in their feature.
//
// Single home for Persian digit conversion, money presentation, and
// card-last-four normalization — the app payment feature and the admin
// operator screens import from here so the two surfaces cannot drift.

const PERSIAN_DIGITS: readonly string[] = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];

const PERSIAN_TO_LATIN: Record<string, string> = {
  '۰': '0',
  '۱': '1',
  '۲': '2',
  '۳': '3',
  '۴': '4',
  '۵': '5',
  '۶': '6',
  '۷': '7',
  '۸': '8',
  '۹': '9',
};
const ARABIC_TO_LATIN: Record<string, string> = {
  '٠': '0',
  '١': '1',
  '٢': '2',
  '٣': '3',
  '٤': '4',
  '٥': '5',
  '٦': '6',
  '٧': '7',
  '٨': '8',
  '٩': '9',
};

/**
 * Convert any ASCII digit in the input to its Persian digit. All other
 * characters pass through unchanged. Returns '' for null/undefined.
 */
export function toPersianDigits(
  input: string | number | null | undefined,
  opts?: { padTo?: number },
): string {
  if (input === null || input === undefined) return '';
  let s: string;
  if (typeof input === 'number' && opts?.padTo) {
    s = String(Math.abs(input)).padStart(opts.padTo, '0');
  } else {
    s = String(input);
  }
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
 * Convert Persian/Arabic digits to Latin. All other characters pass
 * through unchanged. Ported from `app/src/lib/phone.ts`'s
 * `toLatinDigits` (the shared module must not import from app/).
 */
export function toLatinDigits(input: string | null | undefined): string {
  if (typeof input !== 'string') return '';
  let out = '';
  for (const ch of input) {
    const latin = PERSIAN_TO_LATIN[ch] ?? ARABIC_TO_LATIN[ch];
    if (latin !== undefined) out += latin;
    else out += ch;
  }
  return out;
}

/**
 * Normalize any user-typed string to Latin digits only (or empty).
 * Used by the payment form and the send path to validate the
 * sender-card-last-4 input — one function, one contract.
 */
export function normalizeLastFour(raw: string | null | undefined): string {
  if (typeof raw !== 'string') return '';
  return toLatinDigits(raw).replace(/\D/g, '');
}

/**
 * Format a non-negative integer price in Toman with Persian digits
 * and a thousands separator. Returns '' for non-finite or negative
 * input — never throws.
 *
 * @example formatToman(1234567) === '۱٬۲۳۴٬۵۶۷'
 * @example formatToman(1234, { suffix: 'تومان' }) === '۱٬۲۳۴ تومان'
 */
export function formatToman(value: number | null | undefined, opts?: { suffix?: string }): string {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    return '';
  }
  // Math.trunc to keep integer-only formatting; the server returns
  // a non-negative integer per the PB schema. We use the Persian
  // locale so the thousands separator is U+066C (Arabic comma) and
  // the digits are already Persian, no second pass needed.
  const n = Math.trunc(value);
  const digits = n.toLocaleString('fa-IR');
  return opts?.suffix ? `${digits} ${opts.suffix}` : digits;
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

// landing/src/lib/persianDigits.ts
// Deterministic Persian digit conversion for landing copy (fa-IR locale
// rendering). Never mixes Latin and Persian digits in one string.

const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹';

/** Convert an integer to Persian digits, optionally zero-padded. */
export function toPersianDigits(n: number, padTo = 0): string {
  const s = String(Math.abs(n)).padStart(padTo, '0');
  return s
    .split('')
    .map((d) => PERSIAN_DIGITS[Number(d)] ?? d)
    .join('');
}

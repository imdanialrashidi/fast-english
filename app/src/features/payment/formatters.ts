// app/src/features/payment/formatters.ts
// Pure formatting helpers for the payment feature. No React, no
// network. Safe to import from tests.

import { toLatinDigits } from '../../lib/phone';

// Persian digits — used when displaying numbers inside the RTL shell.
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
 * Format a non-negative integer price in Toman with Persian digits
 * and a thousands separator. Returns the input as-is if it is not a
 * finite number — never throws.
 *
 * @example formatToman(1234567) === '۱٬۲۳۴٬۵۶۷'
 */
export function formatToman(value: number | null | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    return '';
  }
  // Math.trunc to keep integer-only formatting; the server returns
  // a non-negative integer per the PB schema. We use the Persian
  // locale so the thousands separator is U+066C (Arabic comma) and
  // the digits are already Persian, no second pass needed.
  const n = Math.trunc(value);
  return n.toLocaleString('fa-IR');
}

/**
 * Normalize any user-typed string to four Latin digits (or empty).
 * Used by the form to validate the sender-card-last-4 input.
 */
export function normalizeLastFour(raw: string | null | undefined): string {
  if (typeof raw !== 'string') return '';
  return toLatinDigits(raw).replace(/\D/g, '');
}

/**
 * Display a last-four value as four Persian digits. Falls back to an
 * empty string for empty input. Always shows exactly four digits
 * (zero-padded) so the UI keeps a stable width.
 */
export function formatLastFour(raw: string | null | undefined): string {
  const digits = normalizeLastFour(raw);
  if (!digits) return '';
  return toPersianDigits(digits.padStart(4, '0').slice(-4));
}

/**
 * Format an Iranian card number (any length 12-32) into 4-digit
 * groups separated by U+066C (Arabic comma, RTL-safe). Non-digit
 * characters in the input are stripped first. Empty string in →
 * empty string out.
 */
export function formatCardNumber(raw: string | null | undefined): string {
  if (typeof raw !== 'string') return '';
  const digits = raw.replace(/\D/g, '');
  if (!digits) return '';
  const groups: string[] = [];
  for (let i = 0; i < digits.length; i += 4) {
    groups.push(digits.slice(i, i + 4));
  }
  // Persian-digit the digit groups, keep the Arabic comma as a
  // separator (the Arabic comma is RTL-neutral and reads correctly
  // inside an LTR numeric block).
  return groups.map((g) => toPersianDigits(g)).join('،');
}

/**
 * Format a duration in days as a short Persian phrase. Used on plan
 * cards and the status page snapshot.
 */
export function formatDurationDays(days: number | null | undefined): string {
  if (typeof days !== 'number' || !Number.isFinite(days) || days <= 0) return '';
  // Keep it simple: days are integer per the server contract.
  const n = Math.trunc(days);
  return `${toPersianDigits(n)} روز`;
}

/**
 * Format an ISO timestamp as a short Persian date+time in the
 * app's default timezone. Returns an empty string for null/invalid
 * input — never throws.
 */
export function formatPersianDateTime(iso: string | null | undefined): string {
  if (typeof iso !== 'string' || !iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  try {
    return new Intl.DateTimeFormat('fa-IR', {
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(d);
  } catch {
    // Old runtimes without fa-IR — fall back to ISO.
    return d.toISOString();
  }
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

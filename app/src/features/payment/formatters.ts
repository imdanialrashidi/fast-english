// app/src/features/payment/formatters.ts
// Pure formatting helpers for the payment feature. No React, no
// network. Safe to import from tests.
//
// Digit conversion, last-four normalization, and Toman formatting
// live in shared/lib/formatters (single home); the feature keeps its
// display helpers that are payment-specific.

import { normalizeLastFour, toPersianDigits } from '../../../../shared/lib/formatters';

export { formatToman, normalizeLastFour, toPersianDigits } from '../../../../shared/lib/formatters';

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

export { formatFileSize } from '../../../../shared/lib/formatters';

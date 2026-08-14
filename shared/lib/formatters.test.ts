// shared/lib/formatters.test.ts
// Shared contract for Persian formatting helpers — the single home for
// money/number presentation across the Student and Admin surfaces.

import { describe, expect, it } from 'vitest';
import {
  formatFileSize,
  formatToman,
  normalizeLastFour,
  toLatinDigits,
  toPersianDigits,
} from './formatters';

describe('toPersianDigits', () => {
  it('converts ASCII digits to Persian digits', () => {
    expect(toPersianDigits('0123456789')).toBe('۰۱۲۳۴۵۶۷۸۹');
    expect(toPersianDigits(1234)).toBe('۱۲۳۴');
  });
  it('passes non-digit characters through unchanged', () => {
    expect(toPersianDigits('1,000 تومان')).toBe('۱,۰۰۰ تومان');
  });
  it('returns empty for nullish input', () => {
    expect(toPersianDigits(null)).toBe('');
    expect(toPersianDigits(undefined)).toBe('');
  });
});

describe('toLatinDigits', () => {
  it('converts Persian digits to Latin', () => {
    expect(toLatinDigits('۰۱۲۳۴۵۶۷۸۹')).toBe('0123456789');
  });
  it('converts Arabic digits to Latin', () => {
    expect(toLatinDigits('٠١٢٣٤٥٦٧٨٩')).toBe('0123456789');
  });
  it('keeps ASCII digits and other characters unchanged', () => {
    expect(toLatinDigits('12-34')).toBe('12-34');
  });
});

describe('formatToman', () => {
  it('formats a non-negative integer with Persian digits and a thousands separator', () => {
    expect(formatToman(0)).toBe('۰');
    expect(formatToman(1000)).toBe('۱٬۰۰۰');
    expect(formatToman(1234567)).toBe('۱٬۲۳۴٬۵۶۷');
  });

  it('truncates fractional values to integer', () => {
    expect(formatToman(1234.9)).toBe('۱٬۲۳۴');
  });

  it('returns empty for non-finite, nullish, or negative input', () => {
    expect(formatToman(NaN)).toBe('');
    expect(formatToman(-1)).toBe('');
    expect(formatToman(null)).toBe('');
    expect(formatToman(undefined)).toBe('');
  });

  it('appends the suffix when requested (admin unit-label surface)', () => {
    expect(formatToman(1234, { suffix: 'تومان' })).toBe('۱٬۲۳۴ تومان');
    expect(formatToman(0, { suffix: 'تومان' })).toBe('۰ تومان');
    expect(formatToman(-5, { suffix: 'تومان' })).toBe('');
  });
});

describe('normalizeLastFour', () => {
  it('strips non-digits and Latinises Persian/Arabic digits', () => {
    expect(normalizeLastFour('۱۲۳۴')).toBe('1234');
    expect(normalizeLastFour('١٢٣٤')).toBe('1234');
    expect(normalizeLastFour(' 12-34 ')).toBe('1234');
    expect(normalizeLastFour('')).toBe('');
    expect(normalizeLastFour('abc')).toBe('');
    expect(normalizeLastFour(null)).toBe('');
  });
});

describe('formatFileSize', () => {
  it('renders bytes in Persian for small and 5 MB receipt sizes', () => {
    expect(formatFileSize(0)).toBe('۰ بایت');
    expect(formatFileSize(1024)).toBe('۱ کیلوبایت');
    expect(formatFileSize(5 * 1024 * 1024)).toBe('۵ مگابایت');
  });
  it('returns empty for invalid input', () => {
    expect(formatFileSize(-1)).toBe('');
    expect(formatFileSize(null)).toBe('');
  });
});

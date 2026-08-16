// app/src/features/payment/formatters.test.ts
// Pure-function tests for the payment formatters. No network, no React.

import { describe, expect, it } from 'vitest';
import {
  formatCardNumber,
  formatDurationDays,
  formatFileSize,
  formatLastFour,
  formatPersianDateTime,
  formatPlanPrice,
  formatToman,
  normalizeLastFour,
} from './formatters';

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
    expect(formatToman(-1)).toBe(''); // negative price is not a valid backend value
    expect(formatToman(null)).toBe('');
    expect(formatToman(undefined)).toBe('');
  });
});

describe('formatPlanPrice', () => {
  it('renders «رایگان» for zero toman (the canonical free-plan signal)', () => {
    expect(formatPlanPrice(0)).toBe('رایگان');
  });

  it('renders the normal Persian Toman value for positive prices', () => {
    expect(formatPlanPrice(299000)).toBe('۲۹۹٬۰۰۰');
    expect(formatPlanPrice(1000)).toBe('۱٬۰۰۰');
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

describe('formatLastFour', () => {
  it('renders exactly four Persian digits', () => {
    expect(formatLastFour('1234')).toBe('۱۲۳۴');
    expect(formatLastFour('۱۲۳۴')).toBe('۱۲۳۴');
    expect(formatLastFour('12')).toBe('۰۰۱۲');
  });
  it('returns empty for empty input', () => {
    expect(formatLastFour('')).toBe('');
    expect(formatLastFour(null)).toBe('');
  });
});

describe('formatCardNumber', () => {
  it('groups digits in fours with Arabic comma', () => {
    expect(formatCardNumber('1234567812345678')).toBe('۱۲۳۴،۵۶۷۸،۱۲۳۴،۵۶۷۸');
  });
  it('keeps non-multiple-of-4 lengths intact', () => {
    expect(formatCardNumber('12345')).toBe('۱۲۳۴،۵');
  });
  it('returns empty for empty / non-digit input', () => {
    expect(formatCardNumber('')).toBe('');
    expect(formatCardNumber(null)).toBe('');
    expect(formatCardNumber('abcd')).toBe('');
  });
  it('strips dashes and spaces', () => {
    expect(formatCardNumber('1234-5678 1234')).toBe('۱۲۳۴،۵۶۷۸،۱۲۳۴');
  });
});

describe('formatDurationDays', () => {
  it('renders integer days as Persian digits with the روز suffix', () => {
    expect(formatDurationDays(30)).toBe('۳۰ روز');
    expect(formatDurationDays(365)).toBe('۳۶۵ روز');
  });
  it('returns empty for zero or invalid', () => {
    expect(formatDurationDays(0)).toBe('');
    expect(formatDurationDays(-1)).toBe('');
    expect(formatDurationDays(null)).toBe('');
  });
});

describe('formatPersianDateTime', () => {
  it('returns empty for null/invalid', () => {
    expect(formatPersianDateTime(null)).toBe('');
    expect(formatPersianDateTime('not a date')).toBe('');
  });
  it('returns a non-empty string for a valid ISO timestamp', () => {
    const out = formatPersianDateTime('2025-01-15T08:30:00Z');
    expect(out.length).toBeGreaterThan(0);
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

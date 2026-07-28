// app/src/lib/phone.test.ts
import { describe, expect, it } from 'vitest';
import {
  isValidIranianPhone,
  normalizeIranianPhone,
  phoneToInternalEmail,
  toLatinDigits,
} from './phone';

describe('phone normalization', () => {
  it('converts Persian and Arabic-Indic digits to Latin', () => {
    expect(toLatinDigits('۰۱۲۳۴۵۶۷۸۹')).toBe('0123456789');
    expect(toLatinDigits('٠١٢٣٤٥٦٧٨٩')).toBe('0123456789');
    expect(toLatinDigits('۰۹۱۲')).toBe('0912');
  });

  it('normalizes 09XXXXXXXXX', () => {
    expect(normalizeIranianPhone('09123456789')).toBe('+989123456789');
  });

  it('normalizes 989XXXXXXXXX', () => {
    expect(normalizeIranianPhone('989123456789')).toBe('+989123456789');
  });

  it('normalizes +989XXXXXXXXX', () => {
    expect(normalizeIranianPhone('+989123456789')).toBe('+989123456789');
  });

  it('normalizes Persian-digit phones', () => {
    expect(normalizeIranianPhone('۰۹۱۲۳۴۵۶۷۸۹')).toBe('+989123456789');
  });

  it('normalizes phones with spaces and dashes', () => {
    expect(normalizeIranianPhone('0912 345 6789')).toBe('+989123456789');
    expect(normalizeIranianPhone('091-234-56789')).toBe('+989123456789');
  });

  it('strips leading 0098 prefix', () => {
    expect(normalizeIranianPhone('00989123456789')).toBe('+989123456789');
  });

  it('rejects invalid lengths', () => {
    expect(normalizeIranianPhone('091234')).toBeNull();
    expect(normalizeIranianPhone('0912345678')).toBeNull();
    expect(normalizeIranianPhone('091234567890')).toBeNull();
  });

  it('rejects numbers not starting with 9 (landline)', () => {
    expect(normalizeIranianPhone('02112345678')).toBeNull();
    expect(normalizeIranianPhone('0311234567')).toBeNull();
  });

  it('rejects empty or non-string values', () => {
    expect(normalizeIranianPhone('')).toBeNull();
    expect(normalizeIranianPhone(null)).toBeNull();
    expect(normalizeIranianPhone(undefined)).toBeNull();
    expect(normalizeIranianPhone(123 as unknown as string)).toBeNull();
  });

  it('rejects non-Iranian country codes', () => {
    expect(normalizeIranianPhone('+12025550100')).toBeNull();
    expect(normalizeIranianPhone('12025550100')).toBeNull();
  });

  it('isValidIranianPhone is consistent with normalize', () => {
    expect(isValidIranianPhone('09123456789')).toBe(true);
    expect(isValidIranianPhone('09123')).toBe(false);
  });

  it('derives the internal auth email', () => {
    expect(phoneToInternalEmail('+989123456789')).toBe('+989123456789@fep.local');
  });
});

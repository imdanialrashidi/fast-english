// admin/src/features/settings/logic.test.ts
// Business Configuration slice — validation + yearly-plan guard.

import { describe, expect, it } from 'vitest';
import {
  isYearlyPlan,
  normalizeCardNumber,
  validateDestination,
  validatePlan,
  validatePlanDraftPrice,
  validateSiteContact,
} from './logic';

describe('normalizeCardNumber', () => {
  it('strips spaces/dashes and normalizes Persian digits', () => {
    expect(normalizeCardNumber('6037 9912 3456 7890')).toBe('6037991234567890');
    expect(normalizeCardNumber('۶۰۳۷-۹۹۱۲-۳۴۵۶-۷۸۹۰')).toBe('6037991234567890');
  });
});

describe('validateDestination', () => {
  it('accepts a valid destination', () => {
    expect(
      validateDestination({ cardNumber: '6037991234567890', cardHolderName: 'T', bankName: 'B' }),
    ).toEqual({});
  });
  it('rejects a too-short card number and missing names', () => {
    const errors = validateDestination({ cardNumber: '123', cardHolderName: '', bankName: '' });
    expect(errors.cardNumber).toBeTruthy();
    expect(errors.cardHolderName).toBeTruthy();
    expect(errors.bankName).toBeTruthy();
  });
});

describe('validatePlan', () => {
  it('accepts the launch plans', () => {
    expect(
      validatePlan({ name: 'ماهانه', slug: 'monthly', durationDays: 30, priceToman: 299000 }),
    ).toEqual({});
    expect(
      validatePlan({ name: 'سه ماهه', slug: 'quarterly', durationDays: 90, priceToman: 807300 }),
    ).toEqual({});
  });
  it('rejects bad slugs and non-integer prices', () => {
    expect(
      validatePlan({ name: 'x', slug: 'Bad Slug', durationDays: 30, priceToman: 1 }).slug,
    ).toBeTruthy();
    expect(
      validatePlan({ name: 'x', slug: 'ok', durationDays: 30, priceToman: 1.5 }).priceToman,
    ).toBeTruthy();
  });
});

describe('validatePlanDraftPrice (blank must never become a FREE plan)', () => {
  it('rejects an empty/blank price field', () => {
    expect(validatePlanDraftPrice('')).toBe('قیمت الزامی است.');
    expect(validatePlanDraftPrice('   ')).toBe('قیمت الزامی است.');
  });
  it('accepts explicit zero (the intentional free-plan signal) and positive prices', () => {
    expect(validatePlanDraftPrice('0')).toBeNull();
    expect(validatePlanDraftPrice('299000')).toBeNull();
  });
  it('rejects non-integer or negative input', () => {
    expect(validatePlanDraftPrice('1.5')).toBeTruthy();
    expect(validatePlanDraftPrice('-5')).toBeTruthy();
  });
});

describe('isYearlyPlan (no annual plan anywhere)', () => {
  it('flags 365-day or yearly-slug plans', () => {
    expect(isYearlyPlan({ durationDays: 365, slug: 'annual' })).toBe(true);
    expect(isYearlyPlan({ durationDays: 30, slug: 'yearly' })).toBe(true);
  });
  it('does not flag monthly/quarterly', () => {
    expect(isYearlyPlan({ durationDays: 30, slug: 'monthly' })).toBe(false);
    expect(isYearlyPlan({ durationDays: 90, slug: 'quarterly' })).toBe(false);
  });
});

describe('validateSiteContact', () => {
  it('accepts empty (honest unset) and valid URLs', () => {
    expect(validateSiteContact('')).toEqual({});
    expect(validateSiteContact('https://t.me/fep')).toEqual({});
    expect(validateSiteContact('mailto:hi@example.com')).toEqual({});
  });
  it('rejects free text and spaces', () => {
    expect(validateSiteContact('not a url').supportContact).toBeTruthy();
    expect(validateSiteContact('0912 345').supportContact).toBeTruthy();
  });
});

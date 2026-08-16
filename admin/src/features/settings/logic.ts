// admin/src/features/settings/logic.ts
// Business Configuration slice — pure validation/derivation for the
// Business Settings surface (unit-testable, mirrors server rules).

import type { BusinessPlan } from './types';

export interface FieldErrors {
  [key: string]: string;
}

/** Strip whitespace/dashes and normalize Persian/Arabic digits. */
export function normalizeCardNumber(raw: string): string {
  const map: Record<string, string> = {
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
  let out = '';
  for (const ch of String(raw ?? '')) {
    if (ch === ' ' || ch === '-' || ch === '\u200c') continue;
    out += map[ch] ?? ch;
  }
  return out;
}

export function validateDestination(input: {
  cardNumber: string;
  cardHolderName: string;
  bankName: string;
}): FieldErrors {
  const errors: FieldErrors = {};
  const digits = normalizeCardNumber(input.cardNumber);
  if (digits.length < 12 || digits.length > 32) {
    errors.cardNumber = 'شماره کارت باید ۱۲ تا ۳۲ رقم باشد.';
  }
  if (!input.cardHolderName.trim()) {
    errors.cardHolderName = 'نام دارندهٔ کارت الزامی است.';
  }
  if (!input.bankName.trim()) {
    errors.bankName = 'نام بانک الزامی است.';
  }
  return errors;
}

export function validatePlan(input: {
  name: string;
  slug: string;
  durationDays: number;
  priceToman: number;
}): FieldErrors {
  const errors: FieldErrors = {};
  if (!input.name.trim()) errors.name = 'نام طرح الزامی است.';
  if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(input.slug)) {
    errors.slug = 'شناسه انگلیسی (slug) فقط حروف کوچک لاتین، عدد و خط تیره میپذیرد.';
  }
  if (
    !Number.isInteger(input.durationDays) ||
    input.durationDays < 1 ||
    input.durationDays > 3650
  ) {
    errors.durationDays = 'مدت باید عددی بین ۱ تا ۳۶۵۰ روز باشد.';
  }
  if (
    !Number.isInteger(input.priceToman) ||
    input.priceToman < 0 ||
    input.priceToman > 1_000_000_000
  ) {
    errors.priceToman = 'قیمت باید عدد صحیح غیرمنفی (تومان) باشد.';
  }
  return errors;
}

/**
 * The editor keeps the price as a raw STRING; `Number('') === 0`, so an
 * empty price field must be rejected BEFORE the numeric conversion — an
 * accidental blank must never silently create a FREE plan.
 */
export function validatePlanDraftPrice(rawPrice: string): string | null {
  if (rawPrice.trim() === '') return 'قیمت الزامی است.';
  const n = Number(rawPrice);
  if (!Number.isInteger(n) || n < 0 || n > 1_000_000_000) {
    return 'قیمت باید عدد صحیح غیرمنفی (تومان) باشد.';
  }
  return null;
}

export function validateSiteContact(supportContact: string): FieldErrors {
  const v = supportContact.trim();
  if (!v) return {};
  if (v.length > 300) return { supportContact: 'حداکثر ۳۰۰ کاراکتر.' };
  if (!/^(https?:\/\/|mailto:|tel:)/i.test(v) || /\s/.test(v)) {
    return { supportContact: 'آدرس معتبر (https/mailto/tel) وارد کنید یا خالی بگذارید.' };
  }
  return {};
}

/**
 * A 365-day plan is never offered: the owner-approved launch set is
 * monthly + quarterly only. Deactivating is allowed (edit), but the
 * editor never CREATES a yearly plan.
 */
export function isYearlyPlan(plan: Pick<BusinessPlan, 'durationDays' | 'slug'>): boolean {
  return plan.durationDays === 365 || plan.slug === 'yearly';
}

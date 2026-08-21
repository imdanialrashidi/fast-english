// app/src/lib/phone.ts
// Iranian phone normalization. Mirrors the server-side canonical form
// (`+989XXXXXXXXX`) used by the PocketBase hook. Used client-side for
// immediate UX feedback and to derive the internal auth identity.
export { toLatinDigits } from '../../../shared/lib/formatters';

import { toLatinDigits } from '../../../shared/lib/formatters';

const CANONICAL_PHONE = /^\+989[0-9]{9}$/;

export function normalizeIranianPhone(raw: string | undefined | null): string | null {
  if (typeof raw !== 'string') return null;
  const stripped = toLatinDigits(raw)
    .replace(/^\+/, '')
    .replace(/[\s -–—().,]/g, '')
    .replace(/\D/g, '');
  let digits = stripped;
  if (digits.startsWith('0098')) digits = digits.slice(2);
  if (digits.startsWith('98') && digits.length === 12) digits = digits.slice(2);
  if (digits.startsWith('0') && digits.length === 11) digits = digits.slice(1);
  if (digits.length !== 10) return null;
  if (!digits.startsWith('9')) return null;
  const canonical = `+98${digits}`;
  return CANONICAL_PHONE.test(canonical) ? canonical : null;
}

export function phoneToInternalEmail(phone: string): string {
  return `${phone}@fep.local`;
}

export function isValidIranianPhone(raw: string | undefined | null): boolean {
  return normalizeIranianPhone(raw) !== null;
}

export function formatIranianPhoneForDisplay(raw: string): string {
  const canonical = normalizeIranianPhone(raw);
  if (!canonical) return raw;
  // +98 912 345 6789
  return `${canonical.slice(0, 3)} ${canonical.slice(3, 6)} ${canonical.slice(6, 9)} ${canonical.slice(9)}`;
}

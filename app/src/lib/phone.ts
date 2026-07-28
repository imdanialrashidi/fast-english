// app/src/lib/phone.ts
// Iranian phone normalization. Mirrors the server-side canonical form
// (`+989XXXXXXXXX`) used by the PocketBase hook. Used client-side for
// immediate UX feedback and to derive the internal auth identity.
const CANONICAL_PHONE = /^\+989[0-9]{9}$/;
const PERSIAN_DIGITS: Record<string, string> = {
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
const ARABIC_DIGITS: Record<string, string> = {
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

export function toLatinDigits(input: string): string {
  let out = '';
  for (const ch of input) {
    if (PERSIAN_DIGITS[ch] !== undefined) out += PERSIAN_DIGITS[ch]!;
    else if (ARABIC_DIGITS[ch] !== undefined) out += ARABIC_DIGITS[ch]!;
    else out += ch;
  }
  return out;
}

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

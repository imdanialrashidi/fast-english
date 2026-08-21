// admin/src/features/payments/formatters.ts
// P1-S2 — Formatters for the operator view.
// Toman formatting lives in shared/lib/formatters; the admin call
// sites pass the unit label via the shared `suffix` option so the
// operator screens keep rendering «تومان» exactly as before.

import {
  formatDate as sharedFormatDate,
  formatDateTime as sharedFormatDateTime,
} from '../../../../shared/lib/date';

export { formatToman } from '../../../../shared/lib/formatters';

export function formatAge(seconds: number): string {
  if (seconds < 60) return `${seconds} ثانیه`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} دقیقه`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (hours < 24) return `${hours} ساعت و ${remainingMinutes} دقیقه`;
  const days = Math.floor(hours / 24);
  return `${days} روز`;
}

export function formatDateTime(iso: string | null | undefined): string {
  return sharedFormatDateTime(iso, { style: 'long', fallback: '—' });
}

export function formatDate(iso: string | null | undefined): string {
  return sharedFormatDate(iso, { fallback: '—' });
}

export function statusLabel(status: string): string {
  const map: Record<string, string> = {
    pending: 'در انتظار',
    approved: 'تأیید شده',
    rejected: 'رد شده',
    cancelled: 'لغو شده',
  };
  return map[status] ?? status;
}

export function accountStatusLabel(s: string): string {
  const map: Record<string, string> = {
    pending_payment: 'در انتظار پرداخت',
    payment_rejected: 'پرداخت رد شده',
    active: 'فعال',
    expired: 'منقضی شده',
    suspended: 'معلق',
  };
  return map[s] ?? s;
}

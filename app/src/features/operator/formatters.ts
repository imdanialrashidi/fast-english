// app/src/features/operator/formatters.ts
// P1-S2 — Formatters for the operator view.

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

export function formatToman(amount: number): string {
  try {
    return `${new Intl.NumberFormat('fa-IR').format(amount)} تومان`;
  } catch {
    return `${amount} تومان`;
  }
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return new Intl.DateTimeFormat('fa-IR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(d);
  } catch {
    return iso;
  }
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return new Intl.DateTimeFormat('fa-IR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(d);
  } catch {
    return iso;
  }
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

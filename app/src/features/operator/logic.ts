// app/src/features/operator/logic.ts
// Pure, deterministic helpers for the operator workspace. Kept free of
// React/MUI so the quality gates can test them directly.

import type { QueueStatusFilter } from './types';

export type QueueEmptyKind = 'no-pending' | 'filtered';

/**
 * Distinguish the two queue empty states:
 * - `no-pending`: the operator is viewing pending and there is genuinely
 *   nothing to review — a calm operational success state.
 * - `filtered`: filters/search produced no rows — an actionable state.
 */
export function emptyStateKind(
  statusFilter: QueueStatusFilter,
  search: string,
  totalItems: number,
): QueueEmptyKind | null {
  if (totalItems > 0) return null;
  if (statusFilter === 'pending' && !search.trim()) return 'no-pending';
  return 'filtered';
}

export interface StatusMeta {
  /** Persian label, always rendered as text (never color-only). */
  label: string;
  /** Semantic tone the chip maps onto the design tokens. */
  tone: 'pending' | 'approved' | 'rejected' | 'neutral';
  /** Icon key the component maps to a MUI icon. */
  icon: 'schedule' | 'check' | 'cancel' | 'block';
}

const STATUS_META: Record<string, StatusMeta> = {
  pending: { label: 'در انتظار', tone: 'pending', icon: 'schedule' },
  approved: { label: 'تأیید شده', tone: 'approved', icon: 'check' },
  rejected: { label: 'رد شده', tone: 'rejected', icon: 'cancel' },
  cancelled: { label: 'لغو شده', tone: 'neutral', icon: 'block' },
  // Subscription lifecycle statuses (server-owned) shown in the
  // Subscription summary chip.
  active: { label: 'فعال', tone: 'approved', icon: 'check' },
  expired: { label: 'منقضی شده', tone: 'neutral', icon: 'block' },
};

export function statusMeta(status: string): StatusMeta {
  return STATUS_META[status] ?? { label: status, tone: 'neutral', icon: 'block' };
}

/** Persian label for a Subscription lifecycle status. */
export function subscriptionStatusLabel(status: string): string {
  const map: Record<string, string> = { active: 'فعال', expired: 'منقضی شده' };
  return map[status] ?? status;
}

/** Persian description of the queue view for the heading subtitle. */
export function statusViewLabel(status: QueueStatusFilter): string {
  const map: Record<QueueStatusFilter, string> = {
    all: 'همهٔ درخواست‌ها',
    pending: 'در انتظار بررسی',
    approved: 'تأیید شده',
    rejected: 'رد شده',
    cancelled: 'لغو شده',
  };
  return map[status] ?? map.all;
}

/** True when the viewport width (px) activates the desktop split workspace.
 * Deterministic by width — never by device name. */
export function isSplitWidth(width: number, md: number): boolean {
  return width >= md;
}

// Public rejection-reason bounds (mirror the Backend contract).
export const PUBLIC_REASON_MIN = 3;
export const PUBLIC_REASON_MAX = 500;
export const INTERNAL_NOTE_MAX = 1000;

/**
 * Inline validation for the public rejection reason. Returns the Persian
 * error text for a non-empty-but-too-short value, null otherwise (an empty
 * value is left to the disabled submit button + server rule).
 */
export function publicReasonError(reason: string): string | null {
  const trimmed = reason.trim();
  if (trimmed.length > 0 && trimmed.length < PUBLIC_REASON_MIN) {
    return 'دلیل رد باید حداقل ۳ حرف باشد.';
  }
  return null;
}

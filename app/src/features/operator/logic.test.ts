// app/src/features/operator/logic.test.ts
// Deterministic operator workspace logic: queue empty-state derivation,
// status metadata, view labels, split threshold, rejection validation.

import { describe, expect, it } from 'vitest';
import {
  emptyStateKind,
  isSplitWidth,
  PUBLIC_REASON_MAX,
  PUBLIC_REASON_MIN,
  publicReasonError,
  statusMeta,
  statusViewLabel,
} from './logic';

describe('queue empty-state derivation', () => {
  it('an empty pending view is the calm no-pending state', () => {
    expect(emptyStateKind('pending', '', 0)).toBe('no-pending');
    expect(emptyStateKind('pending', '  ', 0)).toBe('no-pending');
  });

  it('an empty filtered view differs from no-pending', () => {
    expect(emptyStateKind('pending', 'QA-PEND', 0)).toBe('filtered');
    expect(emptyStateKind('rejected', '', 0)).toBe('filtered');
    expect(emptyStateKind('all', '', 0)).toBe('filtered');
  });

  it('non-empty queues have no empty state', () => {
    expect(emptyStateKind('pending', '', 3)).toBeNull();
    expect(emptyStateKind('rejected', 'x', 1)).toBeNull();
  });
});

describe('status metadata', () => {
  it('every status carries label + icon (never color alone)', () => {
    for (const s of ['pending', 'approved', 'rejected', 'cancelled']) {
      const meta = statusMeta(s);
      expect(meta.label.length).toBeGreaterThan(0);
      expect(['schedule', 'check', 'cancel', 'block']).toContain(meta.icon);
    }
    expect(statusMeta('pending').tone).toBe('pending');
    expect(statusMeta('approved').tone).toBe('approved');
    expect(statusMeta('rejected').tone).toBe('rejected');
  });

  it('unknown statuses fall back to neutral semantics', () => {
    const meta = statusMeta('something_else');
    expect(meta.tone).toBe('neutral');
    expect(meta.label).toBe('something_else');
  });
});

describe('queue view labels', () => {
  it('names every filter view in Persian', () => {
    expect(statusViewLabel('all')).toBe('همهٔ درخواست‌ها');
    expect(statusViewLabel('pending')).toBe('در انتظار بررسی');
    expect(statusViewLabel('approved')).toBe('تأیید شده');
    expect(statusViewLabel('rejected')).toBe('رد شده');
    expect(statusViewLabel('cancelled')).toBe('لغو شده');
  });
});

describe('split threshold', () => {
  it('is deterministic by width (custom theme md=768)', () => {
    expect(isSplitWidth(360, 768)).toBe(false);
    expect(isSplitWidth(430, 768)).toBe(false);
    expect(isSplitWidth(767, 768)).toBe(false);
    expect(isSplitWidth(768, 768)).toBe(true);
    expect(isSplitWidth(1024, 768)).toBe(true);
    expect(isSplitWidth(1440, 768)).toBe(true);
  });
});

describe('public rejection reason validation', () => {
  it('rejects too-short non-empty values inline', () => {
    expect(publicReasonError('ab')).toContain('۳ حرف');
    expect(publicReasonError('   x ')).toContain('۳ حرف');
  });

  it('accepts empty and valid values', () => {
    expect(publicReasonError('')).toBeNull();
    expect(publicReasonError('  ')).toBeNull();
    expect(publicReasonError('رسید نامشخص است')).toBeNull();
  });

  it('bounds match the Backend contract', () => {
    expect(PUBLIC_REASON_MIN).toBe(3);
    expect(PUBLIC_REASON_MAX).toBe(500);
  });
});

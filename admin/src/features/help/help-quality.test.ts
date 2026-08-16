// admin/src/features/help/help-quality.test.ts
// Drift guards for the static Staff Help surface: the Help route must keep
// the essential operational sections (payment workflow, status meanings,
// publishing checklist, escalation rules) and must reference the full
// Persian manuals. Status labels must reuse the canonical payment labels
// rather than inventing new wording.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { accountStatusLabel, statusLabel } from '../payments/formatters';

const routePath = resolve(process.cwd(), 'admin', 'src', 'features', 'help', 'HelpRoute.tsx');
const source = readFileSync(routePath, 'utf8');

describe('Help surface content', () => {
  it('covers the required operational sections', () => {
    expect(source).toContain('جریان پرداخت');
    expect(source).toContain('معنی وضعیت‌ها');
    expect(source).toContain('انتشار محتوا');
    expect(source).toContain('قوانین ارجاع');
  });

  it('documents the payment decision rules honestly', () => {
    expect(source).toContain('تأیید اشتباهی بازگردانی ندارد');
    expect(source).toContain('حداقل ۳ حرف');
  });

  it('uses the canonical Persian status labels', () => {
    for (const status of ['pending', 'approved', 'rejected', 'cancelled']) {
      expect(source).toContain(statusLabel(status));
    }
    for (const status of [
      'pending_payment',
      'payment_rejected',
      'active',
      'expired',
      'suspended',
    ]) {
      expect(source).toContain(accountStatusLabel(status));
    }
  });

  it('keeps the suspension state explicit', () => {
    expect(source).toContain('معلق');
    expect(source).toContain('ارجاع به مالک/مسئول فنی');
  });

  it('references the full Persian manuals instead of duplicating them', () => {
    expect(source).toContain('docs/OPERATOR_MANUAL_FA.md');
    expect(source).toContain('docs/OPERATOR_QUICK_REFERENCE_FA.md');
    expect(source).toContain('docs/LAUNCH_DAY_CHECKLIST_FA.md');
    expect(source).toContain('docs/TECHNICAL_OWNER_RUNBOOK_FA.md');
    expect(source).toContain('راهنمای کامل');
  });

  it('never sends operators to privileged tooling', () => {
    expect(source).not.toMatch(/سوپریوزر.*(رمز|رمز عبور)/);
    expect(source).toContain('رمز سوپریوزر را نمی‌گیرد');
    expect(source).not.toMatch(/systemctl|journalctl|deploy\.sh|ssh -L/);
  });
});

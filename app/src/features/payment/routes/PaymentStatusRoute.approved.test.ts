// app/src/features/payment/routes/PaymentStatusRoute.approved.test.ts
// Static guard for the approved branch of the payment status route
// (now in PaymentApprovedPanel.tsx).
//
// Contract after the Payment Experience Redesign:
//  - the approved state shows activation confirmation and ONLY
//    authoritative backend values (request snapshot + dashboard
//    subscription window — never client-computed dates);
//  - the approved panel never creates or mutates backend records
//    (no subscription creation, no direct record writes);
//  - it does not navigate to lessons or expose the receipt.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const routePath = resolve(__dirname, '../components/PaymentApprovedPanel.tsx');
const source = readFileSync(routePath, 'utf8');

describe('ApprovedPanel (Payment redesign)', () => {
  it('does NOT create or mutate backend records', () => {
    expect(source).not.toMatch(/createSubscription|createRecord|\.save\(|\.update\(/);
  });

  it('does NOT navigate to lessons', () => {
    expect(source).not.toMatch(/\/lessons/);
  });

  it('does NOT expose the receipt after approval', () => {
    expect(source).not.toContain('ReceiptPreview');
  });

  it('shows authoritative subscription values from the dashboard only', () => {
    expect(source).toContain('getDashboard');
    expect(source).toContain('startsAt');
    expect(source).toContain('expiresAt');
    // No independent date arithmetic.
    expect(source).not.toMatch(/new Date\(/);
    expect(source).not.toMatch(/Date\.now/);
  });

  it('confirms activation and offers the next primary action', () => {
    expect(source).toContain('پرداخت تأیید شد');
    expect(source).toContain('اشتراک شما فعال شده است');
    expect(source).toContain('data-testid="approved-primary-cta"');
  });
});

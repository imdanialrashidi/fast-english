// app/src/features/payment/routes/PaymentStatusRoute.approved.test.ts
// Static guard: the "approved" branch of the payment status route
// must NOT call any subscription, account-activation, or premium-
// unlock API. P1-S2 owns activation; this slice is display-only.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const routePath = resolve(__dirname, 'PaymentStatusRoute.tsx');
const source = readFileSync(routePath, 'utf8');

function extractApprovedBlock(): string {
  // Find the ApprovedPanel function and return its body.
  const start = source.indexOf('function ApprovedPanel');
  if (start < 0) throw new Error('ApprovedPanel not found');
  const bodyStart = source.indexOf('{', start);
  // Walk braces.
  let depth = 0;
  for (let i = bodyStart; i < source.length; i++) {
    if (source[i] === '{') depth++;
    else if (source[i] === '}') {
      depth--;
      if (depth === 0) return source.slice(bodyStart, i + 1);
    }
  }
  throw new Error('ApprovedPanel body not closed');
}

describe('ApprovedPanel (P1-S1C display-only)', () => {
  const block = extractApprovedBlock();

  it('does NOT call any subscription API', () => {
    expect(block).not.toMatch(/subscription/i);
  });

  it('does NOT mark the user as active', () => {
    expect(block).not.toMatch(/account_status/);
  });

  it('does NOT unlock placement', () => {
    expect(block).not.toMatch(/\/placement/);
  });

  it('does NOT unlock lessons', () => {
    expect(block).not.toMatch(/\/lessons/);
  });

  it('does NOT create a subscription record', () => {
    expect(block).not.toMatch(/createSubscription|createRecord|authRefresh/);
  });

  it('clearly states that activation is owned by P1-S2', () => {
    expect(block).toContain('P1-S2');
  });
});

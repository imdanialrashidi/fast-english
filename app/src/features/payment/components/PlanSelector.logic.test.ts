// app/src/features/payment/components/PlanSelector.logic.test.ts
// Pure availability logic for the plan selector (no DOM).
//
// Covers the accepted state matrix:
//   - free plan (priceToman === 0) is always purchasable, regardless of
//     the card-to-card toggle;
//   - paid plan is purchasable ONLY while card transfer is enabled.

import { describe, expect, it } from 'vitest';
import type { Plan } from '../types';
import { isPlanPurchasable, type PlanAvailability } from './PlanSelector';

function plan(priceToman: number): Plan {
  return {
    id: 'p1',
    name: 'P',
    slug: 'p',
    durationDays: 30,
    priceToman,
    isActive: true,
    displayOrder: 1,
    description: '',
  };
}

const enabled: PlanAvailability = { cardTransferEnabled: true };
const disabled: PlanAvailability = { cardTransferEnabled: false };

describe('isPlanPurchasable', () => {
  it('free plan + card transfer ON → purchasable', () => {
    expect(isPlanPurchasable(plan(0), enabled)).toBe(true);
  });

  it('free plan + card transfer OFF → still purchasable (free is free)', () => {
    expect(isPlanPurchasable(plan(0), disabled)).toBe(true);
  });

  it('paid plan + card transfer ON → purchasable', () => {
    expect(isPlanPurchasable(plan(299000), enabled)).toBe(true);
  });

  it('paid plan + card transfer OFF → NOT purchasable (no dead checkout)', () => {
    expect(isPlanPurchasable(plan(299000), disabled)).toBe(false);
  });
});

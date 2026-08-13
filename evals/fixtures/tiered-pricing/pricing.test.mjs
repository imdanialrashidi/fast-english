import assert from 'node:assert/strict';
import test from 'node:test';
import { orderTotal } from './pricing.mjs';

test('charges the undiscounted total below the tier', () => {
  assert.equal(orderTotal(2, 12.5), 25);
});

test('applies the discount above the tier', () => {
  assert.equal(orderTotal(11, 10), 99);
});

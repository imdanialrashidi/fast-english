// admin/src/features/payments/formatters.test.ts
// Pins the operator-surface output of the shared Toman formatter: the
// admin call sites pass the unit label via the `suffix` option, so the
// operator screens render «۱٬۲۳۴ تومان» — byte-identical to the
// pre-consolidation local implementation.

import { describe, expect, it } from 'vitest';
import { formatToman } from './formatters';

describe('admin formatToman surface', () => {
  it('renders Persian digits with the تومان suffix', () => {
    expect(formatToman(1234, { suffix: 'تومان' })).toBe('۱٬۲۳۴ تومان');
    expect(formatToman(0, { suffix: 'تومان' })).toBe('۰ تومان');
    expect(formatToman(1234567, { suffix: 'تومان' })).toBe('۱٬۲۳۴٬۵۶۷ تومان');
  });

  it('returns digits only without the suffix (student surface)', () => {
    expect(formatToman(1234)).toBe('۱٬۲۳۴');
  });
});

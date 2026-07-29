// app/src/features/payment/schemas.test.ts
// Tests for the form and wire-level Zod schemas.

import { describe, expect, it } from 'vitest';
import {
  currentRequestResponseSchema,
  paymentDestinationSchema,
  paymentFormSchema,
  planListSchema,
  planSchema,
} from './schemas';

function makeFile({ name = 'r.jpg', type = 'image/jpeg', size = 1024 } = {}): File {
  // jsdom File is just a Blob with a name. Provide an ArrayBuffer so
  // `.size` is non-zero and `.type` is honoured.
  const bytes = new Uint8Array(size);
  return new File([bytes], name, { type });
}

describe('planSchema', () => {
  it('accepts a valid plan', () => {
    const p = {
      id: 'p1',
      name: 'ماهانه',
      slug: 'monthly',
      durationDays: 30,
      priceToman: 100000,
      isActive: true,
      displayOrder: 0,
      description: '',
    };
    expect(planSchema.safeParse(p).success).toBe(true);
  });
  it('rejects negative price', () => {
    const p = {
      id: 'p1',
      name: 'n',
      slug: 's',
      durationDays: 1,
      priceToman: -1,
      isActive: true,
      displayOrder: 0,
      description: '',
    };
    expect(planSchema.safeParse(p).success).toBe(false);
  });
});

describe('planListSchema', () => {
  it('accepts a list of valid plans', () => {
    const plans = [
      {
        id: 'p1',
        name: 'n',
        slug: 's',
        durationDays: 1,
        priceToman: 0,
        isActive: true,
        displayOrder: 0,
        description: '',
      },
    ];
    expect(planListSchema.safeParse(plans).success).toBe(true);
  });
});

describe('paymentDestinationSchema', () => {
  it('accepts a valid destination', () => {
    const d = {
      cardNumber: '1234567812345678',
      cardHolderName: 'Ali',
      bankName: 'Bank',
      instructions: '',
      supportContact: '',
      reviewSlaText: '',
    };
    expect(paymentDestinationSchema.safeParse(d).success).toBe(true);
  });
  it('rejects too-short card numbers', () => {
    const d = {
      cardNumber: '1234',
      cardHolderName: 'A',
      bankName: 'B',
      instructions: '',
      supportContact: '',
      reviewSlaText: '',
    };
    expect(paymentDestinationSchema.safeParse(d).success).toBe(false);
  });
});

describe('currentRequestResponseSchema', () => {
  it('accepts { kind: "none" }', () => {
    expect(currentRequestResponseSchema.safeParse({ kind: 'none' }).success).toBe(true);
  });
  it('accepts a complete request', () => {
    const r = {
      kind: 'request',
      request: {
        id: 'r1',
        status: 'pending',
        planId: 'p1',
        planName: 'Test',
        amountToman: 1,
        durationDays: 30,
        bankReference: null,
        senderCardLast4: null,
        transferAt: null,
        publicRejectionReason: null,
        receipt: { recordId: 'r1', fileName: 'x.jpg', requiresToken: true },
        created: '2025-01-01T00:00:00Z',
        updated: '2025-01-01T00:00:00Z',
      },
    };
    expect(currentRequestResponseSchema.safeParse(r).success).toBe(true);
  });
  it('rejects malformed responses', () => {
    expect(currentRequestResponseSchema.safeParse({ kind: 'unknown' }).success).toBe(false);
    expect(currentRequestResponseSchema.safeParse({}).success).toBe(false);
  });
});

describe('paymentFormSchema', () => {
  it('rejects an empty planId', () => {
    const r = paymentFormSchema.safeParse({
      planId: '',
      receiptFile: makeFile(),
    });
    expect(r.success).toBe(false);
  });

  it('rejects a receipt with the wrong MIME type', () => {
    const r = paymentFormSchema.safeParse({
      planId: 'p1',
      receiptFile: makeFile({ type: 'application/pdf' }),
    });
    expect(r.success).toBe(false);
  });

  it('rejects a receipt over 5 MB', () => {
    const big = makeFile({ size: 5 * 1024 * 1024 + 1 });
    const r = paymentFormSchema.safeParse({ planId: 'p1', receiptFile: big });
    expect(r.success).toBe(false);
  });

  it('accepts a valid minimal form', () => {
    const r = paymentFormSchema.safeParse({
      planId: 'p1',
      receiptFile: makeFile(),
    });
    expect(r.success).toBe(true);
  });

  it('normalises Persian last-four digits', () => {
    const r = paymentFormSchema.safeParse({
      planId: 'p1',
      receiptFile: makeFile(),
      senderCardLast4: '۱۲۳۴',
    });
    expect(r.success).toBe(true);
    if (r.success) {
      // Transformed value is Latin digits.
      expect((r.data as { senderCardLast4: string }).senderCardLast4).toBe('1234');
    }
  });

  it('rejects a non-4-digit last-four', () => {
    const r = paymentFormSchema.safeParse({
      planId: 'p1',
      receiptFile: makeFile(),
      senderCardLast4: '123',
    });
    expect(r.success).toBe(false);
  });

  it('rejects bank_reference with control characters', () => {
    const r = paymentFormSchema.safeParse({
      planId: 'p1',
      receiptFile: makeFile(),
      bankReference: 'abc\u0007',
    });
    expect(r.success).toBe(false);
  });

  it('rejects transfer_at that is more than 24h in the future', () => {
    const future = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();
    const r = paymentFormSchema.safeParse({
      planId: 'p1',
      receiptFile: makeFile(),
      transferAt: future,
    });
    expect(r.success).toBe(false);
  });

  it('accepts a transfer_at in the past', () => {
    const past = new Date(Date.now() - 60_000).toISOString();
    const r = paymentFormSchema.safeParse({
      planId: 'p1',
      receiptFile: makeFile(),
      transferAt: past,
    });
    expect(r.success).toBe(true);
  });
});

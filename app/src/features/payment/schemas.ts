// app/src/features/payment/schemas.ts
// Zod runtime validators for the payment feature. The PB response
// shape is validated at the boundary; the form input is validated
// before multipart submission. We use Zod 4 (the same major version
// already in deps and used by `app/src/lib/schemas.ts`).

import { z } from 'zod';
import { MAX_RECEIPT_BYTES } from './constants';

// ----- Wire-level response schemas -----

export const planSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  slug: z.string().min(1),
  durationDays: z.number().int().positive(),
  priceToman: z.number().int().nonnegative(),
  isActive: z.boolean(),
  displayOrder: z.number().int(),
  description: z.string(),
});

export const planListSchema = z.array(planSchema);

export const paymentDestinationSchema = z.object({
  cardNumber: z.string().min(12).max(32),
  cardHolderName: z.string().min(1).max(120),
  bankName: z.string().min(1).max(120),
  instructions: z.string().max(2000),
  supportContact: z.string().max(200),
  reviewSlaText: z.string().max(200),
});

const paymentRequestBaseSchema = z.object({
  id: z.string().min(1),
  status: z.enum(['pending', 'approved', 'rejected', 'cancelled']),
  planId: z.string().min(1),
  planName: z.string().min(1),
  amountToman: z.number().int().nonnegative(),
  durationDays: z.number().int().positive(),
  bankReference: z.string().nullable(),
  senderCardLast4: z.string().nullable(),
  transferAt: z.string().nullable(),
  publicRejectionReason: z.string().nullable(),
  receipt: z.object({
    recordId: z.string().min(1),
    fileName: z.string().min(1),
    requiresToken: z.literal(true),
  }),
  created: z.string().nullable(),
  updated: z.string().nullable(),
});

export const paymentRequestSchema = paymentRequestBaseSchema;

export const currentRequestResponseSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('none') }),
  z.object({ kind: z.literal('request'), request: paymentRequestBaseSchema }),
]);

const freeSubscriptionSchema = z.object({
  id: z.string().min(1),
  planId: z.string().min(1),
  planName: z.string().min(1),
  durationDays: z.number().int().positive(),
  amountToman: z.number().int().nonnegative(),
  startsAt: z.string().min(1),
  expiresAt: z.string().min(1),
  status: z.string().min(1),
  source: z.string().min(1),
});

export const freeActivationResponseSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('activated'), subscription: freeSubscriptionSchema }),
  z.object({ kind: z.literal('already_entitled'), subscription: freeSubscriptionSchema }),
  z.object({ kind: z.literal('free_period_ended'), subscription: freeSubscriptionSchema }),
]);

// Safe API error envelope. We never trust the wire `code` or `message`
// as user-facing copy; the error mapper (`errors.ts`) is the only
// place that produces Persian messages.
export const apiErrorSchema = z
  .object({
    code: z.string().optional(),
    message: z.string().optional(),
  })
  .passthrough();

// ----- Form-level schema -----

// The intended Student payment journey is deliberately simple: choose a
// plan → see the destination card → transfer manually → upload ONE
// receipt → submit. No transaction-reference fields, banking forms or
// extra confirmation steps (Business Configuration slice). The server
// still accepts optional legacy fields for backward compatibility, but
// the Student UI no longer collects them.

const receiptFileSchema = z
  .instanceof(File, { message: 'رسید را انتخاب کنید.' })
  .refine((f) => f.size > 0, 'رسید نباید خالی باشد.')
  .refine((f) => f.size <= MAX_RECEIPT_BYTES, 'حجم رسید نباید بیشتر از ۵ مگابایت باشد.')
  .refine((f) => {
    const type = f.type.toLowerCase();
    return type === 'image/jpeg' || type === 'image/png' || type === 'image/webp';
  }, 'فرمت رسید باید JPEG، PNG یا WebP باشد.');

export const paymentFormSchema = z.object({
  planId: z.string().min(1, 'یک طرح انتخاب کنید.'),
  receiptFile: receiptFileSchema,
});

export type PaymentFormValues = z.infer<typeof paymentFormSchema>;

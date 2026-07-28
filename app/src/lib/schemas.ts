// app/src/lib/schemas.ts
// Zod schemas for auth forms. Mirror server-side validation where possible.
import { z } from 'zod';
import { isValidIranianPhone, normalizeIranianPhone } from './phone';

export const signupSchema = z
  .object({
    name: z.string().trim().min(1, 'نام الزامی است.').max(80, 'نام بسیار طولانی است.'),
    phone: z
      .string()
      .trim()
      .min(1, 'شمارهٔ موبایل الزامی است.')
      .refine(isValidIranianPhone, 'شمارهٔ موبایل معتبر نیست.'),
    email: z.string().trim().email('ایمیل معتبر نیست.').optional().or(z.literal('')),
    password: z
      .string()
      .min(8, 'رمز عبور باید حداقل ۸ کاراکتر باشد.')
      .max(200, 'رمز عبور بسیار طولانی است.'),
    passwordConfirm: z.string().min(1, 'تکرار رمز عبور الزامی است.'),
  })
  .refine((d) => d.password === d.passwordConfirm, {
    path: ['passwordConfirm'],
    message: 'تکرار رمز عبور با رمز عبور یکسان نیست.',
  });

export type SignupValues = z.infer<typeof signupSchema>;

export const loginSchema = z.object({
  phone: z
    .string()
    .trim()
    .min(1, 'شمارهٔ موبایل الزامی است.')
    .refine(isValidIranianPhone, 'شمارهٔ موبایل معتبر نیست.'),
  password: z.string().min(1, 'رمز عبور الزامی است.').max(200),
});

export type LoginValues = z.infer<typeof loginSchema>;

export { normalizeIranianPhone };

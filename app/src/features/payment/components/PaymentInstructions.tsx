// app/src/features/payment/components/PaymentInstructions.tsx
// The payment information column: approved real values (details card)
// plus concise trust/clarity content. The copy is explicit that:
//  - payment is card-to-card;
//  - the receipt is reviewed manually by an Operator;
//  - the subscription activates only after approval;
//  - duplicate submission must be avoided.
// No fabricated values, no fake security badges, no hardcoded
// review-time promises.

import CheckCircleOutlineRoundedIcon from '@mui/icons-material/CheckCircleOutlineRounded';
import { Card, CardContent, Stack, Typography } from '@mui/material';
import type { PaymentDestination, Plan } from '../types';
import { PaymentDetailsCard } from './PaymentDetailsCard';

const TRUST_POINTS = [
  'رسید باید دقیقاً با مبلغ انتقال‌یافته مطابقت داشته باشد.',
  'تصویر رسید باید خوانا و واضح باشد.',
  'فقط تصویر با فرمت JPEG، PNG یا WebP (حداکثر ۵ مگابایت) پذیرفته می‌شود.',
  'بررسی به‌صورت دستی توسط اپراتور انجام می‌شود؛ پرداخت کارت‌به‌کارت به‌صورت خودکار تأیید نمی‌شود.',
  'اشتراک فقط پس از تأیید اپراتور فعال می‌شود.',
  'هم‌زمان فقط یک درخواست در حال بررسی می‌توانید داشته باشید؛ از ارسال تکراری خودداری کنید.',
  'پس از ارسال، وضعیت بررسی در همین صفحه نمایش داده می‌شود.',
];

export function PaymentInstructions({
  plan,
  destination,
}: {
  plan: Plan | null;
  destination: PaymentDestination | null;
}) {
  return (
    <Stack spacing={2} data-testid="payment-instructions">
      <PaymentDetailsCard plan={plan} destination={destination} />
      <Card>
        <CardContent>
          <Typography component="h2" variant="h4" sx={{ mb: 1.5 }}>
            نکات مهم
          </Typography>
          <Stack spacing={1}>
            {TRUST_POINTS.map((point) => (
              <Stack key={point} direction="row" spacing={1} sx={{ alignItems: 'flex-start' }}>
                <CheckCircleOutlineRoundedIcon
                  sx={{ fontSize: 18, mt: 0.25, flexShrink: 0 }}
                  color="success"
                  aria-hidden
                />
                <Typography variant="body2" color="text.secondary">
                  {point}
                </Typography>
              </Stack>
            ))}
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  );
}

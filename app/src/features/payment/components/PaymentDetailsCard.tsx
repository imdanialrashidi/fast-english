// app/src/features/payment/components/PaymentDetailsCard.tsx
// The approved real values panel: exact amount (copyable), card
// number (LTR-isolated, screen-reader readable, copyable), cardholder
// when configured, bank, access duration and operator-supplied
// instructions. Calm, professional presentation — no alarming color
// block for ordinary payment information; the amount sits on the
// surfaceContainer role and the card number on surfaceContainerHighest.

import { Box, Card, CardContent, Stack, Typography } from '@mui/material';
import { formatCardNumber, formatDurationDays, formatToman } from '../formatters';
import type { PaymentDestination, Plan } from '../types';
import { CopyValue } from './CopyValue';

export function PaymentDetailsCard({
  plan,
  destination,
}: {
  plan: Plan | null;
  destination: PaymentDestination | null;
}) {
  const formattedCard = destination ? formatCardNumber(destination.cardNumber) : '';
  const amount = plan ? formatToman(plan.priceToman) : '';

  return (
    <Card data-testid="payment-details-card">
      <CardContent>
        <Stack spacing={2}>
          <Typography component="h2" variant="h4">
            اطلاعات پرداخت
          </Typography>

          {/* Amount — always readable, copyable for bank apps. */}
          <Box
            sx={{
              p: 2,
              borderRadius: '16px',
              backgroundColor: 'var(--mui-palette-primaryContainer)',
              border: 1,
              borderColor: 'var(--mui-palette-primaryContainer)',
            }}
            data-testid="payment-amount-block"
          >
            <Typography
              variant="caption"
              color="var(--mui-palette-onPrimaryContainer)"
              component="div"
            >
              مبلغ پرداختی
            </Typography>
            <Stack
              direction="row"
              spacing={1}
              sx={{ mt: 0.5, alignItems: 'center', flexWrap: 'wrap' }}
            >
              <Typography
                variant="h3"
                sx={{
                  fontWeight: 700,
                  color: 'var(--mui-palette-onPrimaryContainer)',
                  fontVariantNumeric: 'tabular-nums',
                }}
                data-testid="payment-amount"
              >
                {amount ? `${amount} تومان` : '—'}
              </Typography>
              {plan && amount ? (
                <CopyValue
                  value={String(plan.priceToman)}
                  label="کپی مبلغ"
                  data-testid="copy-amount"
                />
              ) : null}
            </Stack>
            {plan ? (
              <Typography
                variant="caption"
                color="var(--mui-palette-onPrimaryContainer)"
                sx={{ display: 'block', mt: 0.5 }}
              >
                دسترسی: {formatDurationDays(plan.durationDays)}
              </Typography>
            ) : null}
          </Box>

          {destination ? (
            <>
              <Box>
                <Typography variant="caption" color="text.secondary" component="div">
                  شمارهٔ کارت
                </Typography>
                <Stack
                  direction="row"
                  spacing={1}
                  sx={{ mt: 0.5, alignItems: 'center', flexWrap: 'wrap' }}
                >
                  <Typography
                    lang="en"
                    dir="ltr"
                    component="div"
                    sx={{
                      fontSize: '1.25rem',
                      fontWeight: 600,
                      letterSpacing: '0.04em',
                      fontVariantNumeric: 'tabular-nums',
                      textAlign: 'start',
                      userSelect: 'all',
                    }}
                    aria-label={`شمارهٔ کارت ${formattedCard}`}
                    data-testid="payment-card-number"
                  >
                    {formattedCard}
                  </Typography>
                  <CopyValue
                    value={destination.cardNumber}
                    label="کپی شمارهٔ کارت"
                    data-testid="copy-card"
                  />
                </Stack>
              </Box>
              {destination.cardHolderName ? (
                <Box>
                  <Typography variant="caption" color="text.secondary" component="div">
                    نام دارندهٔ کارت
                  </Typography>
                  <Typography variant="body1" sx={{ mt: 0.5 }}>
                    {destination.cardHolderName}
                  </Typography>
                </Box>
              ) : null}
              {destination.bankName ? (
                <Box>
                  <Typography variant="caption" color="text.secondary" component="div">
                    نام بانک
                  </Typography>
                  <Typography variant="body1" sx={{ mt: 0.5 }}>
                    {destination.bankName}
                  </Typography>
                </Box>
              ) : null}
              {destination.instructions ? (
                <Box>
                  <Typography variant="caption" color="text.secondary" component="div">
                    راهنمای انتقال
                  </Typography>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ mt: 0.5, whiteSpace: 'pre-line', overflowWrap: 'anywhere' }}
                  >
                    {destination.instructions}
                  </Typography>
                </Box>
              ) : null}
              {destination.supportContact ? (
                <Box>
                  <Typography variant="caption" color="text.secondary" component="div">
                    راه ارتباطی پشتیبانی
                  </Typography>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ mt: 0.5 }}
                    dir="ltr"
                    lang="en"
                  >
                    {destination.supportContact}
                  </Typography>
                </Box>
              ) : null}
              {destination.reviewSlaText ? (
                <Box>
                  <Typography variant="caption" color="text.secondary" component="div">
                    زمان تقریبی بررسی
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                    {destination.reviewSlaText}
                  </Typography>
                </Box>
              ) : null}
            </>
          ) : (
            <Typography variant="body2" color="text.secondary">
              مقصد پرداخت در حال حاضر فعال نیست. پس از فعال‌شدن، اطلاعات کارت در همین بخش نمایش داده
              می‌شود.
            </Typography>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}

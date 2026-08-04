// app/src/features/payment/components/PaymentRequestSummary.tsx
// Read-only summary rows for a payment request. Values are the
// sanitized backend snapshots; nothing here is client-computed.

import { Box, Stack, Typography } from '@mui/material';
import {
  formatDurationDays,
  formatLastFour,
  formatPersianDateTime,
  formatToman,
} from '../formatters';
import type { PaymentRequest } from '../types';

export function SummaryRow({
  label,
  value,
  ltr = false,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  ltr?: boolean;
}) {
  return (
    <Stack
      direction="row"
      spacing={2}
      sx={{ justifyContent: 'space-between', alignItems: 'flex-start', gap: 2 }}
    >
      <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0 }}>
        {label}
      </Typography>
      <Typography
        variant="body2"
        dir={ltr ? 'ltr' : undefined}
        sx={{
          fontWeight: 500,
          textAlign: 'end',
          maxWidth: '70%',
          overflowWrap: 'anywhere',
          whiteSpace: 'pre-line',
        }}
      >
        {value}
      </Typography>
    </Stack>
  );
}

/**
 * The rows that are always safe to render for a request in any
 * status. `value` stays a string so long Persian text wraps inside
 * the layout (rejection reasons wrap in the rejected panel, not here).
 */
export function PaymentRequestSummary({
  request,
  showTransferDetails = true,
}: {
  request: PaymentRequest;
  showTransferDetails?: boolean;
}) {
  return (
    <Box data-testid="payment-request-summary">
      <Stack spacing={1.5}>
        <SummaryRow label="نام طرح" value={request.planName} />
        <SummaryRow label="مبلغ" value={`${formatToman(request.amountToman)} تومان`} />
        <SummaryRow label="مدت اشتراک" value={formatDurationDays(request.durationDays)} />
        <SummaryRow label="زمان ثبت" value={formatPersianDateTime(request.created) || '—'} />
        {request.status === 'rejected' && request.updated ? (
          <SummaryRow
            label="آخرین به‌روزرسانی"
            value={formatPersianDateTime(request.updated) || '—'}
          />
        ) : null}
        {showTransferDetails && request.senderCardLast4 ? (
          <SummaryRow
            label="چهار رقم کارت مبدأ"
            value={formatLastFour(request.senderCardLast4) || '—'}
          />
        ) : null}
        {showTransferDetails && request.bankReference ? (
          <SummaryRow label="شمارهٔ پیگیری" value={request.bankReference} />
        ) : null}
        {showTransferDetails && request.transferAt ? (
          <SummaryRow label="زمان واریز" value={formatPersianDateTime(request.transferAt) || '—'} />
        ) : null}
      </Stack>
    </Box>
  );
}

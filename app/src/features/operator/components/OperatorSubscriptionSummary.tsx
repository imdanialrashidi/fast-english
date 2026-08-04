// app/src/features/operator/components/OperatorSubscriptionSummary.tsx
// Current Subscription context: the active row with the greatest expiry
// (Backend-computed), otherwise the latest row, otherwise an honest
// "no subscription" state. Read-only — never editable.

import { Stack, Typography } from '@mui/material';
import { formatDate } from '../formatters';
import { subscriptionStatusLabel } from '../logic';
import type { SubscriptionSummary } from '../types';
import { OperatorDetailRow } from './OperatorDetailRow';
import { OperatorStatusChip } from './OperatorStatusChip';

export function OperatorSubscriptionSummary({
  current,
  latest,
}: {
  current: SubscriptionSummary | null;
  latest: SubscriptionSummary | null;
}) {
  const row = current ?? latest;
  return (
    <Stack sx={{ gap: 1.5 }}>
      <Typography variant="subtitle2">اشتراک کاربر</Typography>
      {!row ? (
        <Typography variant="body2" color="text.secondary" data-testid="subscription-none">
          بدون اشتراک ثبت‌شده
        </Typography>
      ) : (
        <Stack sx={{ gap: 1.25 }}>
          <Stack sx={{ flexDirection: 'row', alignItems: 'center', gap: 1 }}>
            <OperatorStatusChip status={row.status} />
            {current ? (
              <Typography variant="caption" color="text.secondary">
                اشتراک فعال
              </Typography>
            ) : null}
          </Stack>
          <OperatorDetailRow label="پلن" value={row.planName || '—'} />
          <OperatorDetailRow label="شروع" value={formatDate(row.startsAt)} />
          <OperatorDetailRow label="پایان" value={formatDate(row.expiresAt)} />
          {!current && latest ? (
            <Typography variant="caption" color="text.secondary">
              وضعیت: {subscriptionStatusLabel(latest.status)}
            </Typography>
          ) : null}
        </Stack>
      )}
    </Stack>
  );
}

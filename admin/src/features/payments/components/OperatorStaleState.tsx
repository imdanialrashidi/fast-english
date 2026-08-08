// admin/src/features/payments/components/OperatorStaleState.tsx
// Multi-operator concurrency: another operator decided this request while
// it was open. The authoritative status has been refreshed; the stale
// action is never presented as successful. Safe audit context (who and
// when) stays visible from the refreshed detail.

import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import { Alert, Button, Stack, Typography } from '@mui/material';
import { formatDateTime } from '../formatters';
import { OperatorStatusChip } from './OperatorStatusChip';

interface Props {
  status: string;
  reviewedAt: string | null;
  reviewerName: string | null;
  onRefresh: () => void;
}

export function OperatorStaleState({ status, reviewedAt, reviewerName, onRefresh }: Props) {
  const reviewedBy =
    reviewerName && reviewedAt
      ? `${reviewerName} — ${formatDateTime(reviewedAt)}`
      : (reviewerName ?? (reviewedAt ? formatDateTime(reviewedAt) : null));

  return (
    <Alert
      severity="warning"
      role="alert"
      data-testid="operator-stale-state"
      sx={{ mb: 2 }}
      action={
        <Button
          onClick={onRefresh}
          startIcon={<RefreshRoundedIcon />}
          size="small"
          color="inherit"
          sx={{ minHeight: 44 }}
          data-testid="operator-stale-refresh"
        >
          تازه‌سازی
        </Button>
      }
    >
      <Stack sx={{ gap: 0.5 }}>
        <Typography variant="body2" sx={{ fontWeight: 700 }}>
          این درخواست قبلاً بررسی شده است
        </Typography>
        <Typography variant="body2">
          وضعیت به‌روزرسانی شد:{' '}
          <Stack component="span" sx={{ display: 'inline-flex', verticalAlign: 'middle', mx: 0.5 }}>
            <OperatorStatusChip status={status} />
          </Stack>
          اقدام شما ثبت نشده است.
        </Typography>
        {reviewedBy ? (
          <Typography variant="caption" color="text.secondary">
            بررسی‌کننده: {reviewedBy}
          </Typography>
        ) : null}
      </Stack>
    </Alert>
  );
}
